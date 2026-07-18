from __future__ import annotations

from fastapi import Request


def get_client_ip(request: Request) -> str:
    """Return the best-effort client IP, honoring common reverse-proxy headers."""
    for header in ("x-forwarded-for", "x-real-ip", "cf-connecting-ip", "x-client-ip"):
        value = request.headers.get(header)
        if value:
            return value.split(",", 1)[0].strip()[:64]
    if request.client and request.client.host:
        return request.client.host[:64]
    return ""
