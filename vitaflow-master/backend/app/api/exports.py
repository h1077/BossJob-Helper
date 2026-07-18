from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.pdf_export_service import export_pdf
from app.services.resume_service import get_resume
from app.services.word_export_service import export_word

router = APIRouter(prefix="/resumes", tags=["exports"])


@router.post("/{resume_id}/export/pdf")
def export_resume_pdf(resume_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    resume = get_resume(db, current_user.id, resume_id)
    path = export_pdf(db, current_user.id, resume)
    return FileResponse(path, filename=path.name, media_type="application/pdf")


@router.post("/{resume_id}/export/word")
def export_resume_word(resume_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    resume = get_resume(db, current_user.id, resume_id)
    path = export_word(db, current_user.id, resume)
    return FileResponse(path, filename=path.name, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
