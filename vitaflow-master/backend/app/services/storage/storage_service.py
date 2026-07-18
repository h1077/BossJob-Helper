from __future__ import annotations

from io import BytesIO
from typing import Iterator
from uuid import uuid4

from fastapi import UploadFile
from fastapi.responses import StreamingResponse
from minio import Minio
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import AppException
from app.models.resume import UploadedFile


ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_SIZE = 3 * 1024 * 1024
CHUNK_SIZE = 32 * 1024
CACHE_MAX_AGE = 31536000
CACHE_CONTROL = f"public, max-age={CACHE_MAX_AGE}, immutable"


def _provider() -> str:
    provider = (settings.storage_provider or "minio").strip().lower()
    if provider not in {"minio", "aliyun_oss"}:
        raise AppException("STORAGE_PROVIDER 只能配置为 minio 或 aliyun_oss")
    return provider


def _proxy_url(object_name: str) -> str:
    return f"{settings.pdf_base_url.rstrip('/')}/api/files/{object_name}"


def _public_url(object_name: str) -> str:
    if _provider() == "aliyun_oss":
        base_url = settings.aliyun_oss_public_url.strip()
        if base_url:
            return f"{base_url.rstrip('/')}/{object_name}"
    else:
        base_url = settings.minio_public_url.strip()
        if base_url:
            return f"{base_url.rstrip('/')}/{object_name}"
    return _proxy_url(object_name)


def _file_url(object_name: str) -> str:
    mode = (settings.storage_public_url_mode or "proxy").strip().lower()
    return _public_url(object_name) if mode == "public" else _proxy_url(object_name)


def _stream_cache_headers(object_name: str) -> dict[str, str]:
    safe_etag = object_name.replace('"', "")
    return {
        "Cache-Control": CACHE_CONTROL,
        "ETag": f'"{safe_etag}"',
    }


def get_minio_client() -> Minio:
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )


def get_aliyun_oss_bucket():
    if not settings.aliyun_oss_endpoint or not settings.aliyun_oss_bucket:
        raise AppException("未配置阿里云 OSS Endpoint 或 Bucket")
    if not settings.aliyun_oss_access_key_id or not settings.aliyun_oss_access_key_secret:
        raise AppException("未配置阿里云 OSS AccessKey")
    try:
        import oss2
    except ImportError as exc:
        raise AppException("未安装阿里云 OSS SDK，请执行 pip install oss2") from exc
    auth = oss2.Auth(settings.aliyun_oss_access_key_id, settings.aliyun_oss_access_key_secret)
    endpoint = settings.aliyun_oss_endpoint.strip()
    if not endpoint.startswith(("http://", "https://")):
        endpoint = f"{'https' if settings.aliyun_oss_secure else 'http'}://{endpoint}"
    return oss2.Bucket(auth, endpoint, settings.aliyun_oss_bucket)


def _upload_minio(object_name: str, content: bytes, content_type: str) -> None:
    client = get_minio_client()
    if not client.bucket_exists(settings.minio_bucket):
        client.make_bucket(settings.minio_bucket)
    client.put_object(
        settings.minio_bucket,
        object_name,
        BytesIO(content),
        length=len(content),
        content_type=content_type,
        metadata={"Cache-Control": CACHE_CONTROL},
    )


def _upload_aliyun_oss(object_name: str, content: bytes, content_type: str) -> None:
    bucket = get_aliyun_oss_bucket()
    result = bucket.put_object(object_name, content, headers={"Content-Type": content_type, "Cache-Control": CACHE_CONTROL})
    status = getattr(result, "status", 0)
    if status < 200 or status >= 300:
        raise AppException(f"阿里云 OSS 上传失败，状态码：{status}")


def upload_avatar(db: Session, user_id: int, file: UploadFile) -> dict[str, str]:
    if file.content_type not in ALLOWED_TYPES:
        raise AppException("头像仅支持 jpg、jpeg、png、webp")
    content = file.file.read()
    if len(content) > MAX_SIZE:
        raise AppException("头像不能超过 3MB")

    suffix = ALLOWED_TYPES[file.content_type]
    object_name = f"avatar/{user_id}_{uuid4().hex}{suffix}"

    if _provider() == "aliyun_oss":
        _upload_aliyun_oss(object_name, content, file.content_type)
    else:
        _upload_minio(object_name, content, file.content_type)

    url = _file_url(object_name)
    db.add(
        UploadedFile(
            user_id=user_id,
            file_type="avatar",
            file_name=file.filename or object_name,
            object_name=object_name,
            file_url=url,
            content_type=file.content_type,
            file_size=len(content),
        )
    )
    db.commit()
    return {"url": url, "object_name": object_name, "provider": _provider()}


def upload_announcement_image(db: Session, user_id: int, file: UploadFile) -> dict[str, str]:
    if file.content_type not in ALLOWED_TYPES:
        raise AppException("公告图片仅支持 jpg、jpeg、png、webp")
    content = file.file.read()
    if len(content) > 5 * 1024 * 1024:
        raise AppException("公告图片不能超过 5MB")

    suffix = ALLOWED_TYPES[file.content_type]
    object_name = f"announcement/{uuid4().hex}{suffix}"
    if _provider() == "aliyun_oss":
        _upload_aliyun_oss(object_name, content, file.content_type)
    else:
        _upload_minio(object_name, content, file.content_type)

    url = _file_url(object_name)
    db.add(
        UploadedFile(
            user_id=user_id,
            file_type="announcement_image",
            file_name=file.filename or object_name,
            object_name=object_name,
            file_url=url,
            content_type=file.content_type,
            file_size=len(content),
        )
    )
    db.commit()
    return {"url": url, "object_name": object_name, "provider": _provider()}


def upload_ai_chat_image(db: Session, user_id: int, file: UploadFile) -> dict[str, str]:
    if file.content_type not in ALLOWED_TYPES:
        raise AppException("AI 对话图片仅支持 jpg、jpeg、png、webp")
    content = file.file.read()
    if len(content) > 5 * 1024 * 1024:
        raise AppException("AI 对话图片不能超过 5MB")

    suffix = ALLOWED_TYPES[file.content_type]
    object_name = f"ai-chat/{user_id}_{uuid4().hex}{suffix}"
    if _provider() == "aliyun_oss":
        _upload_aliyun_oss(object_name, content, file.content_type)
    else:
        _upload_minio(object_name, content, file.content_type)

    url = _file_url(object_name)
    db.add(
        UploadedFile(
            user_id=user_id,
            file_type="ai_chat_image",
            file_name=file.filename or object_name,
            object_name=object_name,
            file_url=url,
            content_type=file.content_type,
            file_size=len(content),
        )
    )
    db.commit()
    return {"url": url, "object_name": object_name, "provider": _provider()}


def _iter_oss_object(obj) -> Iterator[bytes]:
    try:
        while True:
            chunk = obj.read(CHUNK_SIZE)
            if not chunk:
                break
            yield chunk
    finally:
        close = getattr(obj, "close", None)
        if callable(close):
            close()


def stream_uploaded_file(object_name: str) -> StreamingResponse:
    if _provider() == "aliyun_oss":
        obj = get_aliyun_oss_bucket().get_object(object_name)
        content_type = getattr(obj, "headers", {}).get("Content-Type", "application/octet-stream")
        return StreamingResponse(_iter_oss_object(obj), media_type=content_type, headers=_stream_cache_headers(object_name))

    response = get_minio_client().get_object(settings.minio_bucket, object_name)
    return StreamingResponse(
        response.stream(CHUNK_SIZE),
        media_type=response.headers.get("Content-Type", "application/octet-stream"),
        headers=_stream_cache_headers(object_name),
    )


def read_uploaded_file(object_name: str) -> tuple[bytes, str]:
    if _provider() == "aliyun_oss":
        obj = get_aliyun_oss_bucket().get_object(object_name)
        try:
            content = obj.read()
            content_type = getattr(obj, "headers", {}).get("Content-Type", "application/octet-stream")
            return content, content_type
        finally:
            close = getattr(obj, "close", None)
            if callable(close):
                close()

    response = get_minio_client().get_object(settings.minio_bucket, object_name)
    try:
        return response.read(), response.headers.get("Content-Type", "application/octet-stream")
    finally:
        response.close()
        response.release_conn()
