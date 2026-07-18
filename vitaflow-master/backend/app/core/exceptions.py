import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.response import error_response


logger = logging.getLogger(__name__)

FIELD_NAMES = {
    "email": "邮箱",
    "password": "密码",
    "current_password": "当前密码",
    "new_password": "新密码",
    "username": "用户名",
    "verification_code": "验证码",
}


def friendly_validation_message(exc: RequestValidationError) -> str:
    error = exc.errors()[0]
    field = str(error.get("loc", [""])[-1])
    error_type = str(error.get("type", ""))
    label = FIELD_NAMES.get(field, "提交内容")

    if field == "email":
        return "请输入正确的邮箱地址"
    if field == "verification_code":
        return "请输入 6 位邮箱验证码"
    if error_type == "missing":
        return f"请填写{label}"
    if error_type in {"string_too_short", "string_too_long"}:
        context = error.get("ctx") or {}
        limit = context.get("min_length") or context.get("max_length")
        direction = "至少" if error_type == "string_too_short" else "最多"
        return f"{label}{direction}需要 {limit} 个字符"
    return f"{label}格式不正确"


class AppException(Exception):
    def __init__(self, message: str, code: int = 500):
        self.message = message
        self.code = code


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(_: Request, exc: AppException):
        status_code = exc.code if 400 <= exc.code <= 599 else 200
        return error_response(exc.message, exc.code, status_code)

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(_: Request, exc: StarletteHTTPException):
        return error_response(str(exc.detail), exc.status_code, exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_: Request, exc: RequestValidationError):
        return error_response(friendly_validation_message(exc), 422, 422)

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception while processing %s %s", request.method, request.url.path)
        return error_response(str(exc), 500, 500)
