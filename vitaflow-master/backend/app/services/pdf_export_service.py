from __future__ import annotations

import hashlib
import importlib.metadata
import json
from functools import lru_cache
from pathlib import Path
from threading import Lock
from urllib.parse import unquote, urlparse
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.export_record import ExportRecord
from app.models.resume import Resume
from app.services.preview_service import render_resume_html
from app.services.storage.storage_service import read_uploaded_file


PDF_DEPENDENCY_MESSAGE = (
    "PDF preview/export requires WeasyPrint system libraries. "
    "Please install pango, cairo, gdk-pixbuf and related font libraries on the server."
)
PDF_CACHE_VERSION = "2026-06-27-1"
PDF_RESOURCE_TIMEOUT = 3
_pdf_locks: dict[str, Lock] = {}
_pdf_locks_guard = Lock()
PAGINATION_SCRIPT = r"""
() => {
  function pageHeightPx() {
    const marker = document.createElement('div');
    marker.style.cssText = 'position:absolute;left:-9999px;top:0;height:297mm;width:1px;';
    document.body.appendChild(marker);
    const height = marker.getBoundingClientRect().height;
    marker.remove();
    return height || 1123;
  }

  function cssLengthToPx(value, mmPx, fallbackPx) {
    const raw = String(value || '').trim();
    if (!raw) return fallbackPx || 0;
    const number = parseFloat(raw);
    if (!Number.isFinite(number)) return fallbackPx || 0;
    if (raw.includes('px')) return number;
    if (raw.includes('mm')) return number * mmPx;
    return number * mmPx;
  }

  function clampMargin(value, pageHeight) {
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.min(value, pageHeight * 0.35);
  }

  function pageMetrics(page, pageHeight) {
    const style = getComputedStyle(page);
    const mmPx = pageHeight / 297;
    let firstTop = cssLengthToPx(style.getPropertyValue('--page-margin-top'), mmPx, parseFloat(style.paddingTop));
    let firstBottom = cssLengthToPx(style.getPropertyValue('--page-margin-bottom'), mmPx, parseFloat(style.paddingBottom));
    firstTop = clampMargin(firstTop, pageHeight);
    firstBottom = clampMargin(firstBottom, pageHeight);
    const nextTop = clampMargin(cssLengthToPx(style.getPropertyValue('--page-margin-next-top'), mmPx, firstTop), pageHeight);
    const nextBottom = clampMargin(cssLengthToPx(style.getPropertyValue('--page-margin-next-bottom'), mmPx, firstBottom), pageHeight);
    const nextContentHeight = Math.max(pageHeight - nextTop - nextBottom, pageHeight * 0.35);
    return {
      pageHeight,
      firstContentEnd: pageHeight - firstBottom,
      contentHeight: nextContentHeight,
    };
  }

  function distanceToContentBottom(top, metrics) {
    if (top < metrics.firstContentEnd) return metrics.firstContentEnd - top;
    const offset = top - metrics.firstContentEnd;
    const rest = metrics.contentHeight - (offset % metrics.contentHeight);
    return rest || metrics.contentHeight;
  }

  function settlePageBreaks() {
    const page = document.querySelector('.resume-page');
    if (!page) return;
    const pageHeight = pageHeightPx();
    const metrics = pageMetrics(page, pageHeight);
    const selector = [
      '.section-title',
      '.item-head',
      '.timeline-section-title',
      '.timeline-item-head',
      '.timeline-sub',
      '.timeline-tech',
      '.tag-row',
      '.rich-text-body p',
      '.rich-text-body li'
    ].join(',');
    const targets = Array.prototype.slice.call(document.querySelectorAll(selector));
    targets.forEach((el) => { el.style.marginTop = ''; });
    targets.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (!rect.height || rect.height > pageHeight * 0.65) return;
      const pageRect = page.getBoundingClientRect();
      const top = rect.top - pageRect.top;
      if (top < 0) return;
      const rest = distanceToContentBottom(top, metrics);
      const guardHeight = Math.min(rect.height, 72);
      if (rest > 0 && rest < guardHeight + 8) el.style.marginTop = `${rest + 1}px`;
    });
  }

  settlePageBreaks();
  settlePageBreaks();
}
"""
PAGED_EXPORT_SCRIPT = r"""
() => {
  function pageHeightPx() {
    const marker = document.createElement('div');
    marker.style.cssText = 'position:absolute;left:-9999px;top:0;height:297mm;width:1px;';
    document.body.appendChild(marker);
    const height = marker.getBoundingClientRect().height;
    marker.remove();
    return height || 1123;
  }

  function cssLengthToPx(value, mmPx, fallbackPx) {
    const raw = String(value || '').trim();
    if (!raw) return fallbackPx || 0;
    const number = parseFloat(raw);
    if (!Number.isFinite(number)) return fallbackPx || 0;
    if (raw.includes('px')) return number;
    if (raw.includes('mm')) return number * mmPx;
    return number * mmPx;
  }

  function clampMargin(value, pageHeight) {
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.min(value, pageHeight * 0.35);
  }

  function pageMetrics(page, pageHeight) {
    const style = getComputedStyle(page);
    const mmPx = pageHeight / 297;
    let firstTop = cssLengthToPx(style.getPropertyValue('--page-margin-top'), mmPx, parseFloat(style.paddingTop));
    let firstBottom = cssLengthToPx(style.getPropertyValue('--page-margin-bottom'), mmPx, parseFloat(style.paddingBottom));
    firstTop = clampMargin(firstTop, pageHeight);
    firstBottom = clampMargin(firstBottom, pageHeight);
    const nextTop = clampMargin(cssLengthToPx(style.getPropertyValue('--page-margin-next-top'), mmPx, firstTop), pageHeight);
    const nextBottom = clampMargin(cssLengthToPx(style.getPropertyValue('--page-margin-next-bottom'), mmPx, firstBottom), pageHeight);
    const nextContentHeight = Math.max(pageHeight - nextTop - nextBottom, pageHeight * 0.35);
    return {
      pageHeight,
      firstBottom,
      nextTop,
      nextBottom,
      firstContentEnd: pageHeight - firstBottom,
      contentHeight: nextContentHeight,
    };
  }

  function buildSlices(contentHeight, metrics) {
    const effectiveHeight = Math.max(contentHeight - metrics.firstBottom, 0);
    // Keep this threshold aligned with the editor preview. Browser millimetre
    // conversion and font rounding may otherwise create a blank final page.
    const overflowTolerance = (metrics.pageHeight / 297) * 2;
    const slices = [{
      sourceTop: 0,
      viewportTop: 0,
      viewportHeight: metrics.firstContentEnd,
    }];
    if (effectiveHeight <= metrics.firstContentEnd + overflowTolerance) return slices;

    let sourceTop = metrics.firstContentEnd;
    let guard = 0;
    while (sourceTop < effectiveHeight - overflowTolerance && guard < 80) {
      slices.push({
        sourceTop,
        viewportTop: metrics.nextTop,
        viewportHeight: metrics.contentHeight,
      });
      sourceTop += metrics.contentHeight;
      guard += 1;
    }
    return slices;
  }

  function measuredContentHeight(page, metrics) {
    const pageRect = page.getBoundingClientRect();
    let contentBottom = 0;
    page.querySelectorAll('*').forEach((element) => {
      // Containers can include page padding; leaf nodes represent the actual
      // visible content and avoid reserving that padding twice.
      if (element.children.length > 0) return;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      contentBottom = Math.max(contentBottom, rect.bottom - pageRect.top);
    });

    // Capture direct rich-text nodes without treating grid borders, wrapper
    // padding or other structural overflow as printable page content.
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
      if (textNode.textContent && textNode.textContent.trim()) {
        const parent = textNode.parentElement;
        const style = parent ? getComputedStyle(parent) : null;
        if (!style || (style.display !== 'none' && style.visibility !== 'hidden')) {
          const range = document.createRange();
          range.selectNodeContents(textNode);
          Array.from(range.getClientRects()).forEach((rect) => {
            if (rect.width > 0 && rect.height > 0) {
              contentBottom = Math.max(contentBottom, rect.bottom - pageRect.top);
            }
          });
          range.detach();
        }
      }
      textNode = walker.nextNode();
    }

    return Math.max(contentBottom, 0) + metrics.firstBottom;
  }

  const page = document.querySelector('.resume-page');
  if (!page) return;

  const pageHeight = pageHeightPx();
  const metrics = pageMetrics(page, pageHeight);
  const contentHeight = measuredContentHeight(page, metrics);
  const slices = buildSlices(contentHeight, metrics);
  const pageHtml = page.outerHTML;

  const style = document.createElement('style');
  style.textContent = `
    @page { size: A4; margin: 0; }
    html, body {
      width: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: white !important;
    }
    .vitaflow-export-page {
      position: relative;
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      background: white;
      page-break-after: always;
      break-after: page;
    }
    .vitaflow-export-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .vitaflow-export-window {
      position: absolute;
      left: 0;
      width: 210mm;
      overflow: hidden;
    }
    .vitaflow-export-window > .resume-page {
      width: 210mm !important;
      min-height: 297mm !important;
      margin: 0 !important;
      box-shadow: none !important;
      transform-origin: top left !important;
    }
  `;
  document.head.appendChild(style);
  document.body.innerHTML = '';

  slices.forEach((slice) => {
    const shell = document.createElement('section');
    shell.className = 'vitaflow-export-page';
    const viewport = document.createElement('div');
    viewport.className = 'vitaflow-export-window';
    viewport.style.top = `${slice.viewportTop}px`;
    viewport.style.height = `${slice.viewportHeight}px`;
    viewport.innerHTML = pageHtml;
    const clonedPage = viewport.querySelector('.resume-page');
    if (clonedPage) {
      clonedPage.style.transform = `translateY(-${slice.sourceTop}px)`;
    }
    shell.appendChild(viewport);
    document.body.appendChild(shell);
  });
}
"""


@lru_cache(maxsize=16)
def _package_version(name: str) -> str:
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return ""


def _get_weasyprint():
    try:
        from weasyprint import HTML, default_url_fetcher
    except OSError as exc:
        raise HTTPException(status_code=503, detail=PDF_DEPENDENCY_MESSAGE) from exc
    return HTML, default_url_fetcher


def _object_name_from_base_url(url: str, base_url: str, path_prefix: str = "") -> str | None:
    if not base_url:
        return None
    base = urlparse(base_url.rstrip("/"))
    current = urlparse(url)
    if current.scheme != base.scheme or current.netloc != base.netloc:
        return None
    prefix = f"{base.path.rstrip('/')}/{path_prefix.strip('/')}".rstrip("/")
    if not current.path.startswith(f"{prefix}/"):
        return None
    return unquote(current.path.removeprefix(f"{prefix}/"))


def _get_uploaded_object_name(url: str) -> str | None:
    for base_url, path_prefix in [
        (settings.pdf_base_url, "api/files"),
        (settings.minio_public_url, ""),
        (settings.aliyun_oss_public_url, ""),
    ]:
        object_name = _object_name_from_base_url(url, base_url, path_prefix)
        if object_name:
            return object_name
    return None


def _fetch_external_url(url: str, default_url_fetcher):
    try:
        return default_url_fetcher(url, timeout=PDF_RESOURCE_TIMEOUT)
    except TypeError:
        return default_url_fetcher(url)


def _pdf_url_fetcher(url: str):
    _, default_url_fetcher = _get_weasyprint()
    object_name = _get_uploaded_object_name(url)
    if object_name:
        try:
            content, content_type = read_uploaded_file(object_name)
            return {"string": content, "mime_type": content_type, "redirected_url": url}
        except Exception:
            return _fetch_external_url(url, default_url_fetcher)
    return _fetch_external_url(url, default_url_fetcher)


def _fulfill_uploaded_file_route(route) -> None:
    object_name = _get_uploaded_object_name(route.request.url)
    if not object_name:
        route.continue_()
        return
    try:
        content, content_type = read_uploaded_file(object_name)
        route.fulfill(status=200, body=content, content_type=content_type)
    except Exception:
        route.continue_()


def _hash_directory(path: Path) -> str:
    digest = hashlib.sha256()
    if not path.exists():
        return ""
    for file_path in sorted(item for item in path.rglob("*") if item.is_file()):
        digest.update(str(file_path.relative_to(path)).encode("utf-8"))
        digest.update(file_path.read_bytes())
    return digest.hexdigest()


@lru_cache(maxsize=1)
def _renderer_signature() -> str:
    digest = hashlib.sha256()
    for path in [
        settings.backend_root / "app" / "templates" / "resume",
        settings.backend_root / "app" / "static" / "resume",
    ]:
        digest.update(str(path).encode("utf-8"))
        digest.update(_hash_directory(path).encode("utf-8"))
    return digest.hexdigest()


def _pdf_fingerprint(resume: Resume, renderer: str) -> str:
    payload = {
        "cache_version": PDF_CACHE_VERSION,
        "pdf_base_url": settings.pdf_base_url,
        "renderer_name": renderer,
        "renderer": _renderer_signature(),
        "resume_data": resume.resume_data,
        "language": resume.language,
        "template_config": resume.template_config,
        "template_id": resume.template_id,
        "weasyprint_version": _package_version("weasyprint"),
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


def _cache_dir() -> Path:
    path = settings.export_path / "pdf_cache"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _renderer_order() -> list[str]:
    renderer = (settings.pdf_renderer or "chromium").strip().lower()
    if renderer == "auto":
        return ["chromium", "weasyprint"]
    if renderer == "weasyprint":
        return ["weasyprint"]
    return ["chromium"]


def _cache_path(resume: Resume, renderer: str) -> Path:
    fingerprint = _pdf_fingerprint(resume, renderer)
    return _cache_dir() / f"resume_{resume.id}_{renderer}_{fingerprint}.pdf"


def _get_pdf_lock(key: str) -> Lock:
    with _pdf_locks_guard:
        lock = _pdf_locks.get(key)
        if lock is None:
            lock = Lock()
            _pdf_locks[key] = lock
        return lock


def _cleanup_old_cached_pdfs(resume_id: int, keep_path: Path) -> None:
    for path in _cache_dir().glob(f"resume_{resume_id}_*.pdf"):
        if path != keep_path:
            path.unlink(missing_ok=True)


def _render_pdf_with_weasyprint(html: str, file_path: Path) -> None:
    HTML, _ = _get_weasyprint()
    HTML(string=html, base_url=settings.pdf_base_url, url_fetcher=_pdf_url_fetcher).write_pdf(str(file_path))


def _render_pdf_with_chromium(html: str, file_path: Path) -> None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError("Playwright is not installed") from exc

    launch_options = {
        "headless": True,
        "args": [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
        ],
        "timeout": settings.pdf_render_timeout_ms,
    }
    if settings.pdf_chromium_executable_path:
        launch_options["executable_path"] = settings.pdf_chromium_executable_path

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**launch_options)
        try:
            page = browser.new_page(viewport={"width": 1280, "height": 1800})
            page.route("**/*", _fulfill_uploaded_file_route)
            page.emulate_media(media="screen")
            page.set_content(html, wait_until="load", timeout=settings.pdf_render_timeout_ms)
            page.wait_for_load_state("networkidle", timeout=settings.pdf_render_timeout_ms)
            page.evaluate("() => document.fonts ? document.fonts.ready.then(() => true) : true")
            page.evaluate(PAGINATION_SCRIPT)
            page.evaluate(PAGED_EXPORT_SCRIPT)
            page.emulate_media(media="print")
            page.pdf(
                path=str(file_path),
                format="A4",
                print_background=True,
                prefer_css_page_size=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            )
        finally:
            browser.close()


def _render_pdf_file(renderer: str, html: str, file_path: Path) -> None:
    if renderer == "chromium":
        _render_pdf_with_chromium(html, file_path)
    else:
        _render_pdf_with_weasyprint(html, file_path)


def get_pdf_path(resume: Resume) -> Path:
    candidates = [(renderer, _cache_path(resume, renderer)) for renderer in _renderer_order()]
    for _, file_path in candidates:
        if file_path.exists() and file_path.stat().st_size > 0:
            return file_path

    lock_key = f"resume-{resume.id}"
    with _get_pdf_lock(lock_key):
        for _, file_path in candidates:
            if file_path.exists() and file_path.stat().st_size > 0:
                return file_path

        html = render_resume_html(resume.resume_data, resume.template_id, resume.template_config, resume.language)
        errors = []
        for renderer, file_path in candidates:
            tmp_path = file_path.with_suffix(f".{uuid4().hex}.tmp")
            try:
                _render_pdf_file(renderer, html, tmp_path)
                tmp_path.replace(file_path)
                _cleanup_old_cached_pdfs(resume.id, file_path)
                return file_path
            except Exception as exc:
                errors.append(f"{renderer}: {exc}")
            finally:
                tmp_path.unlink(missing_ok=True)

    raise HTTPException(status_code=500, detail=f"PDF 生成失败：{'；'.join(errors)}")


def render_pdf_bytes(resume: Resume) -> bytes:
    return get_pdf_path(resume).read_bytes()


def export_pdf(db: Session, user_id: int, resume: Resume) -> Path:
    file_path = get_pdf_path(resume)
    db.add(
        ExportRecord(
            user_id=user_id,
            resume_id=resume.id,
            file_type="pdf",
            file_name=file_path.name,
            file_path=str(file_path),
            status="success",
        )
    )
    db.commit()
    return file_path
