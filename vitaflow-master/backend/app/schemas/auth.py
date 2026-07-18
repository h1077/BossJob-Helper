from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator


class RegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=6, max_length=100)
    verification_code: str = Field(pattern=r"^\d{6}$")

    @field_validator("username")
    @classmethod
    def username_not_blank(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("用户名至少需要 2 个字符")
        return value

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("密码过长，bcrypt 最多支持 72 字节")
        return value


class LoginRequest(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("密码过长，bcrypt 最多支持 72 字节")
        return value


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    avatar_url: Optional[str] = None
    role: str = "user"
    status: str = "active"
    flow_points: float = 0

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class SendVerificationCodeRequest(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ResetPasswordRequest(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    verification_code: str = Field(pattern=r"^\d{6}$")
    new_password: str = Field(min_length=6, max_length=100)

    @field_validator("new_password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("密码过长，bcrypt 最多支持 72 字节")
        return value


class UpdateProfileRequest(BaseModel):
    username: str = Field(min_length=2, max_length=50)

    @field_validator("username")
    @classmethod
    def username_not_blank(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("用户名至少需要 2 个字符")
        return value


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=6, max_length=100)
    new_password: str = Field(min_length=6, max_length=100)

    @field_validator("current_password", "new_password")
    @classmethod
    def passwords_fit_bcrypt(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("密码过长，bcrypt 最多支持 72 字节")
        return value
