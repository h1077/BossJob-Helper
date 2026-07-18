import logging
import logging.config
from pathlib import Path
from typing import Any

from app.core.config import settings


LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
VALID_LOG_LEVELS = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}


def _normalize_level(value: str, default: str = "INFO") -> str:
    level = (value or "").strip().upper()
    return level if level in VALID_LOG_LEVELS else default


def _resolve_log_file() -> Path | None:
    if not settings.log_file:
        return None
    path = Path(settings.log_file)
    return path if path.is_absolute() else settings.backend_root / path


def configure_logging() -> None:
    log_level = _normalize_level(settings.log_level)
    uvicorn_level = _normalize_level(settings.uvicorn_log_level, log_level)
    sqlalchemy_level = _normalize_level(settings.sqlalchemy_log_level, "WARNING")

    handlers: dict[str, dict[str, Any]] = {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
            "stream": "ext://sys.stdout",
        },
    }
    root_handlers = ["console"]

    log_file = _resolve_log_file()
    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        handlers["file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "formatter": "standard",
            "filename": str(log_file),
            "maxBytes": settings.log_file_max_bytes,
            "backupCount": settings.log_file_backup_count,
            "encoding": "utf-8",
        }
        root_handlers.append("file")

    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "standard": {
                    "format": LOG_FORMAT,
                    "datefmt": DATE_FORMAT,
                },
            },
            "handlers": handlers,
            "root": {
                "level": log_level,
                "handlers": root_handlers,
            },
            "loggers": {
                "vitaflow": {
                    "level": log_level,
                    "handlers": root_handlers,
                    "propagate": False,
                },
                "app": {
                    "level": log_level,
                    "handlers": root_handlers,
                    "propagate": False,
                },
                "uvicorn": {
                    "level": uvicorn_level,
                    "handlers": root_handlers,
                    "propagate": False,
                },
                "uvicorn.error": {
                    "level": uvicorn_level,
                    "handlers": root_handlers,
                    "propagate": False,
                },
                "uvicorn.access": {
                    "level": uvicorn_level,
                    "handlers": root_handlers,
                    "propagate": False,
                },
                "sqlalchemy.engine": {
                    "level": sqlalchemy_level,
                    "handlers": root_handlers,
                    "propagate": False,
                },
            },
        }
    )
