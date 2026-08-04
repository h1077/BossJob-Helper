/**
 * Resume template selection + server-side preview.
 * Replaces the old inline buildHTML() with the unified renderer.
 */
let _templateConfig = { templateId: 'classic', accentColor: '#2563eb', bodyFontSize: 13, lineHeight: 1.7, pageMargin: 16 };
let _previewVersion = 0;
let _previewController = null;

async function initTemplateControls() {
  try {
    const resp = await fetch('/api/resumes/templates', { headers: authHeaders() });
    const result = await resp.json();
    if (!result.success) return;
    const templates = result.data;
    const container = document.getElementById('template-options');
    if (!container) return;
    container.innerHTML = templates.map(t => {
      const active = _templateConfig.templateId === t.id ? ' active' : '';
      return `<button class="tpl-option${active}" data-tpl="${t.id}" title="${t.description}">${t.name}</button>`;
    }).join('');
    container.querySelectorAll('.tpl-option').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tpl-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _templateConfig.templateId = btn.dataset.tpl;
        debouncePreview();
      });
    });
  } catch (e) { /* template list not critical */ }

  const accentInput = document.getElementById('tpl-accent');
  if (accentInput) {
    accentInput.value = _templateConfig.accentColor;
    accentInput.addEventListener('input', () => {
      _templateConfig.accentColor = accentInput.value;
      debouncePreview();
    });
  }
}

// ── Server-side preview (replaces old inline buildHTML) ──

function debouncePreview() {
  clearTimeout(window._previewTimer);
  window._previewTimer = setTimeout(refreshPreview, 250);
}

async function refreshPreview() {
  if (!_data) return;
  const version = ++_previewVersion;
  if (_previewController) _previewController.abort();
  _previewController = new AbortController();

  const frame = document.getElementById('preview-frame');
  const status = document.getElementById('zoom-label');
  if (status) status.textContent = '正在生成预览…';

  try {
    const resp = await fetch('/api/resumes/render-preview', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title: document.getElementById('ed-title')?.value || '简历预览',
        structuredData: _data,
        templateConfig: _templateConfig,
        hiddenModules: _hiddenModules || [],
      }),
      signal: _previewController.signal,
    });
    if (version !== _previewVersion) return;
    const result = await resp.json();
    if (!result.success) {
      if (status) status.textContent = '预览失败: ' + (result.error || '未知错误');
      return;
    }
    if (frame) {
      frame.style.transform = `scale(${_zoom || 0.65})`;
      frame.style.transformOrigin = 'top center';
      frame.srcdoc = result.data.html;
    }
    if (status) status.textContent = `简历预览 · ${Math.round((_zoom || 0.65) * 100)}% · ${result.data.renderMs}ms`;
    _templateConfig = result.data.templateConfig;
  } catch (e) {
    if (e.name === 'AbortError') return;
    if (status) status.textContent = '无法生成预览，请确认桌面服务正在运行。';
  }
}

// ── Load template config from saved resume ──

function loadTemplateConfig(cfg) {
  if (cfg && cfg.templateId) {
    _templateConfig = {
      templateId: cfg.templateId,
      accentColor: cfg.accentColor || '#2563eb',
      bodyFontSize: cfg.bodyFontSize || 13,
      lineHeight: cfg.lineHeight || 1.7,
      pageMargin: cfg.pageMargin || 16,
    };
    const accent = document.getElementById('tpl-accent');
    if (accent) accent.value = _templateConfig.accentColor;
  }
}

function getTemplateConfig() {
  return _templateConfig;
}

// ── Override old export to include template config ──

async function exportPdf(type) {
  if (!_resumeId) { await saveResume(); if (!_resumeId) return alert('请先保存简历'); }
  const url = type === 'latex' ? '/api/ai/export-pdf-latex' : '/api/ai/export-pdf';
  const body = type === 'latex'
    ? JSON.stringify({ resume_id: _resumeId })
    : JSON.stringify({ resume_id: _resumeId, template_config: _templateConfig });
  const res = await fetch(url, { method: 'POST', headers: authHeaders(), body }).then(r => r.json());
  if (!res.success) { alert(res.error || '导出失败'); return; }
  const bytes = atob(res.data.pdf_base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (res.data.filename || '简历') + '.pdf';
  a.click();
}
