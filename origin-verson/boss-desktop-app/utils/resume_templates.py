"""Resume template configuration contract shared by API and renderers."""
from __future__ import annotations

from copy import deepcopy
import re


TEMPLATE_IDS = ('classic', 'ats_compact', 'project_focus')

DEFAULT_TEMPLATE_CONFIG = {
    'schemaVersion': 1,
    'templateId': 'classic',
    'accentColor': '#2563eb',
    'bodyFontSize': 13,
    'lineHeight': 1.7,
    'pageMargin': 16,
}

TEMPLATE_METADATA = (
    {
        'id': 'classic',
        'name': '经典',
        'description': '适合大多数中文求职场景的平衡版式。',
    },
    {
        'id': 'ats_compact',
        'name': '紧凑 ATS',
        'description': '优先保证文本可解析性和信息密度。',
    },
    {
        'id': 'project_focus',
        'name': '项目优先',
        'description': '先突出项目成果与技术能力。',
    },
)

_HEX_COLOR = re.compile(r'^#[0-9a-fA-F]{6}$')


def default_template_config():
    """Return a fresh default so callers cannot mutate shared state."""
    return deepcopy(DEFAULT_TEMPLATE_CONFIG)


def normalize_template_config(config):
    """Return a safe, complete template configuration for new and legacy data."""
    normalized = default_template_config()
    if not isinstance(config, dict):
        return normalized

    template_id = config.get('templateId', config.get('template_id'))
    if template_id in TEMPLATE_IDS:
        normalized['templateId'] = template_id

    accent_color = config.get('accentColor', config.get('themeColor'))
    if isinstance(accent_color, str) and _HEX_COLOR.fullmatch(accent_color):
        normalized['accentColor'] = accent_color.lower()

    _copy_number(config, normalized, 'bodyFontSize', 10.5, 14)
    _copy_number(config, normalized, 'lineHeight', 1.25, 1.8)
    _copy_number(config, normalized, 'pageMargin', 10, 22)
    return normalized


def _copy_number(source, target, key, minimum, maximum):
    value = source.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return
    if minimum <= value <= maximum:
        target[key] = value
