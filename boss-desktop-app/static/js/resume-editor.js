/**
 * 简历编辑器 — 富文本编辑 + AI 分析/优化
 */

// New resume
document.getElementById('btn-new-resume').addEventListener('click', () => {
  document.getElementById('resume-list').classList.add('hidden');
  document.getElementById('resume-editor').classList.remove('hidden');
  document.getElementById('editor-content').textContent = '';
  document.getElementById('resume-title-input').value = '';
  document.getElementById('analysis-result').classList.add('hidden');
  document.getElementById('optimize-result').classList.add('hidden');
  state.editingResumeId = null;
});

// Cancel editor
document.getElementById('btn-cancel-editor').addEventListener('click', () => {
  document.getElementById('resume-editor').classList.add('hidden');
  document.getElementById('resume-list').classList.remove('hidden');
  loadResumes();
});

// Rich text toolbar
document.querySelectorAll('#editor-toolbar button').forEach(btn => {
  btn.addEventListener('click', () => {
    const cmd = btn.dataset.cmd;
    if (cmd === 'bold') document.execCommand('bold');
    else if (cmd === 'italic') document.execCommand('italic');
    else if (cmd === 'h3') document.execCommand('formatBlock', false, 'h3');
    else if (cmd === 'ul') document.execCommand('insertUnorderedList');
    else if (cmd === 'ol') document.execCommand('insertOrderedList');
    document.getElementById('editor-content').focus();
  });
});

// Toolbar HTML injection
(function initToolbar() {
  const tb = document.getElementById('editor-toolbar');
  tb.innerHTML = `
    <button data-cmd="bold"><b>B</b></button>
    <button data-cmd="italic"><i>I</i></button>
    <button data-cmd="h3">H3</button>
    <button data-cmd="ul">• 列表</button>
    <button data-cmd="ol">1. 编号</button>
  `;
  document.getElementById('btn-new-resume').insertAdjacentHTML('afterend', '<div id="resume-list" class="resume-list"></div>');
})();

// Save resume
document.getElementById('btn-save-resume').addEventListener('click', async () => {
  const title = document.getElementById('resume-title-input').value.trim();
  const content = document.getElementById('editor-content').innerHTML.trim();
  if (!title || !content) { alert('请填写标题和内容'); return; }

  const url = state.editingResumeId ? '/api/resumes/' + state.editingResumeId : '/api/resumes';
  const method = state.editingResumeId ? 'PUT' : 'POST';
  const res = await fetch('/api' + url, {
    method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer local-mode-fake-token' },
    body: JSON.stringify({ title, content }),
  }).then(r => r.json());

  if (res.success) {
    document.getElementById('resume-editor').classList.add('hidden');
    document.getElementById('resume-list').classList.remove('hidden');
    loadResumes();
  } else {
    alert(res.error || '保存失败');
  }
});

// Edit resume
async function editResume(id) {
  const res = await fetch('/api/resumes', { headers: { 'Authorization': 'Bearer local-mode-fake-token' } }).then(r => r.json());
  if (!res.success) return;
  const resume = res.data.find(r => r.id === id);
  if (!resume) return;
  state.editingResumeId = id;
  document.getElementById('resume-list').classList.add('hidden');
  document.getElementById('resume-editor').classList.remove('hidden');
  document.getElementById('editor-content').innerHTML = resume.content;
  document.getElementById('resume-title-input').value = resume.title;
  document.getElementById('analysis-result').classList.add('hidden');
  document.getElementById('optimize-result').classList.add('hidden');
}

// AI Analyze
document.getElementById('btn-analyze-resume').addEventListener('click', async () => {
  const text = document.getElementById('editor-content').innerText.trim();
  if (!text) { alert('请先输入简历内容'); return; }

  const panel = document.getElementById('analysis-result');
  panel.classList.remove('hidden');
  panel.innerHTML = '<div class="loading">AI 分析中</div>';

  const res = await fetch('/api/ai/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer local-mode-fake-token' },
    body: JSON.stringify({ resume_text: text }),
  }).then(r => r.json());

  if (!res.success || !res.data) {
    panel.innerHTML = '<p style="color:#dc2626;">分析失败: ' + (res.error || '未知错误') + '</p>';
    return;
  }

  const d = res.data;
  const dims = d.dimensions || {};
  panel.innerHTML = `
    <h4>📊 简历评分报告</h4>
    <p style="font-size:24px;font-weight:700;color:var(--primary);margin:8px 0;">综合: ${d.overall_score}分</p>
    ${Object.entries(dims).map(([k, v]) => `
      <div class="score-bar">
        <span class="score-bar-label">${dimLabel(k)}</span>
        <div class="score-bar-fill"><div class="score-bar-fill-inner" style="width:${(v.score/v.max_score*100).toFixed(0)}%"></div></div>
        <span class="score-bar-value">${v.score}/${v.max_score}</span>
      </div>
      <p style="font-size:12px;color:#666;margin:0 0 8px 98px;">${v.analysis||''}</p>
    `).join('')}
    ${d.strengths ? `<p style="margin-top:12px;"><strong>✅ 优势:</strong> ${d.strengths.join('、')}</p>` : ''}
    ${d.weaknesses ? `<p><strong>⚠️ 短板:</strong> ${d.weaknesses.join('、')}</p>` : ''}
    ${d.resume_optimization_suggestions ? `<p><strong>💡 建议:</strong> ${d.resume_optimization_suggestions.join('；')}</p>` : ''}
  `;

  // Store analysis for later optimize
  panel._analysisData = d;
});

function dimLabel(key) {
  const map = {
    education: '教育背景', technical_skills: '技术技能', experience: '项目经验',
    career_progression: '职业发展', soft_skills: '软技能', resume_quality: '简历质量',
  };
  return map[key] || key;
}

// AI Optimize
document.getElementById('btn-optimize-resume').addEventListener('click', async () => {
  const text = document.getElementById('editor-content').innerText.trim();
  if (!text) { alert('请先输入简历内容'); return; }

  const panel = document.getElementById('optimize-result');
  panel.classList.remove('hidden');
  panel.innerHTML = '<div class="loading">AI 优化中</div>';

  const analysisPanel = document.getElementById('analysis-result');
  const analysis = analysisPanel._analysisData || {};

  const res = await fetch('/api/ai/rewrite', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer local-mode-fake-token' },
    body: JSON.stringify({ resume_text: text, analysis }),
  }).then(r => r.json());

  if (!res.success) {
    panel.innerHTML = '<p style="color:#dc2626;">优化失败: ' + (res.error || '未知错误') + '</p>';
    return;
  }

  const optimized = res.data.rewritten_resume;
  panel.innerHTML = `
    <h4>✨ AI 优化结果</h4>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px;">
      <div><strong style="color:#666;">📄 原始版本</strong><div style="white-space:pre-wrap;font-size:13px;line-height:1.6;margin-top:8px;padding:12px;background:#f9fafb;border-radius:8px;max-height:400px;overflow-y:auto;">${esc(text)}</div></div>
      <div><strong style="color:#16a34a;">✨ 优化版本</strong><div style="white-space:pre-wrap;font-size:13px;line-height:1.6;margin-top:8px;padding:12px;background:#f0fdf4;border-radius:8px;max-height:400px;overflow-y:auto;" id="optimized-text">${esc(optimized)}</div></div>
    </div>
    <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="adoptOptimized()">采纳优化版本</button>
  `;
});

function adoptOptimized() {
  const optimized = document.getElementById('optimized-text');
  if (optimized) {
    document.getElementById('editor-content').innerHTML = optimized.textContent;
    document.getElementById('optimize-result').classList.add('hidden');
    document.getElementById('analysis-result').classList.add('hidden');
  }
}
