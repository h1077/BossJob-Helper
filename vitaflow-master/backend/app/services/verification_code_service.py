from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import uuid
from collections.abc import Callable

from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.redis import redis_client

logger = logging.getLogger(__name__)


class VerificationCodeService:
    def __init__(self, client: Redis):
        self.client = client

    @staticmethod
    def _email_id(email: str) -> str:
        return hashlib.sha256(email.encode("utf-8")).hexdigest()

    @staticmethod
    def _code_id(email: str, code: str) -> str:
        return hmac.new(
            settings.jwt_secret_key.encode("utf-8"),
            f"{email}:{code}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    def _key(self, email: str, suffix: str, purpose: str = "register") -> str:
        return f"{settings.redis_key_prefix}:auth:{purpose}:{self._email_id(email)}:{suffix}"

    def _code_key(self, email: str, code_id: str, purpose: str = "register") -> str:
        return self._key(email, f"code:{code_id}", purpose)

    def issue_code(self, email: str, send_email: Callable[[str, str], None], purpose: str) -> None:
        rate_key = self._key(email, "send-rate", purpose)
        try:
            acquired = self.client.set(
                rate_key,
                "1",
                nx=True,
                ex=settings.email_code_send_interval_seconds,
            )
        except RedisError as exc:
            raise AppException("验证码服务暂不可用，请稍后重试") from exc

        if not acquired:
            try:
                remaining = max(self.client.ttl(rate_key), 1)
            except RedisError:
                remaining = settings.email_code_send_interval_seconds
            raise AppException(f"请在 {remaining} 秒后重新发送")

        code = f"{secrets.randbelow(1_000_000):06d}"
        code_id = self._code_id(email, code)
        code_key = self._code_key(email, code_id, purpose)
        index_key = self._key(email, "codes", purpose)
        ttl_seconds = settings.email_code_expire_minutes * 60

        try:
            with self.client.pipeline(transaction=True) as pipe:
                pipe.set(code_key, "1", ex=ttl_seconds)
                pipe.sadd(index_key, code_id)
                # 索引仅用于注册成功后的批量清理；每个验证码仍由独立 Key 的 TTL 控制有效期。
                pipe.expire(index_key, ttl_seconds)
                pipe.execute()
        except RedisError as exc:
            self._delete_quietly(rate_key)
            raise AppException("验证码服务暂不可用，请稍后重试") from exc

        try:
            send_email(email, code)
        except Exception:
            # 邮件投递失败时撤销验证码和限频，用户可以立即重试。
            self._delete_code_quietly(email, code_id, rate_key, purpose)
            raise

    def verify_code(self, email: str, code: str, purpose: str) -> None:
        code_key = self._code_key(email, self._code_id(email, code), purpose)
        try:
            valid = bool(self.client.exists(code_key))
        except RedisError as exc:
            raise AppException("验证码服务暂不可用，请稍后重试") from exc
        if not valid:
            raise AppException("验证码错误或已过期，请重新获取")

    def acquire_lock(self, email: str, purpose: str, conflict_message: str) -> str:
        lock_key = self._key(email, "lock", purpose)
        token = uuid.uuid4().hex
        try:
            acquired = self.client.set(
                lock_key,
                token,
                nx=True,
                ex=settings.email_code_register_lock_seconds,
            )
        except RedisError as exc:
            raise AppException("验证码服务暂不可用，请稍后重试") from exc
        if not acquired:
            raise AppException(conflict_message)
        return token

    def release_lock(self, email: str, token: str, purpose: str) -> None:
        script = """
        if redis.call('get', KEYS[1]) == ARGV[1] then
            return redis.call('del', KEYS[1])
        end
        return 0
        """
        try:
            self.client.eval(script, 1, self._key(email, "lock", purpose), token)
        except RedisError:
            logger.warning("Failed to release verification code lock", exc_info=True)

    def invalidate_codes(self, email: str, purpose: str) -> None:
        index_key = self._key(email, "codes", purpose)
        try:
            code_ids = self.client.smembers(index_key)
            keys = [self._code_key(email, code_id, purpose) for code_id in code_ids]
            keys.extend([index_key, self._key(email, "send-rate", purpose)])
            if keys:
                self.client.delete(*keys)
        except RedisError:
            # 操作已完成，残留 Key 也会自动过期。
            logger.warning("Failed to invalidate registration codes", exc_info=True)

    def issue_registration_code(self, email: str, send_email: Callable[[str, str], None]) -> None:
        self.issue_code(email, send_email, "register")

    def verify_registration_code(self, email: str, code: str) -> None:
        self.verify_code(email, code, "register")

    def acquire_registration_lock(self, email: str) -> str:
        return self.acquire_lock(email, "register", "注册请求正在处理中，请勿重复提交")

    def release_registration_lock(self, email: str, token: str) -> None:
        self.release_lock(email, token, "register")

    def invalidate_registration_codes(self, email: str) -> None:
        self.invalidate_codes(email, "register")

    def issue_password_reset_code(self, email: str, send_email: Callable[[str, str], None]) -> None:
        self.issue_code(email, send_email, "password-reset")

    def verify_password_reset_code(self, email: str, code: str) -> None:
        self.verify_code(email, code, "password-reset")

    def acquire_password_reset_lock(self, email: str) -> str:
        return self.acquire_lock(email, "password-reset", "密码重置请求正在处理中，请勿重复提交")

    def release_password_reset_lock(self, email: str, token: str) -> None:
        self.release_lock(email, token, "password-reset")

    def invalidate_password_reset_codes(self, email: str) -> None:
        self.invalidate_codes(email, "password-reset")

    def _delete_quietly(self, *keys: str) -> None:
        try:
            self.client.delete(*keys)
        except RedisError:
            logger.warning("Failed to clean up Redis keys", exc_info=True)

    def _delete_code_quietly(self, email: str, code_id: str, rate_key: str, purpose: str) -> None:
        try:
            with self.client.pipeline(transaction=True) as pipe:
                pipe.delete(self._code_key(email, code_id, purpose), rate_key)
                pipe.srem(self._key(email, "codes", purpose), code_id)
                pipe.execute()
        except RedisError:
            logger.warning("Failed to roll back verification code", exc_info=True)


verification_code_service = VerificationCodeService(redis_client)
