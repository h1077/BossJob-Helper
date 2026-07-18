from __future__ import annotations

import json
import math
import re
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any


_CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
_current_tracker: ContextVar["TokenUsageTracker | None"] = ContextVar("ai_token_usage_tracker", default=None)


def stringify_for_tokens(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if hasattr(value, "model_dump"):
        try:
            value = value.model_dump(mode="json")
        except TypeError:
            value = value.model_dump()
    try:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)
    except TypeError:
        return str(value)


def estimate_tokens(value: Any) -> int:
    text = stringify_for_tokens(value)
    if not text:
        return 0
    cjk_count = len(_CJK_RE.findall(text))
    non_cjk_text = _CJK_RE.sub("", text)
    non_cjk_compact = re.sub(r"\s+", "", non_cjk_text)
    # Chinese text is usually close to one token per character; English/code/JSON
    # is closer to four compact characters per token. This is intentionally
    # conservative for billing and monitoring when providers do not return usage.
    return max(1, cjk_count + math.ceil(len(non_cjk_compact) / 4))


def _message_content_to_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                parts.append(str(item.get("text") or item.get("content") or item))
            elif item is not None:
                parts.append(str(item))
        return "\n".join(parts)
    return stringify_for_tokens(content)


def prompt_to_text(prompt: Any, variables: dict[str, Any]) -> str:
    try:
        messages = prompt.format_messages(**variables)
        lines = []
        for message in messages:
            role = getattr(message, "type", message.__class__.__name__)
            lines.append(f"{role}: {_message_content_to_text(getattr(message, 'content', message))}")
        return "\n".join(lines)
    except Exception:
        return f"{prompt}\n{stringify_for_tokens(variables)}"


@dataclass
class TokenUsageTracker:
    input_tokens: int = 0
    output_tokens: int = 0
    calls: list[dict[str, Any]] = field(default_factory=list)

    def add_input(self, label: str, value: Any) -> int:
        tokens = estimate_tokens(value)
        self.input_tokens += tokens
        self.calls.append({"label": label, "input_tokens": tokens, "output_tokens": 0, "estimated": True})
        return tokens

    def add_output(self, label: str, value: Any) -> int:
        tokens = estimate_tokens(value)
        for call in reversed(self.calls):
            if call.get("label") == label and call.get("usage_actual"):
                return 0
            if call.get("label") == label and not call.get("output_tokens"):
                self.output_tokens += tokens
                call["output_tokens"] = tokens
                call["estimated"] = True
                break
        else:
            self.output_tokens += tokens
            self.calls.append({"label": label, "input_tokens": 0, "output_tokens": tokens, "estimated": True})
        return tokens

    def add_input_tokens(self, label: str, tokens: int, note: str | None = None) -> int:
        value = max(0, int(tokens or 0))
        if value <= 0:
            return 0
        for call in reversed(self.calls):
            if call.get("label") == label and not call.get("usage_actual") and not call.get("output_tokens"):
                call["input_tokens"] = max(0, int(call.get("input_tokens") or 0)) + value
                call["estimated"] = True
                if note:
                    notes = [item for item in str(call.get("note") or "").split("; ") if item]
                    notes.append(note)
                    call["note"] = "; ".join(notes)
                self.input_tokens += value
                return value
        self.input_tokens += value
        call = {"label": label, "input_tokens": value, "output_tokens": 0, "estimated": True}
        if note:
            call["note"] = note
        self.calls.append(call)
        return value

    def set_actual_usage(
        self,
        label: str,
        *,
        input_tokens: int = 0,
        output_tokens: int = 0,
        total_tokens: int = 0,
    ) -> bool:
        input_value = max(0, int(input_tokens or 0))
        output_value = max(0, int(output_tokens or 0))
        total_value = max(0, int(total_tokens or 0))
        target = None
        for call in reversed(self.calls):
            if call.get("label") == label and not call.get("usage_actual"):
                target = call
                break
        if target is None:
            if total_value and not input_value and not output_value:
                output_value = total_value
            if not input_value and not output_value:
                return False
            self.input_tokens += input_value
            self.output_tokens += output_value
            self.calls.append(
                {
                    "label": label,
                    "input_tokens": input_value,
                    "output_tokens": output_value,
                    "estimated": False,
                    "usage_actual": True,
                }
            )
            return True

        previous_input = max(0, int(target.get("input_tokens") or 0))
        previous_output = max(0, int(target.get("output_tokens") or 0))
        if total_value and not input_value and not output_value:
            input_value = previous_input
            output_value = max(0, total_value - input_value)
        elif total_value and input_value and not output_value:
            output_value = max(0, total_value - input_value)
        elif total_value and output_value and not input_value:
            input_value = max(0, total_value - output_value)
        if not input_value and not output_value:
            return False
        self.input_tokens += input_value - previous_input
        self.output_tokens += output_value - previous_output
        target["input_tokens"] = input_value
        target["output_tokens"] = output_value
        target["estimated"] = False
        target["usage_actual"] = True
        target.pop("note", None)
        return True

    def snapshot(self) -> dict[str, Any]:
        estimated = any(bool(call.get("estimated", True)) for call in self.calls)
        return build_token_usage(self.input_tokens, self.output_tokens, self.calls, estimated=estimated)


def activate_token_tracker(initial_input_tokens: int = 0):
    tracker = TokenUsageTracker(input_tokens=max(0, int(initial_input_tokens or 0)))
    token = _current_tracker.set(tracker)
    return tracker, token


def reset_token_tracker(token: Any) -> None:
    _current_tracker.reset(token)


@contextmanager
def bind_token_tracker(tracker: TokenUsageTracker):
    token = _current_tracker.set(tracker)
    try:
        yield tracker
    finally:
        _current_tracker.reset(token)


def current_token_tracker() -> TokenUsageTracker | None:
    return _current_tracker.get()


def record_prompt_input(prompt: Any, variables: dict[str, Any], label: str) -> None:
    tracker = current_token_tracker()
    if not tracker:
        return
    tracker.add_input(label, prompt_to_text(prompt, variables))


def record_model_output(output: Any, label: str) -> None:
    tracker = current_token_tracker()
    if not tracker:
        return
    tracker.add_output(label, output)


def record_extra_input_tokens(label: str, tokens: int, note: str | None = None) -> None:
    tracker = current_token_tracker()
    if not tracker:
        return
    tracker.add_input_tokens(label, tokens, note=note)


def _usage_int(value: Any) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def _extract_usage_from_dict(data: dict[str, Any] | None) -> dict[str, int]:
    if not isinstance(data, dict):
        return {}
    token_usage = data.get("token_usage") if isinstance(data.get("token_usage"), dict) else data
    input_tokens = _usage_int(
        token_usage.get("input_tokens")
        or token_usage.get("prompt_tokens")
        or token_usage.get("prompt_token_count")
    )
    output_tokens = _usage_int(
        token_usage.get("output_tokens")
        or token_usage.get("completion_tokens")
        or token_usage.get("completion_token_count")
    )
    total_tokens = _usage_int(token_usage.get("total_tokens") or token_usage.get("total_token_count"))
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
    }


def model_usage_from_message(message: Any) -> dict[str, int]:
    candidates: list[dict[str, Any]] = []
    usage_metadata = getattr(message, "usage_metadata", None)
    if isinstance(usage_metadata, dict):
        candidates.append(usage_metadata)
    response_metadata = getattr(message, "response_metadata", None)
    if isinstance(response_metadata, dict):
        candidates.append(response_metadata)
        if isinstance(response_metadata.get("token_usage"), dict):
            candidates.append(response_metadata["token_usage"])
    llm_output = getattr(message, "llm_output", None)
    if isinstance(llm_output, dict):
        candidates.append(llm_output)
        if isinstance(llm_output.get("token_usage"), dict):
            candidates.append(llm_output["token_usage"])
    if isinstance(message, dict):
        candidates.append(message)
        if isinstance(message.get("token_usage"), dict):
            candidates.append(message["token_usage"])
    for candidate in candidates:
        usage = _extract_usage_from_dict(candidate)
        if usage.get("input_tokens") or usage.get("output_tokens") or usage.get("total_tokens"):
            return usage
    return {}


def record_model_usage(message: Any, label: str) -> bool:
    tracker = current_token_tracker()
    if not tracker:
        return False
    usage = model_usage_from_message(message)
    if not usage:
        return False
    return tracker.set_actual_usage(
        label,
        input_tokens=usage.get("input_tokens", 0),
        output_tokens=usage.get("output_tokens", 0),
        total_tokens=usage.get("total_tokens", 0),
    )


def build_token_usage(
    input_tokens: int = 0,
    output_tokens: int = 0,
    calls: list[dict[str, Any]] | None = None,
    *,
    estimated: bool = True,
) -> dict[str, Any]:
    input_value = max(0, int(input_tokens or 0))
    output_value = max(0, int(output_tokens or 0))
    return {
        "input_tokens": input_value,
        "output_tokens": output_value,
        "total_tokens": input_value + output_value,
        "estimated": estimated,
        "calls": calls or [],
    }


def normalize_token_usage(input_data: dict[str, Any] | None, fallback_total: int = 0) -> dict[str, Any]:
    data = input_data or {}
    raw = data.get("token_usage") if isinstance(data, dict) else None
    try:
        request_input_tokens = max(0, int(data.get("request_input_tokens") or 0)) if isinstance(data, dict) else 0
    except (TypeError, ValueError):
        request_input_tokens = 0
    if not isinstance(raw, dict):
        total = max(0, int(fallback_total or 0))
        if not total:
            return build_token_usage(request_input_tokens, 0, [], estimated=True) if request_input_tokens else build_token_usage()
        input_tokens = min(request_input_tokens, total) if request_input_tokens else 0
        output_tokens = max(0, total - input_tokens) if input_tokens else total
        return build_token_usage(input_tokens, output_tokens, [], estimated=True)
    input_tokens = int(raw.get("input_tokens") or 0)
    output_tokens = int(raw.get("output_tokens") or 0)
    total_tokens = int(raw.get("total_tokens") or 0)
    if request_input_tokens and input_tokens <= 0:
        input_tokens = request_input_tokens
    if total_tokens and not input_tokens and not output_tokens:
        output_tokens = total_tokens
    elif total_tokens and input_tokens + output_tokens != total_tokens:
        output_tokens = max(0, total_tokens - input_tokens)
    elif not total_tokens:
        total_tokens = input_tokens + output_tokens
    normalized_total = max(0, total_tokens if total_tokens else input_tokens + output_tokens)
    normalized_total = max(normalized_total, max(0, input_tokens) + max(0, output_tokens))
    return {
        "input_tokens": max(0, input_tokens),
        "output_tokens": max(0, output_tokens),
        "total_tokens": normalized_total,
        "estimated": bool(raw.get("estimated", True)),
        "calls": raw.get("calls") if isinstance(raw.get("calls"), list) else [],
    }


def merge_token_usage(input_data: dict[str, Any] | None, token_usage: dict[str, Any]) -> dict[str, Any]:
    data = dict(input_data or {})
    data["token_usage"] = normalize_token_usage({"token_usage": token_usage}, token_usage.get("total_tokens", 0))
    return data
