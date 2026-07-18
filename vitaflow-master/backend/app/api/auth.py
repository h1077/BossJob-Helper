from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.exceptions import AppException
from app.core.request_utils import get_client_ip
from app.core.response import success
from app.core.security import create_access_token, get_current_user, get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SendVerificationCodeRequest,
    TokenOut,
    UpdateProfileRequest,
    UserOut,
)
from app.services.email_service import send_password_reset_code, send_registration_code
from app.services.app_settings_service import get_int_setting
from app.services.flow_points_service import add_point_transaction
from app.services.verification_code_service import verification_code_service

router = APIRouter(prefix="/auth", tags=["auth"])


def normalize_email(email: str) -> str:
    return email.strip().lower()


@router.get("/user-agreement")
def get_user_agreement(db: Session = Depends(get_db)):
    from app.services.app_settings_service import get_setting
    agreement = get_setting(db, "user_agreement", "")
    return success({"user_agreement": agreement})


@router.post("/verification-code")
def send_verification_code(payload: SendVerificationCodeRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise AppException("该邮箱已注册")

    verification_code_service.issue_registration_code(email, send_registration_code)
    return success(message="验证码已发送")


@router.post("/password-reset-code")
def send_password_reset_verification_code(
    payload: SendVerificationCodeRequest,
    db: Session = Depends(get_db),
):
    email = normalize_email(payload.email)
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if not user:
        raise AppException("该邮箱尚未注册")
    if user.status != "active":
        raise AppException("账号已被停用")

    verification_code_service.issue_password_reset_code(email, send_password_reset_code)
    return success(message="验证码已发送")


@router.post("/register")
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    client_ip = get_client_ip(request)
    lock_token = verification_code_service.acquire_registration_lock(email)
    try:
        if db.scalar(select(User).where(User.username == payload.username)):
            raise AppException("用户名已存在")
        if db.scalar(select(User).where(func.lower(User.email) == email)):
            raise AppException("邮箱已存在")

        verification_code_service.verify_registration_code(email, payload.verification_code)
        user = User(
            username=payload.username.strip(),
            email=email,
            password_hash=get_password_hash(payload.password),
            register_ip=client_ip,
        )
        db.add(user)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise AppException("用户名或邮箱已存在") from exc
        db.refresh(user)
        gift_points = get_int_setting(db, "signup_gift_points", 0)
        if gift_points > 0:
            add_point_transaction(
                db,
                user,
                "signup_gift",
                gift_points,
                "新用户注册赠送 Flow Points",
            )
            db.commit()
            db.refresh(user)
        verification_code_service.invalidate_registration_codes(email)
        return success(UserOut.model_validate(user).model_dump())
    finally:
        verification_code_service.release_registration_lock(email, lock_token)


@router.post("/login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.email) == normalize_email(payload.email)))
    if not user or not verify_password(payload.password, user.password_hash):
        raise AppException("邮箱或密码错误")
    if user.status != "active":
        raise AppException("账号已被停用")
    if user.email.lower() in settings.admin_email_list and user.role != "admin":
        user.role = "admin"
    user.last_login_ip = get_client_ip(request)
    user.last_login_time = datetime.now()
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return success(TokenOut(access_token=token, user=UserOut.model_validate(user)).model_dump())


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    lock_token = verification_code_service.acquire_password_reset_lock(email)
    try:
        user = db.scalar(select(User).where(func.lower(User.email) == email))
        if not user:
            raise AppException("该邮箱尚未注册")
        if user.status != "active":
            raise AppException("账号已被停用")
        if verify_password(payload.new_password, user.password_hash):
            raise AppException("新密码不能与原密码相同")

        verification_code_service.verify_password_reset_code(email, payload.verification_code)
        user.password_hash = get_password_hash(payload.new_password)
        db.add(user)
        db.commit()
        verification_code_service.invalidate_password_reset_codes(email)
        return success(message="密码已重置，请使用新密码登录")
    finally:
        verification_code_service.release_password_reset_lock(email, lock_token)


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return success(UserOut.model_validate(current_user).model_dump())


@router.put("/profile")
def update_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    username = payload.username.strip()
    exists = db.scalar(select(User.id).where(User.username == username, User.id != current_user.id))
    if exists:
        raise AppException("用户名已存在")
    current_user.username = username
    db.commit()
    db.refresh(current_user)
    return success(UserOut.model_validate(current_user).model_dump(), "用户名已更新")


@router.put("/password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise AppException("当前密码错误")
    if payload.current_password == payload.new_password:
        raise AppException("新密码不能与当前密码相同")
    current_user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    return success(message="密码已修改")
