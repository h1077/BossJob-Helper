from __future__ import annotations

import re
from copy import deepcopy
from datetime import datetime
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.core.exceptions import AppException
from app.models.ai_chat import AiChatMessage, AiChatSession
from app.models.resume import Resume
from app.models.resume import ResumeVersion
from app.models.user import User
from app.schemas.ai_chat import AiChatMessageOut
from app.services.ai.chains import (
    localize_ai_text,
    resume_chat_change_repair_chain,
    resume_chat_action_reply_stream,
    resume_chat_chain,
    resume_chat_image_import_chain,
    resume_chat_intent_chain,
    resume_chat_reply_stream,
    strip_thinking_text,
)
from app.services.ai_config_service import get_active_ai_config


SECTION_LABELS = {
    "basics": "基本信息",
    "summary": "个人简介",
    "education": "教育经历",
    "skills": "专业技能",
    "work": "实习/工作经历",
    "projects": "项目经历",
    "awards": "荣誉奖项",
}
def _attachment_data(attachment: Any) -> dict[str, Any]:
    if hasattr(attachment, "model_dump"):
        return attachment.model_dump()
    if isinstance(attachment, dict):
        return attachment
    return {}


def _message_out(message: AiChatMessage) -> AiChatMessageOut:
    return AiChatMessageOut.model_validate(
        {
            "id": message.id,
            "role": message.role,
            "content": strip_thinking_text(message.content or "") if message.role == "assistant" else message.content,
            "attachments": message.attachments or [],
            "suggestions": message.suggestions or [],
            "optimized_resume_data": message.optimized_resume_data,
            "action_status": message.action_status or "none",
            "create_time": message.create_time,
        }
    )


def _clip_text(value: Any, limit: int = 600) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text if len(text) <= limit else text[:limit] + "..."


def _resume_intent_summary(resume_data: dict[str, Any] | None) -> dict[str, Any]:
    data = resume_data or {}
    basics = data.get("basics") if isinstance(data.get("basics"), dict) else {}
    sections: list[str] = []
    for key in ("summary", "education", "skills", "work", "projects", "awards", "custom_sections"):
        value = data.get(key)
        if isinstance(value, list) and value:
            sections.append(key)
        elif isinstance(value, dict) and any(str(item or "").strip() for item in value.values()):
            sections.append(key)
    return {
        "name": basics.get("name", ""),
        "target_position": basics.get("title", ""),
        "sections": sections,
        "layout_order": (data.get("layout") or {}).get("section_order", []) if isinstance(data.get("layout"), dict) else [],
    }


def _chat_intent_payload(payload: dict[str, Any]) -> dict[str, Any]:
    resume = payload.get("resume") or {}
    history = payload.get("history") or []
    attachments = payload.get("attachments") or []
    return {
        "resume": {
            "id": resume.get("id"),
            "title": resume.get("title", ""),
            "summary": _resume_intent_summary(resume.get("resume_data")),
        },
        "history": [
            {
                "role": item.get("role"),
                "content": _clip_text(item.get("content"), 500),
                "has_attachments": bool(item.get("attachments")),
            }
            for item in history[-6:]
            if isinstance(item, dict)
        ],
        "attachments": [
            {
                "name": item.get("name", ""),
                "content_type": item.get("content_type", ""),
            }
            for item in attachments
            if isinstance(item, dict)
        ],
        "pending_change": payload.get("pending_change") or {},
        "user_message": _clip_text(payload.get("user_message"), 1200),
    }


def _direct_reply_payload(payload: dict[str, Any], intent_result: Any, *, draft_reply: str = "") -> dict[str, Any]:
    reply_payload = deepcopy(payload)
    reply_payload["prepared_result"] = {
        "intent": intent_result.intent,
        "change_scope": getattr(intent_result, "change_scope", "none"),
        "target_sections": getattr(intent_result, "target_sections", []),
        "has_changes": False,
        "draft_reply": draft_reply or getattr(intent_result, "reply_hint", ""),
        "suggestions": [],
        "validation_issue": "",
    }
    return reply_payload


def _resume_preserve_snapshot(resume_data: dict[str, Any] | None) -> dict[str, Any]:
    data = resume_data or {}
    basics = data.get("basics") if isinstance(data.get("basics"), dict) else {}
    layout = data.get("layout") if isinstance(data.get("layout"), dict) else {}
    return {
        "basics": {
            "avatar": basics.get("avatar", ""),
            "custom_fields": deepcopy(basics.get("custom_fields") or []),
            "field_config": deepcopy(basics.get("field_config") or {}),
        },
        "layout": deepcopy(layout),
        "custom_sections": deepcopy(data.get("custom_sections") or []),
    }


def _chat_image_change_payload(payload: dict[str, Any], intent_result: Any) -> dict[str, Any]:
    resume = payload.get("resume") or {}
    resume_data = resume.get("resume_data") if isinstance(resume.get("resume_data"), dict) else {}
    preserve = _resume_preserve_snapshot(resume_data)
    return {
        "user_message": payload.get("user_message", ""),
        "model_intent": {
            "intent": getattr(intent_result, "intent", ""),
            "change_scope": getattr(intent_result, "change_scope", "none"),
            "target_sections": getattr(intent_result, "target_sections", []) or [],
            "reply_hint": getattr(intent_result, "reply_hint", ""),
        },
        "resume": {
            "id": resume.get("id"),
            "title": resume.get("title", ""),
            "target_position": resume.get("target_position", ""),
            "resume_data": resume_data,
        },
        "current_resume_data": resume_data,
        "current_resume_preserve": preserve,
        "attachments": payload.get("attachments") or [],
    }


def _should_use_image_change_chain(payload: dict[str, Any], intent_result: Any) -> bool:
    if getattr(intent_result, "intent", "") != "propose_change":
        return False
    if not any(isinstance(item, dict) and item.get("url") for item in payload.get("attachments") or []):
        return False
    target_sections = set(getattr(intent_result, "target_sections", []) or [])
    return not target_sections or bool(target_sections - {"basics", "layout"})


def _pending_change_reply(suggestions: list[str], *, fallback: str = "") -> str:
    clean_items = [str(item).strip() for item in suggestions if str(item or "").strip()]
    if clean_items:
        summary = "\n".join(f"- {item}" for item in clean_items[:6])
        return f"已生成一份待确认的简历修改方案：\n\n{summary}\n\n是否确认按这个方案修改？"
    return fallback or "已生成一份待确认的简历修改方案，是否确认按这个方案修改？"


def _friendly_ai_error(exc: Exception) -> str:
    raw_message = str(exc) or "AI 对话失败"
    lowered = raw_message.lower()
    if "image_url" in lowered and ("expected `text`" in lowered or "expected text" in lowered or "unknown variant" in lowered):
        return (
            "当前选择的模型接口不支持图片输入格式。"
            "请在后台关闭该模型的“支持图片输入”，或切换到真正支持图片输入的多模态模型后重试。"
        )
    if "timed out" in lowered or "timeout" in lowered:
        return "AI 模型生成超时，已记录模型调用日志，请稍后重试或调高 AI_CHAT_CHANGE_TIMEOUT"
    if "connection" in lowered:
        return "AI 服务连接失败，请检查模型配置或网络连通性"
    return raw_message


def _raise_image_reply_error(exc: Exception, image_attachments: list[dict[str, Any]]) -> None:
    if image_attachments:
        raise AppException(_friendly_ai_error(exc)) from exc


def get_or_create_chat_session(db: Session, user_id: int, resume_id: int) -> AiChatSession:
    session = db.scalar(
        select(AiChatSession)
        .where(AiChatSession.user_id == user_id, AiChatSession.resume_id == resume_id)
        .order_by(AiChatSession.id.asc())
    )
    if session:
        return session
    session = AiChatSession(user_id=user_id, resume_id=resume_id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def list_chat_messages(db: Session, user_id: int, resume_id: int, limit: int = 80) -> list[AiChatMessageOut]:
    session = get_or_create_chat_session(db, user_id, resume_id)
    messages = list(
        db.scalars(
            select(AiChatMessage)
            .where(AiChatMessage.session_id == session.id, AiChatMessage.user_id == user_id)
            .order_by(AiChatMessage.id.desc())
            .limit(limit)
        )
    )
    return [_message_out(message) for message in reversed(messages)]


def clear_chat_messages(db: Session, user_id: int, resume_id: int) -> None:
    session = get_or_create_chat_session(db, user_id, resume_id)
    db.execute(delete(AiChatMessage).where(AiChatMessage.session_id == session.id, AiChatMessage.user_id == user_id))
    session.update_time = datetime.now()
    db.add(session)
    db.commit()


def _chat_context(
    db: Session,
    user: User,
    resume: Resume,
    content: str,
    attachments: list[dict[str, Any]] | None = None,
) -> tuple[AiChatSession, str, dict[str, Any], list[dict[str, Any]]]:
    message = content.strip()
    if not message:
        raise AppException("请输入要咨询的问题")
    image_attachments = [item for item in (attachments or []) if item.get("url")]
    config = get_active_ai_config(db)
    if image_attachments and not config.supports_multimodal:
        raise AppException("当前模型未开启多模态能力，暂不支持在对话中上传图片")

    session = get_or_create_chat_session(db, user.id, resume.id)
    context_limit = max(1, min(int(config.context_messages or 12), 40))
    history = list_chat_messages(db, user.id, resume.id, limit=context_limit + 8)
    pending_change = db.scalar(
        select(AiChatMessage)
        .where(
            AiChatMessage.user_id == user.id,
            AiChatMessage.resume_id == resume.id,
            AiChatMessage.role == "assistant",
            AiChatMessage.action_status == "pending",
            AiChatMessage.optimized_resume_data.is_not(None),
        )
        .order_by(AiChatMessage.id.desc())
    )
    payload: dict[str, Any] = {
        "user": {"id": user.id, "username": user.username, "email": user.email},
        "resume": {
            "id": resume.id,
            "title": resume.title,
            "target_position": (resume.resume_data or {}).get("basics", {}).get("title", ""),
            "resume_data": resume.resume_data,
        },
        "history": [
            {
                "role": item.role,
                "content": item.content,
                "attachments": [
                    data
                    for data in (_attachment_data(attachment) for attachment in (item.attachments or []))
                    if data
                ],
            }
            for item in history[-context_limit:]
        ],
        "attachments": image_attachments,
        "pending_change": {
            "exists": pending_change is not None,
            "message_id": pending_change.id if pending_change else None,
            "summary": pending_change.suggestions if pending_change else [],
        },
        "user_message": message,
    }
    return session, message, payload, image_attachments


def _save_assistant_message(
    db: Session,
    session: AiChatSession,
    user: User,
    resume: Resume,
    reply: str,
    suggestions: list[str],
    optimized_resume_data: dict[str, Any] | None,
) -> AiChatMessageOut:
    reply = strip_thinking_text(localize_ai_text(reply or "")).strip()
    assistant_message = AiChatMessage(
        session_id=session.id,
        user_id=user.id,
        resume_id=resume.id,
        role="assistant",
        content=reply,
        suggestions=suggestions,
        optimized_resume_data=optimized_resume_data,
        action_status="pending" if optimized_resume_data else "none",
    )
    session.update_time = datetime.now()
    db.add(assistant_message)
    db.add(session)
    db.commit()
    db.refresh(assistant_message)
    return _message_out(assistant_message)


def _latest_pending_change(db: Session, user_id: int, resume_id: int) -> AiChatMessage | None:
    return db.scalar(
        select(AiChatMessage)
        .where(
            AiChatMessage.user_id == user_id,
            AiChatMessage.resume_id == resume_id,
            AiChatMessage.role == "assistant",
            AiChatMessage.action_status == "pending",
            AiChatMessage.optimized_resume_data.is_not(None),
        )
        .order_by(AiChatMessage.id.desc())
    )


def _merge_confirmed_resume_data(
    current_data: dict[str, Any] | None,
    optimized_data: dict[str, Any],
    replace_sections: set[str] | None = None,
) -> dict[str, Any]:
    """Apply the proposed content without dropping omitted resume configuration."""
    current = deepcopy(current_data or {})
    optimized = _unwrap_resume_data(optimized_data)
    merged = {**current, **optimized}
    replace_sections = replace_sections or set()

    for key in ("basics", "layout"):
        current_section = current.get(key)
        optimized_section = optimized.get(key)
        if (
            key not in replace_sections
            and isinstance(current_section, dict)
            and isinstance(optimized_section, dict)
        ):
            merged[key] = {**current_section, **optimized_section}

    return merged


_RESUME_SECTION_KEYS = {
    "basics",
    "summary",
    "education",
    "skills",
    "work",
    "projects",
    "awards",
    "custom_sections",
    "layout",
}
_RESUME_WRAPPER_KEYS = ("optimized_resume_data", "resume_data", "data", "result", "resume")


def _unwrap_resume_data(value: dict[str, Any]) -> dict[str, Any]:
    """Remove occasional model response wrappers before persisting resume JSON."""
    candidate: Any = deepcopy(value)
    for _ in range(5):
        if not isinstance(candidate, dict):
            raise AppException("AI 修改结果不是有效的简历数据")
        if _RESUME_SECTION_KEYS.intersection(candidate):
            return candidate
        nested = next(
            (
                candidate.get(key)
                for key in _RESUME_WRAPPER_KEYS
                if isinstance(candidate.get(key), dict)
            ),
            None,
        )
        if nested is None:
            break
        candidate = nested
    raise AppException("AI 修改结果缺少可写入的简历模块，请重新生成")


_NUMERIC_CLAIM_RE = re.compile(r"(?<![A-Za-z])\d+(?:\.\d+)?(?:%|\+)?")
_NUMERIC_SKIP_KEYS = {"id", "row", "order", "icon", "field_config", "layout"}


def _numeric_claim_variants(token: str) -> set[str]:
    """Treat common date normalizations as the same fact, e.g. 2025.9 -> 2025-09."""
    token = token.strip()
    if not token:
        return set()
    variants = {token}
    bare = token.rstrip("%+")
    variants.add(bare)
    if "." in bare:
        for part in bare.split("."):
            if not part:
                continue
            variants.add(part)
            if part.isdigit():
                variants.add(str(int(part)))
                if len(part) == 1:
                    variants.add(f"0{part}")
    elif bare.isdigit():
        variants.add(str(int(bare)))
        if len(bare) == 1:
            variants.add(f"0{bare}")
    return variants


def _numeric_claims(value: Any, key: str | None = None) -> set[str]:
    """Collect user-visible numeric claims while ignoring structural configuration."""
    if key in _NUMERIC_SKIP_KEYS:
        return set()
    if isinstance(value, dict):
        claims: set[str] = set()
        for child_key, child_value in value.items():
            claims.update(_numeric_claims(child_value, str(child_key)))
        return claims
    if isinstance(value, list):
        claims: set[str] = set()
        for item in value:
            claims.update(_numeric_claims(item, key))
        return claims
    if isinstance(value, str):
        claims: set[str] = set()
        for token in _NUMERIC_CLAIM_RE.findall(value):
            claims.update(_numeric_claim_variants(token))
        return claims
    return set()


def _unverified_numeric_claims(payload: dict[str, Any], optimized_data: dict[str, Any]) -> set[str]:
    # Multimodal chat can extract dates, phone numbers, and other numeric facts
    # directly from the uploaded image. The text-only evidence check cannot see
    # those pixels, so do not treat image-derived numbers as hallucinations here.
    if any(isinstance(item, dict) and item.get("url") for item in payload.get("attachments") or []):
        return set()

    source = {
        "resume_data": payload.get("resume", {}).get("resume_data") or {},
        "history": payload.get("history") or [],
        "user_message": payload.get("user_message") or "",
    }
    return _numeric_claims(optimized_data) - _numeric_claims(source)


def _validated_optimized_data(
    payload: dict[str, Any],
    current_data: dict[str, Any] | None,
    optimized_data: dict[str, Any] | None,
    replace_sections: set[str] | None = None,
) -> tuple[dict[str, Any] | None, str]:
    if not optimized_data:
        return None, ""

    merged = _merge_confirmed_resume_data(
        current_data,
        optimized_data,
        replace_sections=replace_sections,
    )
    if merged == (current_data or {}):
        return None, "模型没有生成实际内容变化，未创建待确认修改。"
    if _unverified_numeric_claims(payload, merged):
        return None, "检测到方案包含简历和对话中未提供的量化结果，已阻止写入。"
    return merged, ""


def _actual_change_suggestions(
    current_data: dict[str, Any] | None,
    optimized_data: dict[str, Any] | None,
) -> list[str]:
    if not optimized_data:
        return []
    current = current_data or {}
    suggestions: list[str] = []
    for section in ("basics", "summary", "education", "skills", "work", "projects", "awards", "custom_sections"):
        if current.get(section) == optimized_data.get(section):
            continue
        label = SECTION_LABELS.get(section, "自定义模块")
        before = current.get(section)
        after = optimized_data.get(section)
        if section == "basics" and isinstance(before, dict) and isinstance(after, dict):
            basic_labels = {
                "name": "姓名", "title": "求职方向", "status": "当前状态", "phone": "电话",
                "email": "邮箱", "location": "所在城市", "expected_salary": "期望薪资",
                "highest_degree": "最高学历", "website": "个人网站", "github": "代码仓库",
            }
            changed = [
                basic_labels[key]
                for key in basic_labels
                if before.get(key) != after.get(key)
            ]
            detail = "、".join(changed) if changed else "内容"
            suggestions.append(f"已修改：基本信息（{detail}）")
        elif isinstance(before, list) and isinstance(after, list):
            item_names = [
                str(item.get("name") or item.get("school") or item.get("company") or "").strip()
                for item in after
                if isinstance(item, dict)
            ]
            item_names = [name for name in item_names if name]
            names = "、".join(item_names[:4])
            detail = f"{len(before)} 条变为 {len(after)} 条"
            if names:
                detail += f"：{names}"
            suggestions.append(f"已修改：{label}（{detail}）")
        else:
            suggestions.append(f"已修改：{label}内容")
    before_order = (current.get("layout") or {}).get("section_order", [])
    after_order = (optimized_data.get("layout") or {}).get("section_order", [])
    if before_order != after_order:
        suggestions.append("已修改：模块展示顺序")
    return suggestions


def _model_declared_change_issue(
    result: Any,
    current_data: dict[str, Any] | None,
    optimized_data: dict[str, Any] | None,
) -> str:
    if result.intent != "propose_change":
        return ""
    if not optimized_data:
        return "模型识别到修改意图，但没有生成可写入的简历数据"

    current = current_data or {}
    target_sections = list(dict.fromkeys(result.target_sections or []))
    unchanged = [
        SECTION_LABELS.get(section, "自定义模块" if section == "custom_sections" else section)
        for section in target_sections
        if section != "layout" and current.get(section) == optimized_data.get(section)
    ]
    if unchanged:
        return "模型声明要修改但实际未变化的模块：" + "、".join(unchanged)

    before_order = (current.get("layout") or {}).get("section_order", [])
    after_order = (optimized_data.get("layout") or {}).get("section_order", [])
    if result.change_scope == "reorder" and before_order == after_order:
        return "模型识别到模块排序意图，但没有实际修改模块顺序"
    if result.change_scope == "full_replace":
        required = [section for section in target_sections if section != "layout"]
        if not required:
            return "模型识别到整份替换，但没有声明需要重建的简历模块"
    return ""


def _has_visible_section_content(value: Any) -> bool:
    if isinstance(value, dict):
        return any(_has_visible_section_content(item) for item in value.values())
    if isinstance(value, list):
        return any(_has_visible_section_content(item) for item in value)
    return bool(str(value or "").strip())


def _destructive_image_partial_issue(
    payload: dict[str, Any],
    result: Any,
    current_data: dict[str, Any] | None,
    optimized_data: dict[str, Any] | None,
) -> str:
    if not optimized_data or getattr(result, "change_scope", "") == "full_replace":
        return ""
    if not any(isinstance(item, dict) and item.get("url") for item in payload.get("attachments") or []):
        return ""

    current = current_data or {}
    cleared_sections: list[str] = []
    for section in ("summary", "education", "skills", "work", "projects", "awards", "custom_sections"):
        if _has_visible_section_content(current.get(section)) and not _has_visible_section_content(optimized_data.get(section)):
            cleared_sections.append(SECTION_LABELS.get(section, "自定义模块"))

    if not cleared_sections:
        return ""
    return (
        "模型把图片局部导入理解成了覆盖，导致已有模块被清空："
        + "、".join(cleared_sections)
        + "。图片局部导入必须基于当前简历合并，除非用户明确要求整份替换。"
    )


def _generate_checked_chat_result(
    payload: dict[str, Any],
    current_data: dict[str, Any] | None,
    initial_result: Any | None = None,
    *,
    max_repair_attempts: int = 2,
):
    result = initial_result or resume_chat_chain(payload)
    if result.intent != "propose_change":
        if max_repair_attempts <= 0:
            result.optimized_resume_data = None
            result.suggestions = []
            return result, None, ""
        repair_payload = deepcopy(payload)
        repair_payload["prior_result"] = result.model_dump() if hasattr(result, "model_dump") else {}
        repair_payload["validation_feedback"] = (
            "主助手本轮没有生成可写入的修改数据。请重新基于完整 history 和当前简历判断："
            "如果用户是在补充上一轮已确定对象的信息、要求调整顺序、要求替换或要求新增/修改/删除内容，"
            "必须生成 intent=propose_change 和完整 optimized_resume_data；"
            "如果用户只是咨询建议或普通对话，则保持 answer/clarify 且不生成修改。"
        )
        audited_result = resume_chat_change_repair_chain(repair_payload)
        if audited_result.intent == "propose_change":
            result = audited_result
            payload = repair_payload
        else:
            result = audited_result
            result.optimized_resume_data = None
            result.suggestions = []
            return result, None, ""

    if result.intent != "propose_change":
        result.optimized_resume_data = None
        result.suggestions = []
    replace_sections = (
        set(result.target_sections or [])
        if result.intent == "propose_change" and result.change_scope == "full_replace"
        else set()
    )
    optimized_data, validation_issue = _validated_optimized_data(
        payload,
        current_data,
        result.optimized_resume_data,
        replace_sections=replace_sections,
    )
    declared_issue = _model_declared_change_issue(result, current_data, optimized_data)
    destructive_issue = _destructive_image_partial_issue(payload, result, current_data, optimized_data)
    issue = declared_issue or destructive_issue or validation_issue
    if issue and max_repair_attempts > 0:
        repair_payload = deepcopy(payload)
        repair_payload["prior_result"] = result.model_dump() if hasattr(result, "model_dump") else {}
        repair_payload["validation_feedback"] = (
            issue
            + "。请重新结合完整对话生成真实可执行的数据。"
            "如果用户本轮是短确认或补充字段，要从 history 找回上一轮目标并合并生成修改；"
            "不得只口头承诺，也不得保留用户明确要求删除的旧内容。"
        )
        for _ in range(max_repair_attempts):
            result = resume_chat_change_repair_chain(repair_payload)
            if result.intent != "propose_change":
                result.optimized_resume_data = None
                result.suggestions = []
                return result, None, ""
            replace_sections = (
                set(result.target_sections or [])
                if result.change_scope == "full_replace"
                else set()
            )
            optimized_data, validation_issue = _validated_optimized_data(
                repair_payload,
                current_data,
                result.optimized_resume_data,
                replace_sections=replace_sections,
            )
            declared_issue = _model_declared_change_issue(result, current_data, optimized_data)
            destructive_issue = _destructive_image_partial_issue(repair_payload, result, current_data, optimized_data)
            issue = declared_issue or destructive_issue or validation_issue
            if not issue:
                break
            repair_payload["prior_result"] = result.model_dump() if hasattr(result, "model_dump") else {}
            repair_payload["validation_feedback"] = (
                issue
                + "。修复结果仍不可执行。请只输出能真实写入当前简历的完整数据；"
                "如果确实无法执行，请改为 clarify 并只询问唯一缺失事实。"
            )
    if issue:
        return result, None, issue
    result.suggestions = _actual_change_suggestions(current_data, optimized_data)
    return result, optimized_data, ""


def _generate_chat_change_result(
    payload: dict[str, Any],
    current_data: dict[str, Any] | None,
    intent_result: Any,
):
    if _should_use_image_change_chain(payload, intent_result):
        try:
            image_result = resume_chat_image_import_chain(_chat_image_change_payload(payload, intent_result))
            image_result, optimized_data, validation_issue = _generate_checked_chat_result(
                payload,
                current_data,
                initial_result=image_result,
                max_repair_attempts=0,
            )
            if optimized_data and not validation_issue:
                return image_result, optimized_data, ""
        except Exception:
            pass

    structured_result = resume_chat_chain(payload)
    if structured_result.intent in {"confirm_change", "reject_change"}:
        return structured_result, None, ""
    return _generate_checked_chat_result(payload, current_data, initial_result=structured_result)


def _reconsider_confirmation_without_pending(payload: dict[str, Any], result: Any):
    """Ask the model to reinterpret an apparent confirmation when no action exists."""
    if result.intent not in {"confirm_change", "reject_change"}:
        return result

    retry_payload = deepcopy(payload)
    retry_payload["validation_feedback"] = (
        "你将本轮识别成了确认或取消，但系统当前没有任何待确认修改。"
        "请重新结合完整历史判断用户是在回答普通问题、补充信息、提出新修改，还是需要澄清；"
        "不要声称已经执行过修改。"
    )
    corrected = resume_chat_chain(retry_payload)
    if corrected.intent in {"confirm_change", "reject_change"}:
        corrected.intent = "propose_change"
        corrected.change_scope = "none"
        corrected.target_sections = []
        corrected.optimized_resume_data = None
        corrected.suggestions = []
        corrected.reply = (
            "我会根据上一轮对话重新整理一份可确认的修改方案。"
            "如果上下文足够，系统会生成待确认修改；如果还缺关键信息，我会只问最关键的一项。"
        )
    return corrected


def _persist_resume_change(
    db: Session,
    user: User,
    resume: Resume,
    optimized_data: dict[str, Any],
    reason: str,
) -> dict[str, Any]:
    """Persist and verify one AI change before the assistant reports success."""
    db.add(
        ResumeVersion(
            resume_id=resume.id,
            resume_data=deepcopy(resume.resume_data),
            template_config=deepcopy(resume.template_config),
            reason=reason,
        )
    )
    before_data = deepcopy(resume.resume_data or {})
    # Pending AI changes are stored as a fully validated resume snapshot.
    next_data = deepcopy(_unwrap_resume_data(optimized_data))
    if next_data == before_data:
        raise AppException("本次方案没有产生实际内容变化，请重新生成修改")
    resume.resume_data = next_data
    flag_modified(resume, "resume_data")
    resume.update_by = user.id
    db.add(resume)
    db.flush()
    db.expire(resume, ["resume_data"])
    persisted_data = deepcopy(resume.resume_data or {})
    if persisted_data != next_data:
        db.rollback()
        raise AppException("修改写入校验失败，简历未发生变化，请重试")
    return persisted_data


def resolve_chat_change(
    db: Session,
    user: User,
    resume: Resume,
    message_id: int,
    action: str,
) -> tuple[AiChatMessageOut, dict[str, Any] | None]:
    message = db.get(AiChatMessage, message_id)
    if (
        not message
        or message.user_id != user.id
        or message.resume_id != resume.id
        or message.role != "assistant"
    ):
        raise AppException("待确认修改不存在", 404)
    if message.action_status != "pending":
        raise AppException("这次修改已经处理过了", 409)

    resume_data: dict[str, Any] | None = None
    if action == "apply":
        if not message.optimized_resume_data:
            raise AppException("这次对话没有可写入的修改")
        persisted_data = _persist_resume_change(
            db,
            user,
            resume,
            message.optimized_resume_data,
            "采纳 AI 助手修改",
        )
        message.action_status = "applied"
        resume_data = persisted_data
    elif action == "reject":
        message.action_status = "rejected"
    else:
        raise AppException("不支持的确认操作", 400)

    db.add(message)
    db.commit()
    db.refresh(message)
    return _message_out(message), resume_data


def send_chat_message(
    db: Session,
    user: User,
    resume: Resume,
    content: str,
    attachments: list[dict[str, Any]] | None = None,
) -> tuple[list[AiChatMessageOut], AiChatMessageOut]:
    session, message, payload, image_attachments = _chat_context(db, user, resume, content, attachments)
    user_message = AiChatMessage(
        session_id=session.id,
        user_id=user.id,
        resume_id=resume.id,
        role="user",
        content=message,
        attachments=image_attachments,
        suggestions=[],
        optimized_resume_data=None,
    )
    db.add(user_message)
    db.commit()

    intent_result = resume_chat_intent_chain(_chat_intent_payload(payload))
    if intent_result.intent in {"confirm_change", "reject_change"}:
        pending_change = _latest_pending_change(db, user.id, resume.id)
        if pending_change:
            action = "apply" if intent_result.intent == "confirm_change" else "reject"
            resolve_chat_change(db, user, resume, pending_change.id, action)
            reply = "修改已经写入简历。" if action == "apply" else "本次修改已取消。"
            assistant_message = _save_assistant_message(
                db, session, user, resume, reply, [], None
            )
            return list_chat_messages(db, user.id, resume.id), assistant_message
        reply = "当前没有待确认的修改。你可以告诉我想调整哪一部分，我会重新生成一份可确认的方案。"
        assistant_message = _save_assistant_message(db, session, user, resume, reply, [], None)
        return list_chat_messages(db, user.id, resume.id), assistant_message

    if intent_result.intent in {"answer", "clarify"}:
        reply_payload = _direct_reply_payload(payload, intent_result)
        reply = localize_ai_text("".join(resume_chat_reply_stream(reply_payload)).strip())
        if not reply:
            reply = intent_result.reply_hint or "我已经看过当前简历，请告诉我你想重点了解的内容。"
        assistant_message = _save_assistant_message(db, session, user, resume, reply, [], None)
        return list_chat_messages(db, user.id, resume.id), assistant_message

    result, optimized_data, validation_issue = _generate_chat_change_result(payload, resume.resume_data, intent_result)
    if result.intent in {"confirm_change", "reject_change"}:
        pending_change = _latest_pending_change(db, user.id, resume.id)
        if pending_change:
            action = "apply" if result.intent == "confirm_change" else "reject"
            resolve_chat_change(db, user, resume, pending_change.id, action)
            reply = "修改已经写入简历。" if action == "apply" else "本次修改已取消。"
            assistant_message = _save_assistant_message(db, session, user, resume, reply, [], None)
            return list_chat_messages(db, user.id, resume.id), assistant_message
        result = _reconsider_confirmation_without_pending(payload, result)
        result, optimized_data, validation_issue = _generate_checked_chat_result(
            payload, resume.resume_data, initial_result=result
        )
    suggestions = _actual_change_suggestions(resume.resume_data, optimized_data)
    reply = _pending_change_reply(suggestions, fallback=localize_ai_text(result.reply)) if optimized_data else localize_ai_text(result.reply)
    if validation_issue:
        reply = f"这次模型生成的修改没有通过执行校验：{validation_issue}。系统没有写入不完整结果。"
    assistant_message = _save_assistant_message(
        db, session, user, resume, reply, suggestions, optimized_data
    )
    return list_chat_messages(db, user.id, resume.id), assistant_message


def _chat_context_from_message(
    db: Session,
    user: User,
    resume: Resume,
    user_message: AiChatMessage,
) -> tuple[AiChatSession, str, dict[str, Any], list[dict[str, Any]]]:
    message = (user_message.content or "").strip()
    if not message:
        raise AppException("这条消息内容为空，无法重新生成")
    image_attachments = [item for item in (user_message.attachments or []) if item.get("url")]
    config = get_active_ai_config(db)
    if image_attachments and not config.supports_multimodal:
        raise AppException("当前模型未开启多模态能力，暂不支持在对话中上传图片")

    session = get_or_create_chat_session(db, user.id, resume.id)
    context_limit = max(1, min(int(config.context_messages or 12), 40))
    history = list_chat_messages(db, user.id, resume.id, limit=context_limit + 8)
    pending_change = db.scalar(
        select(AiChatMessage)
        .where(
            AiChatMessage.user_id == user.id,
            AiChatMessage.resume_id == resume.id,
            AiChatMessage.role == "assistant",
            AiChatMessage.action_status == "pending",
            AiChatMessage.optimized_resume_data.is_not(None),
        )
        .order_by(AiChatMessage.id.desc())
    )
    payload: dict[str, Any] = {
        "user": {"id": user.id, "username": user.username, "email": user.email},
        "resume": {
            "id": resume.id,
            "title": resume.title,
            "target_position": (resume.resume_data or {}).get("basics", {}).get("title", ""),
            "resume_data": resume.resume_data,
        },
        "history": [
            {
                "role": item.role,
                "content": item.content,
                "attachments": [
                    data
                    for data in (_attachment_data(attachment) for attachment in (item.attachments or []))
                    if data
                ],
            }
            for item in history[-context_limit:]
        ],
        "attachments": image_attachments,
        "pending_change": {
            "exists": pending_change is not None,
            "message_id": pending_change.id if pending_change else None,
            "summary": pending_change.suggestions if pending_change else [],
        },
        "user_message": message,
    }
    return session, message, payload, image_attachments


def stream_chat_message(
    db: Session,
    user: User,
    resume: Resume,
    content: str,
    attachments: list[dict[str, Any]] | None = None,
):
    try:
        session, message, payload, image_attachments = _chat_context(db, user, resume, content, attachments)
        user_message = AiChatMessage(
            session_id=session.id,
            user_id=user.id,
            resume_id=resume.id,
            role="user",
            content=message,
            attachments=image_attachments,
            suggestions=[],
            optimized_resume_data=None,
        )
        db.add(user_message)
        db.commit()
        db.refresh(user_message)
    except AppException as exc:
        yield {"type": "error", "message": exc.message}
        return
    except Exception as exc:
        yield {"type": "error", "message": _friendly_ai_error(exc)}
        return

    yield {"type": "start", "data": {"user_message_id": user_message.id}}
    try:
        yield {"type": "phase", "phase": "understanding_intent", "text": "正在结合对话理解你的意图"}
        intent_result = resume_chat_intent_chain(_chat_intent_payload(payload))

        if intent_result.intent in {"confirm_change", "reject_change"}:
            pending_change = _latest_pending_change(db, user.id, resume.id)
            if pending_change:
                decision = "apply" if intent_result.intent == "confirm_change" else "reject"
                resolved_message, resume_data = resolve_chat_change(
                    db, user, resume, pending_change.id, decision
                )
                action_result = {
                    "status": "applied" if decision == "apply" else "rejected",
                    "message": "修改已经写入简历" if decision == "apply" else "本次修改已取消",
                    "suggestions": resolved_message.suggestions,
                }
                reply_chunks: list[str] = []
                try:
                    for text in resume_chat_action_reply_stream({"action_result": action_result}):
                        reply_chunks.append(text)
                        yield {"type": "delta", "text": text}
                    reply = localize_ai_text("".join(reply_chunks).strip())
                except Exception:
                    reply = "修改已经写入简历。" if decision == "apply" else "本次修改已取消。"
                    yield {"type": "delta", "text": reply}
                if not reply:
                    reply = "修改已经写入简历。" if decision == "apply" else "本次修改已取消。"
                    yield {"type": "delta", "text": reply}
                confirmation = _save_assistant_message(db, session, user, resume, reply, [], None)
                yield {
                    "type": "result",
                    "data": {
                        "assistant_message": confirmation.model_dump(mode="json"),
                        "resolved_message": resolved_message.model_dump(mode="json"),
                        "resume_data": resume_data,
                    },
                }
                return

            reply = "当前没有待确认的修改。你可以告诉我想调整哪一部分，我会重新生成一份可确认的方案。"
            yield {"type": "delta", "text": reply}
            assistant_message = _save_assistant_message(db, session, user, resume, reply, [], None)
            yield {
                "type": "result",
                "data": {"assistant_message": assistant_message.model_dump(mode="json")},
            }
            return

        if intent_result.intent in {"answer", "clarify"}:
            reply_payload = _direct_reply_payload(payload, intent_result)
            yield {"type": "phase", "phase": "replying", "text": "正在组织回复"}
            reply_chunks: list[str] = []
            try:
                for text in resume_chat_reply_stream(reply_payload):
                    reply_chunks.append(text)
                    yield {"type": "delta", "text": text}
                reply = localize_ai_text("".join(reply_chunks).strip())
            except Exception as exc:
                _raise_image_reply_error(exc, image_attachments)
                reply = intent_result.reply_hint or "我已经看过当前简历，请告诉我你想重点了解的内容。"
                yield {"type": "delta", "text": reply}
            if not reply:
                reply = intent_result.reply_hint or "我已经看过当前简历，请告诉我你想重点了解的内容。"
                yield {"type": "delta", "text": reply}
            assistant_message = _save_assistant_message(db, session, user, resume, reply, [], None)
            yield {
                "type": "result",
                "data": {"assistant_message": assistant_message.model_dump(mode="json")},
            }
            return

        if _should_use_image_change_chain(payload, intent_result):
            yield {"type": "phase", "phase": "generating_change", "text": "正在识别图片并生成可确认的修改方案"}
        else:
            yield {"type": "phase", "phase": "generating_change", "text": "正在生成可确认的修改方案"}
        structured_result, optimized_data, validation_issue = _generate_chat_change_result(
            payload, resume.resume_data, intent_result
        )

        if structured_result.intent in {"confirm_change", "reject_change"}:
            pending_change = _latest_pending_change(db, user.id, resume.id)
            if pending_change:
                decision = "apply" if structured_result.intent == "confirm_change" else "reject"
                resolved_message, resume_data = resolve_chat_change(
                    db, user, resume, pending_change.id, decision
                )
                reply = "修改已经写入简历。" if decision == "apply" else "本次修改已取消。"
                yield {"type": "delta", "text": reply}
                confirmation = _save_assistant_message(db, session, user, resume, reply, [], None)
                yield {
                    "type": "result",
                    "data": {
                        "assistant_message": confirmation.model_dump(mode="json"),
                        "resolved_message": resolved_message.model_dump(mode="json"),
                        "resume_data": resume_data,
                    },
                }
                return
            structured_result = _reconsider_confirmation_without_pending(payload, structured_result)
            structured_result, optimized_data, validation_issue = _generate_checked_chat_result(
                payload, resume.resume_data, initial_result=structured_result
            )
        suggestions = _actual_change_suggestions(resume.resume_data, optimized_data)
        draft_reply = localize_ai_text(structured_result.reply)
        if validation_issue:
            draft_reply = (
                f"这次模型生成的修改没有通过执行校验：{validation_issue}。"
                "系统没有写入不完整结果。"
            )

        yield {"type": "phase", "phase": "replying", "text": "正在组织回复"}
        reply = _pending_change_reply(suggestions, fallback=draft_reply) if optimized_data else draft_reply
        if not reply:
            reply = draft_reply or "我已经看过当前简历，请告诉我你想重点调整的内容。"
        yield {"type": "delta", "text": reply}

        assistant_message = _save_assistant_message(
            db,
            session,
            user,
            resume,
            reply,
            suggestions,
            optimized_data,
        )
        yield {"type": "result", "data": {"assistant_message": assistant_message.model_dump(mode="json")}}
    except AppException as exc:
        yield {"type": "error", "message": exc.message}
    except Exception as exc:
        yield {"type": "error", "message": _friendly_ai_error(exc)}


def stream_regenerate_chat_message(
    db: Session,
    user: User,
    resume: Resume,
    message_id: int,
    override_content: str | None = None,
    override_attachments: list[dict[str, Any]] | None = None,
):
    try:
        user_message = db.get(AiChatMessage, message_id)
        if (
            not user_message
            or user_message.user_id != user.id
            or user_message.resume_id != resume.id
            or user_message.role != "user"
        ):
            raise AppException("只能重新生成自己的用户消息", 404)

        session = get_or_create_chat_session(db, user.id, resume.id)
        if override_content is not None or override_attachments is not None:
            next_content = (override_content if override_content is not None else user_message.content or "").strip()
            next_attachments = override_attachments if override_attachments is not None else (user_message.attachments or [])
            if not next_content and not next_attachments:
                raise AppException("重新生成内容不能为空")
            user_message.content = next_content or "请结合我上传的图片分析简历。"
            user_message.attachments = [_attachment_data(item) for item in next_attachments]
            flag_modified(user_message, "attachments")
            db.add(user_message)
        db.execute(
            delete(AiChatMessage).where(
                AiChatMessage.session_id == user_message.session_id,
                AiChatMessage.user_id == user.id,
                AiChatMessage.resume_id == resume.id,
                AiChatMessage.id > user_message.id,
            )
        )
        session.update_time = datetime.now()
        db.add(session)
        db.commit()
        db.refresh(user_message)

        session, message, payload, image_attachments = _chat_context_from_message(db, user, resume, user_message)
    except AppException as exc:
        yield {"type": "error", "message": exc.message}
        return
    except Exception as exc:
        yield {"type": "error", "message": _friendly_ai_error(exc)}
        return
    yield {"type": "start", "data": {"user_message_id": user_message.id}}
    try:
        yield {"type": "phase", "phase": "understanding_intent", "text": "正在重新理解这条消息"}
        intent_result = resume_chat_intent_chain(_chat_intent_payload(payload))

        if intent_result.intent in {"confirm_change", "reject_change"}:
            pending_change = _latest_pending_change(db, user.id, resume.id)
            if pending_change:
                decision = "apply" if intent_result.intent == "confirm_change" else "reject"
                resolved_message, resume_data = resolve_chat_change(
                    db, user, resume, pending_change.id, decision
                )
                action_result = {
                    "status": "applied" if decision == "apply" else "rejected",
                    "message": "修改已经写入简历" if decision == "apply" else "本次修改已取消",
                    "suggestions": resolved_message.suggestions,
                }
                reply_chunks: list[str] = []
                try:
                    for text in resume_chat_action_reply_stream({"action_result": action_result}):
                        reply_chunks.append(text)
                        yield {"type": "delta", "text": text}
                    reply = localize_ai_text("".join(reply_chunks).strip())
                except Exception:
                    reply = "修改已经写入简历。" if decision == "apply" else "本次修改已取消。"
                    yield {"type": "delta", "text": reply}
                if not reply:
                    reply = "修改已经写入简历。" if decision == "apply" else "本次修改已取消。"
                    yield {"type": "delta", "text": reply}
                confirmation = _save_assistant_message(db, session, user, resume, reply, [], None)
                yield {
                    "type": "result",
                    "data": {
                        "assistant_message": confirmation.model_dump(mode="json"),
                        "resolved_message": resolved_message.model_dump(mode="json"),
                        "resume_data": resume_data,
                    },
                }
                return

            reply = "当前没有待确认的修改。你可以告诉我想调整哪一部分，我会重新生成一份可确认的方案。"
            yield {"type": "delta", "text": reply}
            assistant_message = _save_assistant_message(db, session, user, resume, reply, [], None)
            yield {
                "type": "result",
                "data": {"assistant_message": assistant_message.model_dump(mode="json")},
            }
            return

        if intent_result.intent in {"answer", "clarify"}:
            reply_payload = _direct_reply_payload(payload, intent_result)
            yield {"type": "phase", "phase": "replying", "text": "正在组织回复"}
            reply_chunks: list[str] = []
            try:
                for text in resume_chat_reply_stream(reply_payload):
                    reply_chunks.append(text)
                    yield {"type": "delta", "text": text}
                reply = localize_ai_text("".join(reply_chunks).strip())
            except Exception as exc:
                _raise_image_reply_error(exc, image_attachments)
                reply = intent_result.reply_hint or "我已经看过当前简历，请告诉我你想重点了解的内容。"
                yield {"type": "delta", "text": reply}
            if not reply:
                reply = intent_result.reply_hint or "我已经看过当前简历，请告诉我你想重点了解的内容。"
                yield {"type": "delta", "text": reply}
            assistant_message = _save_assistant_message(db, session, user, resume, reply, [], None)
            yield {
                "type": "result",
                "data": {"assistant_message": assistant_message.model_dump(mode="json")},
            }
            return

        if _should_use_image_change_chain(payload, intent_result):
            yield {"type": "phase", "phase": "generating_change", "text": "正在识别图片并生成可确认的修改方案"}
        else:
            yield {"type": "phase", "phase": "generating_change", "text": "正在生成可确认的修改方案"}
        structured_result, optimized_data, validation_issue = _generate_chat_change_result(
            payload, resume.resume_data, intent_result
        )

        if structured_result.intent in {"confirm_change", "reject_change"}:
            pending_change = _latest_pending_change(db, user.id, resume.id)
            if pending_change:
                decision = "apply" if structured_result.intent == "confirm_change" else "reject"
                resolved_message, resume_data = resolve_chat_change(
                    db, user, resume, pending_change.id, decision
                )
                reply = "修改已经写入简历。" if decision == "apply" else "本次修改已取消。"
                yield {"type": "delta", "text": reply}
                confirmation = _save_assistant_message(db, session, user, resume, reply, [], None)
                yield {
                    "type": "result",
                    "data": {
                        "assistant_message": confirmation.model_dump(mode="json"),
                        "resolved_message": resolved_message.model_dump(mode="json"),
                        "resume_data": resume_data,
                    },
                }
                return
            structured_result = _reconsider_confirmation_without_pending(payload, structured_result)
            structured_result, optimized_data, validation_issue = _generate_checked_chat_result(
                payload, resume.resume_data, initial_result=structured_result
            )
        suggestions = _actual_change_suggestions(resume.resume_data, optimized_data)
        draft_reply = localize_ai_text(structured_result.reply)
        if validation_issue:
            draft_reply = (
                f"这次模型生成的修改没有通过执行校验：{validation_issue}。"
                "系统没有写入不完整结果。"
            )

        yield {"type": "phase", "phase": "replying", "text": "正在组织回复"}
        reply = _pending_change_reply(suggestions, fallback=draft_reply) if optimized_data else draft_reply
        if not reply:
            reply = draft_reply or "我已经看过当前简历，请告诉我你想重点调整的内容。"
        yield {"type": "delta", "text": reply}

        assistant_message = _save_assistant_message(
            db,
            session,
            user,
            resume,
            reply,
            suggestions,
            optimized_data,
        )
        yield {"type": "result", "data": {"assistant_message": assistant_message.model_dump(mode="json")}}
    except AppException as exc:
        yield {"type": "error", "message": exc.message}
    except Exception as exc:
        yield {"type": "error", "message": _friendly_ai_error(exc)}
