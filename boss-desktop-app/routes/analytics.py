"""
用户行为分析 API
"""
from flask import Blueprint, request, jsonify
from models import db, AnalyticsEvent
from utils.auth import get_current_user

analytics_bp = Blueprint('analytics', __name__, url_prefix='/api/analytics')

PRIVACY_FIELDS = {'password', 'api_key', 'apiKey', 'token', 'secret',
                  'resume_text', 'resumeText', 'resume_content', 'resumeContent'}


def sanitize_metadata(meta):
    if not isinstance(meta, dict):
        return meta
    cleaned = {}
    for k, v in meta.items():
        if k in PRIVACY_FIELDS:
            continue
        if isinstance(v, dict):
            cleaned[k] = sanitize_metadata(v)
        elif isinstance(v, str) and len(v) > 200:
            cleaned[k] = v[:100] + f'...({len(v)} chars)'
        else:
            cleaned[k] = v
    return cleaned


@analytics_bp.route('/event', methods=['POST'])
def ingest_event():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400

    events = data if isinstance(data, list) else [data]
    user = get_current_user()
    user_id = user.id if user else None

    seen_keys = set()
    valid = []
    for e in events:
        event_type = (e.get('event_type') or '').strip()
        session_id = (e.get('session_id') or '').strip()
        if not event_type or not session_id:
            continue
        dedup = f"{event_type}|{session_id}|{e.get('client_ts', '')}"
        if dedup in seen_keys:
            continue
        seen_keys.add(dedup)
        valid.append({
            'user_id': e.get('user_id', user_id),
            'event_type': event_type,
            'category': e.get('category', 'general'),
            'page': e.get('page', ''),
            'metadata': sanitize_metadata(e.get('metadata', {})),
            'session_id': session_id,
            'client_ts': e.get('client_ts'),
        })

    if not valid:
        return jsonify({'success': True, 'count': 0})

    try:
        count = AnalyticsEvent.batch_create(valid)
        return jsonify({'success': True, 'count': count})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@analytics_bp.route('/stats', methods=['GET'])
def get_stats():
    from sqlalchemy import func
    from datetime import datetime, timedelta

    week_ago = datetime.utcnow() - timedelta(days=7)
    total_recent = AnalyticsEvent.query.filter(AnalyticsEvent.server_ts >= week_ago).count()

    top_events = db.session.query(
        AnalyticsEvent.event_type, func.count(AnalyticsEvent.id)
    ).group_by(AnalyticsEvent.event_type).order_by(
        func.count(AnalyticsEvent.id).desc()
    ).limit(30).all()

    daily = db.session.query(
        func.date(AnalyticsEvent.server_ts), func.count(AnalyticsEvent.id)
    ).filter(AnalyticsEvent.server_ts >= week_ago).group_by(
        func.date(AnalyticsEvent.server_ts)
    ).order_by(func.date(AnalyticsEvent.server_ts)).all()

    return jsonify({
        'success': True,
        'data': {
            'total_events_7d': total_recent,
            'top_events': [{'type': t, 'count': c} for t, c in top_events],
            'daily': [{'date': str(d), 'count': c} for d, c in daily],
        }
    })
