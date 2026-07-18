from pydantic import BaseModel


class FileUploadOut(BaseModel):
    url: str
    object_name: str
