/* global fetch, AbortSignal */
// The single authenticated transport to the local Flask desktop app.
(function (root) {
  const BASE_URL = 'http://localhost:5001';
  let localToken = '';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    }[char]));
  }

  function extractProxyText(envelope) {
    if (!envelope || envelope.success !== true) return null;
    return envelope.data?.choices?.[0]?.message?.content || null;
  }

  function assertApiSuccess(envelope) {
    if (!envelope || envelope.success !== true) {
      throw new Error(envelope?.error || '桌面端请求失败');
    }
    return envelope.data;
  }

  async function getToken() {
    if (localToken) return localToken;
    const response = await fetch(`${BASE_URL}/api/local-token`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw new Error(`桌面端认证失败 (${response.status})`);
    const body = await response.json();
    if (!body?.token) throw new Error('桌面端未返回认证令牌');
    localToken = body.token;
    return localToken;
  }

  async function request(path, options = {}) {
    const token = await getToken();
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
      signal: options.signal || AbortSignal.timeout(15000),
    });
    let envelope;
    try {
      envelope = await response.json();
    } catch (_) {
      throw new Error(`桌面端返回了无效响应 (${response.status})`);
    }
    if (!response.ok) throw new Error(envelope?.error || `桌面端请求失败 (${response.status})`);
    return assertApiSuccess(envelope);
  }

  async function proxy(messages, maxTokens, temperature) {
    const data = await request('/api/ai/proxy', {
      method: 'POST',
      body: JSON.stringify({
        messages,
        max_tokens: maxTokens || 500,
        ...(temperature != null ? { temperature } : {}),
      }),
    });
    return extractProxyText({ success: true, data });
  }

  root.DesktopBridge = { getToken, request, proxy, extractProxyText, assertApiSuccess, escapeHtml };
  if (typeof module !== 'undefined') module.exports = { extractProxyText, assertApiSuccess, escapeHtml };
}(globalThis));
