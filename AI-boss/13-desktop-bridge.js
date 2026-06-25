  /**
   * DesktopBridge — Boss海投小助手桥接层
   * 将 AI 请求、岗位数据、埋点事件转发到本地桌面应用
   */
  const DesktopBridge = {
    _available: false,
    _lastCheck: 0,
    _baseUrl: CONFIG.DESKTOP_APP.BASE_URL,
    _token: null,

    async _getToken() {
      if (this._token) return this._token;
      try {
        const resp = await fetch(this._baseUrl + '/api/local-token', { signal: AbortSignal.timeout(2000) });
        if (resp.ok) {
          const data = await resp.json();
          this._token = data.token || '';
          return this._token;
        }
      } catch (e) {}
      return '';
    },

    async _authHeaders() {
      const token = await this._getToken();
      return token
        ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
        : { 'Content-Type': 'application/json' };
    },

    async isAvailable() {
      const now = Date.now();
      if (now - this._lastCheck < CONFIG.DESKTOP_APP.CHECK_INTERVAL) {
        return this._available;
      }
      this._lastCheck = now;
      try {
        const resp = await fetch(this._baseUrl + '/api/health', { signal: AbortSignal.timeout(2000) });
        this._available = resp.ok;
        if (this._available && !this._wasAvailable) {
          typeof Core !== 'undefined' && Core.log('🔗 Boss海投小助手已连接');
        }
        this._wasAvailable = this._available;
      } catch (e) {
        this._available = false;
      }
      return this._available;
    },

    async aiProxy(messages, options = {}) {
      const body = { messages: messages, temperature: options.temperature, max_tokens: options.max_tokens };
      if (options.model) body.model = options.model;
      const resp = await fetch(this._baseUrl + '/api/ai/proxy', {
        method: 'POST', headers: await this._authHeaders(), body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000),
      });
      const result = await resp.json();
      if (!result.success) throw new Error(result.error || '桌面 AI 代理返回错误');
      return result.data;
    },

    async collectJob(jobData) {
      if (!await this.isAvailable()) return;
      try {
        fetch(this._baseUrl + '/api/jobs/collect', {
          method: 'POST', headers: await this._authHeaders(), body: JSON.stringify(jobData),
          signal: AbortSignal.timeout(5000),
        }).catch(() => {});
      } catch (e) {}
    },

    async trackEvent(eventType, metadata = {}) {
      if (!await this.isAvailable()) return;
      try {
        fetch(this._baseUrl + '/api/analytics/event', {
          method: 'POST', headers: await this._authHeaders(),
          body: JSON.stringify([{
            event_type: eventType, category: 'script', page: location.pathname,
            metadata: metadata, session_id: 'boss-js-script', client_ts: Date.now(),
          }]),
          signal: AbortSignal.timeout(5000),
        }).catch(() => {});
      } catch (e) {}
    },

    async generateGreeting(jobId, jdText, resumeText, companyName, jobName) {
      if (!await this.isAvailable()) return null;
      try {
        const resp = await fetch(this._baseUrl + '/api/ai/generate-greeting', {
          method: 'POST', headers: await this._authHeaders(),
          body: JSON.stringify({ job_id: jobId||'', jd_text: jdText||'', resume_text: resumeText||'', company_name: companyName||'', job_name: jobName||'' }),
          signal: AbortSignal.timeout(35000),
        });
        const result = await resp.json();
        if (result.success && result.data && result.data.greeting) {
          return { greeting: result.data.greeting, cached: result.data.cached, grade: result.data.grade };
        }
      } catch (e) {}
      return null;
    },
  };
