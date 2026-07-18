from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.response import success
from app.services.template_service import get_template, list_templates

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("")
def templates(db: Session = Depends(get_db)):
    return success(list_templates(db))


@router.get("/{template_id}")
def template_detail(template_id: str, db: Session = Depends(get_db)):
    template = get_template(template_id, db)
    if not template:
        raise AppException("模板不存在")
    return success(template)
