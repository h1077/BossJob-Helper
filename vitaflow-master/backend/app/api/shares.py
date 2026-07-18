from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.response import success
from app.services.preview_service import render_resume_html
from app.services.resume_share_service import get_shared_resume, prepare_public_share_content


router = APIRouter(prefix="/shares", tags=["public-shares"])


@router.get("/{token}")
def shared_resume(token: str, response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    resume = get_shared_resume(db, token)
    resume_data, template_config, title = prepare_public_share_content(resume)
    html = render_resume_html(resume_data, resume.template_id, template_config, resume.language)
    return success(
        {
            "title": title,
            "html": html,
            "expire_time": resume.share_expire_time,
        }
    )
