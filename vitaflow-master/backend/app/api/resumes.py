from pathlib import Path
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.response import success
from app.core.security import get_current_user
from app.models.ai_task import AiTask
from app.models.user import User
from app.schemas.resume import ResumeCreate, ResumeOut, ResumeShareUpdate, ResumeUpdate, ResumeVersionCreate, default_template_config
from app.schemas.resume_starter import ResumeStarterCreateRequest
from app.services.ai.chains import import_resume_chain
from app.services.ai.token_usage import activate_token_tracker, estimate_tokens, merge_token_usage, reset_token_tracker
from app.services.ai_config_service import get_active_ai_config
from app.services.flow_points_service import POINT_ZERO, precheck_flow_points, settle_task_flow_points
from app.services.preview_service import render_resume_html
from app.services.pdf_export_service import get_pdf_path
from app.services.resume_import_service import extract_resume_text_from_uploads
from app.services.resume_locale import detect_resume_language, normalize_resume_language
from app.services.resume_service import (
    create_resume,
    create_version,
    delete_resume,
    duplicate_resume,
    get_resume,
    list_resumes,
    update_resume,
)
from app.services.resume_starter_service import create_resume_from_starter
from app.services.resume_share_service import (
    generate_share_token,
    normalize_custom_share_token,
    normalize_expire_time,
    share_is_expired,
)

router = APIRouter(prefix="/resumes", tags=["resumes"])


def _imported_resume_title(resume_data: dict[str, Any], filename: str, language: str = "zh-CN") -> str:
    basics = resume_data.get("basics") if isinstance(resume_data, dict) else {}
    basics = basics if isinstance(basics, dict) else {}
    name = str(basics.get("name") or "").strip()
    title = str(basics.get("title") or "").strip()
    if name and title:
        return f"{name} - {title}"[:80]
    if name:
        return (f"{name}'s Resume" if normalize_resume_language(language) == "en" else f"{name}的简历")[:80]
    stem = Path(filename or "导入简历").stem.strip() or "导入简历"
    return stem[:80]


def _mark_import_task_failed(db: Session, task: AiTask | None, message: str) -> None:
    if not task:
        return
    task.status = "failed"
    task.error_message = message
    task.points_used = POINT_ZERO
    db.add(task)
    db.commit()


@router.get("")
def list_my_resumes(
    page: int = Query(1, ge=1),
    page_size: int = Query(8, ge=1, le=48),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, total = list_resumes(db, current_user.id, page, page_size)
    return success(
        {
            "items": [ResumeOut.model_validate(item).model_dump() for item in items],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


@router.post("")
def create(payload: ResumeCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return success(ResumeOut.model_validate(create_resume(db, current_user.id, payload)).model_dump())


@router.post("/from-starter")
def create_from_starter(
    payload: ResumeStarterCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume = create_resume_from_starter(db, current_user.id, payload.starter_id, payload.level_id, payload.template_id)
    return success(ResumeOut.model_validate(resume).model_dump())


@router.post("/import-file")
def import_resume_file(
    files: list[UploadFile] = File(...),
    template_id: str = Form("tech"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task: AiTask | None = None
    tracker_token = None
    try:
        upload_files = files if isinstance(files, list) else [files]
        text = extract_resume_text_from_uploads(upload_files)
        filenames = [item.filename or "resume" for item in upload_files]
        display_filename = filenames[0] if len(filenames) == 1 else f"{filenames[0]} 等 {len(filenames)} 张图片"
        detected_language = detect_resume_language(text)
        payload = {
            "filename": display_filename,
            "resume_text": text,
            "template_id": template_id,
            "language": detected_language,
        }
        request_tokens = estimate_tokens(payload)
        precheck_flow_points(db, current_user, "import_resume", input_tokens=request_tokens)

        ai_config = get_active_ai_config(db)
        task = AiTask(
            user_id=current_user.id,
            task_type="import_resume",
            status="pending",
            model_name=ai_config.model,
            input_data={
                "source": "import_file",
                "filename": display_filename,
                "filenames": filenames,
                "template_id": template_id,
                "text_length": len(text),
                "model": ai_config.model,
                "model_config_id": ai_config.id,
                "model_name": ai_config.name,
                "request_input_tokens": request_tokens,
            },
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        tracker, tracker_token = activate_token_tracker(request_tokens)
        result = import_resume_chain(payload)
        result_language = normalize_resume_language(result.language or detected_language)
        token_usage = tracker.snapshot()
        template_id = str(template_id or result.template_id or "tech")
        template_config = default_template_config(template_id)

        resume = create_resume(
            db,
            current_user.id,
            ResumeCreate(
                title=_imported_resume_title(result.resume_data, display_filename or "导入简历", result_language),
                language=result_language,
                template_id=template_id,
                resume_data=result.resume_data,
                template_config=template_config,
            ),
        )
        task.resume_id = resume.id
        task.status = "success"
        task.output_data = result.model_dump(mode="json")
        task.tokens_used = int(token_usage.get("total_tokens") or 0)
        task.input_data = merge_token_usage(task.input_data or {}, token_usage)
        db.add(task)
        db.commit()
        db.refresh(task)
        settle_task_flow_points(db, task, description="导入简历生成结构化内容")
        db.commit()
        db.refresh(resume)
        return success(ResumeOut.model_validate(resume).model_dump(), "导入成功")
    except AppException as exc:
        _mark_import_task_failed(db, task, exc.message)
        raise
    except Exception as exc:
        message = str(exc).strip()
        if "Input to ChatPromptTemplate is missing variables" in message:
            message = "简历导入提示词变量配置错误，请联系管理员检查 AI 配置"
        _mark_import_task_failed(db, task, message)
        raise AppException(f"简历导入失败：{message or '请稍后重试'}") from exc
    finally:
        if tracker_token is not None:
            reset_token_tracker(tracker_token)


@router.get("/{resume_id}")
def detail(resume_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return success(ResumeOut.model_validate(get_resume(db, current_user.id, resume_id)).model_dump())


@router.put("/{resume_id}")
def update(resume_id: int, payload: ResumeUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return success(ResumeOut.model_validate(update_resume(db, current_user.id, resume_id, payload)).model_dump())


@router.delete("/{resume_id}")
def remove(resume_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    delete_resume(db, current_user.id, resume_id)
    return success(True)


@router.post("/{resume_id}/duplicate")
def duplicate(resume_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return success(ResumeOut.model_validate(duplicate_resume(db, current_user.id, resume_id)).model_dump())


@router.post("/{resume_id}/versions")
def version(resume_id: int, payload: ResumeVersionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = create_version(db, current_user.id, resume_id, payload.reason)
    return success({"id": item.id})


def _share_data(resume) -> dict[str, Any]:
    active = bool(resume.share_enabled and resume.share_token and not share_is_expired(resume.share_expire_time))
    return {
        "enabled": bool(resume.share_enabled),
        "active": active,
        "token": resume.share_token if resume.share_enabled else None,
        "path": f"/share/{resume.share_token}" if resume.share_enabled and resume.share_token else None,
        "expire_time": resume.share_expire_time,
        "created_time": resume.share_created_time,
        "mask_sensitive": bool(resume.share_mask_sensitive),
    }


@router.get("/{resume_id}/share")
def get_share_settings(
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume = get_resume(db, current_user.id, resume_id)
    return success(_share_data(resume))


@router.put("/{resume_id}/share")
def update_share_settings(
    resume_id: int,
    payload: ResumeShareUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume = get_resume(db, current_user.id, resume_id)
    expire_time = normalize_expire_time(payload.expire_time)
    if payload.enabled and expire_time and expire_time <= datetime.now():
        raise AppException("分享有效期必须晚于当前时间")
    custom_token = normalize_custom_share_token(db, payload.custom_token, resume.id) if payload.custom_token is not None else None
    if payload.enabled and custom_token:
        if custom_token != resume.share_token:
            resume.share_token = custom_token
            resume.share_created_time = datetime.now()
    elif payload.enabled and (not resume.share_token or payload.regenerate_token):
        resume.share_token = generate_share_token(db)
        resume.share_created_time = datetime.now()
    resume.share_enabled = payload.enabled
    resume.share_mask_sensitive = payload.mask_sensitive
    resume.share_expire_time = expire_time if payload.enabled else resume.share_expire_time
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return success(_share_data(resume), "分享设置已更新")


@router.get("/{resume_id}/preview-html", response_class=HTMLResponse)
def preview_html(resume_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    resume = get_resume(db, current_user.id, resume_id)
    html = render_resume_html(resume.resume_data, resume.template_id, resume.template_config, resume.language)
    return HTMLResponse(content=html, headers={"Cache-Control": "no-store"})


@router.get("/{resume_id}/preview-pdf")
def preview_pdf(resume_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    resume = get_resume(db, current_user.id, resume_id)
    path = get_pdf_path(resume)
    return FileResponse(path, media_type="application/pdf", headers={"Cache-Control": "no-store"})
