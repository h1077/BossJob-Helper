/**
 * 模拟面试 — AI 扮演 HR，根据 JD + 简历分阶段提问
 * 支持两种模式：
 *   1) 模态框直接输入 JD 文字 + 简历文字（推荐，无需前置数据）
 *   2) 从下拉框选择已有岗位+简历（兼容旧流程）
 */
const Interview = {
  sessionId: null,
  phaseLabels: { opening:'开场', technical:'技术深挖', experience:'项目经验', behavioral:'综合素质', reverse:'候选人反问', closing:'结束' },

  async init() {
    // 加载历史面试记录
    this.loadHistory();
  },

  async loadHistory() {
    const res = await fetch('/api/ai/interview/sessions', { headers: authHeaders() }).then(r => r.json());
    if (!res.success || !res.data.length) return;

    const reportDiv = document.getElementById('interview-report');
    const sessions = res.data.filter(s => s.status === 'completed');
    if (!sessions.length) return;

    reportDiv.classList.remove('hidden');
    reportDiv.innerHTML = `<h3>📋 历史面试记录</h3>` + sessions.slice(0, 5).map(s => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
        <span>🎯 综合评分: <strong>${s.overallScore || '--'}分</strong></span>
        <span style="color:var(--text-secondary);font-size:12px;">${new Date(s.startedAt).toLocaleDateString()}</span>
        <button class="btn btn-sm" onclick="Interview.showReport(${s.id})">查看报告</button>
      </div>
    `).join('');
  },

  phaseLabel(p) { return this.phaseLabels[p] || p; },

  // ── 模态框 ──

  async openModal() {
    document.getElementById('interview-modal-overlay').classList.remove('hidden');
    document.getElementById('modal-interview-company').focus();

    // 加载已保存的简历到下拉框
    const select = document.getElementById('modal-interview-resume-select');
    select.innerHTML = '<option value="">-- 从简历管理导入，或下方手动输入 --</option>';
    try {
      const res = await fetch('/api/resumes', { headers: authHeaders() }).then(r => r.json());
      if (res.success && res.data.length) {
        res.data.forEach(r => {
          const opt = document.createElement('option');
          opt.value = r.id;
          opt.textContent = r.title;
          // 把简历内容存在 data 属性上
          opt.dataset.content = r.content || '';
          select.appendChild(opt);
        });
      }
    } catch (e) {}
  },

  closeModal() {
    document.getElementById('interview-modal-overlay').classList.add('hidden');
  },

  // ── 开始面试 ──

  start() {
    const company = document.getElementById('modal-interview-company').value.trim();
    const job = document.getElementById('modal-interview-job').value.trim();
    const jd = document.getElementById('modal-interview-jd').value.trim();

    if (!job && !jd) { alert('请至少填写岗位名称或岗位 JD'); return; }

    // 关闭模态框
    this.closeModal();

    document.getElementById('interview-setup').classList.add('hidden');
    document.getElementById('interview-report').classList.add('hidden');
    const room = document.getElementById('interview-room');
    room.classList.remove('hidden');
    document.getElementById('interview-chat').innerHTML = '';
    document.getElementById('interview-input').value = '';
    document.getElementById('interview-phase-badge').textContent = '开场';

    this.sessionId = null;
    this.send(null);
  },

  // ── 发送消息 ──

  async send(userText) {
    const input = document.getElementById('interview-input');
    const btn = document.getElementById('btn-send-answer');

    btn.disabled = true;
    btn.textContent = '⏳';

    if (userText) {
      this.addMessage('user', userText);
    }

    try {
      const body = {};

      // 从模态框读取 JD 和简历文字（直接文本模式）
      const jdText = document.getElementById('modal-interview-jd').value.trim();
      const resumeText = document.getElementById('modal-interview-resume').value.trim();
      const jobTitle = document.getElementById('modal-interview-job').value.trim();
      const companyName = document.getElementById('modal-interview-company').value.trim();

      if (jdText) {
        body.jd_text = jdText;
        body.job_title = jobTitle;
        body.company_name = companyName;
        body.resume_text = resumeText;
      }

      if (this.sessionId) body.session_id = this.sessionId;
      if (userText) body.user_message = userText;

      const res = await fetch('/api/ai/interview', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      }).then(r => r.json());

      if (!res.success) {
        this.addMessage('hr', '抱歉，面试系统出现问题：' + (res.error || '未知错误'));
        return;
      }

      this.sessionId = res.data.session_id;
      this.addMessage('hr', res.data.hr_message);
      document.getElementById('interview-phase-badge').textContent = this.phaseLabel(res.data.phase);

      if (res.data.is_ended) {
        this.end(res.data.report);
      }
    } catch (e) {
      this.addMessage('hr', '网络错误，请检查桌面管家是否运行');
    } finally {
      btn.disabled = false;
      btn.textContent = '发送';
      input.value = '';
      input.focus();
    }
  },

  addMessage(role, text) {
    const chat = document.getElementById('interview-chat');
    const div = document.createElement('div');
    div.className = `interview-msg ${role}`;
    div.innerHTML = `<div class="msg-label">${role === 'hr' ? '🤖 HR' : '👤 你'}</div><div>${this.escapeHtml(text)}</div>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  },

  escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML.replace(/\n/g, '<br>');
  },

  end(report) {
    const inputRow = document.querySelector('.interview-input-row');
    if (inputRow) inputRow.style.display = 'none';
    document.getElementById('btn-end-interview').style.display = 'none';

    if (report) {
      this.showReportData(report);
    }
  },

  async showReport(sessionId) {
    const res = await fetch('/api/ai/interview/sessions', { headers: authHeaders() }).then(r => r.json());
    if (!res.success) return;
    const s = res.data.find(x => x.id === sessionId);
    if (!s) return;

    document.getElementById('interview-setup').classList.add('hidden');
    document.getElementById('interview-room').classList.add('hidden');
    const reportDiv = document.getElementById('interview-report');
    reportDiv.classList.remove('hidden');
    this.showReportData({
      overall_score: s.overallScore,
      strengths: s.strengths,
      weaknesses: s.weaknesses,
      suggestions: s.suggestions,
    });
  },

  showReportData(report) {
    const reportDiv = document.getElementById('interview-report');
    reportDiv.classList.remove('hidden');
    const eh = this.escapeHtml.bind(this);
    reportDiv.innerHTML = `
      <h3 style="text-align:center;">📊 面试评估报告</h3>
      <div class="report-score">${+report.overall_score || '--'} 分</div>
      ${report.strengths ? `
        <h4>✅ 优势</h4>
        <ul>${(report.strengths||[]).map(s => `<li>${eh(s)}</li>`).join('')}</ul>
      ` : ''}
      ${report.weaknesses ? `
        <h4>⚠️ 待改进</h4>
        <ul>${(report.weaknesses||[]).map(s => `<li>${eh(s)}</li>`).join('')}</ul>
      ` : ''}
      ${report.suggestions ? `
        <h4>💡 改进建议</h4>
        <ul>${(report.suggestions||[]).map(s => `<li>${eh(s)}</li>`).join('')}</ul>
      ` : ''}
      <button class="btn btn-primary" onclick="location.reload()">🔄 再来一次</button>
    `;
  },
};

// ── Event bindings ──

// 打开模态框
document.getElementById('btn-open-interview-modal').addEventListener('click', () => Interview.openModal());
// 关闭模态框
document.getElementById('btn-close-interview-modal').addEventListener('click', () => Interview.closeModal());
document.getElementById('btn-cancel-interview-modal').addEventListener('click', () => Interview.closeModal());
// 点击遮罩关闭
document.getElementById('interview-modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) Interview.closeModal();
});
// 确认开始
document.getElementById('btn-confirm-interview').addEventListener('click', () => Interview.start());
// Enter 在 JD textarea 中提交
document.getElementById('modal-interview-jd').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.ctrlKey) Interview.start();
});

// 发送消息
document.getElementById('btn-send-answer').addEventListener('click', () => {
  const text = document.getElementById('interview-input').value.trim();
  if (!text) return;
  Interview.send(text);
});
document.getElementById('interview-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('btn-send-answer').click();
  }
});
// 结束面试
document.getElementById('btn-end-interview').addEventListener('click', () => {
  document.getElementById('interview-input').value = '结束';
  Interview.send('结束');
});

// 从简历管理导入：选中后自动填充到 textarea
document.getElementById('modal-interview-resume-select').addEventListener('change', function () {
  const opt = this.selectedOptions[0];
  if (opt && opt.dataset.content) {
    document.getElementById('modal-interview-resume').value = opt.dataset.content;
  }
});
