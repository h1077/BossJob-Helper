from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class GenerateResumeRequest(BaseModel):
    target_position: str
    language: str = "zh-CN"
    personal_info: str = ""
    basics: dict[str, Any] = Field(default_factory=dict)
    education: str = ""
    skills: list[str] = Field(default_factory=list)
    projects: str = ""
    work: str = ""
    awards: str = ""
    expected_location: str = ""
    expected_salary: str = ""
    status: str = ""
    style: str = "技术型"


class ScoreResumeRequest(BaseModel):
    resume_id: Optional[int] = None
    resume_data: dict[str, Any]
    target_position: str = ""
    job_description: str = ""


class OptimizeSectionRequest(BaseModel):
    resume_id: Optional[int] = None
    section_type: str
    section_title: str
    section_content: Any
    full_resume_data: dict[str, Any] = Field(default_factory=dict)
    target_position: str = ""
    job_description: str = ""
    optimize_style: str = "更专业"


class JdOptimizeRequest(BaseModel):
    resume_id: Optional[int] = None
    resume_data: dict[str, Any]
    job_description: str


class TranslateResumeRequest(BaseModel):
    resume_id: Optional[int] = None
    resume_data: dict[str, Any]
    current_language: str = "zh-CN"
    target_language: Literal["zh-CN", "en"]
