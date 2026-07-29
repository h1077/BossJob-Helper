// ===== Boss海投助手 侧边栏 UI 逻辑 =====
const $ = id => document.getElementById(id);

const CFG_KEYS = [
  'keyword', 'city', 'count', 'welfare', 'dailyLimit',
  'aiApiKey', 'aiApiUrl', 'aiModel',
  'useAutoSendResume', 'useAutoSendImageResume',
  'imageResumes', 'excludeHeadhunters', 'recruiterActivityStatus',
  'resumeText', 'resumeAnalysis', 'useResumeMatch', 'matchMinScore',
  'enableCompanyCheck', 'autoReply', 'aiRole', 'conversationStrategy',
  'hrInactiveDays', 'useDesktopBridge', 'jobTracker', 'dailyStats',
  'blacklist', 'salaryRange', 'resumes', 'interviews',
  'smartSchedule', 'smartGreetingPrompt'
];

// 折叠面板
document.querySelectorAll('.card-h[data-toggle]').forEach(h => {
  h.addEventListener('click', () => {
    const body = $(h.dataset.toggle);
    body.classList.toggle('collapsed');
    h.classList.toggle('open');
  });
});

// 模型预设选项
const MODEL_PRESETS = {
  'deepseek': {
    url: 'https://api.deepseek.com/v1/chat/completions',
    models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash']
  },
  'openai': {
    url: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo']
  },
  'siliconflow': {
    url: 'https://api.siliconflow.cn/v1/chat/completions',
    models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-V2.5', 'Qwen/Qwen2.5-7B-Instruct']
  }
};

function populateModelSelect(provider, currentModel) {
  const sel = $('aiModelSelect');
  sel.innerHTML = '<option value="">-- 自定义模型 --</option>';
  const preset = MODEL_PRESETS[provider];
  if (!preset) return;
  preset.models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    if (m === currentModel) opt.selected = true;
    sel.appendChild(opt);
  });
}

// 预设按钮 → 同步更新下拉框
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $('aiApiUrl').value = btn.dataset.url;
    // 推断 provider 并更新下拉框
    const url = btn.dataset.url;
    let provider = '';
    if (url.includes('deepseek.com')) provider = 'deepseek';
    else if (url.includes('openai.com')) provider = 'openai';
    else if (url.includes('siliconflow')) provider = 'siliconflow';
    populateModelSelect(provider, btn.dataset.model);
  });
});

// 活跃状态 chips
let selectedActivity = ['在线', '刚刚活跃', '今日活跃', '3日内活跃', '本周活跃'];
document.querySelectorAll('#activityChips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const val = chip.dataset.val;
    if (val === '不限') {
      selectedActivity = ['不限'];
      document.querySelectorAll('#activityChips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    } else {
      selectedActivity = selectedActivity.filter(v => v !== '不限');
      if (selectedActivity.includes(val)) {
        selectedActivity = selectedActivity.filter(v => v !== val);
        chip.classList.remove('active');
      } else {
        selectedActivity.push(val);
        chip.classList.add('active');
      }
      document.querySelector('#activityChips .chip[data-val="不限"]').classList.remove('active');
      if (selectedActivity.length === 0) {
        selectedActivity = ['不限'];
        document.querySelector('#activityChips .chip[data-val="不限"]').classList.add('active');
      }
    }
  });
  if (selectedActivity.includes(chip.dataset.val)) chip.classList.add('active');
});

// 策略选择器
let conversationStrategy = 'balanced';
function applyConversationStrategy(value) {
  const inputs = [...document.querySelectorAll('.strategy-card input')];
  const input = inputs.find(item => item.value === value)
    || inputs.find(item => item.value === 'balanced');
  conversationStrategy = input ? input.value : 'balanced';
  document.querySelectorAll('.strategy-card').forEach(card => card.classList.remove('active'));
  if (input) {
    input.checked = true;
    input.closest('.strategy-card').classList.add('active');
  }
}
document.querySelectorAll('.strategy-card').forEach(card => {
  card.addEventListener('click', () => {
    const input = card.querySelector('input');
    applyConversationStrategy(input ? input.value : 'balanced');
  });
});

// 匹配分滑块
$('matchMinScore').addEventListener('input', () => {
  $('matchScoreLabel').textContent = $('matchMinScore').value;
});

// 图片简历
let imageResumes = [];
$('useAutoSendImageResume').addEventListener('change', () => {
  $('addImageBtn').style.display = $('useAutoSendImageResume').checked ? 'inline-block' : 'none';
  if (!$('useAutoSendImageResume').checked) $('imageResumeList').innerHTML = '';
});
$('addImageBtn').addEventListener('click', () => $('imageResumeInput').click());
$('imageResumeInput').addEventListener('change', (e) => {
  const files = e.target.files;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const reader = new FileReader();
    reader.onload = (ev) => {
      imageResumes.push({ path: file.name, data: ev.target.result });
      renderImageResumes();
    };
    reader.readAsDataURL(file);
  }
  e.target.value = '';
});
function renderImageResumes() {
  $('imageResumeList').innerHTML = imageResumes.map((r, i) =>
    '<div class="img-item"><span>' + r.path + '</span><button data-idx="' + i + '">删除</button></div>'
  ).join('');
  $('imageResumeList').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      imageResumes.splice(parseInt(btn.dataset.idx), 1);
      renderImageResumes();
    });
  });
}

// 简历文件导入（通过桌面端解析 PDF/Word）
$('importFileBtn').addEventListener('click', () => {
  const useDesktop = $('useDesktopBridge') && $('useDesktopBridge').checked;
  if (!useDesktop) {
    $('importFileStatus').textContent = '请先开启桌面桥接（勾选⑤运行中的"使用桌面桥接"）';
    return;
  }
  $('resumeFileInput').click();
});
$('resumeFileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  $('importFileStatus').textContent = '解析中: ' + file.name + '...';
  try {
    // TXT 文件直接浏览器端读取
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const text = await file.text();
      $('resumeText').value = text;
    } else {
      // PDF/Word 发送到桌面端解析
      const text = await parseResumeViaDesktop(file);
      $('resumeText').value = text;
    }
    const text = $('resumeText').value;
    const name = prompt('给这份简历起个名字（如：Python开发 或 售前顾问）：', file.name.replace(/\.[^.]+$/, ''));
    if (name) {
      resumes = resumes.filter(r => r.name !== name);
      resumes.push({ name, text, analysis: '', time: Date.now() });
      currentResumeName = name;
      renderResumeSelector();
      $('importFileStatus').textContent = '已导入: ' + name + ' (' + text.length + ' 字符)';
    } else {
      $('importFileStatus').textContent = '已读取: ' + file.name + ' (' + text.length + ' 字符)';
    }
  } catch (err) {
    $('importFileStatus').textContent = '导入失败: ' + err.message;
  }
  $('resumeFileInput').value = '';
});

// 通过桌面端解析 PDF/Word 文件
async function parseResumeViaDesktop(file) {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await fetch('http://localhost:5001/api/resumes/parse-file', {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000)
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || '服务器解析失败 (HTTP ' + resp.status + ')');
  }
  const data = await resp.json();
  if (!data.success || !data.text) {
    throw new Error('解析返回内容为空');
  }
  return data.text;
}

// 渲染分析结果显示区域（消除重复代码）
function renderAnalysisDisplay(content) {
  let d = document.getElementById('analysisDisplay');
  if (!d) {
    d = document.createElement('div');
    d.id = 'analysisDisplay';
    d.style.cssText = 'margin-top:8px;padding:8px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;font-size:12px;white-space:pre-wrap;max-height:150px;overflow-y:auto;';
    $('resumeText').after(d);
  }
  d.textContent = 'AI分析：\n' + content;
}

// AI 分析简历
$('analyzeResumeBtn').addEventListener('click', async () => {
  const resumeText = $('resumeText').value.trim();
  if (!resumeText) return addLog('请先粘贴或导入简历内容', 'warn');

  // 优先使用桌面端 6 维分析，降级到直调 AI
  const useDesktop = $('useDesktopBridge') && $('useDesktopBridge').checked;
  if (useDesktop) {
    $('analyzeResumeBtn').textContent = '分析中(桌面端)...';
    $('analyzeResumeBtn').disabled = true;
    try {
      const resp = await fetch('http://localhost:5001/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_text: resumeText }),
        signal: AbortSignal.timeout(30000)
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.data) {
          const r = data.data;
          const report = '【6维评分】\n' +
            '- 学历背景：' + (r.education || 0) + '/15\n' +
            '- 技术技能：' + (r.technical_skills || 0) + '/25\n' +
            '- 工作经验：' + (r.experience || 0) + '/30\n' +
            '- 职业成长：' + (r.career_progression || 0) + '/15\n' +
            '- 软技能：' + (r.soft_skills || 0) + '/10\n' +
            '- 简历质量：' + (r.resume_quality || 0) + '/5\n' +
            '总分：' + (r.total_score || 0) + '/100\n\n' +
            (r.pre_match_analysis ? '【匹配预判】' + r.pre_match_analysis + '\n\n' : '') +
            (r.icebreaker_suggestion ? '【破冰语框架】' + r.icebreaker_suggestion + '\n\n' : '') +
            (r.suggestions || '');
          await chrome.storage.local.set({ resumeAnalysis: report });
          if (currentResumeName) {
            const idx = resumes.findIndex(r => r.name === currentResumeName);
            if (idx >= 0) { resumes[idx].analysis = report; renderResumeSelector(); }
          }
          renderAnalysisDisplay(report);
          addLog('桌面端6维分析完成，总分' + (r.total_score || 0) + '/100', 'success');
          $('analyzeResumeBtn').textContent = 'AI分析简历';
          $('analyzeResumeBtn').disabled = false;
          return;
        }
      }
    } catch (e) { addLog('桌面端分析失败，降级直调AI', 'warn'); }
    $('analyzeResumeBtn').textContent = '降级直调AI...';
  }

  const apiKey = $('aiApiKey').value.trim();
  const apiUrl = $('aiApiUrl').value.trim() || 'https://api.deepseek.com/v1/chat/completions';
  const model = $('aiModelSelect').value || 'deepseek-chat';
  if (!apiKey) return addLog('请先在AI配置中填写API Key', 'warn');

  $('analyzeResumeBtn').textContent = '分析中...';
  $('analyzeResumeBtn').disabled = true;
  try {
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model, max_tokens: 1000, temperature: 0.5,
        messages: [
          { role: 'system', content: '你是专业求职顾问。我的任务包含两部分：\n\n1. 核心技能与优势分析：提取简历中的核心技能、适合的岗位类型、工作经验亮点及个人优势。请用"- "开头，保持简短、结构化。\n2. 岗位匹配预判：根据简历内容，帮我生成一段【针对该候选人的精准破冰招呼语核心要点】。\n\n【注意】由于系统限制，输入的简历内容可能被截断。如果接收到截断后的文本，请基于你已接收到的部分内容做出合理的推断，不要因为尾部信息的缺失而误判候选人的核心竞争力。\n\n【输出格式要求】\n请使用清晰的"- "项目符号输出，结构如下：\n- 核心技能：...\n- 适合岗位：...\n- 工作经验亮点：...\n- 个人优势：...\n- 破冰语核心要点：...' },
          { role: 'user', content: '简历：\n' + resumeText.slice(0, 4000) }
        ]
      })
    });
    if (!resp.ok) throw new Error('API ' + resp.status);
    const data = await resp.json();
    const analysis = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    if (analysis) {
      await chrome.storage.local.set({ resumeAnalysis: analysis });
      if (currentResumeName) {
        const idx = resumes.findIndex(r => r.name === currentResumeName);
        if (idx >= 0) { resumes[idx].analysis = analysis; renderResumeSelector(); }
      }
      addLog('简历分析完成', 'success');
      renderAnalysisDisplay(analysis);
    }
  } catch (e) {
    addLog('分析失败: ' + e.message, 'error');
  }
  $('analyzeResumeBtn').textContent = 'AI分析简历';
  $('analyzeResumeBtn').disabled = false;
});

// ── 薪资范围选择 ──
let salaryRange = '';
document.querySelectorAll('.chip-salary').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip-salary').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    salaryRange = chip.dataset.val;
  });
});

// ── 多份简历管理 ──
let resumes = [];
let currentResumeName = '';

function renderResumeSelector() {
  const sel = $('resumeSelector');
  sel.innerHTML = '<option value="">默认简历</option>' +
    resumes.map(r => '<option value="' + r.name + '">' + r.name + '</option>').join('');
  sel.value = currentResumeName;
}
$('resumeSelector').addEventListener('change', () => {
  const name = $('resumeSelector').value;
  if (!name) {
    currentResumeName = '';
    $('resumeText').value = '';
    $('resumeText').placeholder = '粘贴你的简历内容...';
    return;
  }
  const r = resumes.find(r => r.name === name);
  if (r) {
    currentResumeName = name;
    $('resumeText').value = r.text || '';
    if (r.analysis) renderAnalysisDisplay(r.analysis);
  }
});
$('deleteResumeBtn').addEventListener('click', () => {
  const name = currentResumeName;
  if (!name || !confirm('删除简历「' + name + '」？')) return;
  resumes = resumes.filter(r => r.name !== name);
  currentResumeName = '';
  $('resumeText').value = '';
  renderResumeSelector();
});

// ── 面试追踪 ──
let interviews = [];
function renderInterviews() {
  const list = $('interviewList');
  if (!interviews.length) {
    $('interviewCard').style.display = 'none';
    return;
  }
  $('interviewCard').style.display = 'block';
  list.innerHTML = interviews.map((iv, i) =>
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #ffe0b2;">' +
    '<span>' + iv.company + ' - ' + iv.position + '<br><small style="color:#888">' + (iv.time || '待定') + '</small></span>' +
    '<button data-idx="' + i + '" class="iv-del" style="background:none;color:#c62828;font-size:11px;">X</button>' +
    '</div>'
  ).join('');
  list.querySelectorAll('.iv-del').forEach(btn => {
    btn.addEventListener('click', () => {
      interviews.splice(parseInt(btn.dataset.idx), 1);
      renderInterviews();
    });
  });
}
$('addInterviewBtn').addEventListener('click', () => {
  const company = prompt('公司名称：');
  if (!company) return;
  const position = prompt('岗位名称：');
  if (!position) return;
  const time = prompt('面试时间（如：7月3日 14:00）：') || '待定';
  interviews.push({ company, position, time, status: 'pending', addedAt: Date.now() });
  renderInterviews();
});

// ── 面试按钮 ──
$('btnInterview').addEventListener('click', () => {
  const useDesktop = $('useDesktopBridge') && $('useDesktopBridge').checked;
  if (useDesktop) {
    window.open('http://localhost:5001', '_blank');
    addLog('已打开桌面端面试页面', 'info');
  } else {
    addLog('请先启动桌面端并开启桥接', 'warn');
  }
});

// ── 数据导出 ──
async function exportData(format) {
  const useDesktop = $('useDesktopBridge') && $('useDesktopBridge').checked;
  if (!useDesktop) return addLog('导出需要桌面端运行，请先启动Boss海投小助手并开启桌面桥接', 'warn');
  try {
    const resp = await fetch('http://localhost:5001/api/jobs/export?format=' + format, {
      signal: AbortSignal.timeout(15000)
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'boss_jobs_' + new Date().toISOString().slice(0, 10) + '.' + format;
    a.click();
    URL.revokeObjectURL(url);
    addLog('导出完成：' + format.toUpperCase(), 'success');
  } catch (e) {
    addLog('导出失败: ' + e.message + '（需要桌面端运行）', 'error');
  }
}

// ── 启动时从桌面端同步 ──
async function syncFromDesktop() {
  const useDesktop = $('useDesktopBridge') && $('useDesktopBridge').checked;
  if (!useDesktop) return;
  try {
    const resp = await fetch('http://localhost:5001/api/jobs/interested?limit=50', {
      signal: AbortSignal.timeout(5000)
    });
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.success && data.data && data.data.items) {
      const tracker = { total: 0, highMatch: 0, applied: 0, interviewing: 0, rejected: 0 };
      for (const j of data.data.items) {
        tracker.total++;
        if (j.status === 'applied') tracker.applied++;
        else if (j.status === 'interviewing') tracker.interviewing++;
        else if (j.status === 'rejected') tracker.rejected++;
        if ((j.match_score || 0) >= 7) tracker.highMatch++;
      }
      await chrome.storage.local.set({ jobTracker: tracker });
      addLog('从桌面端同步 ' + data.data.items.length + ' 条岗位记录', 'info');
      updateDashboard();
    }
  } catch (e) { /* 桌面端未运行 */ }
}

// ── Agent 命令轮询 ──
let agentPollTimer = null;
function agentHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (desktopToken) headers.Authorization = 'Bearer ' + desktopToken;
  return headers;
}
async function startAgentPolling() {
  if (agentPollTimer) return;
  agentPollTimer = setInterval(async () => {
    try {
      const resp = await fetch('http://localhost:5001/api/agent/command', {
        headers: agentHeaders(),
        signal: AbortSignal.timeout(3000)
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const cmd = data?.data?.command;
      if (data.ok && data?.data?.pending && cmd?.action) {
        addLog('收到Agent命令: ' + cmd.action, 'info');
        if (cmd.action === 'start_apply') {
          $('btnCollect').click();
        } else if (cmd.action === 'stop_apply') {
          $('btnStop').click();
        }
        // ACK
        fetch('http://localhost:5001/api/agent/command/ack', {
          method: 'POST',
          headers: agentHeaders(),
          body: JSON.stringify({ id: cmd.id || '', status: 'done' }),
          signal: AbortSignal.timeout(3000)
        }).catch(() => {});
      }
    } catch (e) { /* 桌面端未运行 */ }
  }, 10000);
}
function stopAgentPolling() {
  if (agentPollTimer) { clearInterval(agentPollTimer); agentPollTimer = null; }
}

$('btnRefreshFeedback').addEventListener('click', async () => {
  const status = $('feedbackRefreshStatus');
  status.textContent = '正在读取当前聊天页...';
  const tabs = await chrome.tabs.query({ url: '*://*.zhipin.com/web/geek/chat*' });
  if (!tabs.length) { status.textContent = '请先打开 BOSS 聊天页'; return; }
  const response = await new Promise(resolve => chrome.tabs.sendMessage(tabs[0].id, { type: 'SCAN_VISIBLE_FEEDBACK' }, resolve));
  if (!response?.success) { status.textContent = '读取失败，请刷新聊天页后重试'; return; }
  const results = await Promise.all((response.events || []).map(event =>
    chrome.runtime.sendMessage({ type: 'CHAT_FEEDBACK_EVENT', event }).catch(() => null)
  ));
  const pendingCount = results.reduce((max, result) => Math.max(max, result?.data?.pendingCount || 0), 0);
  status.textContent = pendingCount
    ? `已检查 ${(response.events || []).length} 条可见来信；${pendingCount} 条等待桌面端同步`
    : `已检查 ${(response.events || []).length} 条可见来信`;
  await chrome.storage.local.set({ lastFeedbackRefreshAt: Date.now() });
});

// ── JD 需求分析 ──
$('btnJdAnalysis').addEventListener('click', async () => {
  const allJobs = await new Promise(res => {
    chrome.storage.local.get('sw_queue', d => res(d.sw_queue || []));
  });
  if (!allJobs.length) {
    const fromStorage = await chrome.storage.local.get('jobTracker');
    if (!fromStorage.jobTracker || !fromStorage.jobTracker.total) {
      return addLog('暂无收集的岗位数据，请先运行收集', 'warn');
    }
  }

  const apiKey = $('aiApiKey').value.trim();
  if (!apiKey) return addLog('请先配置AI API Key', 'warn');

  addLog('AI分析岗位需求趋势...', 'info');
  const sample = allJobs.slice(0, 30);
  const jobText = sample.map(j => j.name + ': ' + (j.tags || []).join('、')).join('\n');

  try {
    const apiUrl = $('aiApiUrl').value.trim() || 'https://api.deepseek.com/v1/chat/completions';
    const model = $('aiModelSelect').value || 'deepseek-chat';
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model, max_tokens: 600, temperature: 0.3, messages: [
        { role: 'system', content: '你是技术招聘分析师。分析这些岗位需求，用中文输出：1)出现频率最高的5个技能 2)最值钱的2个技术栈方向 3)求职者应优先补充的3个技能。用- 开头，简洁。' },
        { role: 'user', content: '岗位列表：\n' + jobText.slice(0, 4000) }
      ]})
    });
    if (!resp.ok) throw new Error('API ' + resp.status);
    const data = await resp.json();
    const result = (data.choices?.[0]?.message?.content || '').trim();
    if (result) {
      const overlay = document.createElement('div');
      overlay.className = 'report-overlay';
      overlay.innerHTML = '<div class="report-box"><h3>📈 JD需求分析</h3><pre style="white-space:pre-wrap;font-size:13px;line-height:1.6;">' + result + '</pre><button>关闭</button></div>';
      document.body.appendChild(overlay);
      overlay.querySelector('button').addEventListener('click', () => overlay.remove());
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
      addLog('JD需求分析完成', 'success');
    }
  } catch (e) {
    addLog('分析失败: ' + e.message, 'error');
  }
});

// ── 载入/保存配置 ──
function loadCfg() {
  chrome.storage.local.get(CFG_KEYS.concat(['imageResumeData']), d => {
    if (d.keyword) $('keyword').value = d.keyword;
    if (d.city) $('city').value = d.city;
    if (d.count) $('count').value = d.count;
    if (d.welfare) $('welfare').value = d.welfare;
    if (d.dailyLimit) $('dailyLimit').value = d.dailyLimit;
    if (d.aiApiKey) $('aiApiKey').value = d.aiApiKey;
    if (d.aiApiUrl) $('aiApiUrl').value = d.aiApiUrl;
    if (d.aiModel) {
      // 尝试在下拉框中匹配已保存的模型名
      const sel = $('aiModelSelect');
      let found = false;
      for (const opt of sel.options) { if (opt.value === d.aiModel) { sel.value = d.aiModel; found = true; break; } }
      if (!found && d.aiModel) {
        // 自定义模型名：添加为临时选项
        const opt = document.createElement('option');
        opt.value = d.aiModel; opt.textContent = d.aiModel + ' (自定义)';
        sel.appendChild(opt);
        sel.value = d.aiModel;
      }
    }
    // 初始化模型下拉框
    const url = d.aiApiUrl || '';
    let provider = '';
    if (url.includes('deepseek.com')) provider = 'deepseek';
    else if (url.includes('openai.com')) provider = 'openai';
    else if (url.includes('siliconflow')) provider = 'siliconflow';
    if (provider) populateModelSelect(provider, d.aiModel || '');
    $('useAutoSendResume').checked = d.useAutoSendResume === true;
    $('useAutoSendImageResume').checked = d.useAutoSendImageResume === true;
    $('excludeHeadhunters').checked = d.excludeHeadhunters === true;
    $('useResumeMatch').checked = d.useResumeMatch !== false;
    $('matchMinScore').value = d.matchMinScore || 3;
    $('matchScoreLabel').textContent = d.matchMinScore || 3;
    $('enableCompanyCheck').checked = d.enableCompanyCheck !== false;
    $('autoReply').checked = d.autoReply === true;
    if (d.aiRole) $('aiRole').value = d.aiRole;
    applyConversationStrategy(d.conversationStrategy);
    if (d.recruiterActivityStatus) {
      selectedActivity = d.recruiterActivityStatus;
      document.querySelectorAll('#activityChips .chip').forEach(c => {
        c.classList.toggle('active', selectedActivity.includes(c.dataset.val));
      });
    }
    $('hrInactiveDays').value = d.hrInactiveDays || 14;
    $('useDesktopBridge').checked = d.useDesktopBridge === true;
    $('smartSchedule').checked = d.smartSchedule !== false;
    if (d.smartGreetingPrompt) $('smartGreetingPrompt').value = d.smartGreetingPrompt;
    if (d.blacklist) $('blacklist').value = d.blacklist;
    if (d.salaryRange) {
      salaryRange = d.salaryRange;
      document.querySelectorAll('.chip-salary').forEach(c => {
        c.classList.toggle('active', c.dataset.val === d.salaryRange);
      });
    }
    if (d.resumes) { resumes = d.resumes; renderResumeSelector(); }
    if (d.interviews) { interviews = d.interviews; renderInterviews(); }
    if (d.resumeText) $('resumeText').value = d.resumeText;
    if (d.resumeAnalysis) {
      renderAnalysisDisplay(d.resumeAnalysis);
    }
    if (d.imageResumes) { imageResumes = d.imageResumes; renderImageResumes(); }
    if ($('useAutoSendImageResume').checked) $('addImageBtn').style.display = 'inline-block';
  });
}

async function saveCfg() {
  const obj = {
    keyword: $('keyword').value.trim(),
    city: $('city').value.trim(),
    count: parseInt($('count').value) || 60,
    welfare: $('welfare').value.trim(),
    dailyLimit: parseInt($('dailyLimit').value) || 100,
    aiApiKey: $('aiApiKey').value.trim(),
    aiApiUrl: $('aiApiUrl').value.trim() || 'https://api.deepseek.com/v1/chat/completions',
    aiModel: $('aiModelSelect').value || 'deepseek-chat',
    useAutoSendResume: $('useAutoSendResume').checked,
    useAutoSendImageResume: $('useAutoSendImageResume').checked,
    imageResumes,
    excludeHeadhunters: $('excludeHeadhunters').checked,
    recruiterActivityStatus: selectedActivity,
    resumeText: $('resumeText').value.trim(),
    useResumeMatch: $('useResumeMatch').checked,
    matchMinScore: parseInt($('matchMinScore').value),
    enableCompanyCheck: $('enableCompanyCheck').checked,
    autoReply: $('autoReply').checked,
    aiRole: $('aiRole').value.trim(),
    conversationStrategy,
    hrInactiveDays: parseInt($('hrInactiveDays').value) || 14,
    useDesktopBridge: $('useDesktopBridge').checked,
    smartSchedule: $('smartSchedule').checked,
    smartGreetingPrompt: $('smartGreetingPrompt').value.trim(),
    blacklist: $('blacklist').value.trim(),
    salaryRange,
    resumes,
    interviews
  };
  await chrome.storage.local.set(obj);
}

// 日志
function addLog(text, level) {
  const log = $('log');
  const div = document.createElement('div');
  div.className = level || 'info';
  div.textContent = '[' + new Date().toLocaleTimeString() + '] ' + text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}
$('clearLog').addEventListener('click', () => { $('log').innerHTML = ''; });
$('copyLog').addEventListener('click', async () => {
  const lines = [];
  $('log').querySelectorAll('div').forEach(div => lines.push(div.textContent));
  const text = lines.join('\n');
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    // 短暂反馈
    const btn = $('copyLog');
    const orig = btn.textContent;
    btn.textContent = '✅ 已复制';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  } catch (e) {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const btn = $('copyLog');
    const orig = btn.textContent;
    btn.textContent = '✅ 已复制';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  }
});

// 运行控制
function setRunning(run) {
  $('btnCollect').textContent = run ? '运行中...' : '开始收集 + 投递';
  $('btnCollect').disabled = run;
  $('btnPause').disabled = !run;
  $('btnStop').disabled = !run;
}

$('btnCollect').addEventListener('click', async () => {
  await saveCfg();
  if (!$('keyword').value.trim()) return addLog('请先填写岗位关键词', 'error');
  setRunning(true);
  $('phaseText').textContent = '收集中...';
  addLog('开始收集 + 投递', 'info');
  chrome.runtime.sendMessage({ type: 'START_COLLECT' });
});

$('btnPause').addEventListener('click', () => {
  if ($('btnPause').textContent === '暂停') {
    chrome.runtime.sendMessage({ type: 'PAUSE' });
    $('btnPause').textContent = '继续';
  } else {
    chrome.runtime.sendMessage({ type: 'RESUME' });
    $('btnPause').textContent = '暂停';
  }
});

$('btnStop').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP' });
  setRunning(false);
  $('phaseText').textContent = '已停止';
});

$('btnReset').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'RESET' });
  setRunning(false);
  $('phaseText').textContent = '就绪';
  $('log').innerHTML = '';
});

// ── 审核确认 ──
let reviewQueue = [];

function showReviewList(queue) {
  reviewQueue = queue;
  $('reviewCard').style.display = 'block';
  $('reviewCount').textContent = queue.length + ' 个岗位';
  $('selAll').checked = true;
  renderReviewList();
}

function renderReviewList(filtered) {
  const list = filtered || reviewQueue;
  const escapeHtml = DesktopBridge.escapeHtml;

  // 按公司聚合：同公司多岗位折叠显示
  const companyGroups = {};
  const companyOrder = [];
  for (const j of list) {
    const key = (j.company || '未知').replace(/\s/g, '');
    if (!companyGroups[key]) { companyGroups[key] = []; companyOrder.push(key); }
    companyGroups[key].push(j);
  }

  let html = '';
  let globalIdx = 0;
  let groupIdx = 0;
  for (const key of companyOrder) {
    const jobs = companyGroups[key];
    const company = escapeHtml(jobs[0].company || '未知');
    const groupId = String(groupIdx++);
    if (jobs.length > 1) {
      html += '<div style="background:#f8fafc;padding:4px 8px;margin:4px 0;border-radius:4px;font-size:11px;color:#555;cursor:pointer;" class="company-group-header" data-group="' + groupId + '">🏢 ' + company + ' (' + jobs.length + '个岗位) ▸</div>';
      html += '<div class="company-group-body" data-group="' + groupId + '" style="display:none;">';
    }
    for (const j of jobs) {
      const i = globalIdx++;
      const score = j.matchScore || 0;
      const level = score >= 7 ? '🔥' : score >= 4 ? '👍' : '📌';
      const bossBadge = j.isBoss ? '<span style="background:#fff3e0;color:#e65100;padding:0 4px;border-radius:3px;font-size:10px;margin-left:4px;">👔直招</span>' : '';
      const hrInfo = j.hrTitle ? ' · ' + escapeHtml(j.hrName || '') + ' ' + escapeHtml(j.hrTitle) : '';
      html += '<label class="review-item" style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:12px;cursor:pointer;">' +
        '<input type="checkbox" class="review-cb" data-idx="' + i + '" checked style="margin-top:2px;">' +
        '<div style="flex:1;">' +
        '<b>' + escapeHtml(j.name || '未知') + '</b>' + bossBadge +
        '<br><span style="color:#666;">' + escapeHtml(j.salary || '') + ' · ' + escapeHtml(j.location || j.city || '') + hrInfo + '</span>' +
        '<button class="btn-sm analyze-btn" data-idx="' + i + '" style="float:right;font-size:10px;padding:1px 6px;margin-top:2px;">📊分析</button>' +
        '<span style="float:right;color:#4285f4;margin-right:4px;">' + level + score + '分</span>' +
        '</div></label>';
    }
    if (jobs.length > 1) html += '</div>';
  }

  $('reviewList').innerHTML = html || '<div style="color:#888;text-align:center;padding:12px;">无匹配岗位</div>';

  // 折叠展开
  $('reviewList').querySelectorAll('.company-group-header').forEach(h => {
    h.addEventListener('click', () => {
      const body = $('reviewList').querySelector('.company-group-body[data-group="' + h.dataset.group + '"]');
      const visible = body.style.display !== 'none';
      body.style.display = visible ? 'none' : 'block';
      h.innerHTML = h.innerHTML.replace(visible ? '▸' : '▾', visible ? '▾' : '▸');
      h.innerHTML = h.innerHTML.replace(visible ? '▾' : '▸', visible ? '▸' : '▾');
    });
  });

  $('reviewList').querySelectorAll('.review-cb').forEach(cb => {
    cb.addEventListener('change', () => updateSelAll());
  });
  // JD 分析按钮
  $('reviewList').querySelectorAll('.analyze-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const idx = parseInt(btn.dataset.idx);
      const job = reviewQueue[idx];
      if (!job) return;
      await analyzeJD(job);
    });
  });
}
async function analyzeJD(job) {
  const useDesktop = $('useDesktopBridge') && $('useDesktopBridge').checked;

  addLog('分析中: ' + (job.name || ''), 'info');

  // 构建请求体
  const body = JSON.stringify({
    job_title: job.name || '',
    company: job.company || '',
    description: job.jdText || (job.tags || []).join('、'),
    resume_text: $('resumeText').value.trim(),
    resume_analysis: (await chrome.storage.local.get('resumeAnalysis')).resumeAnalysis || ''
  });

  // ── 优先桌面端 ──
  if (useDesktop) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (desktopToken) headers['Authorization'] = 'Bearer ' + desktopToken;
      const resp = await fetch('http://localhost:5001/api/ai/analyze-jd', {
        method: 'POST', headers, body,
        signal: AbortSignal.timeout(30000)
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.data) { showJdReport(job, data.data, data._cached); return; }
      }
      if (resp.status === 401) addLog('桌面端认证失败，降级直调AI', 'warn');
    } catch (e) { addLog('桌面端不可用，降级直调AI', 'warn'); }
  }

  // ── 降级：直接调 AI ──
  const apiKey = $('aiApiKey').value.trim();
  if (!apiKey) { addLog('JD分析需要配置AI API Key（或启动桌面端）', 'error'); return; }
  const apiUrl = $('aiApiUrl').value.trim() || 'https://api.deepseek.com/v1/chat/completions';
  const model = $('aiModelSelect').value || 'deepseek-chat';

  try {
    const req = JSON.parse(body);
    const hasResume = req.resume_text && req.resume_text.length > 10;
    const sys = '你是求职辅导专家。分析岗位JD' + (hasResume ? '并对比求职者简历' : '') + '，输出严格JSON。';
    const user = (hasResume
      ? '## 求职者简历\n' + req.resume_text.slice(0, 2000) + '\n\n' + (req.resume_analysis ? '## 简历分析\n' + req.resume_analysis.slice(0, 600) + '\n\n' : '')
      : '')
      + '## 岗位信息\n- 公司: ' + req.company + '\n- 职位: ' + req.job_title + '\n- JD: ' + req.description.slice(0, 2000)
      + '\n\n## 输出格式（严格JSON，不要markdown）\n{"match_score":85,"decision":"建议投递","key_skills":["技能1"],"gap":"缺口","advice":"建议","summary":"总结","reasons":["理由"],"risks":["风险"],"suggested_questions":["追问1"]}';

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model, max_tokens: 800, temperature: 0.3,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }]
      })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const raw = (data.choices?.[0]?.message?.content || '').trim();
    // 解析 JSON
    let result = null;
    try { result = JSON.parse(raw); } catch (e) {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { result = JSON.parse(m[0]); } catch (e2) {} }
    }
    if (result) {
      showJdReport(job, result, false);
    } else {
      addLog('JD分析: AI返回解析失败', 'error');
    }
  } catch (e) {
    addLog('JD分析失败: ' + e.message, 'error');
  }
}

function showJdReport(job, d, cached) {
  const report = '【匹配评分】' + (d.match_score || '?') + '/100 ' + (d.decision || '') + '\n' +
    '【关键技能】' + (d.key_skills || []).join('、') + '\n' +
    '【技能缺口】' + (d.gap || '无') + '\n' +
    '【投递建议】' + (d.advice || '无') + '\n' +
    '【匹配理由】' + (d.reasons || []).join('；') + '\n' +
    '【风险提示】' + (d.risks || []).join('；') + '\n' +
    '【建议追问】' + (d.suggested_questions || []).map((q, i) => (i + 1) + '. ' + q).join('\n');
  const overlay = document.createElement('div');
  overlay.className = 'report-overlay';
  overlay.innerHTML = '<div class="report-box"><h3>📊 JD分析: ' + (job.name || '') + '</h3><pre style="white-space:pre-wrap;font-size:12px;line-height:1.6;">' + report + (cached ? '\n\n(缓存结果)' : '') + '</pre><button>关闭</button></div>';
  document.body.appendChild(overlay);
  overlay.querySelector('button').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  addLog('JD分析完成: ' + (d.match_score || '?') + '/100', 'success');
}

function updateSelAll() {
  const cbs = $('reviewList').querySelectorAll('.review-cb');
  const allChecked = Array.from(cbs).every(c => c.checked);
  $('selAll').checked = allChecked;
}

$('selAll').addEventListener('change', () => {
  $('reviewList').querySelectorAll('.review-cb').forEach(cb => { cb.checked = $('selAll').checked; });
});

$('btnDeliver').addEventListener('click', async () => {
  const cbs = $('reviewList').querySelectorAll('.review-cb');
  const selected = [];
  cbs.forEach(cb => {
    if (cb.checked) {
      const idx = parseInt(cb.dataset.idx);
      if (idx >= 0 && idx < reviewQueue.length) selected.push(reviewQueue[idx]);
    }
  });
  if (!selected.length) return addLog('请至少勾选一个岗位', 'warn');

  addLog('投递 ' + selected.length + ' 个选中岗位', 'info');
  $('reviewCard').style.display = 'none';
  setRunning(true);
  $('phaseText').textContent = '投递中...';

  // 更新 SW 中的队列为选中岗位
  await chrome.storage.local.set({ sw_queue: selected, sw_queue_index: 0 });
  chrome.runtime.sendMessage({ type: 'START_DELIVER' });
});

// 接收 Background 消息
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'LOG') { addLog(msg.text, msg.level); }
  if (msg.type === 'PHASE') {
    const map = { idle: '就绪', collecting: '收集中...', screening: '筛选中...', review: '待确认', delivering: '投递中...', done: '完成' };
    $('phaseText').textContent = map[msg.phase] || msg.phase;
    if (msg.phase === 'done' || msg.phase === 'idle') setRunning(false);
  }
  if (msg.type === 'PROGRESS') {
    $('progText').textContent = msg.cur + '/' + msg.total + ' ' + msg.label;
  }
  if (msg.type === 'QUEUE_READY') {
    addLog('筛选完成：匹配 ' + msg.queue.length + ' 个岗位', 'success');
    showReviewList(msg.queue);
  }
  if (msg.type === 'DONE') {
    addLog('投递完成：成功 ' + msg.ok + ' | 跳过 ' + (msg.skipped || 0) + ' | 失败 ' + msg.fail, msg.ok > 0 ? 'success' : 'warn');
    setRunning(false);
  }
});

// ── 仪表盘刷新 ──
async function updateDashboard() {
  const data = await chrome.storage.local.get(['jobTracker', 'dailyStats']);
  const tracker = data.jobTracker || { total: 0, highMatch: 0, applied: 0, interviewing: 0, rejected: 0 };
  const stats = data.dailyStats || {};
  const today = new Date().toDateString().replace(/\s/g, '_');
  const todayStats = stats['dailyStats_' + today] || {};

  document.querySelector('#dashStats').innerHTML =
    '<div class="dash-chip">总岗位 <b>' + (tracker.total || 0) + '</b></div>' +
    '<div class="dash-chip high">高匹配 <b>' + (tracker.highMatch || 0) + '</b></div>' +
    '<div class="dash-chip applied">已投递 <b>' + (tracker.applied || 0) + '</b></div>' +
    '<div class="dash-chip interview">面试中 <b>' + (tracker.interviewing || 0) + '</b></div>' +
    '<div class="dash-chip rejected">已拒绝 <b>' + (tracker.rejected || 0) + '</b></div>';

  const greets = todayStats.count || 0;
  const replies = todayStats.replies || 0;
  const interviews = todayStats.interviews || 0;
  const maxVal = Math.max(greets, 1);

  document.querySelector('#funnel').innerHTML =
    '<div class="funnel-bar"><span>今日投递</span><div style="flex:1;background:#eee;border-radius:3px;height:14px;overflow:hidden"><div style="width:' + (greets/maxVal*100) + '%;background:#4285f4;height:100%;border-radius:3px"></div></div><b style="color:#4285f4">' + greets + '</b></div>' +
    '<div class="funnel-bar"><span>HR回复</span><div style="flex:1;background:#eee;border-radius:3px;height:14px;overflow:hidden"><div style="width:' + (replies/maxVal*100) + '%;background:#34a853;height:100%;border-radius:3px"></div></div><b style="color:#34a853">' + replies + '</b></div>' +
    '<div class="funnel-bar"><span>面试邀约</span><div style="flex:1;background:#eee;border-radius:3px;height:14px;overflow:hidden"><div style="width:' + (interviews/maxVal*100) + '%;background:#ea4335;height:100%;border-radius:3px"></div></div><b style="color:#ea4335">' + interviews + '</b></div>';
}

// ── 周报 ──
$('btnReport').addEventListener('click', async () => {
  const data = await chrome.storage.local.get(['jobTracker', 'dailyStats']);
  const tracker = data.jobTracker || {};
  const stats = data.dailyStats || {};
  const today = new Date().toDateString().replace(/\s/g, '_');
  const todayCount = (stats['dailyStats_' + today] || {}).count || 0;

  // 计算过去7天
  let weekCount = 0, weekReplies = 0, weekInterviews = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() - i * 86400000).toDateString().replace(/\s/g, '_');
    const s = stats['dailyStats_' + d] || {};
    weekCount += s.count || 0;
    weekReplies += s.replies || 0;
    weekInterviews += s.interviews || 0;
  }

  const html =
    '<h3>📊 本周求职报告</h3>' +
    '<p>📅 本周投递：<b>' + weekCount + '</b> 次</p>' +
    '<p>💬 HR回复：<b>' + weekReplies + '</b> 次（' + (weekCount ? Math.round(weekReplies/weekCount*100) : 0) + '%）</p>' +
    '<p>🎯 面试邀约：<b>' + weekInterviews + '</b> 次（' + (weekCount ? Math.round(weekInterviews/weekCount*100) : 0) + '%）</p>' +
    '<p>📋 累计已投：<b>' + (tracker.applied || 0) + '</b> | 面试中：<b>' + (tracker.interviewing || 0) + '</b></p>' +
    '<p style="color:#888;font-size:11px;">💡 投递转化率 = 面试邀约 / 投递次数</p>';

  const overlay = document.createElement('div');
  overlay.className = 'report-overlay';
  overlay.innerHTML = '<div class="report-box">' + html + '<button>关闭</button></div>';
  document.body.appendChild(overlay);
  overlay.querySelector('button').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
});

// ── 桌面桥接检测 ──
let desktopToken = '';
async function refreshFeedbackSyncStatus(syncNow = false) {
  const type = syncNow ? 'SYNC_PENDING_FEEDBACK' : 'GET_PENDING_FEEDBACK_COUNT';
  try {
    const response = await chrome.runtime.sendMessage({ type });
    const data = response && response.data;
    const pendingCount = response && (data ? data.pendingCount : response.pendingCount);
    const status = $('feedbackRefreshStatus');
    if (syncNow && data && data.synced) {
      status.textContent = `已同步 ${data.synced} 条离线反馈；${pendingCount ? `仍有 ${pendingCount} 条等待桌面端` : '全部完成'}`;
    } else if (pendingCount) {
      status.textContent = `有 ${pendingCount} 条反馈等待桌面端连接后自动同步`;
    }
    return pendingCount || 0;
  } catch (e) {
    return 0;
  }
}

async function checkDesktopBridge() {
  try {
    const resp = await fetch('http://localhost:5001/api/health', { signal: AbortSignal.timeout(2000) });
    if (resp.status === 200) {
      // 获取本地 token 用于后续认证
      try {
        const tr = await fetch('http://localhost:5001/api/local-token', { signal: AbortSignal.timeout(2000) });
        if (tr.ok) { const td = await tr.json(); desktopToken = td.token || ''; }
      } catch (e) { desktopToken = ''; }
      $('desktopStatus').textContent = '已连接桌面端';
      $('desktopStatus').style.color = '#2e7d32';
      await refreshFeedbackSyncStatus(true);
      return true;
    }
  } catch (e) {}
  $('desktopStatus').textContent = '桌面端未连接';
  $('desktopStatus').style.color = '#888';
  return false;
}
	let _bridgeToggling = false; // 防止 change 事件重入
	$('useDesktopBridge').addEventListener('change', async () => {
	  if (_bridgeToggling) return;
	  if ($('useDesktopBridge').checked) {
	    _bridgeToggling = true;
	    const ok = await checkDesktopBridge();
	    if (!ok) {
	      $('useDesktopBridge').checked = false;
	    } else {
	      startAgentPolling();
	    }
	    _bridgeToggling = false;
	  } else {
	    stopAgentPolling();
	  }
	});

// ── API Key 眼睛切换 ──
$('toggleApiKey').addEventListener('click', () => {
  const input = $('aiApiKey');
  const btn = $('toggleApiKey');
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
});

// 初始化
loadCfg();
updateDashboard();
checkDesktopBridge().then(ok => {
  if (ok) { syncFromDesktop(); startAgentPolling(); }
  else refreshFeedbackSyncStatus();
});
