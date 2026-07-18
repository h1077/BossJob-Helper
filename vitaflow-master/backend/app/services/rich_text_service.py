from __future__ import annotations

import html
import re
from typing import Any

import bleach

try:
    from bleach.css_sanitizer import CSSSanitizer
    allowed_css = {
        "text-align", "color", "font-size", "width", "height", "margin", "display", "float",
        "text-decoration", "text-decoration-line", "font-weight", "font-style", "font-family",
        "background", "background-color", "padding", "border", "line-height", "list-style",
        "list-style-type", "vertical-align"
    }
    css_sanitizer = CSSSanitizer(allowed_css_properties=allowed_css)
    clean_kwargs = {"css_sanitizer": css_sanitizer}
except ImportError:
    allowed_css_list = [
        "text-align", "color", "font-size", "width", "height", "margin", "display", "float",
        "text-decoration", "text-decoration-line", "font-weight", "font-style", "font-family",
        "background", "background-color", "padding", "border", "line-height", "list-style",
        "list-style-type", "vertical-align"
    ]
    clean_kwargs = {"styles": allowed_css_list}


ALLOWED_TAGS = {
    "p", "br", "div", "span", "font", "strong", "b", "em", "i", "u", "s", "strike", "del",
    "h1", "h2", "h3", "h4", "blockquote", "ul", "ol", "li", "a", "hr",
}
ALLOWED_ATTRIBUTES = {
    "*": ["style", "align", "class"],
    "a": ["href", "title", "target", "rel", "style", "align"],
    "font": ["color", "size", "style", "align"],
}
ALLOWED_IMAGE_ATTRIBUTES = ["src", "alt", "title", "width", "height", "data-size", "style", "align", "class"]


def _plain_text_to_html(value: str) -> str:
    lines = [line.strip() for line in value.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    paragraphs = []
    for line in lines:
        if not line:
            continue
        if re.search(r"&[a-z]+;|&#[0-9]+;|&#x[0-9a-f]+;", line, flags=re.IGNORECASE):
            paragraphs.append(f"<p>{line}</p>")
        else:
            paragraphs.append(f"<p>{html.escape(line)}</p>")
    return "".join(paragraphs)


def _sanitize_fragment(value: Any, *, allow_images: bool = False) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    text = text.replace("&amp;nbsp;", "&nbsp;")
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", text, flags=re.IGNORECASE | re.DOTALL)
    if not re.search(r"<[a-z][^>]*>", text, flags=re.IGNORECASE):
        text = _plain_text_to_html(text)
    tags = set(ALLOWED_TAGS)
    attributes = dict(ALLOWED_ATTRIBUTES)
    if allow_images:
        tags.add("img")
        attributes["img"] = ALLOWED_IMAGE_ATTRIBUTES
    cleaned = bleach.clean(
        text,
        tags=tags,
        attributes=attributes,
        protocols={"http", "https", "mailto"},
        strip=True,
        **clean_kwargs,
    )
    cleaned = cleaned.replace("&amp;nbsp;", "&nbsp;")
    cleaned = re.sub(r'\srel=("[^"]*"|\'[^\']*\')', "", cleaned, flags=re.IGNORECASE)
    return re.sub(r"<a(?=\s|>)", '<a rel="noopener noreferrer"', cleaned, flags=re.IGNORECASE)


def sanitize_rich_text_html(value: Any, *, allow_images: bool = False) -> str:
    """Render stored rich text and rich list items through one safe HTML path."""
    if value is None:
        return ""
    if isinstance(value, list):
        items = []
        for item in value:
            cleaned = _sanitize_fragment(item, allow_images=allow_images)
            if cleaned.startswith("<p>") and cleaned.endswith("</p>") and cleaned.count("<p>") == 1:
                cleaned = cleaned[3:-4]
            if cleaned:
                items.append(f"<li>{cleaned}</li>")
        return f"<ul>{''.join(items)}</ul>" if items else ""
    return _sanitize_fragment(value, allow_images=allow_images)


def rich_text_has_text(value: Any) -> bool:
    rendered = sanitize_rich_text_html(value)
    return bool(re.sub(r"<[^>]+>|&nbsp;|\s+", "", rendered))


def rich_text_to_plain(value: Any) -> str:
    rendered = sanitize_rich_text_html(value)
    rendered = re.sub(r"<br\s*/?>|</(?:p|div|h[1-4]|blockquote|li)>", "\n", rendered, flags=re.IGNORECASE)
    rendered = re.sub(r"<li[^>]*>", "• ", rendered, flags=re.IGNORECASE)
    text = bleach.clean(rendered, tags=set(), strip=True)
    lines = [html.unescape(line).replace("\xa0", " ").strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)
