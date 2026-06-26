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
    document.getElementById('stat-total').textContent = stats.data.total;
    document.getElementById('stat-interviewing').textContent = stats.data.interviewing;
    document.getElementById('stat-interested').textContent = stats.data.interested;
    document.getElementById('stat-rejected').textContent = stats.data.rejected;
  }

  const daily = await API('/jobs/daily-stats?days=14');
  if (daily.success) renderDailyChart(daily.data);

  const jobs = await API('/jobs/interested?per_page=10');
  if (jobs.success) renderRecentTable(jobs.data.jobs);
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
    <td>${esc(j.companyName)}</td><td>${esc(j.jobName)}</td><td>${esc(j.salary||'-')}</td>
    <td>${esc(j.location||'-')}</td><td><span class="badge badge-${j.status}">${statusLabel(j.status)}</span></td>
    <td>${j.matchScore.score || 0}分</td><td>${fmtTime(j.collectedAt)}</td>
    <td>
      <select onchange="changeStatus(${j.id}, this.value)" style="font-size:12px;">
        <option value="">改状态</option>
        <option value="applied">已投递</option>
        <option value="interviewing">面试中</option>
        <option value="interested">有意向</option>
        <option value="rejected">已拒绝</option>
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
  const map = { applied: '已投递', interviewing: '面试中', interested: '有意向', rejected: '已拒绝' };
  return map[s] || s;
}

async function changeStatus(id, status) {
  if (!status) return;
  await fetch('/api/jobs/' + id + '/status', {
    method: 'PUT', headers: authHeaders(),
    body: JSON.stringify({ status }),
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
    ${job.jd ? `<div style="margin-top:12px;font-size:13px;line-height:1.8;max-height:300px;overflow-y:auto;white-space:pre-wrap;">${esc(job.jd)}</div>` : ''}
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
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
      <span>${r.type === 'optimized' ? '✨优化版' : '📄原始版'} · 评分: ${r.score}分 · ${r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : ''}</span>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-sm" onclick="editResume(${r.id})">编辑</button>
      <button class="btn btn-ghost btn-sm" onclick="deleteResume(${r.id})">🗑</button>
    </div>
  </div>`).join('');
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

// Initial load
loadDashboard();
