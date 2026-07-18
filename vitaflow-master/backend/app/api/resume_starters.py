from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.response import success
from app.services.resume_starter_service import list_resume_starters

router = APIRouter(prefix="/resume-starters", tags=["resume-starters"])


@router.get("")
def starters(industry_id: str = "", db: Session = Depends(get_db)):
    return success(list_resume_starters(db, industry_id))
