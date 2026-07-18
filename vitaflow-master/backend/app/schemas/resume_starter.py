from pydantic import BaseModel, Field


class ResumeStarterCreateRequest(BaseModel):
    starter_id: str = Field(min_length=1, max_length=80)
    level_id: str = "junior"
    template_id: str = "__industry_default"
