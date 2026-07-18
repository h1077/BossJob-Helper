from typing import Literal

from pydantic import BaseModel, Field


class AnnouncementWrite(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=100000)
    status: Literal["draft", "published"] = "draft"


class AnnouncementStatusUpdate(BaseModel):
    status: Literal["draft", "published"]
