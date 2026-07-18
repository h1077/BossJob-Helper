from typing import Any

from fastapi.responses import JSONResponse


def success(data: Any = None, message: str = "success") -> dict[str, Any]:
    return {"code": 200, "message": message, "data": data}


def error_response(message: str, code: int = 500, status_code: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"code": code, "message": message, "data": None})
