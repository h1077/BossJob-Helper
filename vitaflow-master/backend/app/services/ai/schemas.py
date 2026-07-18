from typing import Any, Literal

from pydantic import BaseModel, Field


class ResumeGenerateResult(BaseModel):
    resume_data: dict[str, Any]
    language: Literal["zh-CN", "en"] = "zh-CN"
    template_id: str = "tech"
    template_config: dict[str, Any] = Field(default_factory=dict)
    explanation: str = ""


class ScoreDetail(BaseModel):
    dimension: str = "评分维度"
    score: int = 0
    max_score: int = 100
    comment: str = ""


class ResumeScoreResult(BaseModel):
    score: int
    level: str
    summary: str
    details: list[ScoreDetail] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    missing_keywords: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class SectionOptimizeResult(BaseModel):
    optimized_section: Any
    changes: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class JdOptimizeResult(BaseModel):
    job_keywords: dict[str, Any] = Field(default_factory=dict)
    match_analysis: dict[str, Any] = Field(default_factory=dict)
    optimized_resume_data: dict[str, Any]
    score: int = 0
    suggestions: list[str] = Field(default_factory=list)


class ResumeTranslateResult(BaseModel):
    source_language: Literal["zh-CN", "en"]
    target_language: Literal["zh-CN", "en"]
    translated_resume_data: dict[str, Any]
    translated_sections: list[str] = Field(default_factory=list)
    summary: str = ""
    warnings: list[str] = Field(default_factory=list)


class ResumeChatResult(BaseModel):
    intent: Literal["answer", "clarify", "propose_change", "confirm_change", "reject_change"]
    change_scope: Literal["none", "partial", "full_replace", "reorder"]
    target_sections: list[Literal["basics", "summary", "education", "skills", "work", "projects", "awards", "custom_sections", "layout"]] = Field(default_factory=list)
    reply: str
    suggestions: list[str] = Field(default_factory=list)
    optimized_resume_data: dict[str, Any] | None = None


class ResumeChatIntentResult(BaseModel):
    intent: Literal["answer", "clarify", "propose_change", "confirm_change", "reject_change"]
    change_scope: Literal["none", "partial", "full_replace", "reorder"] = "none"
    target_sections: list[Literal["basics", "summary", "education", "skills", "work", "projects", "awards", "custom_sections", "layout"]] = Field(default_factory=list)
    reply_hint: str = ""
