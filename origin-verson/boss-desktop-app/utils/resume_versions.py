"""Shared helpers for creating immutable resume snapshots."""
from __future__ import annotations

from copy import deepcopy

from models import ResumeVersion


def create_resume_snapshot(resume, user_id, source, note=''):
    """Add an uncommitted immutable copy of the current resume state."""
    latest = ResumeVersion.query.filter_by(resume_id=resume.id).order_by(
        ResumeVersion.version_number.desc()
    ).first()
    next_number = (latest.version_number if latest else 0) + 1
    snapshot = ResumeVersion(
        user_id=user_id,
        resume_id=resume.id,
        version_number=next_number,
        title=resume.title,
        content=resume.content,
        structured_data=deepcopy(resume.structured_data) if isinstance(resume.structured_data, dict) else None,
        source=source,
        note=(note or '')[:200],
    )
    return snapshot
