/**
 * BOSS 海投桌面管家 — 仪表盘逻辑
 */
// 全局 token，页面加载时预取
let _localToken = '';
(async function preloadToken() {
  try {
    const r = await fetch('/api/local-token');
    if (r.ok) { const d = await r.json(); _localToken = d.token || ''; }
  } catch (e) {}
})();

function authHeaders() {
  return _localToken
    ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _localToken }
    : { 'Content-Type': 'application/json' };
}

const API = (path, opts = {}) => fetch('/api' + path, {
  headers: authHeaders(),
  ...opts,
}).then(r => r.json());

const state = { currentPage: 'dashboard', jobsPage: 1, editingResumeId: null };

// Navigation
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    const page = el.dataset.page;
    state.currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    if (page === 'dashboard') loadDashboard();
    else if (page === 'jobs') loadJobs();
    else if (page === 'resumes') loadResumes();
    else if (page === 'settings') loadSettings();
    else if (page === 'export') loadExport();
    else if (page === 'interview' && typeof Interview !== 'undefined') Interview.init();
  });
});

// Dashboard
async function loadDashboard() {
  const stats = await API('/jobs/stats');
  if (stats.success) {
    const d = stats.data;
    document.getElementById('stat-total').textContent = d.total || 0;
    document.getElementById('stat-screening').textContent = (d.resume_screening || 0) + (d.applied || 0);
    document.getElementById('stat-interviewing').textContent = d.interviewing || 0;
    document.getElementById('stat-pending-interview').textContent = d.pending_interview || 0;
    document.getElementById('stat-pending-exam').textContent = d.pending_exam || 0;
    document.getElementById('stat-offer').textContent = d.offer_accepted || 0;
  }

  await loadKanban();

  const daily = await API('/jobs/daily-stats?days=14');
  if (daily.success) renderDailyChart(daily.data);

  const jobs = await API('/jobs/interested?per_page=10');
  if (jobs.success) renderRecentTable(jobs.data.jobs);
}

async function loadKanban() {
  const res = await API('/jobs/kanban');
  const board = document.getElementById('kanban-board');
  if (!res.success) { board.innerHTML = '<p style="color:#999;text-align:center;padding:12px;">看板加载失败</p>'; return; }

  const columns = res.data;
  let html = '';
  for (const [key, col] of Object.entries(columns)) {
    const jobs = col.jobs || [];
    html += `<div class="kanban-column">
      <div class="kanban-col-header">${col.label} <span class="kanban-col-count">${jobs.length}</span></div>`;
    jobs.forEach(j => {
      html += `<div class="kanban-card" title="${esc(j.companyName)} - ${esc(j.jobName)}" onclick="showJobDetail(${j.id})">
        <div class="kanban-card-company">${esc(j.companyName)}</div>
        <div class="kanban-card-job">${esc(j.jobName)}</div>
        <div class="kanban-card-meta">${esc(j.salary||'')} · ${fmtTime(j.collectedAt)}</div>
      </div>`;
    });
    html += '</div>';
  }
  board.innerHTML = html || '<p style="color:#999;text-align:center;padding:12px;">暂无数据</p>';
}

function renderDailyChart(data) {
  const container = document.getElementById('daily-chart');
  const days = Object.keys(data).sort().slice(-14);
  if (!days.length) { container.innerHTML = '<div class="loading">暂无数据</div>'; return; }
  const max = Math.max(1, ...days.map(d => (data[d].applied || 0) + (data[d].interviewing || 0)));
  container.innerHTML = days.map(d => {
    const total = (data[d].applied || 0) + (data[d].interviewing || 0);
    const h = Math.max(4, (total / max) * 180);
    return `<div class="chart-bar" title="${d}: ${total}条"><div class="chart-bar-fill" style="height:${h}px"></div></div>`;
  }).join('');
}

function renderRecentTable(jobs) {
  const tbody = document.querySelector('#recent-table tbody');
  tbody.innerHTML = jobs.map(j => `<tr>
    <td>${esc(j.companyName)}</td><td>${esc(j.jobName)}</td><td>${esc(j.salary||'-')}</td>
    <td>${esc(j.location||'-')}</td><td><span class="badge badge-${j.status}">${statusLabel(j.status)}</span></td>
    <td>${fmtTime(j.collectedAt)}</td>
  </tr>`).join('');
}

// Jobs
async function loadJobs(page = 1) {
  state.jobsPage = page;
  const keyword = document.getElementById('job-search').value;
  const status = document.getElementById('job-status-filter').value;
  const params = new URLSearchParams({ page, per_page: 30 });
  if (status) params.set('status', status);
  if (keyword) params.set('keyword', keyword);

  const res = await API('/jobs/interested?' + params);
  if (!res.success) return;

  const tbody = document.querySelector('#jobs-table tbody');
  tbody.innerHTML = res.data.jobs.map(j => `<tr>
    <td><input type="checkbox" class="batch-job-cb" value="${j.id}" onchange="updateBatchButton()"></td>
    <td>${esc(j.companyName)}</td><td>${esc(j.jobName)}</td><td>${esc(j.salary||'-')}</td>
    <td>${esc(j.location||'-')}</td><td><span class="badge badge-${j.status}">${statusLabel(j.status)}</span></td>
    <td>${j.matchScore.score || 0}分</td><td>${fmtTime(j.collectedAt)}</td>
    <td>
      <select onchange="changeStatus(${j.id}, this.value)" style="font-size:12px;">
        <option value="">改状态</option>
        ${statusOptions(j.status)}
      </select>
      <button class="btn btn-ghost btn-sm" onclick="deleteJob(${j.id})">🗑</button>
      <button class="btn btn-ghost btn-sm" onclick="showJobDetail(${j.id})">🔍</button>
    </td>
  </tr>`).join('');

  const pages = res.data.pages;
  const pag = document.getElementById('jobs-pagination');
  pag.innerHTML = '';
  for (let i = 1; i <= Math.min(pages, 20); i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === page) btn.classList.add('active');
    btn.addEventListener('click', () => loadJobs(i));
    pag.appendChild(btn);
  }
}

function statusLabel(s) {
  const map = {
    not_applied: '未投递', applied: '已投递', resume_screening: '简历初筛',
    pending_exam: '待笔试', pending_interview: '待面试', interviewing: '面试中',
    interview_passed: '面试通过', interview_failed: '面试未通过',
    terminated: '已终止', offer_accepted: 'Offer已接受', offer_rejected: 'Offer已拒绝',
    interested: '有意向', rejected: '已拒绝',
  };
  return map[s] || s;
}

function statusOptions(selected) {
  const labels = {
    not_applied: '未投递', applied: '已投递', resume_screening: '简历初筛',
    pending_exam: '待笔试', pending_interview: '待面试', interviewing: '面试中',
    interview_passed: '面试通过', interview_failed: '面试未通过',
    terminated: '已终止', offer_accepted: 'Offer已接受', offer_rejected: 'Offer已拒绝',
    interested: '有意向', rejected: '已拒绝',
  };
  return Object.entries(labels).map(([v, l]) =>
    `<option value="${v}" ${v === selected ? 'selected' : ''}>${l}</option>`
  ).join('');
}

async function changeStatus(id, status) {
  if (!status) return;
  const notes = prompt('备注（可选）：状态变更说明');
  await fetch('/api/jobs/' + id + '/status', {
    method: 'PUT', headers: authHeaders(),
    body: JSON.stringify({ status, statusNotes: notes || '' }),
  });
  loadJobs(state.jobsPage);
  loadDashboard();
}

async function deleteJob(id) {
  if (!confirm('确定删除此岗位记录？')) return;
  await fetch('/api/jobs/' + id, {
    method: 'DELETE', headers: authHeaders(),
  });
  loadJobs(state.jobsPage);
  loadDashboard();
}

async function showJobDetail(id) {
  const res = await fetch('/api/jobs/interested?per_page=200', { headers: authHeaders() }).then(r => r.json());
  if (!res.success) return;
  const job = res.data.jobs.find(j => j.id === id);
  if (!job) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal"><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
    <h3>${esc(job.companyName)} — ${esc(job.jobName)}</h3>
    <p style="color:#666;font-size:13px;">薪资: ${esc(job.salary||'-')} | 地点: ${esc(job.location||'-')} | 经验: ${esc(job.experience||'-')} | 学历: ${esc(job.education||'-')}</p>
    ${job.companyStage ? `<p style="font-size:13px;">阶段: ${job.companyStage} | 规模: ${job.companyScale||'-'} | 行业: ${job.companyIndustry||'-'}</p>` : ''}
    <p style="font-size:13px;color:var(--primary);margin-top:4px;">状态: <span class="badge badge-${job.status}">${statusLabel(job.status)}</span>
       ${job.statusUpdatedAt ? ' · 更新于 ' + new Date(job.statusUpdatedAt).toLocaleString('zh-CN') : ''}
    </p>
    ${job.statusNotes ? `<p style="font-size:12px;color:#999;">备注: ${esc(job.statusNotes)}</p>` : ''}

    <!-- 详情 Tabs -->
    <div class="modal-tabs" style="margin-top:16px;">
      <button class="modal-tab active" data-tab="jd">📋 JD详情</button>
      <button class="modal-tab" data-tab="timeline">🕐 状态历史</button>
      <button class="modal-tab" data-tab="strategy">🎯 简历策略</button>
    </div>

    <div class="modal-tab-panel" id="modal-tab-jd">
      ${job.jd ? `<div style="margin-top:12px;font-size:13px;line-height:1.8;max-height:300px;overflow-y:auto;white-space:pre-wrap;">${esc(job.jd)}</div>` : '<p style="color:#999;padding:20px;">暂无 JD 信息</p>'}
    </div>
    <div class="modal-tab-panel hidden" id="modal-tab-timeline">
      <div class="loading">加载中</div>
    </div>
    <div class="modal-tab-panel hidden" id="modal-tab-strategy">
      <div class="loading">加载中</div>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // Tab 切换
  overlay.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      overlay.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const panelName = tab.dataset.tab;
      overlay.querySelectorAll('.modal-tab-panel').forEach(p => p.classList.add('hidden'));
      const panel = overlay.querySelector('#modal-tab-' + panelName);
      if (panel) panel.classList.remove('hidden');

      if (panelName === 'timeline') {
        const timelinePanel = overlay.querySelector('#modal-tab-timeline');
        const tl = await API('/jobs/' + id + '/timeline');
        if (tl.success && tl.data.length) {
          timelinePanel.innerHTML = '<div class="status-timeline">' + tl.data.map(e => `
            <div class="timeline-item">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <span class="timeline-status">${esc(e.toStatusLabel || e.toStatus)}</span>
                ${e.notes ? `<span class="timeline-notes">${esc(e.notes)}</span>` : ''}
                <span class="timeline-time">${e.timestamp ? new Date(e.timestamp).toLocaleString('zh-CN') : ''}</span>
              </div>
            </div>
          `).join('') + '</div>';
        } else {
          timelinePanel.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">暂无状态变更记录</p>';
        }
      }

      if (panelName === 'strategy') {
        const strategyPanel = overlay.querySelector('#modal-tab-strategy');
        await loadJobStrategy(strategyPanel, id);
      }
    });
  });
}

// Resumes
async function loadResumes() {
  const res = await API('/resumes');
  const list = document.getElementById('resume-list');
  if (!res.success || !res.data.length) {
    list.innerHTML = '<p style="color:#666;text-align:center;padding:40px;">暂无简历，点击上方按钮创建</p>';
    return;
  }
  list.innerHTML = res.data.map(r => `<div class="resume-card">
    <div class="resume-info">
      <h4>${esc(r.title)}</h4>
      <span>${r.type === 'optimized' ? '✨优化版' : r.type === 'targeted' ? '🎯定制版' : '📄原始版'} · 评分: ${r.score}分 · ${r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : ''}</span>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn" onclick="editResume(${r.id})">编辑</button>
      <button class="btn" onclick="exportResumePDF(${r.id})">导出PDF</button>
      <button class="btn btn-ghost" onclick="deleteResume(${r.id})">删除</button>
    </div>
  </div>`).join('');
}

// ── 简历策略 ──

async function loadJobStrategy(panel, jobId) {
  panel.innerHTML = '<div class="loading">加载中</div>';

  const [strategyRes, rulesRes] = await Promise.all([
    API('/jobs/' + jobId + '/strategy'),
    API('/jobs/strategy-rules'),
  ]);

  const strategy = strategyRes.success ? strategyRes.data : null;
  const rules = rulesRes.success ? rulesRes.data : [];
  if (!strategy) { panel.innerHTML = '<p style="color:#dc2626;">加载策略失败</p>'; return; }

  const companyTypes = ['私企', '国企', '外企', '事业单位', '科研院所'];
  const currentRule = rules.find(r => r.companyType === strategy.companyType) || {};

  panel.innerHTML = `
    <div class="strategy-form" style="padding:8px 0;">
      <div class="sf-field">
        <label>公司类型</label>
        <select id="strat-company-type" onchange="onStrategyTypeChange('${jobId}')">
          ${companyTypes.map(t => `<option value="${t}" ${t === strategy.companyType ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="sf-field">
        <label>项目优先级</label>
        <input type="text" id="strat-projects" value="${esc((strategy.highlightedProjects || []).map(p => Array.isArray(p) ? p.join(':') : p).join(', '))}" placeholder="0:1, 2:2 (索引:优先级, 逗号分隔)">
        <span style="font-size:11px;color:#999;">格式: 项目索引:优先级, 如 "0:1, 2:2" 表示项目0优先级1，项目2优先级2</span>
      </div>
      <div class="sf-field">
        <label>实习优先级</label>
        <input type="text" id="strat-internships" value="${esc((strategy.highlightedInternships || []).map(p => Array.isArray(p) ? p.join(':') : p).join(', '))}" placeholder="0:1, 1:2">
        <span style="font-size:11px;color:#999;">格式同上</span>
      </div>
      <div class="sf-field">
        <label>技能侧重</label>
        <input type="text" id="strat-skills" value="${esc((strategy.highlightedSkills || []).map(p => Array.isArray(p) ? p.join(':') : p).join(', '))}" placeholder="ai:1, programming:2">
        <span style="font-size:11px;color:#999;">键: english/programming/ai/tools/hardware/other</span>
      </div>
      <div class="sf-field">
        <label>策略备注</label>
        <textarea id="strat-notes" rows="2" placeholder="额外的简历定制策略说明">${esc(strategy.strategyNotes || '')}</textarea>
      </div>
      <div style="margin-top:8px;font-size:12px;color:var(--text-secondary);background:var(--bg);padding:8px;border-radius:6px;">
        <strong>📌 当前类型策略参考：</strong><br>
        政治面貌：${currentRule.showPoliticalStatus ? '保留' : '隐藏'} |
        学生工作：${currentRule.studentWorkHandling === 'keep' ? '保留' : currentRule.studentWorkHandling === 'remove' ? '删除' : '精简'} |
        语调：${currentRule.tone || '主导'}
      </div>
      <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="saveJobStrategy(${jobId})">💾 保存策略</button>
      <button class="btn btn-sm" style="margin-top:12px;margin-left:4px;" onclick="autoFillStrategy('${jobId}')">🪄 自动填充</button>
    </div>
  `;
}

async function saveJobStrategy(jobId) {
  const data = {
    companyType: document.getElementById('strat-company-type').value,
    highlightedProjects: parsePriorityInput(document.getElementById('strat-projects').value),
    highlightedInternships: parsePriorityInput(document.getElementById('strat-internships').value),
    highlightedSkills: parsePriorityInput(document.getElementById('strat-skills').value),
    strategyNotes: document.getElementById('strat-notes').value.trim(),
  };
  const res = await API('/jobs/' + jobId + '/strategy', { method: 'POST', body: JSON.stringify(data) });
  if (res.success) {
    alert('策略已保存');
  } else {
    alert('保存失败: ' + (res.error || ''));
  }
}

function parsePriorityInput(val) {
  if (!val || !val.trim()) return [];
  return val.split(',').map(s => {
    const parts = s.trim().split(':');
    if (parts.length >= 2) return [parts[0].trim(), parseInt(parts[1]) || 1];
    return [s.trim(), 99];
  });
}

function onStrategyTypeChange(jobId) {
  // 切换到不同公司类型时的提示
  const type = document.getElementById('strat-company-type').value;
  const panel = document.querySelector('#modal-tab-strategy');
  if (panel) {
    const hint = panel.querySelector('div[style]');
    if (hint) hint.style.background = '#fef3c7';
  }
}

async function autoFillStrategy(jobId) {
  const type = document.getElementById('strat-company-type').value;
  const rulesRes = await API('/jobs/strategy-rules');
  if (!rulesRes.success) return;
  const rule = rulesRes.data.find(r => r.companyType === type);
  if (!rule) return;

  // 根据公司类型自动推荐技能排序
  const skillMap = {'私企': 'programming:1, ai:2, tools:3', '国企': 'programming:1, hardware:2, ai:3',
                     '外企': 'english:1, programming:2, ai:3', '事业单位': 'english:1, ai:2, programming:3',
                     '科研院所': 'ai:1, english:2, programming:3'};
  document.getElementById('strat-skills').value = skillMap[type] || '';
  document.getElementById('strat-notes').value = type + '岗位定制 - 政治面貌' + (rule.showPoliticalStatus ? '保留' : '隐藏') + '，' + (rule.studentWorkHandling === 'keep' ? '保留学生工作' : rule.studentWorkHandling === 'remove' ? '删除学生工作' : '精简学生工作');
}


async function deleteResume(id) {
  if (!confirm('确定删除此简历？')) return;
  await fetch('/api/resumes/' + id, { method: 'DELETE', headers: authHeaders() });
  loadResumes();
}

// ── AI Provider Presets ──
const AI_PROVIDERS = {
  siliconflow: {
    name: '硅基流动',
    url: 'https://api.siliconflow.cn/v1/chat/completions',
    models: [
      'deepseek-ai/DeepSeek-V3',
      'deepseek-ai/DeepSeek-R1',
      'deepseek-ai/DeepSeek-R1-0528',
      'Qwen/Qwen3-235B-A22B',
      'Pro/THUDM/GLM-4-9B-Chat',
    ],
  },
  deepseek: {
    name: 'DeepSeek',
    url: 'https://api.deepseek.com/v1',
    models: [
      'deepseek-chat',
      'deepseek-reasoner',
    ],
  },
  volcengine: {
    name: '火山引擎',
    url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    models: [
      'deepseek-v3-250324',
      'deepseek-r1-250528',
      'doubao-1.5-pro-256k-250115',
      'doubao-1.5-lite-32k-250115',
    ],
  },
  openai: {
    name: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    models: [
      'gpt-4o',
      'gpt-4.1',
      'gpt-4o-mini',
      'gpt-4.1-mini',
    ],
  },
};

function onProviderChange() {
  const provider = document.getElementById('ai-provider').value;
  const urlInput = document.getElementById('ai-api-url');
  const modelPreset = document.getElementById('ai-model-preset');
  const modelInput = document.getElementById('ai-model');

  if (!provider) {
    modelPreset.innerHTML = '<option value="">-- 选择供应商后出现 --</option>';
    return;
  }

  if (provider === 'custom') {
    modelPreset.innerHTML = '<option value="">-- 手动输入 --</option>';
    return;
  }

  const cfg = AI_PROVIDERS[provider];
  urlInput.value = cfg.url;
  modelPreset.innerHTML = '<option value="">-- 选择模型（或手动输入）--</option>' +
    cfg.models.map(m => `<option value="${m}">${m}</option>`).join('');
  modelInput.value = cfg.models[0];
}

function onModelPresetChange() {
  const val = document.getElementById('ai-model-preset').value;
  if (val) document.getElementById('ai-model').value = val;
}

// Settings
async function loadSettings() {
  const res = await API('/ai/settings');
  if (res.success) {
    document.getElementById('ai-api-url').value = res.data.api_url || '';
    document.getElementById('ai-api-key').value = res.data.api_key || '';
    document.getElementById('ai-model').value = res.data.model || '';
    autoDetectProvider(res.data.api_url || '');
  }
}

function autoDetectProvider(apiUrl) {
  const providerSelect = document.getElementById('ai-provider');
  let detected = null;
  for (const [key, cfg] of Object.entries(AI_PROVIDERS)) {
    if (apiUrl.includes(new URL(cfg.url).hostname)) { detected = key; break; }
  }
  if (detected) {
    providerSelect.value = detected;
    onProviderChange();
  }
}

document.getElementById('btn-save-ai').addEventListener('click', async () => {
  const res = await API('/ai/settings', {
    method: 'POST', body: JSON.stringify({
      api_url: document.getElementById('ai-api-url').value.trim(),
      api_key: document.getElementById('ai-api-key').value.trim(),
      model: document.getElementById('ai-model').value.trim(),
    }),
  });
  document.getElementById('ai-test-result').innerHTML = res.success
    ? '<span style="color:#16a34a;">✅ 配置已保存</span>'
    : '<span style="color:#dc2626;">❌ ' + res.error + '</span>';
});

function toggleApiKeyVisibility() {
  const input = document.getElementById('ai-api-key');
  const btn = document.getElementById('btn-toggle-key');
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}

document.getElementById('btn-test-ai').addEventListener('click', async () => {
  document.getElementById('ai-test-result').innerHTML = '<span style="color:#666;">⏳ 测试中...</span>';
  const res = await API('/ai/test', {
    method: 'POST', body: JSON.stringify({
      api_url: document.getElementById('ai-api-url').value.trim(),
      api_key: document.getElementById('ai-api-key').value.trim(),
      model: document.getElementById('ai-model').value.trim(),
    }),
  });
  document.getElementById('ai-test-result').innerHTML = res.success
    ? '<span style="color:#16a34a;">✅ ' + res.data.message + '</span>'
    : '<span style="color:#dc2626;">❌ ' + (res.error || '测试失败') + '</span>';
});

// Export
async function loadExport() {
  const stats = await API('/jobs/stats');
  if (stats.success) document.getElementById('export-count').textContent = stats.data.total;
}

document.getElementById('btn-export-csv').addEventListener('click', () => window.open('/api/jobs/export?format=csv'));
document.getElementById('btn-export-xlsx').addEventListener('click', () => window.open('/api/jobs/export?format=xlsx'));
document.getElementById('btn-export-json').addEventListener('click', () => window.open('/api/jobs/export?format=json'));

document.getElementById('job-search-btn').addEventListener('click', () => loadJobs(1));
document.getElementById('job-search').addEventListener('keydown', e => { if (e.key === 'Enter') loadJobs(1); });

// Helpers
function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
function fmtTime(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleDateString('zh-CN');
}

// Status check
setInterval(async () => {
  try {
    const r = await fetch('/api/health');
    const d = document.getElementById('status-dot');
    if (r.ok) { d.style.background = '#34a853'; document.getElementById('status-text').textContent = '运行中'; }
    else { d.style.background = '#dc2626'; document.getElementById('status-text').textContent = '异常'; }
  } catch (e) {
    document.getElementById('status-dot').style.background = '#dc2626';
    document.getElementById('status-text').textContent = '异常';
  }
}, 30000);

// ── 批量定制简历 ──

function toggleSelectAll(cb) {
  document.querySelectorAll('.batch-job-cb').forEach(c => { c.checked = cb.checked; });
  updateBatchButton();
}

function updateBatchButton() {
  const btn = document.getElementById('btn-batch-customize');
  const count = document.querySelectorAll('.batch-job-cb:checked').length;
  btn.textContent = count ? `📋 批量定制简历 (${count})` : '📋 批量定制简历';
}

function getSelectedJobIds() {
  return [...document.querySelectorAll('.batch-job-cb:checked')].map(c => parseInt(c.value));
}

document.getElementById('btn-batch-customize').addEventListener('click', async () => {
  const jobIds = getSelectedJobIds();
  if (!jobIds.length) { alert('请先勾选要定制简历的职位'); return; }

  // Get resumes for selector
  const resumesRes = await API('/resumes');
  const resumes = resumesRes.success ? resumesRes.data : [];
  if (!resumes.length) { alert('请先创建一份主简历（结构化编辑）'); return; }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal"><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
    <h3>📋 批量定制简历</h3>
    <p style="font-size:13px;color:#666;">已选择 <strong>${jobIds.length}</strong> 个职位</p>
    <div class="sf-field" style="margin-top:12px;">
      <label>选择主简历</label>
      <select id="batch-master-resume" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);">
        ${resumes.map(r => `<option value="${r.id}">${esc(r.title)} ${r.structuredData ? '✅有结构化数据' : '⚠️无结构化数据'}</option>`).join('')}
      </select>
    </div>
    <div id="batch-progress" style="margin-top:12px;"></div>
    <div id="batch-results" style="margin-top:12px;"></div>
    <div style="margin-top:16px;display:flex;gap:8px;">
      <button class="btn btn-primary" id="btn-run-batch">🚀 开始生成</button>
      <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">取消</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('btn-run-batch').addEventListener('click', async () => {
    const resumeId = parseInt(document.getElementById('batch-master-resume').value);
    if (!resumeId) { alert('请选择主简历'); return; }

    const btn = document.getElementById('btn-run-batch');
    btn.disabled = true;
    btn.textContent = '⏳ 生成中...';
    const progress = document.getElementById('batch-progress');
    progress.innerHTML = `<div class="loading">正在生成 1/${jobIds.length}...</div>`;

    const res = await API('/resumes/batch-customize', {
      method: 'POST',
      body: JSON.stringify({ resumeId: resumeId, jobIds: jobIds }),
    });

    btn.disabled = false;
    btn.textContent = '🚀 开始生成';

    const results = document.getElementById('batch-results');
    if (!res.success) {
      results.innerHTML = `<p style="color:#dc2626;">批量生成失败: ${esc(res.error || '未知错误')}</p>`;
      return;
    }

    const data = res.data || [];
    const ok = data.filter(r => r.success).length;
    const fail = data.length - ok;
    results.innerHTML = `
      <p style="margin-bottom:8px;">✅ 成功: ${ok} / ${data.length} ${fail ? `| ❌ 失败: ${fail}` : ''}</p>
      ${data.map(r => r.success
        ? `<div style="font-size:13px;padding:6px 8px;margin:2px 0;background:#f0fdf4;border-radius:4px;">
            ✅ <strong>${esc(r.companyName)}</strong> — ${esc(r.jobName)}
            → <a href="javascript:editResume(${r.resumeId})" style="color:var(--primary);">${esc(r.resumeTitle)}</a>
          </div>`
        : `<div style="font-size:13px;padding:6px 8px;margin:2px 0;background:#fee2e2;border-radius:4px;">
            ❌ ${esc(r.error || '失败')}
          </div>`
      ).join('')}
      ${ok ? '<button class="btn btn-sm" style="margin-top:8px;" onclick="loadResumes();this.closest(\'.modal-overlay\').remove();">📝 返回简历列表查看</button>' : ''}
    `;
    progress.innerHTML = '';
  });
});


// Initial load
loadDashboard();
