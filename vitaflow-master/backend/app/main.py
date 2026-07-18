import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, ai, announcements, auth, exports, feedback, files, resume_starters, resumes, shares, templates
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.core.response import success


configure_logging()

logger = logging.getLogger(__name__)
access_logger = logging.getLogger("vitaflow.access")


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting %s backend env=%s debug=%s", settings.app_name, settings.app_env, settings.app_debug)
    yield
    logger.info("Stopping %s backend", settings.app_name)


app = FastAPI(title=settings.app_name, debug=settings.app_debug, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    if not settings.log_access_enabled:
        return await call_next(request)

    start_time = time.perf_counter()
    response = None
    try:
        response = await call_next(request)
        return response
    finally:
        duration_ms = (time.perf_counter() - start_time) * 1000
        status_code = response.status_code if response else 500
        client_host = request.client.host if request.client else "-"
        access_logger.info(
            '%s %s "%s %s" %s %.2fms',
            client_host,
            request.headers.get("x-forwarded-for", "-"),
            request.method,
            request.url.path,
            status_code,
            duration_ms,
        )


app.include_router(auth.router, prefix="/api")
app.include_router(resumes.router, prefix="/api")
app.include_router(resume_starters.router, prefix="/api")
app.include_router(shares.router, prefix="/api")
app.include_router(templates.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(exports.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(announcements.router, prefix="/api")


@app.get("/")
def root():
    return success({"name": settings.app_name, "cn_name": settings.app_cn_name})
