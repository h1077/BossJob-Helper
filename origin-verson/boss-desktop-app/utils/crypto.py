"""
API Key 本地加密 — 用机器特征派生密钥，防止 .db 文件被直接读取
"""
import os
import hashlib
import base64
from cryptography.fernet import Fernet


def _derive_key():
    machine_id = hashlib.sha256(
        (os.environ.get('COMPUTERNAME', '') + os.environ.get('USERNAME', '') + 'boss-desktop-salt').encode()
    ).digest()
    return base64.urlsafe_b64encode(machine_id[:32])


_fernet = None


def _get_fernet():
    global _fernet
    if _fernet is None:
        _fernet = Fernet(_derive_key())
    return _fernet


def encrypt_key(plaintext):
    if not plaintext:
        return ''
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_key(ciphertext):
    if not ciphertext:
        return ''
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except Exception:
        return ciphertext  # 兼容旧数据（明文），尝试直接返回
