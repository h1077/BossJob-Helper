from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class AiChatAttachment(BaseModel):
    url: str
    name: str = ""
    content_type: str = "image"
    object_name: Optional[str] = None


class AiChatSendRequest(BaseModel):
    content: str
    attachments: list[AiChatAttachment] = Field(default_factory=list)
    model_config_id: Optional[int] = None


class AiChatRegenerateRequest(BaseModel):
    content: Optional[str] = None
    attachments: Optional[list[AiChatAttachment]] = None
    model_config_id: Optional[int] = None


class AiChatDecisionRequest(BaseModel):
    action: Literal["apply", "reject"]


class AiChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    attachments: list[AiChatAttachment] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    optimized_resume_data: Optional[dict[str, Any]] = None
    action_status: str = "none"
    create_time: datetime

    model_config = {"from_attributes": True}


class AiChatSendResponse(BaseModel):
    messages: list[AiChatMessageOut]
    assistant_message: AiChatMessageOut


class AiChatDecisionResponse(BaseModel):
    assistant_message: AiChatMessageOut
    resume_data: Optional[dict[str, Any]] = None
