from pydantic import BaseModel


class ExportOut(BaseModel):
    file_name: str
    file_path: str
