import json
from collections.abc import Callable, Iterable
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.request_utils import get_client_ip
from app.core.response import success
from app.core.security import get_current_user
from app.models.ai_config import FlowPointRule, FlowPointTransaction
from app.models.ai_task import AiTask
from app.models.resume import Resume
from app.models.user import User
from app.schemas.ai import (
    GenerateResumeRequest,
    JdOptimizeRequest,
    OptimizeSectionRequest,
    ScoreResumeRequest,
    TranslateResumeRequest,
)
from app.schemas.ai_chat import (
    AiChatDecisionRequest,
    AiChatDecisionResponse,
    AiChatRegenerateRequest,
    AiChatSendRequest,
    AiChatSendResponse,
)
from app.services.ai.chains import (
    generate_resume_chain,
    generate_resume_stream,
    optimize_by_jd_chain,
    optimize_by_jd_stream,
    optimize_section_chain,
    optimize_section_stream,
    score_resume_chain,
    score_resume_stream,
    translate_resume_chain,
    translate_resume_stream,
)
from app.services.ai.token_usage import normalize_token_usage
from app.services.ai.graphs import optimize_by_jd_graph
from app.services.ai_chat_service import (
    clear_chat_messages,
    list_chat_messages,
    stream_regenerate_chat_message,
    resolve_chat_change,
    send_chat_message,
    stream_chat_message,
)
from app.services.ai_config_service import bind_ai_runtime_config, get_active_ai_config, get_ai_config_by_id, get_default_chat_ai_config, public_ai_capability
from app.services.ai_task_service import create_ai_task, run_tracked_ai, tracked_ai_events
from app.services.app_settings_service import get_setting
from app.services.flow_points_service import (
    ACTIVE_AI_FEATURE_TYPES,
    consume_flow_points,
    ensure_default_point_rules,
    estimate_tokens,
    precheck_flow_points,
    point_number,
    redeem_flow_points,
)
from app.services.resume_service import get_resume
from app.services.resume_locale import resolve_resume_language

router = APIRouter(prefix="/ai", tags=["ai"])


class FlowPointRedeemRequest(BaseModel):
    code: str


def ai_payload(payload: Any) -> dict[str, Any]:
    return payload.model_dump(exclude={"resume_id"})


def ai_metadata(task_type: str, payload: Any, model_name: str, model_config_id: int | None = None) -> dict[str, Any]:
    data = payload.model_dump()
    metadata: dict[str, Any] = {"model": model_name}
    if model_config_id:
        metadata["model_config_id"] = model_config_id
    for key in ("section_type", "section_title", "target_position", "optimize_style", "current_language", "target_language"):
        if data.get(key):
            metadata[key] = data[key]
    if data.get("job_description"):
        metadata["job_description_length"] = len(data["job_description"])
    if task_type == "generate_resume":
        metadata["style"] = data.get("style", "")
    metadata["request_input_tokens"] = estimate_tokens({"task_type": task_type, "payload": data, "model": model_name})
    return metadata


def new_task(db: Session, user: User, task_type: str, payload: Any, resume_id: int | None = None):
    if task_type not in ACTIVE_AI_FEATURE_TYPES:
        raise AppException("该 AI 功能已停用")
    is_admin = getattr(user, "role", "") == "admin"
    requested_model_id = getattr(payload, "model_config_id", None) if task_type == "ai_chat" else None
    config = (
        get_ai_config_by_id(db, int(requested_model_id), require_chat_selectable=not is_admin)
        if requested_model_id
        else get_default_chat_ai_config(db) if task_type == "ai_chat" else get_active_ai_config(db)
    )
    metadata = ai_metadata(task_type, payload, config.model, config.id)
    metadata["model_name"] = config.name
    if task_type == "ai_chat":
        metadata["supports_multimodal"] = config.supports_multimodal
        metadata["billing_override"] = config.chat_billing_override()
    request_tokens = int(metadata.get("request_input_tokens") or 0)
    charge_on_finish = task_type == "ai_chat"
    precheck_flow_points(
        db,
        user,
        task_type,
        input_tokens=0 if charge_on_finish else request_tokens,
        pricing_override=metadata.get("billing_override") if charge_on_finish else None,
    )
    task = create_ai_task(
        db,
        user.id,
        task_type,
        resume_id=resume_id if resume_id is not None else getattr(payload, "resume_id", None),
        input_data=metadata,
        model_name=config.model,
    )
    task._runtime_ai_config = config  # type: ignore[attr-defined]
    if not charge_on_finish:
        consume_flow_points(
            db,
            user,
            task_type,
            task=task,
            tokens_used=request_tokens,
            input_tokens=request_tokens,
            description=f"{ai_feature_label(task_type)}调用扣减",
        )
    return task


def run_with_task_model(task: AiTask, callback):
    config = getattr(task, "_runtime_ai_config", None)
    if not config:
        return callback()
    with bind_ai_runtime_config(config):
        return callback()


def stream_with_task_model(task: AiTask, event_factory: Callable[[], Iterable[dict[str, Any]]]):
    config = getattr(task, "_runtime_ai_config", None)
    if not config:
        yield from event_factory()
        return
    with bind_ai_runtime_config(config):
        iterator = iter(event_factory())
    while True:
        try:
            with bind_ai_runtime_config(config):
                event = next(iterator)
        except StopIteration:
            return
        yield event


def ai_feature_label(task_type: str) -> str:
    labels = {
        "generate_resume": "AI 简历生成",
        "import_resume": "导入简历",
        "ai_chat": "AI 对话",
        "resume_score": "简历诊断",
        "jd_optimize": "JD 优化",
        "resume_translate": "简历翻译",
        "section_optimize": "AI 润色",
        "redeem": "兑换码充值",
        "admin_adjust": "管理员调整",
        "admin_grant_all": "全员发放",
        "admin_grant_all_revoke": "全员发放撤回",
        "signup_gift": "注册赠送",
    }
    return labels.get(task_type, task_type)


def user_visible_task_model_name(task: AiTask | None) -> str | None:
    if not task or task.task_type != "ai_chat":
        return None
    input_data = task.input_data or {}
    return str(input_data.get("model_name") or "AI 对话模型")


def stream_events(events: Iterable[dict[str, Any]]) -> StreamingResponse:
    def iterator():
        for event in events:
            yield json.dumps(event, ensure_ascii=False) + "\n"

    return StreamingResponse(
        iterator(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


def page_data(items: list[dict[str, Any]], total: int, page: int, page_size: int) -> dict[str, Any]:
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def ai_task_data(task: AiTask, resume_title: str | None = None) -> dict[str, Any]:
    input_data = dict(task.input_data or {})
    input_data["token_usage"] = normalize_token_usage(input_data, task.tokens_used or 0)
    input_data.pop("model", None)
    input_data.pop("model_config_id", None)
    input_data.pop("billing_override", None)
    return {
        "id": task.id,
        "resume_id": task.resume_id,
        "resume_title": resume_title,
        "task_type": task.task_type,
        "task_label": ai_feature_label(task.task_type),
        "status": task.status,
        "model_name": user_visible_task_model_name(task),
        "points_used": point_number(task.points_used),
        "tokens_used": task.tokens_used,
        "input_data": input_data,
        "output_data": task.output_data or {},
        "error_message": task.error_message,
        "create_time": task.create_time,
        "update_time": task.update_time,
    }


@router.get("/capability")
def ai_capability(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return success(public_ai_capability(db, include_all_chat_models=current_user.role == "admin"))


@router.get("/records")
def my_ai_records(
    page: int = 1,
    page_size: int = 20,
    task_type: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    query = (
        select(AiTask, Resume.title)
        .outerjoin(Resume, (Resume.id == AiTask.resume_id) & (Resume.user_id == current_user.id))
        .where(AiTask.user_id == current_user.id)
    )
    count_query = select(func.count()).select_from(AiTask).where(AiTask.user_id == current_user.id)
    if task_type:
        query = query.where(AiTask.task_type == task_type)
        count_query = count_query.where(AiTask.task_type == task_type)
    total = db.scalar(count_query) or 0
    rows = db.execute(
        query.order_by(AiTask.create_time.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return success(page_data([ai_task_data(task, resume_title) for task, resume_title in rows], total, page, page_size))


@router.get("/histories")
def my_ai_histories(
    task_type: str,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if task_type not in {"resume_score", "jd_optimize", "resume_translate"}:
        raise AppException("只支持查看简历诊断、JD 优化和简历翻译历史")
    return my_ai_records(page, page_size, task_type, db, current_user)


@router.get("/flow-points")
def my_flow_points(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_default_point_rules(db)
    spent = db.scalar(
        select(func.coalesce(func.sum(FlowPointTransaction.points_delta), 0))
        .where(FlowPointTransaction.user_id == current_user.id, FlowPointTransaction.points_delta < 0)
    ) or 0
    earned = db.scalar(
        select(func.coalesce(func.sum(FlowPointTransaction.points_delta), 0))
        .where(FlowPointTransaction.user_id == current_user.id, FlowPointTransaction.points_delta > 0)
    ) or 0
    rules = list(
        db.scalars(
            select(FlowPointRule)
            .where(FlowPointRule.feature_type.in_(ACTIVE_AI_FEATURE_TYPES))
            .order_by(FlowPointRule.id.asc())
        )
    )
    return success(
        {
            "balance": point_number(current_user.flow_points),
            "spent": point_number(abs(spent)),
            "earned": point_number(earned),
            "hint": get_setting(db, "ai_records_hint"),
            "rules": [
                {
                    "feature_type": item.feature_type,
                    "display_name": item.display_name,
                    "points_per_call": point_number(item.points_per_call),
                    "points_per_1k_tokens": point_number(item.points_per_1k_tokens),
                    "points_per_million_tokens": point_number(item.points_per_million_tokens),
                    "points_per_million_input_tokens": point_number(item.points_per_million_input_tokens),
                    "points_per_million_output_tokens": point_number(item.points_per_million_output_tokens),
                    "enabled": item.enabled,
                }
                for item in rules
            ],
        }
    )


@router.get("/flow-points/transactions")
def my_flow_point_transactions(
    page: int = 1,
    page_size: int = 20,
    feature_type: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    condition = FlowPointTransaction.user_id == current_user.id
    if feature_type:
        condition = condition & (FlowPointTransaction.feature_type == feature_type)
    total = db.scalar(select(func.count()).select_from(FlowPointTransaction).where(condition)) or 0
    rows = list(
        db.execute(
            select(FlowPointTransaction, AiTask)
            .outerjoin(AiTask, AiTask.id == FlowPointTransaction.task_id)
            .where(condition)
            .order_by(FlowPointTransaction.create_time.desc(), FlowPointTransaction.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    items = [
        {
            "id": item.id,
            "feature_type": item.feature_type,
            "feature_label": ai_feature_label(item.feature_type),
            "points_delta": point_number(item.points_delta),
            "balance_after": point_number(item.balance_after),
            "tokens_used": item.tokens_used,
            "model_name": user_visible_task_model_name(task),
            "description": item.description,
            "create_time": item.create_time,
        }
        for item, task in rows
    ]
    return success(page_data(items, total, page, page_size))


@router.post("/flow-points/redeem")
def redeem_points(
    payload: FlowPointRedeemRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = redeem_flow_points(db, current_user, payload.code, get_client_ip(request))
    return success(
        {
            "points": point_number(record.points),
            "balance": point_number(current_user.flow_points),
        },
        "兑换成功",
    )


@router.post("/generate-resume")
def generate_resume(payload: GenerateResumeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = new_task(db, current_user, "generate_resume", payload)
    result = run_tracked_ai(db, task, lambda: run_with_task_model(task, lambda: generate_resume_chain(ai_payload(payload))))
    return success(result.model_dump())


@router.post("/generate-resume/stream")
def generate_resume_stream_api(payload: GenerateResumeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = new_task(db, current_user, "generate_resume", payload)
    return stream_events(tracked_ai_events(db, task, stream_with_task_model(task, lambda: generate_resume_stream(ai_payload(payload)))))


@router.post("/score-resume")
def score_resume(payload: ScoreResumeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = new_task(db, current_user, "resume_score", payload)
    result = run_tracked_ai(db, task, lambda: run_with_task_model(task, lambda: score_resume_chain(ai_payload(payload))))
    return success(result.model_dump())


@router.post("/score-resume/stream")
def score_resume_stream_api(payload: ScoreResumeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = new_task(db, current_user, "resume_score", payload)
    return stream_events(tracked_ai_events(db, task, stream_with_task_model(task, lambda: score_resume_stream(ai_payload(payload)))))


@router.post("/optimize-section")
def optimize_section(payload: OptimizeSectionRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = new_task(db, current_user, "section_optimize", payload)
    result = run_tracked_ai(db, task, lambda: run_with_task_model(task, lambda: optimize_section_chain(ai_payload(payload))))
    return success(result.model_dump())


@router.post("/optimize-section/stream")
def optimize_section_stream_api(payload: OptimizeSectionRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = new_task(db, current_user, "section_optimize", payload)
    return stream_events(tracked_ai_events(db, task, stream_with_task_model(task, lambda: optimize_section_stream(ai_payload(payload)))))


@router.post("/optimize-by-jd")
def optimize_by_jd(payload: JdOptimizeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = new_task(db, current_user, "jd_optimize", payload)
    result = run_tracked_ai(db, task, lambda: run_with_task_model(task, lambda: optimize_by_jd_graph(payload.resume_data, payload.job_description)))
    return success(result.model_dump())


@router.post("/optimize-by-jd/stream")
def optimize_by_jd_stream_api(payload: JdOptimizeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = new_task(db, current_user, "jd_optimize", payload)
    return stream_events(tracked_ai_events(db, task, stream_with_task_model(task, lambda: optimize_by_jd_stream(ai_payload(payload)))))


@router.post("/optimize-by-jd-single")
def optimize_by_jd_single(payload: JdOptimizeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = new_task(db, current_user, "jd_optimize", payload)
    result = run_tracked_ai(db, task, lambda: run_with_task_model(task, lambda: optimize_by_jd_chain(ai_payload(payload))))
    return success(result.model_dump())


def _translate_input(payload: TranslateResumeRequest) -> dict[str, Any]:
    data = ai_payload(payload)
    source_language = resolve_resume_language(payload.current_language, payload.resume_data)
    if source_language == payload.target_language:
        raise AppException("目标语言与当前简历语言相同")
    data["source_language"] = source_language
    return data


@router.post("/translate-resume")
def translate_resume(payload: TranslateResumeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.resume_id is not None:
        get_resume(db, current_user.id, payload.resume_id)
    input_data = _translate_input(payload)
    task = new_task(db, current_user, "resume_translate", payload)
    result = run_tracked_ai(
        db,
        task,
        lambda: run_with_task_model(task, lambda: translate_resume_chain(input_data)),
    )
    return success(result.model_dump())


@router.post("/translate-resume/stream")
def translate_resume_stream_api(payload: TranslateResumeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.resume_id is not None:
        get_resume(db, current_user.id, payload.resume_id)
    input_data = _translate_input(payload)
    task = new_task(db, current_user, "resume_translate", payload)
    return stream_events(
        tracked_ai_events(
            db,
            task,
            stream_with_task_model(task, lambda: translate_resume_stream(input_data)),
        )
    )


@router.get("/resume-chat/{resume_id}/messages")
def resume_chat_messages(resume_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    get_resume(db, current_user.id, resume_id)
    return success([item.model_dump() for item in list_chat_messages(db, current_user.id, resume_id)])


@router.post("/resume-chat/{resume_id}/messages")
def resume_chat_send(
    resume_id: int,
    payload: AiChatSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume = get_resume(db, current_user.id, resume_id)
    task = new_task(db, current_user, "ai_chat", payload, resume_id=resume_id)
    messages, assistant_message = run_tracked_ai(
        db,
        task,
        lambda: run_with_task_model(
            task,
            lambda: send_chat_message(
                db,
                current_user,
                resume,
                payload.content,
                [item.model_dump() for item in payload.attachments],
            ),
        ),
    )
    return success(
        AiChatSendResponse(messages=messages, assistant_message=assistant_message).model_dump()
    )


@router.post("/resume-chat/{resume_id}/messages/stream")
def resume_chat_send_stream(
    resume_id: int,
    payload: AiChatSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume = get_resume(db, current_user.id, resume_id)
    task = new_task(db, current_user, "ai_chat", payload, resume_id=resume_id)
    return stream_events(
        tracked_ai_events(
            db,
            task,
            stream_with_task_model(
                task,
                lambda: stream_chat_message(
                    db,
                    current_user,
                    resume,
                    payload.content,
                    [item.model_dump() for item in payload.attachments],
                ),
            ),
        )
    )


@router.post("/resume-chat/{resume_id}/messages/{message_id}/regenerate/stream")
def resume_chat_regenerate_stream(
    resume_id: int,
    message_id: int,
    payload: AiChatRegenerateRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume = get_resume(db, current_user.id, resume_id)
    task_payload = AiChatSendRequest(
        content=(payload.content if payload and payload.content is not None else f"重新生成消息 {message_id}"),
        attachments=(payload.attachments if payload and payload.attachments is not None else []),
        model_config_id=payload.model_config_id if payload else None,
    )
    task = new_task(db, current_user, "ai_chat", task_payload, resume_id=resume_id)
    return stream_events(
        tracked_ai_events(
            db,
            task,
            stream_with_task_model(
                task,
                lambda: stream_regenerate_chat_message(
                    db,
                    current_user,
                    resume,
                    message_id,
                    override_content=payload.content if payload and payload.content is not None else None,
                    override_attachments=[item.model_dump() for item in payload.attachments]
                    if payload and payload.attachments is not None
                    else None,
                ),
            ),
        )
    )


@router.post("/resume-chat/{resume_id}/messages/{message_id}/decision")
def resume_chat_decision(
    resume_id: int,
    message_id: int,
    payload: AiChatDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume = get_resume(db, current_user.id, resume_id)
    assistant_message, resume_data = resolve_chat_change(
        db, current_user, resume, message_id, payload.action
    )
    return success(
        AiChatDecisionResponse(
            assistant_message=assistant_message,
            resume_data=resume_data,
        ).model_dump()
    )


@router.delete("/resume-chat/{resume_id}/messages")
def resume_chat_clear(resume_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    get_resume(db, current_user.id, resume_id)
    clear_chat_messages(db, current_user.id, resume_id)
    return success(True)
