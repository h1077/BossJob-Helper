import base64
import json
import logging
import re
import time
import uuid
from copy import deepcopy
from io import BytesIO
from pathlib import Path
from typing import Any, Optional, TypeVar
from urllib.parse import unquote, urlparse

from langchain_core.messages import HumanMessage
from PIL import Image, ImageOps
from pydantic import BaseModel, ValidationError

from app.core.config import settings
from app.core.exceptions import AppException
from app.services.ai.llm import get_llm
from app.services.ai.prompts import (
    CHAT_ACTION_REPLY_PROMPT,
    CHAT_CHANGE_REPAIR_PROMPT,
    CHAT_IMAGE_IMPORT_PROMPT,
    CHAT_INTENT_PROMPT,
    GENERATE_RESUME_PROMPT,
    IMPORT_RESUME_PROMPT,
    CHAT_RESUME_REPLY_PROMPT,
    CHAT_RESUME_PROMPT,
    JD_OPTIMIZE_PROMPT,
    JSON_REPAIR_PROMPT,
    OPTIMIZE_SECTION_PROMPT,
    RESUME_TRANSLATE_PROMPT,
    SCORE_RESUME_PROMPT,
)
from app.services.ai.schemas import (
    JdOptimizeResult,
    ResumeChatIntentResult,
    ResumeGenerateResult,
    ResumeTranslateResult,
    ResumeChatResult,
    ResumeScoreResult,
    SectionOptimizeResult,
)
from app.services.ai.token_usage import (
    model_usage_from_message,
    prompt_to_text,
    record_extra_input_tokens,
    record_model_output,
    record_model_usage,
    record_prompt_input,
    stringify_for_tokens,
)
from app.services.resume_locale import (
    detect_resume_language,
    localized_section_title,
    normalize_resume_language,
    resolve_resume_language,
    resume_locale,
)
from app.services.storage.storage_service import read_uploaded_file

T = TypeVar("T", bound=BaseModel)
MODEL_IO_LOGGER_NAME = "vitaflow.ai.model_io"
MODEL_IO_REDACTED_KEYS = {
    "api_key",
    "authorization",
    "access_token",
    "refresh_token",
    "password",
    "secret",
    "token",
}

BUILT_IN_SECTIONS = ["basics", "summary", "education", "skills", "work", "projects", "awards"]
BUILT_IN_TITLES = {
    "basics": "基本信息",
    "summary": "个人简介",
    "education": "教育经历",
    "skills": "专业技能",
    "work": "工作经历",
    "projects": "项目经历",
    "awards": "荣誉奖项",
}
DEFAULT_FIELD_CONFIG = {
    "phone": {"label": "电话", "icon": "Phone", "row": 1, "order": 1},
    "email": {"label": "邮箱", "icon": "Mail", "row": 1, "order": 2},
    "status": {"label": "当前状态", "icon": "Info", "row": 1, "order": 3},
    "location": {"label": "地点", "icon": "MapPin", "row": 1, "order": 4},
    "highest_degree": {"label": "最高学历", "icon": "GraduationCap", "row": 2, "order": 1},
    "website": {"label": "个人网站", "icon": "Globe", "row": 2, "order": 2},
    "github": {"label": "代码仓库", "icon": "Github", "row": 2, "order": 3},
    "expected_salary": {"label": "期望薪资", "icon": "Briefcase", "row": 2, "order": 4},
}

SCORE_DIMENSIONS = [
    ("信息完整度", 0.10),
    ("岗位匹配度", 0.20),
    ("项目经历质量", 0.20),
    ("技能表达质量", 0.15),
    ("语言专业度", 0.15),
    ("结构清晰度", 0.10),
    ("ATS 友好度", 0.10),
]

CHAT_CHANGE_SCOPES = {"none", "partial", "full_replace", "reorder"}
CHAT_TARGET_SECTIONS = {
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
CHAT_SECTION_ALIASES = {
    "basic": "basics",
    "profile": "basics",
    "personal_info": "basics",
    "基本信息": "basics",
    "个人信息": "basics",
    "个人简介": "summary",
    "自我评价": "summary",
    "教育": "education",
    "教育经历": "education",
    "技能": "skills",
    "专业技能": "skills",
    "工作": "work",
    "工作经历": "work",
    "实习经历": "work",
    "项目": "projects",
    "项目经历": "projects",
    "奖项": "awards",
    "荣誉奖项": "awards",
    "自定义模块": "custom_sections",
    "布局": "layout",
    "模块顺序": "layout",
}
CHAT_NONE_SCOPE_ALIASES = {
    "",
    "answer",
    "clarify",
    "no_change",
    "nochange",
    "unchanged",
    "null",
    "none",
}
CHAT_PARTIAL_SCOPE_ALIASES = {
    "add",
    "append",
    "create",
    "delete",
    "edit",
    "insert",
    "modify",
    "partial",
    "remove",
    "replace",
    "update",
    "新增",
    "删除",
    "修改",
    "局部修改",
}
CHAT_FULL_REPLACE_SCOPE_ALIASES = {
    "all",
    "entire",
    "full",
    "full_replace",
    "overwrite",
    "replace_all",
    "整份替换",
    "全部替换",
}
CHAT_REORDER_SCOPE_ALIASES = {
    "layout",
    "move",
    "order",
    "reorder",
    "sort",
    "调整顺序",
    "重排",
}
SUPPORTED_CHAT_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_CHAT_IMAGES_PER_REQUEST = 4
FALLBACK_CHAT_IMAGE_INPUT_TOKENS = 512
CHAT_IMAGE_MAX_SIDE = 1600
CHAT_IMAGE_JPEG_QUALITY = 82


def _model_io_log_path() -> Path:
    path = Path(settings.ai_model_io_log_path)
    return path if path.is_absolute() else settings.backend_root / path


def _model_io_logger() -> logging.Logger | None:
    if not settings.ai_model_io_log_enabled:
        return None
    logger = logging.getLogger(MODEL_IO_LOGGER_NAME)
    if not logger.handlers:
        log_path = _model_io_log_path()
        log_path.parent.mkdir(parents=True, exist_ok=True)
        handler = logging.FileHandler(log_path, encoding="utf-8")
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger


def _clip_model_log_text(value: Any) -> str:
    text = stringify_for_tokens(value)
    max_chars = int(settings.ai_model_io_log_max_chars or 200000)
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars]}\n...[truncated {len(text) - max_chars} chars]"


def _sanitize_model_log_value(value: Any) -> Any:
    if isinstance(value, dict):
        sanitized: dict[str, Any] = {}
        for key, item in value.items():
            key_text = str(key)
            if key_text.lower() in MODEL_IO_REDACTED_KEYS:
                sanitized[key_text] = "[redacted]"
            else:
                sanitized[key_text] = _sanitize_model_log_value(item)
        return sanitized
    if isinstance(value, list):
        return [_sanitize_model_log_value(item) for item in value]
    if isinstance(value, str):
        if value.startswith("data:image/"):
            return f"[inline image data url, {len(value)} chars]"
        return value
    return value


def _write_model_io_log(entry: dict[str, Any]) -> None:
    logger = _model_io_logger()
    if not logger:
        return
    safe_entry = _sanitize_model_log_value(entry)
    try:
        logger.info(_clip_model_log_text(safe_entry))
    except Exception:
        logging.getLogger(__name__).warning("Failed to write AI model IO log", exc_info=True)


def _chat_result_timeout(schema: type[BaseModel]) -> int | None:
    return int(settings.ai_chat_change_timeout) if schema is ResumeChatResult else None


def _model_call_start(
    label: str,
    prompt: Any,
    variables: dict[str, Any],
    *,
    schema: type[BaseModel] | None = None,
    image_count: int = 0,
    timeout: int | None = None,
) -> tuple[str, float]:
    call_id = uuid.uuid4().hex[:12]
    started_at = time.perf_counter()
    entry = {
        "event": "start",
        "call_id": call_id,
        "label": label,
        "schema": schema.__name__ if schema else "",
        "timeout_seconds": timeout,
        "image_count": image_count,
        "input": prompt_to_text(prompt, variables),
    }
    _write_model_io_log(entry)
    return call_id, started_at


def _model_call_output(call_id: str, label: str, started_at: float, output: Any, *, raw_output: Any = None) -> None:
    elapsed_ms = int((time.perf_counter() - started_at) * 1000)
    _write_model_io_log(
        {
            "event": "output",
            "call_id": call_id,
            "label": label,
            "elapsed_ms": elapsed_ms,
            "output": output,
            "raw_output": raw_output if raw_output is not None else output,
        }
    )


def _model_call_error(
    call_id: str,
    label: str,
    started_at: float,
    exc: Exception,
    *,
    partial_output: Any = "",
) -> None:
    elapsed_ms = int((time.perf_counter() - started_at) * 1000)
    _write_model_io_log(
        {
            "event": "error",
            "call_id": call_id,
            "label": label,
            "elapsed_ms": elapsed_ms,
            "error_type": exc.__class__.__name__,
            "error": str(exc),
            "partial_output": partial_output,
        }
    )


def _strip_json_fence(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _remove_trailing_commas(text: str) -> str:
    return re.sub(r",(\s*[}\]])", r"\1", text)


def _decode_json_candidate(text: str) -> Any:
    decoder = json.JSONDecoder()
    last_error: Optional[json.JSONDecodeError] = None
    candidates = [_strip_json_fence(text)]
    for opener in ("{", "["):
        index = text.find(opener)
        if index >= 0:
            candidate = text[index:]
            if candidate not in candidates:
                candidates.append(candidate)
    for candidate in candidates:
        for cleaned in (candidate, _remove_trailing_commas(candidate)):
            cleaned = _strip_json_fence(cleaned)
            if not cleaned:
                continue
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError as exc:
                last_error = exc
            try:
                data, _ = decoder.raw_decode(cleaned)
                return data
            except json.JSONDecodeError as exc:
                last_error = exc
    if last_error:
        raise AppException(f"AI 输出不是合法 JSON，请重试：{last_error.msg}")
    raise AppException("AI 输出不是合法 JSON，请重试")


def _parse_json_content(content: Any) -> dict[str, Any]:
    if isinstance(content, dict):
        data = content
    else:
        text = _strip_json_fence(str(content))
        data = _decode_json_candidate(text)
    if not isinstance(data, dict):
        raise AppException("AI 输出 JSON 顶层必须是对象")
    return data


def _repair_json_content(content: Any, task: str) -> dict[str, Any]:
    repair_chain = JSON_REPAIR_PROMPT | get_llm()
    variables = {"task": task, "raw_content": str(content)[:12000]}
    record_prompt_input(JSON_REPAIR_PROMPT, variables, "JSON 修复")
    repaired = repair_chain.invoke(variables)
    record_model_usage(repaired, "JSON 修复")
    record_model_output(getattr(repaired, "content", repaired), "JSON 修复")
    try:
        return _parse_json_content(getattr(repaired, "content", repaired))
    except AppException as exc:
        raise AppException(f"AI 输出 JSON 修复失败：{exc.message}") from exc


def _stringify_summary(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        if isinstance(value.get("content"), str):
            return value["content"]
        return json.dumps(value, ensure_ascii=False)
    if value is None:
        return ""
    return str(value)


def _safe_int(value: Any, default: int = 0) -> int:
    if isinstance(value, bool):
        return default
    if isinstance(value, (int, float)):
        number = float(value)
        if 0 < number <= 1:
            number *= 100
        return int(round(number))
    if isinstance(value, str):
        match = re.search(r"\d+(?:\.\d+)?", value)
        if match:
            number = float(match.group(0))
            if 0 < number <= 1:
                number *= 100
            return int(round(number))
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if item is not None and str(item).strip()]
    if isinstance(value, dict):
        items: list[str] = []
        for key, item in value.items():
            if isinstance(item, list):
                items.extend(str(entry) for entry in item if entry is not None and str(entry).strip())
            elif item is not None and str(item).strip():
                items.append(f"{key}：{item}")
        return items
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _normalize_chat_change_scope(data: dict[str, Any]) -> None:
    """Translate a clear model intent into the small wire-protocol enum."""
    raw_scope = data.get("change_scope")
    scope = "" if raw_scope is None else str(raw_scope).strip()
    normalized_scope = re.sub(r"[\s-]+", "_", scope.lower())

    target_sections: list[str] = []
    for raw_target in _string_list(data.get("target_sections", [])):
        normalized_target = re.sub(r"[\s-]+", "_", raw_target.strip().lower())
        target = CHAT_SECTION_ALIASES.get(normalized_target, normalized_target)
        if target in CHAT_TARGET_SECTIONS and target not in target_sections:
            target_sections.append(target)
    section = CHAT_SECTION_ALIASES.get(normalized_scope, normalized_scope)
    if section in CHAT_TARGET_SECTIONS:
        if section not in target_sections:
            target_sections.append(section)
        normalized_scope = "reorder" if section == "layout" else "partial"
    elif normalized_scope in CHAT_NONE_SCOPE_ALIASES:
        normalized_scope = "none"
    elif normalized_scope in CHAT_PARTIAL_SCOPE_ALIASES:
        normalized_scope = "partial"
    elif normalized_scope in CHAT_FULL_REPLACE_SCOPE_ALIASES:
        normalized_scope = "full_replace"
    elif normalized_scope in CHAT_REORDER_SCOPE_ALIASES:
        normalized_scope = "reorder"
    elif normalized_scope not in CHAT_CHANGE_SCOPES:
        normalized_scope = "partial" if isinstance(data.get("optimized_resume_data") or data.get("resume_data"), dict) else "none"

    data["change_scope"] = normalized_scope
    data["target_sections"] = target_sections


def _clean_score_text(value: Any) -> Any:
    if isinstance(value, str):
        result = value
        noisy_patterns = [
            r"简历评价[^\n。；;]*[。；;]?",
            r"简历内容本身[^\n。；;]*[。；;]?",
            r"简历使用\s*JSON\s*格式[，,、。；;\s]*",
            r"JSON\s*格式[，,、。；;\s]*",
            r"JSON\s*格式[^\n。；;]*[。；;]?",
            r"字段命名规范[，,、。；;\s]*",
            r"字段命名[^\n。；;]*[。；;]?",
            r"内部字段[^\n。；;]*[。；;]?",
            r"数据结构[^\n。；;]*[。；;]?",
            r"schema[^\n。；;]*[。；;]?",
        ]
        for pattern in noisy_patterns:
            result = re.sub(pattern, "", result, flags=re.IGNORECASE)
        return result.strip(" ，,。；;\n")
    if isinstance(value, list):
        return [_clean_score_text(item) for item in value]
    if isinstance(value, dict):
        return {key: _clean_score_text(item) for key, item in value.items()}
    return value


FIELD_LABELS = {
    "basics": "基本信息",
    "summary": "个人简介",
    "education": "教育经历",
    "skills": "专业技能",
    "work": "工作经历",
    "projects": "项目经历",
    "awards": "荣誉奖项",
    "name": "姓名",
    "title": "求职方向",
    "status": "当前状态",
    "phone": "电话",
    "email": "邮箱",
    "location": "所在城市",
    "expected_salary": "期望薪资",
    "highest_degree": "最高学历",
    "website": "个人网站",
    "github": "代码仓库",
    "school": "学校",
    "major": "专业",
    "degree": "学历",
    "start_date": "开始时间",
    "end_date": "结束时间",
    "description": "描述",
    "highlights": "亮点",
    "keywords": "关键词",
    "tech_stack": "技术栈",
    "field_config": "基本信息展示配置",
    "highlight": "亮点",
    "content": "内容",
    "resume_data": "简历内容",
    "optimized_resume_data": "优化后的简历内容",
}


def _localize_field_names(value: Any) -> Any:
    if isinstance(value, str):
        result = value
        for key, label in sorted(FIELD_LABELS.items(), key=lambda item: len(item[0]), reverse=True):
            result = re.sub(rf"(?<![A-Za-z0-9_]){re.escape(key)}(?![A-Za-z0-9_])", label, result)
        return result
    if isinstance(value, list):
        return [_localize_field_names(item) for item in value]
    if isinstance(value, dict):
        return {key: _localize_field_names(item) for key, item in value.items()}
    return value


def localize_ai_text(value: str) -> str:
    result = value
    user_hidden_fields = {
        "optimized_resume_data": "优化后的简历内容",
        "resume_data": "简历内容",
        "field_config": "基本信息展示配置",
        "highest_degree": "最高学历",
        "start_date": "开始时间",
        "end_date": "结束时间",
        "tech_stack": "技术栈",
        "description": "描述",
        "highlights": "亮点",
        "highlight": "亮点",
        "keywords": "关键词",
        "basics": "基本信息",
        "summary": "个人简介",
        "skills": "专业技能",
        "projects": "项目经历",
    }
    for key, label in sorted(user_hidden_fields.items(), key=lambda item: len(item[0]), reverse=True):
        result = re.sub(rf"(?<![A-Za-z0-9_]){re.escape(key)}(?![A-Za-z0-9_])", label, result, flags=re.IGNORECASE)
    return result


def _normalize_score_detail(value: Any, fallback_dimension: str = "评分维度") -> dict[str, Any]:
    if not isinstance(value, dict):
        score = _safe_int(value, 0)
        comment = "" if score else str(value)
        return {"dimension": fallback_dimension, "score": max(0, min(score, 100)), "max_score": 100, "comment": _clean_score_text(_localize_field_names(comment))}
    comment = (
        value.get("comment")
        or value.get("suggestion")
        or value.get("advice")
        or value.get("reason")
        or value.get("analysis")
        or value.get("feedback")
        or value.get("description")
        or value.get("问题")
        or value.get("建议")
        or ""
    )
    score = _safe_int(value.get("score", value.get("得分", value.get("points", value.get("value", 0)))), 0)
    max_score = _safe_int(value.get("max_score", value.get("max", value.get("满分", value.get("total", 100)))), 100) or 100
    if max_score != 100 and max_score > 0:
        score = int(round(score / max_score * 100))
        max_score = 100
    score = max(0, min(score, max_score))
    return {
        "dimension": _localize_field_names(str(value.get("dimension") or value.get("name") or fallback_dimension)),
        "score": score,
        "max_score": max_score,
        "comment": _clean_score_text(_localize_field_names(_stringify_summary(comment))),
    }


def _looks_like_resume_data(data: dict[str, Any]) -> bool:
    return "basics" in data and "layout" in data


def _normalize_resume_data(data: dict[str, Any], payload: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    data = data if isinstance(data, dict) else {}
    requested_language = (payload or {}).get("language")
    language = normalize_resume_language(
        requested_language or detect_resume_language(json.dumps(data, ensure_ascii=False))
    )
    locale = resume_locale(language)
    basics = data.setdefault("basics", {})
    if not isinstance(basics, dict):
        basics = {}
        data["basics"] = basics
    basics.setdefault("avatar", "")
    if not isinstance(basics.get("custom_fields"), list):
        basics["custom_fields"] = []
    field_config = basics.get("field_config")
    if not isinstance(field_config, dict):
        field_config = {}
        basics["field_config"] = field_config
    for key, cfg in DEFAULT_FIELD_CONFIG.items():
        current = field_config.get(key)
        if not isinstance(current, dict):
            current = {}
        default_label = locale["field_config"].get(key) or cfg["label"]
        field_config[key] = {**cfg, "label": default_label, **current}

    summary = data.setdefault("summary", {"content": ""})
    if isinstance(summary, str):
        data["summary"] = {"content": summary}
    elif not isinstance(summary, dict):
        data["summary"] = {"content": ""}
    else:
        summary.setdefault("content", "")

    for key in ["education", "skills", "work", "projects", "awards", "custom_sections"]:
        if not isinstance(data.get(key), list):
            data[key] = []
    custom_ids = [
        item.get("id")
        for item in data.get("custom_sections", [])
        if isinstance(item, dict) and item.get("id")
    ]

    layout = data.setdefault("layout", {})
    if not isinstance(layout.get("field_labels"), dict):
        layout["field_labels"] = {}
    layout["hidden_sections"] = [key for key in layout.get("hidden_sections", []) if key != "basics"] if isinstance(layout.get("hidden_sections"), list) else []
    section_order = layout.get("section_order")
    allowed_sections = [*BUILT_IN_SECTIONS, *custom_ids]
    layout["section_order"] = [
        key for key in section_order if key in allowed_sections
    ] if isinstance(section_order, list) and section_order else allowed_sections.copy()
    for key in allowed_sections:
        if key not in layout["section_order"]:
            layout["section_order"].append(key)
    layout["section_order"] = ["basics"] + [key for key in layout["section_order"] if key != "basics"]
    section_titles = layout.setdefault("section_titles", {})
    for key in BUILT_IN_TITLES:
        section_titles[key] = localized_section_title(key, section_titles.get(key), language)
    for item in data.get("custom_sections", []):
        if isinstance(item, dict) and item.get("id"):
            section_titles.setdefault(item["id"], item.get("title") or "自定义模块")
    return data


def _merge_section_entries(source: list[Any], candidate: Any) -> list[Any]:
    if not isinstance(candidate, list):
        return deepcopy(source)
    candidate_by_id = {
        str(item.get("id")): item
        for item in candidate
        if isinstance(item, dict) and item.get("id") not in (None, "")
    }
    merged: list[Any] = []
    for index, original in enumerate(source):
        replacement: Any = None
        if isinstance(original, dict) and original.get("id") not in (None, ""):
            replacement = candidate_by_id.get(str(original.get("id")))
        if replacement is None and index < len(candidate):
            indexed = candidate[index]
            if not isinstance(original, dict) or not isinstance(indexed, dict) or not original.get("id") or not indexed.get("id"):
                replacement = indexed
        if isinstance(original, dict) and isinstance(replacement, dict):
            item = {**deepcopy(original), **deepcopy(replacement)}
            item["id"] = original.get("id", item.get("id"))
            merged.append(item)
        elif replacement is not None and not isinstance(original, dict):
            merged.append(deepcopy(replacement))
        else:
            merged.append(deepcopy(original))
    return merged


def _merge_section_content(source: Any, candidate: Any) -> Any:
    if isinstance(source, list):
        return _merge_section_entries(source, candidate)
    if isinstance(source, dict) and isinstance(candidate, dict):
        merged = {**deepcopy(source), **deepcopy(candidate)}
        if isinstance(source.get("items"), list):
            merged["items"] = _merge_section_entries(source["items"], candidate.get("items"))
        if source.get("id") not in (None, ""):
            merged["id"] = source["id"]
        return merged
    return deepcopy(candidate) if candidate is not None else deepcopy(source)


def _semantic_value(value: Any) -> Any:
    if isinstance(value, str):
        return re.sub(r"[\s,，、。；;：:!?！？\"'“”‘’（）()【】\[\]{}<>《》\-—_~`]+", "", value).lower()
    if isinstance(value, dict):
        return {key: _semantic_value(item) for key, item in sorted(value.items())}
    if isinstance(value, list):
        normalized = [_semantic_value(item) for item in value]
        if all(not isinstance(item, (dict, list)) for item in normalized):
            return sorted(normalized, key=str)
        return normalized
    return value


def _has_substantive_change(source: Any, candidate: Any) -> bool:
    return _semantic_value(source) != _semantic_value(candidate)


_TRANSLATION_PROTECTED_KEYS = {
    "id",
    "preset_type",
    "preset_key",
    "icon",
    "row",
    "order",
    "avatar",
    "phone",
    "email",
    "website",
    "github",
    "url",
    "start_date",
    "end_date",
    "date",
    "credential_id",
}
_TRANSLATION_PROTECTED_PATHS = {
    ("layout", "section_order"),
    ("layout", "hidden_sections"),
    ("layout", "skills_options"),
}


def _merge_translated_value(source: Any, candidate: Any, path: tuple[str, ...] = ()) -> Any:
    if path in _TRANSLATION_PROTECTED_PATHS or (path and path[-1] in _TRANSLATION_PROTECTED_KEYS):
        return deepcopy(source)
    if isinstance(source, dict):
        candidate_dict = candidate if isinstance(candidate, dict) else {}
        return {
            key: _merge_translated_value(value, candidate_dict.get(key), (*path, key))
            for key, value in source.items()
        }
    if isinstance(source, list):
        if not isinstance(candidate, list) or len(candidate) != len(source):
            raise AppException("翻译结果结构不完整，请重新生成")
        for index, source_item in enumerate(source):
            candidate_item = candidate[index]
            if (
                isinstance(source_item, dict)
                and source_item.get("id") not in (None, "")
                and (
                    not isinstance(candidate_item, dict)
                    or str(candidate_item.get("id")) != str(source_item.get("id"))
                )
            ):
                raise AppException("翻译结果改变了简历条目顺序，请重新生成")
        return [
            _merge_translated_value(value, candidate[index], (*path, str(index)))
            for index, value in enumerate(source)
        ]
    if source in (None, ""):
        return deepcopy(source)
    if candidate is None or type(candidate) is not type(source):
        return deepcopy(source)
    return deepcopy(candidate)


def _normalize_translation_payload(data: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    source_data = payload.get("resume_data")
    if not isinstance(source_data, dict):
        raise AppException("缺少待翻译的简历数据")
    candidate = data.get("translated_resume_data")
    if not isinstance(candidate, dict):
        for key in ("optimized_resume_data", "resume_data", "data", "result"):
            if isinstance(data.get(key), dict):
                candidate = data[key]
                break
    if not isinstance(candidate, dict):
        raise AppException("翻译结果中没有完整简历数据")
    nested_resume_data = candidate.get("resume_data")
    if isinstance(nested_resume_data, dict) and _looks_like_resume_data(nested_resume_data):
        candidate = nested_resume_data

    source_language = resolve_resume_language(
        payload.get("source_language") or payload.get("current_language"),
        source_data,
    )
    target_language = normalize_resume_language(payload.get("target_language") or data.get("target_language"))
    if source_language == target_language:
        raise AppException("目标语言与当前简历语言相同")

    translated_data = _merge_translated_value(source_data, candidate)
    layout = translated_data.setdefault("layout", {})
    if isinstance(layout, dict):
        layout["language_locked"] = True
    translated_data = _normalize_resume_data(translated_data, {"language": target_language})
    return {
        "source_language": source_language,
        "target_language": target_language,
        "translated_resume_data": translated_data,
        "translated_sections": [
            str(item).strip()
            for item in data.get("translated_sections", [])
            if str(item).strip()
        ] if isinstance(data.get("translated_sections"), list) else [],
        "summary": _stringify_summary(data.get("summary") or "整份简历已完成翻译。"),
        "warnings": [
            str(item).strip()
            for item in data.get("warnings", [])
            if str(item).strip()
        ] if isinstance(data.get("warnings"), list) else [],
    }


def _normalize_ai_payload(data: dict[str, Any], schema: type[T], payload: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    payload = payload or {}
    if schema is ResumeGenerateResult:
        resume_data = data.get("resume_data")
        if not isinstance(resume_data, dict):
            for key in ["optimized_resume_data", "data", "result", "resume"]:
                if isinstance(data.get(key), dict):
                    resume_data = data[key]
                    break
        if isinstance(resume_data, dict) and isinstance(resume_data.get("resume_data"), dict):
            resume_data = resume_data["resume_data"]
        if "resume_data" not in data and _looks_like_resume_data(data):
            resume_data = data
            data = {"resume_data": resume_data, "template_id": "tech", "template_config": {}, "explanation": ""}
        elif isinstance(resume_data, dict):
            data["resume_data"] = resume_data
        if "resume_data" in data:
            data["language"] = normalize_resume_language(payload.get("language") or data.get("language"))
            template_id = data.get("template_id")
            if template_id not in {
                "classic", "tech", "modern", "blue_timeline",
                "minimal_light", "minimal_mono", "modern_clean", "elegant_line",
            }:
                data["template_id"] = "tech"
            if not isinstance(data.get("template_config"), dict):
                data["template_config"] = {}
            data["explanation"] = _stringify_summary(data.get("explanation", ""))
            data["resume_data"] = _normalize_resume_data(
                data["resume_data"],
                {**payload, "language": data["language"]},
            )
        return data

    if schema is ResumeTranslateResult:
        return _normalize_translation_payload(data, payload)

    if schema is ResumeScoreResult:
        if isinstance(data.get("result"), dict):
            nested = data["result"]
            data = {**nested, **{key: value for key, value in data.items() if key != "result"}}
        data["summary"] = _clean_score_text(_localize_field_names(_stringify_summary(data.get("summary", ""))))
        if isinstance(data.get("details"), dict):
            details = []
            for dimension, value in data["details"].items():
                details.append(_normalize_score_detail(value, str(dimension)))
            data["details"] = details
        elif isinstance(data.get("details"), list):
            data["details"] = [_normalize_score_detail(item, f"评分维度 {index + 1}") for index, item in enumerate(data["details"])]
        else:
            data["details"] = []
        data.setdefault("details", [])
        if len(data["details"]) >= len(SCORE_DIMENSIONS):
            data["details"] = data["details"][: len(SCORE_DIMENSIONS)]
            for detail, (dimension, _) in zip(data["details"], SCORE_DIMENSIONS):
                detail["dimension"] = dimension
            weighted_score = int(
                round(sum(detail["score"] * weight for detail, (_, weight) in zip(data["details"], SCORE_DIMENSIONS)))
            )
        else:
            weighted_score = 0
        detail_average = int(round(sum(item["score"] for item in data["details"]) / len(data["details"]))) if data["details"] else 0
        score = _safe_int(data.get("score", 0), 0)
        if weighted_score > 0:
            score = weighted_score
        elif (data.get("score") is None or data.get("score") == "" or score == 0) and detail_average > 0:
            score = detail_average
        data["score"] = max(0, min(score, 100))
        data["level"] = (
            "优秀"
            if data["score"] >= 90
            else "良好"
            if data["score"] >= 80
            else "合格"
            if data["score"] >= 70
            else "待优化"
            if data["score"] >= 60
            else "需重点完善"
        )
        data.setdefault("strengths", [])
        data.setdefault("weaknesses", [])
        data.setdefault("missing_keywords", [])
        data.setdefault("suggestions", [])
        for key in ["strengths", "weaknesses", "missing_keywords", "suggestions"]:
            data[key] = _clean_score_text(_localize_field_names(data.get(key, [])))
        return data

    if schema is JdOptimizeResult:
        if "optimized_resume_data" not in data:
            if isinstance(data.get("resume_data"), dict):
                data["optimized_resume_data"] = data["resume_data"]
            elif _looks_like_resume_data(data):
                data = {
                    "job_keywords": {},
                    "match_analysis": {},
                    "optimized_resume_data": data,
                    "score": 0,
                    "suggestions": [],
                }
        data["job_keywords"] = data.get("job_keywords") if isinstance(data.get("job_keywords"), dict) else {}
        data["match_analysis"] = data.get("match_analysis") if isinstance(data.get("match_analysis"), dict) else {}
        if isinstance(data.get("optimized_resume_data"), dict):
            optimized_resume_data = data["optimized_resume_data"]
            if isinstance(optimized_resume_data.get("resume_data"), dict):
                optimized_resume_data = optimized_resume_data["resume_data"]
            source_resume = payload.get("resume_data")
            if isinstance(source_resume, dict):
                guarded_resume = deepcopy(source_resume)
                for key in ("summary", "skills", "work", "projects"):
                    guarded_resume[key] = _merge_section_content(source_resume.get(key), optimized_resume_data.get(key))
                optimized_resume_data = guarded_resume
            data["optimized_resume_data"] = _normalize_resume_data(optimized_resume_data, {})
        data["score"] = max(0, min(_safe_int(data.get("score", 0), 0), 100))
        data["suggestions"] = _clean_score_text(_localize_field_names(_string_list(data.get("suggestions", []))))
        source_resume = payload.get("resume_data")
        if isinstance(source_resume, dict) and isinstance(data.get("optimized_resume_data"), dict):
            source_relevant = {key: source_resume.get(key) for key in ("summary", "skills", "work", "projects")}
            optimized_relevant = {key: data["optimized_resume_data"].get(key) for key in ("summary", "skills", "work", "projects")}
            if not _has_substantive_change(source_relevant, optimized_relevant):
                data["suggestions"] = [
                    item for item in data["suggestions"] if isinstance(item, str) and item.strip().startswith("待核实：")
                ]
        return data

    if schema is ResumeChatResult:
        if isinstance(data.get("result"), dict):
            nested = data["result"]
            data = {**nested, **{key: value for key, value in data.items() if key != "result"}}
        _normalize_chat_change_scope(data)
        data["reply"] = _clean_score_text(_localize_field_names(_stringify_summary(data.get("reply") or data.get("message") or data.get("content") or "")))
        data["suggestions"] = _clean_score_text(_localize_field_names(_string_list(data.get("suggestions", []))))
        data["target_sections"] = [
            item
            for item in _string_list(data.get("target_sections", []))
            if item in CHAT_TARGET_SECTIONS
        ]
        optimized_resume_data = data.get("optimized_resume_data")
        if optimized_resume_data is None and isinstance(data.get("resume_data"), dict):
            optimized_resume_data = data["resume_data"]
        if isinstance(optimized_resume_data, dict):
            if isinstance(optimized_resume_data.get("resume_data"), dict):
                optimized_resume_data = optimized_resume_data["resume_data"]
            source_resume = (payload or {}).get("resume", {}).get("resume_data")
            if isinstance(source_resume, dict):
                source_basics = source_resume.get("basics")
                candidate_basics = optimized_resume_data.get("basics")
                if isinstance(source_basics, dict) and isinstance(candidate_basics, dict):
                    for key in ("avatar", "field_config", "custom_fields"):
                        if key not in candidate_basics and key in source_basics:
                            candidate_basics[key] = deepcopy(source_basics[key])
                if "layout" not in optimized_resume_data and isinstance(source_resume.get("layout"), dict):
                    optimized_resume_data["layout"] = deepcopy(source_resume["layout"])
            data["optimized_resume_data"] = _normalize_resume_data(optimized_resume_data, {})
        else:
            data["optimized_resume_data"] = None
        return data

    if schema is ResumeChatIntentResult:
        if isinstance(data.get("result"), dict):
            nested = data["result"]
            data = {**nested, **{key: value for key, value in data.items() if key != "result"}}
        _normalize_chat_change_scope(data)
        data["reply_hint"] = _clean_score_text(_localize_field_names(_stringify_summary(data.get("reply_hint") or data.get("reply") or "")))
        data["target_sections"] = [
            item
            for item in _string_list(data.get("target_sections", []))
            if item in CHAT_TARGET_SECTIONS
        ]
        return data

    if schema is SectionOptimizeResult:
        if "optimized_section" not in data and "section_content" in data:
            data = {
                "optimized_section": data.get("section_content"),
                "changes": data.get("changes", []),
                "suggestions": data.get("suggestions", []),
            }
        if "optimized_section" not in data:
            data = {"optimized_section": data, "changes": [], "suggestions": []}
        if isinstance(data.get("optimized_section"), dict) and "section_content" in data["optimized_section"]:
            data["optimized_section"] = data["optimized_section"]["section_content"]
        source_section = payload.get("section_content")
        if source_section is not None:
            data["optimized_section"] = _merge_section_content(source_section, data.get("optimized_section"))
        data.setdefault("changes", [])
        data.setdefault("suggestions", [])
        data["changes"] = _clean_score_text(_localize_field_names(data.get("changes", [])))
        data["suggestions"] = _clean_score_text(_localize_field_names(data.get("suggestions", [])))
        if source_section is not None and not _has_substantive_change(source_section, data["optimized_section"]):
            data["optimized_section"] = deepcopy(source_section)
            data["changes"] = []
            data["suggestions"] = []
        return data

    return data


def _validate_json_content(content: Any, schema: type[T], payload: Optional[dict[str, Any]] = None) -> T:
    try:
        parsed = _parse_json_content(content)
    except AppException:
        parsed = _repair_json_content(content, f"修复 {schema.__name__} 的 JSON 输出")
    data = _normalize_ai_payload(parsed, schema, payload)
    try:
        return schema.model_validate(data)
    except ValidationError as exc:
        repair_input = {"validation_error": str(exc), "raw_json": data}
        try:
            repaired = _repair_json_content(json.dumps(repair_input, ensure_ascii=False), f"根据校验错误修复 {schema.__name__} 的 JSON 结构")
            normalized = _normalize_ai_payload(repaired, schema, payload)
            return schema.model_validate(normalized)
        except Exception:
            raise AppException(f"AI 输出结构校验失败：{exc}") from exc


def strip_thinking_text(text: str) -> str:
    result = re.sub(r"<think\b[^>]*>.*?</think>", "", text or "", flags=re.IGNORECASE | re.DOTALL)
    if "</think>" in result.lower():
        result = re.split(r"</think>", result, maxsplit=1, flags=re.IGNORECASE)[-1]
    result = re.sub(r"<think\b[^>]*>.*$", "", result, flags=re.IGNORECASE | re.DOTALL)
    return result.lstrip()


def _visible_thinking_delta(state: dict[str, Any], text: str, *, flush: bool = False) -> str:
    state["buffer"] = str(state.get("buffer") or "") + (text or "")
    output: list[str] = []

    while state["buffer"]:
        buffer = state["buffer"]
        lowered = buffer.lower()
        if state.get("in_think"):
            end = lowered.find("</think>")
            if end < 0:
                state["buffer"] = buffer[-16:]
                return "".join(output)
            state["buffer"] = buffer[end + len("</think>") :]
            state["in_think"] = False
            continue

        start = lowered.find("<think")
        if start < 0:
            if flush:
                output.append(buffer)
                state["buffer"] = ""
            elif len(buffer) > 16:
                output.append(buffer[:-16])
                state["buffer"] = buffer[-16:]
            return "".join(output)

        output.append(buffer[:start])
        close = buffer.find(">", start)
        if close < 0:
            state["buffer"] = buffer[start:]
            return "".join(output)
        state["buffer"] = buffer[close + 1 :]
        state["in_think"] = True

    return "".join(output)


def _object_name_from_base_url(url: str, base_url: str, path_prefix: str = "") -> str | None:
    if not base_url:
        return None
    base = urlparse(base_url.rstrip("/"))
    current = urlparse(url)
    if current.scheme != base.scheme or current.netloc != base.netloc:
        return None
    prefix = f"{base.path.rstrip('/')}/{path_prefix.strip('/')}".rstrip("/")
    if not current.path.startswith(f"{prefix}/"):
        return None
    return unquote(current.path.removeprefix(f"{prefix}/"))


def _uploaded_object_name_from_attachment(attachment: dict[str, Any]) -> str | None:
    object_name = str(attachment.get("object_name") or "").strip().lstrip("/")
    if object_name:
        return object_name

    url = str(attachment.get("url") or "").strip()
    if not url:
        return None

    path = urlparse(url).path
    if path.startswith("/api/files/"):
        return unquote(path.removeprefix("/api/files/"))

    for base_url, path_prefix in [
        (settings.pdf_base_url, "api/files"),
        (settings.minio_public_url, ""),
        (settings.aliyun_oss_public_url, ""),
    ]:
        object_name = _object_name_from_base_url(url, base_url, path_prefix)
        if object_name:
            return object_name
    return None


def _compressed_chat_image(content: bytes) -> tuple[bytes, str]:
    try:
        image = Image.open(BytesIO(content))
        image.load()
    except Exception as exc:
        raise AppException("AI 对话图片读取失败，请重新上传清晰的 jpg、png 或 webp 图片") from exc

    image = ImageOps.exif_transpose(image)
    if max(image.size) > CHAT_IMAGE_MAX_SIDE:
        try:
            resampling = Image.Resampling.LANCZOS
        except AttributeError:
            resampling = Image.LANCZOS
        image.thumbnail((CHAT_IMAGE_MAX_SIDE, CHAT_IMAGE_MAX_SIDE), resampling)

    if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
        background = Image.new("RGB", image.size, "white")
        rgba_image = image.convert("RGBA")
        background.paste(rgba_image, mask=rgba_image.getchannel("A"))
        image = background
    elif image.mode != "RGB":
        image = image.convert("RGB")

    output = BytesIO()
    image.save(output, format="JPEG", quality=CHAT_IMAGE_JPEG_QUALITY, optimize=True)
    return output.getvalue(), "image/jpeg"


def _attachment_image_url(attachment: dict[str, Any]) -> str:
    url = str(attachment.get("url") or "").strip()
    object_name = _uploaded_object_name_from_attachment(attachment)
    if not object_name:
        if url.startswith(("http://", "https://")):
            return url
        raise AppException("AI 对话图片地址无效，请重新上传后再试")

    try:
        content, content_type = read_uploaded_file(object_name)
    except Exception as exc:
        raise AppException("AI 对话图片读取失败，请重新上传后再试") from exc

    mime_type = str(content_type or "").split(";", 1)[0].strip().lower()
    hinted_type = str(attachment.get("content_type") or "").split(";", 1)[0].strip().lower()
    if mime_type not in SUPPORTED_CHAT_IMAGE_TYPES and hinted_type in SUPPORTED_CHAT_IMAGE_TYPES:
        mime_type = hinted_type
    if mime_type not in SUPPORTED_CHAT_IMAGE_TYPES:
        raise AppException("AI 对话图片格式异常，仅支持 jpg、png、webp")

    content, mime_type = _compressed_chat_image(content)
    encoded = base64.b64encode(content).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _chat_image_blocks(payload: dict[str, Any]) -> list[dict[str, Any]]:
    attachments = [
        item
        for item in payload.get("attachments", [])
        if isinstance(item, dict) and item.get("url")
    ]
    return [
        {"type": "image_url", "image_url": {"url": _attachment_image_url(attachment)}}
        for attachment in attachments[:MAX_CHAT_IMAGES_PER_REQUEST]
    ]


def _record_image_fallback_usage(label: str, image_blocks: list[dict[str, Any]]) -> None:
    if not image_blocks:
        return
    record_extra_input_tokens(
        label,
        len(image_blocks) * FALLBACK_CHAT_IMAGE_INPUT_TOKENS,
        note=f"图片输入估算 {len(image_blocks)} 张",
    )


def _invoke_json_with_images(
    prompt,
    payload: dict[str, Any],
    schema: type[T],
    image_blocks: list[dict[str, Any]],
    label: str,
) -> T:
    variables = {**payload, "input_json": json.dumps(payload, ensure_ascii=False)}
    record_prompt_input(prompt, variables, label)
    _record_image_fallback_usage(label, image_blocks)
    timeout = _chat_result_timeout(schema)
    call_id, started_at = _model_call_start(
        label,
        prompt,
        variables,
        schema=schema,
        image_count=len(image_blocks),
        timeout=timeout,
    )
    messages = prompt.format_messages(**variables)
    for index in range(len(messages) - 1, -1, -1):
        if getattr(messages[index], "type", "") != "human":
            continue
        text = str(getattr(messages[index], "content", ""))
        messages[index] = HumanMessage(
            content=[
                {"type": "text", "text": text},
                *image_blocks,
            ]
        )
        break
    try:
        message = get_llm(timeout=timeout).invoke(messages)
        raw_content = getattr(message, "content", message)
        content = strip_thinking_text(raw_content) if isinstance(raw_content, str) else raw_content
        _model_call_output(call_id, label, started_at, content, raw_output=raw_content)
    except Exception as exc:
        _model_call_error(call_id, label, started_at, exc)
        raise
    record_model_usage(message, label)
    record_model_output(content, label)
    return _validate_json_content(content, schema, payload)


def _stream_prompt(prompt, payload: dict[str, Any], label: str):
    variables = {"input_json": json.dumps(payload, ensure_ascii=False)}
    record_prompt_input(prompt, variables, label)
    image_blocks = _chat_image_blocks(payload) if payload.get("attachments") else []
    _record_image_fallback_usage(label, image_blocks)
    call_id, started_at = _model_call_start(
        label,
        prompt,
        variables,
        image_count=len(image_blocks),
    )
    chunks: list[str] = []
    usage_chunk: Any = None
    thinking_state: dict[str, Any] = {"buffer": "", "in_think": False}
    try:
        if image_blocks:
            messages = prompt.format_messages(**variables)
            for index in range(len(messages) - 1, -1, -1):
                if getattr(messages[index], "type", "") != "human":
                    continue
                text = str(getattr(messages[index], "content", ""))
                messages[index] = HumanMessage(
                    content=[
                        {"type": "text", "text": text},
                        *image_blocks,
                    ]
                )
                break
            stream = get_llm().stream(messages)
        else:
            stream = (prompt | get_llm()).stream(variables)
        for chunk in stream:
            if model_usage_from_message(chunk):
                usage_chunk = chunk
            text = _chunk_text(chunk)
            if text:
                chunks.append(text)
                visible = _visible_thinking_delta(thinking_state, text)
                if visible:
                    yield visible
        visible = _visible_thinking_delta(thinking_state, "", flush=True)
        if visible:
            yield visible
    except Exception as exc:
        _model_call_error(call_id, label, started_at, exc, partial_output="".join(chunks))
        raise
    output = strip_thinking_text("".join(chunks))
    _model_call_output(call_id, label, started_at, output, raw_output="".join(chunks))
    if usage_chunk is not None:
        record_model_usage(usage_chunk, label)
    record_model_output(output, label)


def _invoke_json(prompt, payload: dict[str, Any], schema: type[T], label: str | None = None) -> T:
    label = label or schema.__name__
    if schema is ResumeChatResult and payload.get("attachments"):
        image_blocks = _chat_image_blocks(payload)
        if image_blocks:
            return _invoke_json_with_images(prompt, payload, schema, image_blocks, label)

    timeout = _chat_result_timeout(schema)
    chain = prompt | get_llm(timeout=timeout)
    variables = {**payload, "input_json": json.dumps(payload, ensure_ascii=False)}
    record_prompt_input(prompt, variables, label)
    call_id, started_at = _model_call_start(label, prompt, variables, schema=schema, timeout=timeout)
    try:
        message = chain.invoke(variables)
        raw_content = getattr(message, "content", message)
        content = strip_thinking_text(raw_content) if isinstance(raw_content, str) else raw_content
        _model_call_output(call_id, label, started_at, content, raw_output=raw_content)
    except Exception as exc:
        _model_call_error(call_id, label, started_at, exc)
        raise
    record_model_usage(message, label)
    record_model_output(content, label)
    return _validate_json_content(content, schema, payload)


def _chunk_text(chunk: Any) -> str:
    content = getattr(chunk, "content", chunk)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                parts.append(str(item.get("text") or item.get("content") or ""))
            elif item is not None:
                parts.append(str(item))
        return "".join(parts)
    return "" if content is None else str(content)


def stream_json_events(prompt, payload: dict[str, Any], schema: type[T]):
    yield {"type": "start"}
    chunks: list[str] = []
    thinking_state: dict[str, Any] = {"buffer": "", "in_think": False}
    label = schema.__name__
    call_id = ""
    started_at = time.perf_counter()
    usage_chunk: Any = None
    try:
        chain = prompt | get_llm()
        variables = {**payload, "input_json": json.dumps(payload, ensure_ascii=False)}
        record_prompt_input(prompt, variables, label)
        call_id, started_at = _model_call_start(label, prompt, variables, schema=schema)
        for chunk in chain.stream(variables):
            if model_usage_from_message(chunk):
                usage_chunk = chunk
            text = _chunk_text(chunk)
            if not text:
                continue
            chunks.append(text)
            visible = _visible_thinking_delta(thinking_state, text)
            if visible:
                yield {"type": "delta", "text": visible}
        visible = _visible_thinking_delta(thinking_state, "", flush=True)
        if visible:
            yield {"type": "delta", "text": visible}
        raw_output = "".join(chunks)
        clean_output = strip_thinking_text(raw_output)
        _model_call_output(call_id, label, started_at, clean_output, raw_output=raw_output)
        if usage_chunk is not None:
            record_model_usage(usage_chunk, label)
        record_model_output(clean_output, label)
        result = _validate_json_content(clean_output, schema, payload)
        if schema is ResumeGenerateResult:
            result.resume_data = _normalize_resume_data(result.resume_data, payload)  # type: ignore[attr-defined]
        yield {"type": "result", "data": result.model_dump()}
    except AppException as exc:
        if call_id:
            _model_call_error(call_id, label, started_at, exc, partial_output="".join(chunks))
        yield {"type": "error", "message": exc.message}
    except Exception as exc:
        if call_id:
            _model_call_error(call_id, label, started_at, exc, partial_output="".join(chunks))
        raw_message = str(exc) or "AI 生成失败"
        message = "AI 服务连接失败，请检查模型配置或网络连通性" if "connection" in raw_message.lower() else raw_message
        yield {"type": "error", "message": message}


def generate_resume_chain(payload: dict[str, Any]) -> ResumeGenerateResult:
    result = _invoke_json(GENERATE_RESUME_PROMPT, payload, ResumeGenerateResult)
    result.resume_data = _normalize_resume_data(result.resume_data, payload)
    return result


def import_resume_chain(payload: dict[str, Any]) -> ResumeGenerateResult:
    result = _invoke_json(IMPORT_RESUME_PROMPT, payload, ResumeGenerateResult)
    result.resume_data = _normalize_resume_data(result.resume_data, payload)
    return result


def score_resume_chain(payload: dict[str, Any]) -> ResumeScoreResult:
    return _invoke_json(SCORE_RESUME_PROMPT, payload, ResumeScoreResult)


def optimize_section_chain(payload: dict[str, Any]) -> SectionOptimizeResult:
    return _invoke_json(OPTIMIZE_SECTION_PROMPT, payload, SectionOptimizeResult)


def optimize_by_jd_chain(payload: dict[str, Any]) -> JdOptimizeResult:
    return _invoke_json(JD_OPTIMIZE_PROMPT, payload, JdOptimizeResult)


def translate_resume_chain(payload: dict[str, Any]) -> ResumeTranslateResult:
    return _invoke_json(RESUME_TRANSLATE_PROMPT, payload, ResumeTranslateResult)


def resume_chat_chain(payload: dict[str, Any]) -> ResumeChatResult:
    return _invoke_json(CHAT_RESUME_PROMPT, payload, ResumeChatResult, "AI 助手生成修改方案")


def resume_chat_image_import_chain(payload: dict[str, Any]) -> ResumeChatResult:
    return _invoke_json(CHAT_IMAGE_IMPORT_PROMPT, payload, ResumeChatResult, "AI 助手图片导入简历")


def resume_chat_intent_chain(payload: dict[str, Any]) -> ResumeChatIntentResult:
    return _invoke_json(CHAT_INTENT_PROMPT, payload, ResumeChatIntentResult, "AI 助手意图识别")


def resume_chat_change_repair_chain(payload: dict[str, Any]) -> ResumeChatResult:
    return _invoke_json(CHAT_CHANGE_REPAIR_PROMPT, payload, ResumeChatResult, "AI 助手修复修改方案")


def resume_chat_reply_stream(payload: dict[str, Any]):
    yield from _stream_prompt(CHAT_RESUME_REPLY_PROMPT, payload, "AI 对话回复")


def resume_chat_action_reply_stream(payload: dict[str, Any]):
    yield from _stream_prompt(CHAT_ACTION_REPLY_PROMPT, payload, "AI 操作回复")


def generate_resume_stream(payload: dict[str, Any]):
    return stream_json_events(GENERATE_RESUME_PROMPT, payload, ResumeGenerateResult)


def score_resume_stream(payload: dict[str, Any]):
    return stream_json_events(SCORE_RESUME_PROMPT, payload, ResumeScoreResult)


def optimize_section_stream(payload: dict[str, Any]):
    return stream_json_events(OPTIMIZE_SECTION_PROMPT, payload, SectionOptimizeResult)


def optimize_by_jd_stream(payload: dict[str, Any]):
    return stream_json_events(JD_OPTIMIZE_PROMPT, payload, JdOptimizeResult)


def translate_resume_stream(payload: dict[str, Any]):
    return stream_json_events(RESUME_TRANSLATE_PROMPT, payload, ResumeTranslateResult)
