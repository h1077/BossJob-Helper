from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime
from typing import Any, Callable, TypeVar

from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ai_config import FlowPointTransaction
from app.models.ai_task import AiTask
from app.models.user import User
from app.services.ai.token_usage import (
    activate_token_tracker,
    bind_token_tracker,
    merge_token_usage,
    reset_token_tracker,
    TokenUsageTracker,
)
from app.services.flow_points_service import POINT_ZERO, point_amount, point_number, settle_task_flow_points


T = TypeVar("T")


def create_ai_task(
    db: Session,
    user_id: int,
    task_type: str,
    resume_id: int | None = None,
    input_data: dict[str, Any] | None = None,
    model_name: str | None = None,
) -> AiTask:
    task = AiTask(
        user_id=user_id,
        resume_id=resume_id,
        task_type=task_type,
        input_data=input_data or {},
        model_name=model_name,
        status="pending",
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def finish_ai_task(
    db: Session,
    task: AiTask,
    status: str,
    error_message: str | None = None,
    output_data: dict[str, Any] | None = None,
    token_usage: dict[str, Any] | None = None,
) -> None:
    # AI services may have used the same session. Clear a failed transaction
    # before persisting the monitoring result, which was already committed at creation.
    db.rollback()
    task.status = status
    task.error_message = error_message[:4000] if error_message else None
    task.output_data = output_data or {}
    if token_usage:
        task.input_data = merge_token_usage(task.input_data or {}, token_usage)
        task.tokens_used = int(task.input_data["token_usage"]["total_tokens"] or 0)
        transactions = db.scalars(
            select(FlowPointTransaction).where(FlowPointTransaction.task_id == task.id)
        ).all()
        for transaction in transactions:
            transaction.tokens_used = task.tokens_used
            db.add(transaction)
    if status == "success":
        settle_task_flow_points(db, task)
    elif status == "failed":
        _refund_failed_task_points(db, task)
    task.update_time = datetime.now()
    db.add(task)
    db.commit()


def _refund_failed_task_points(db: Session, task: AiTask) -> None:
    """Return points for failed AI tasks once, keeping usage history auditable."""
    transactions = list(
        db.scalars(select(FlowPointTransaction).where(FlowPointTransaction.task_id == task.id))
    )
    net_points = sum((point_amount(item.points_delta) for item in transactions), POINT_ZERO)
    if net_points >= 0:
        task.points_used = POINT_ZERO
        return

    refund_points = abs(net_points)
    user = db.get(User, task.user_id)
    if not user:
        task.points_used = POINT_ZERO
        return

    user.flow_points = point_amount(user.flow_points) + refund_points
    refund = FlowPointTransaction(
        user_id=task.user_id,
        task_id=task.id,
        feature_type=task.task_type,
        points_delta=refund_points,
        balance_after=user.flow_points,
        tokens_used=int(task.tokens_used or 0),
        description="AI 任务失败，自动退还 Flow Points",
    )
    task.points_used = POINT_ZERO
    db.add(user)
    db.add(refund)


def _request_input_tokens(task: AiTask) -> int:
    try:
        return max(0, int((task.input_data or {}).get("request_input_tokens") or 0))
    except (TypeError, ValueError):
        return 0


def _snapshot_with_request_fallback(task: AiTask, tracker: Any) -> dict[str, Any]:
    snapshot = tracker.snapshot()
    request_tokens = _request_input_tokens(task)
    if request_tokens > 0 and int(snapshot.get("input_tokens") or 0) <= 0:
        output_tokens = int(snapshot.get("output_tokens") or 0)
        snapshot["input_tokens"] = request_tokens
        snapshot["total_tokens"] = request_tokens + output_tokens
        snapshot["estimated"] = True
        calls = list(snapshot.get("calls") or [])
        snapshot["calls"] = [
            {
                "label": "请求、系统提示词与上下文估算",
                "input_tokens": request_tokens,
                "output_tokens": 0,
            },
            *calls,
        ]
    return snapshot


def ai_task_usage_payload(task: AiTask) -> dict[str, Any]:
    return {
        "points_used": point_number(task.points_used),
        "tokens_used": int(task.tokens_used or 0),
        "token_usage": (task.input_data or {}).get("token_usage"),
    }


def run_tracked_ai(
    db: Session,
    task: AiTask,
    callback: Callable[[], T],
) -> T:
    tracker, token = activate_token_tracker()
    try:
        result = callback()
        if isinstance(result, BaseModel):
            result_name = result.__class__.__name__
            output_data = result.model_dump(mode="json")
        else:
            result_name = type(result).__name__
            output_data = {"value": jsonable_encoder(result)}
        if tracker.output_tokens <= 0:
            tracker.add_output(result_name, output_data)
        finish_ai_task(
            db,
            task,
            "success",
            output_data={"result_type": result_name, "result": output_data},
            token_usage=_snapshot_with_request_fallback(task, tracker),
        )
        return result
    except Exception as exc:
        finish_ai_task(
            db,
            task,
            "failed",
            error_message=str(exc) or "AI 调用失败",
            token_usage=_snapshot_with_request_fallback(task, tracker),
        )
        raise
    finally:
        reset_token_tracker(token)


def tracked_ai_events(db: Session, task: AiTask, events: Iterable[dict[str, Any]]):
    finished = False
    tracker = TokenUsageTracker()
    output_chunks: list[str] = []
    iterator = iter(events)
    try:
        def process_event(event: dict[str, Any]) -> dict[str, Any]:
            nonlocal finished
            if event.get("type") == "delta" and event.get("text"):
                output_chunks.append(str(event.get("text")))
            if event.get("type") == "error":
                if tracker.output_tokens <= 0 and output_chunks:
                    tracker.add_output("流式输出", "".join(output_chunks))
                finish_ai_task(
                    db,
                    task,
                    "failed",
                    error_message=str(event.get("message") or "AI 调用失败"),
                    token_usage=_snapshot_with_request_fallback(task, tracker),
                )
                finished = True
            elif event.get("type") == "result":
                if tracker.output_tokens <= 0:
                    tracker.add_output("流式结果", "".join(output_chunks) or event.get("data"))
                finish_ai_task(
                    db,
                    task,
                    "success",
                    output_data={"stream": True, "result": event.get("data")},
                    token_usage=_snapshot_with_request_fallback(task, tracker),
                )
                db.refresh(task)
                data = event.get("data")
                if isinstance(data, dict):
                    event["data"] = {**data, "usage": ai_task_usage_payload(task)}
                else:
                    event["data"] = {"value": data, "usage": ai_task_usage_payload(task)}
                finished = True
            return event

        while True:
            try:
                with bind_token_tracker(tracker):
                    event = process_event(next(iterator))
            except StopIteration:
                break
            yield event
        if not finished:
            if tracker.output_tokens <= 0 and output_chunks:
                tracker.add_output("流式输出", "".join(output_chunks))
            finish_ai_task(
                db,
                task,
                "failed",
                error_message="AI 流式响应未返回结果",
                token_usage=_snapshot_with_request_fallback(task, tracker),
            )
    except GeneratorExit:
        if not finished:
            try:
                while True:
                    try:
                        with bind_token_tracker(tracker):
                            process_event(next(iterator))
                    except StopIteration:
                        break
                    if finished:
                        break
            except Exception:
                pass
        if not finished:
            if tracker.output_tokens <= 0 and output_chunks:
                tracker.add_output("流式输出", "".join(output_chunks))
            finish_ai_task(
                db,
                task,
                "failed",
                error_message="前端连接已断开，AI 流式响应未完成",
                token_usage=_snapshot_with_request_fallback(task, tracker),
            )
        raise
    except Exception as exc:
        if not finished:
            if tracker.output_tokens <= 0 and output_chunks:
                tracker.add_output("流式输出", "".join(output_chunks))
            finish_ai_task(
                db,
                task,
                "failed",
                error_message=str(exc) or "AI 调用失败",
                token_usage=_snapshot_with_request_fallback(task, tracker),
            )
        raise
