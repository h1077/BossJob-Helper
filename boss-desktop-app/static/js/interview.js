/**
 * 模拟面试 — AI 扮演 HR，根据 JD + 简历分阶段提问
 */
const Interview = {
  sessionId: null,
  phaseLabels: { opening:'开场', technical:'技术深挖', experience:'项目经验', behavioral:'综合素质', reverse:'候选人反问', closing:'结束' },

  async init() {
    // 加载岗位列表
    const jobsRes = await fetch('/api/jobs/interested?per_page=200', { headers:{'Authorization':'Bearer local-mode-fake-token'} }).then(r => r.json());
    const jobSelect = document.getElementById('interview-job-select');
    jobSelect.innerHTML = '<option value="">-- 选择岗位 --</option>';
    if (jobsRes.success) {
      jobsRes.data.jobs.forEach(j => {
        const opt = document.createElement('option');
        opt.value = j.id;
        opt.textContent = `${j.companyName} — ${j.jobName}`;
        jobSelect.appendChild(opt);
      });
    }

    // 加载简历列表
    const resumeRes = await fetch('/api/resumes', { headers:{'Authorization':'Bearer local-mode-fake-token'} }).then(r => r.json());
    const resumeSelect = document.getElementById('interview-resume-select');
    resumeSelect.innerHTML = '<option value="">-- 选择简历 --</option>';
    if (resumeRes.success) {
      resumeRes.data.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.title;
        resumeSelect.appendChild(opt);
      });
    }

    // 加载历史面试记录
    this.loadHistory();
  },

  async loadHistory() {
    const res = await fetch('/api/ai/interview/sessions', { headers:{'Authorization':'Bearer local-mode-fake-token'} }).then(r => r.json());
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

  async start() {
    const jobId = document.getElementById('interview-job-select').value;
    const resumeId = document.getElementById('interview-resume-select').value;
    if (!jobId) { alert('请先选择一个岗位'); return; }
    if (!resumeId) { alert('请先选择一份简历'); return; }

    document.getElementById('interview-setup').classList.add('hidden');
    document.getElementById('interview-report').classList.add('hidden');
    const room = document.getElementById('interview-room');
    room.classList.remove('hidden');
    document.getElementById('interview-chat').innerHTML = '';
    document.getElementById('interview-input').value = '';
    document.getElementById('interview-phase-badge').textContent = '开场';

    this.sessionId = null;
    await this.send(null, jobId, resumeId);
  },

  async send(userText) {
    const jobId = document.getElementById('interview-job-select').value;
    const resumeId = document.getElementById('interview-resume-select').value;
    const input = document.getElementById('interview-input');
    const btn = document.getElementById('btn-send-answer');

    btn.disabled = true;
    btn.textContent = '⏳';

    if (userText) {
      this.addMessage('user', userText);
    }

    try {
      const body = { job_id: parseInt(jobId), resume_id: parseInt(resumeId) };
      if (this.sessionId) body.session_id = this.sessionId;
      if (userText) body.user_message = userText;

      const res = await fetch('/api/ai/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer local-mode-fake-token' },
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
    const res = await fetch('/api/ai/interview/sessions', { headers:{'Authorization':'Bearer local-mode-fake-token'} }).then(r => r.json());
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
    reportDiv.innerHTML = `
      <h3 style="text-align:center;">📊 面试评估报告</h3>
      <div class="report-score">${report.overall_score || '--'} 分</div>
      ${report.strengths ? `
        <h4>✅ 优势</h4>
        <ul>${report.strengths.map(s => `<li>${s}</li>`).join('')}</ul>
      ` : ''}
      ${report.weaknesses ? `
        <h4>⚠️ 待改进</h4>
        <ul>${report.weaknesses.map(s => `<li>${s}</li>`).join('')}</ul>
      ` : ''}
      ${report.suggestions ? `
        <h4>💡 改进建议</h4>
        <ul>${report.suggestions.map(s => `<li>${s}</li>`).join('')}</ul>
      ` : ''}
      <button class="btn btn-primary" onclick="location.reload()">🔄 再来一次</button>
    `;
  },
};

// Event bindings
document.getElementById('btn-start-interview').addEventListener('click', () => Interview.start());
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
document.getElementById('btn-end-interview').addEventListener('click', () => {
  document.getElementById('interview-input').value = '结束';
  Interview.send('结束');
});
