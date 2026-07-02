/**
 * 简历编辑器 — 富文本编辑 + 结构化编辑 + AI 分析/优化
 */

// ── 编辑器模式 ──
let _editorMode = 'richtext';  // 'richtext' | 'structured'
let _structuredData = null;    // 当前结构化数据缓存

function sanitizeHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,link').forEach(el => el.remove());
  doc.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on') || (attr.name === 'href' && attr.value.startsWith('javascript:'))) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return doc.body.innerHTML;
}

function escHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

// ── 富文本 toolbar ──
(function initToolbar() {
  const tb = document.getElementById('editor-toolbar');
  tb.innerHTML = `
    <button data-cmd="bold"><b>B</b></button>
    <button data-cmd="italic"><i>I</i></button>
    <button data-cmd="h3">H3</button>
    <button data-cmd="ul">• 列表</button>
    <button data-cmd="ol">1. 编号</button>
  `;
  if (!document.getElementById('resume-list')) {
    document.getElementById('btn-new-resume').insertAdjacentHTML('afterend', '<div id="resume-list" class="resume-list"></div>');
  }
})();

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

// ── 编辑器 Tab 切换 ──
document.getElementById('editor-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.editor-tab');
  if (!tab) return;
  const mode = tab.dataset.mode;
  switchEditorMode(mode);
});

function switchEditorMode(mode) {
  _editorMode = mode;
  document.querySelectorAll('#editor-tabs .editor-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode);
  });
  document.getElementById('panel-richtext').classList.toggle('hidden', mode !== 'richtext');
  document.getElementById('panel-structured').classList.toggle('hidden', mode !== 'structured');

  if (mode === 'structured') {
    // 从富文本切换到结构化：尝试从已有结构化数据回填，否则用空模板
    if (!_structuredData || !Object.keys(_structuredData).length) {
      _structuredData = getDefaultStructuredData();
    }
    renderStructuredForm(_structuredData);
  } else {
    // 从结构化切换到富文本：收集表单数据并生成文本预览
    _structuredData = collectStructuredData();
  }
}

// ── 新建简历 ──
document.getElementById('btn-new-resume').addEventListener('click', () => {
  document.getElementById('resume-list').classList.add('hidden');
  document.getElementById('resume-editor').classList.remove('hidden');
  document.getElementById('editor-content').textContent = '';
  document.getElementById('resume-title-input').value = '';
  document.getElementById('analysis-result').classList.add('hidden');
  document.getElementById('optimize-result').classList.add('hidden');
  state.editingResumeId = null;
  _structuredData = getDefaultStructuredData();
  switchEditorMode(_editorMode);
});

// ── 取消 ──
document.getElementById('btn-cancel-editor').addEventListener('click', () => {
  document.getElementById('resume-editor').classList.add('hidden');
  document.getElementById('resume-list').classList.remove('hidden');
  loadResumes();
});

// ── 保存 ──
let _isParsing = false;  // 防止重复 AI 解析

document.getElementById('btn-save-resume').addEventListener('click', async () => {
  const title = document.getElementById('resume-title-input').value.trim();

  let content, body;
  if (_editorMode === 'structured') {
    _structuredData = collectStructuredData();
    body = { title, structuredData: _structuredData };
  } else {
    content = document.getElementById('editor-content').innerText.trim();
    body = { title, content };
  }

  console.log('📝 [保存] 模式:', _editorMode, '| 标题:', title, '| 内容长度:', (content || '').length, '| resumeId:', state.editingResumeId);

  if (!title) { alert('请填写标题'); return; }
  if (!content && !_structuredData) { alert('请填写简历内容'); return; }

  const url = state.editingResumeId ? '/api/resumes/' + state.editingResumeId : '/api/resumes';
  const method = state.editingResumeId ? 'PUT' : 'POST';
  console.log('📝 [保存] 请求:', method, url);

  let res;
  try {
    res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) }).then(r => r.json());
    console.log('📝 [保存] 响应:', res.success, res.error || '', '| id:', res.data?.id);
  } catch (e) {
    console.error('📝 [保存] 网络错误:', e.message);
    alert('保存失败: ' + e.message);
    return;
  }

  if (res.success) {
    const savedResume = res.data;
    console.log('📝 [保存] 成功, savedResume:', savedResume ? { id: savedResume.id, title: savedResume.title } : null);

    // ── 富文本模式保存后，自动 AI 解析并填入结构化编辑器 ──
    if (_editorMode === 'richtext' && content && content.length >= 20 && !_isParsing) {
      console.log('🤖 [AI解析] 开始, 文本长度:', content.length);
      _isParsing = true;
      const btnSave = document.getElementById('btn-save-resume');
      const originalText = btnSave.textContent;
      btnSave.textContent = '🤖 AI 解析中...';
      btnSave.disabled = true;

      try {
        const parseRes = await fetch('/api/ai/parse-structured', {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({ resume_text: content }),
        }).then(r => r.json());
        console.log('🤖 [AI解析] 响应:', parseRes.success, parseRes.error || '', '| 字段数:', parseRes.data ? Object.keys(parseRes.data).length : 0);

        if (parseRes.success && parseRes.data) {
          _structuredData = parseRes.data;
          switchEditorMode('structured');
          renderStructuredForm(_structuredData);
          console.log('🤖 [AI解析] 已填入结构化编辑器 | name:', parseRes.data.name, '| education:', (parseRes.data.education || []).length, '| projects:', (parseRes.data.projects || []).length);

          // 自动保存结构化数据到简历
          if (savedResume && savedResume.id) {
            await fetch('/api/resumes/' + savedResume.id + '/structured', {
              method: 'PUT', headers: authHeaders(),
              body: JSON.stringify({ structuredData: _structuredData }),
            });
            state.editingResumeId = savedResume.id;
            document.getElementById('resume-title-input').value = savedResume.title || title;
            console.log('🤖 [AI解析] 结构化数据已回存到简历', savedResume.id);
          }
        } else {
          console.warn('🤖 [AI解析] 失败:', parseRes.error || '未知错误');
        }
      } catch (e) {
        console.warn('🤖 [AI解析] 异常:', e.message);
      } finally {
        _isParsing = false;
        btnSave.textContent = originalText;
        btnSave.disabled = false;
      }
    }

    // 编辑器显示控制
    if (_editorMode === 'structured' || (_structuredData && Object.keys(_structuredData).length > 0)) {
      // AI 解析成功 → 保持编辑器打开，让用户查看结构化结果
      console.log('📝 [保存] 保持编辑器打开（有结构化数据）');
    } else {
      document.getElementById('resume-editor').classList.add('hidden');
      document.getElementById('resume-list').classList.remove('hidden');
      console.log('📝 [保存] 隐藏编辑器，显示列表');
    }
    loadResumes();
  } else {
    console.error('📝 [保存] 失败:', res.error);
    alert(res.error || '保存失败');
  }
});

// ── 编辑简历 ──
async function editResume(id) {
  const res = await fetch('/api/resumes', { headers: authHeaders() }).then(r => r.json());
  if (!res.success) return;
  const resume = res.data.find(r => r.id === id);
  if (!resume) return;
  state.editingResumeId = id;
  document.getElementById('resume-list').classList.add('hidden');
  document.getElementById('resume-editor').classList.remove('hidden');
  document.getElementById('editor-content').innerHTML = sanitizeHtml(resume.content);
  document.getElementById('resume-title-input').value = resume.title;
  document.getElementById('analysis-result').classList.add('hidden');
  document.getElementById('optimize-result').classList.add('hidden');

  // 加载结构化数据
  _structuredData = resume.structuredData || getDefaultStructuredData();
  if (_editorMode === 'structured') {
    renderStructuredForm(_structuredData);
  }
}

// ── AI 分析 ──
document.getElementById('btn-analyze-resume').addEventListener('click', async () => {
  const text = _editorMode === 'structured'
    ? (await generateContentFromStructured())
    : document.getElementById('editor-content').innerText.trim();
  if (!text) { alert('请先输入简历内容'); return; }

  const panel = document.getElementById('analysis-result');
  panel.classList.remove('hidden');
  panel.innerHTML = '<div class="loading">AI 分析中</div>';

  const res = await fetch('/api/ai/analyze', {
    method: 'POST', headers: authHeaders(),
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
    <p style="font-size:24px;font-weight:700;color:var(--primary);margin:8px 0;">综合: ${+d.overall_score || 0}分</p>
    ${Object.entries(dims).map(([k, v]) => `
      <div class="score-bar">
        <span class="score-bar-label">${escHtml(dimLabel(k))}</span>
        <div class="score-bar-fill"><div class="score-bar-fill-inner" style="width:${+(v.score/v.max_score*100).toFixed(0)}%"></div></div>
        <span class="score-bar-value">${+v.score}/${+v.max_score}</span>
      </div>
      <p style="font-size:12px;color:#666;margin:0 0 8px 98px;">${escHtml(v.analysis||'')}</p>
    `).join('')}
    ${d.strengths ? `<p style="margin-top:12px;"><strong>✅ 优势:</strong> ${escHtml((d.strengths||[]).join('、'))}</p>` : ''}
    ${d.weaknesses ? `<p><strong>⚠️ 短板:</strong> ${escHtml((d.weaknesses||[]).join('、'))}</p>` : ''}
    ${d.resume_optimization_suggestions ? `<p><strong>💡 建议:</strong> ${escHtml((d.resume_optimization_suggestions||[]).join('；'))}</p>` : ''}
  `;
  panel._analysisData = d;
});

function dimLabel(key) {
  const map = {
    education: '教育背景', technical_skills: '技术技能', experience: '项目经验',
    career_progression: '职业发展', soft_skills: '软技能', resume_quality: '简历质量',
  };
  return map[key] || key;
}

async function generateContentFromStructured() {
  _structuredData = collectStructuredData();
  const res = await fetch('/api/resumes/0/structured', {
    method: 'PUT', headers: authHeaders(),
    body: JSON.stringify({ structuredData: _structuredData }),
  }).then(r => r.json()).catch(() => null);
  return res?.generatedContent || '';
}

// ── AI 优化 ──
document.getElementById('btn-optimize-resume').addEventListener('click', async () => {
  const text = _editorMode === 'structured'
    ? (await generateContentFromStructured())
    : document.getElementById('editor-content').innerText.trim();
  if (!text) { alert('请先输入简历内容'); return; }

  const panel = document.getElementById('optimize-result');
  panel.classList.remove('hidden');
  panel.innerHTML = '<div class="loading">AI 优化中</div>';

  const analysisPanel = document.getElementById('analysis-result');
  const analysis = analysisPanel._analysisData || {};

  const res = await fetch('/api/ai/rewrite', {
    method: 'POST', headers: authHeaders(),
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

// ═══════════════════════════════════════════
// 结构化编辑器
// ═══════════════════════════════════════════

// 自定义区块标题
let _sectionTitles = {};

function editSectionTitle(key, defaultTitle) {
  const current = _sectionTitles[key] || defaultTitle;
  const newTitle = prompt('重命名区块:', current);
  if (newTitle && newTitle.trim() && newTitle.trim() !== defaultTitle) {
    _sectionTitles[key] = newTitle.trim();
  } else if (newTitle !== null) {
    delete _sectionTitles[key];
  }
  // 重新渲染以更新所有标题
  _structuredData = collectStructuredData();
  _structuredData._sectionTitles = { ..._sectionTitles };
  renderStructuredForm(_structuredData);
}

function getDefaultStructuredData() {
  return {
    name: '', email: '', phone: '',
    political_status: '', homepage: '', address: '', portfolio: '',
    education: [],
    internships: [],
    projects: [],
    skills: { english: '', programming: '', ai: '', tools: '', hardware: '', other: '' },
    awards: [],
    student_work: [],
  };
}

function renderStructuredForm(sd) {
  const container = document.getElementById('structured-form');
  if (!container) return;
  sd = sd || getDefaultStructuredData();
  _structuredData = sd;
  // 恢复自定义区块标题
  _sectionTitles = (sd._sectionTitles && typeof sd._sectionTitles === 'object') ? { ...sd._sectionTitles } : {};
  _hiddenFields = (sd._hiddenFields && Array.isArray(sd._hiddenFields)) ? [...sd._hiddenFields] : ['political_status', 'homepage', 'address', 'portfolio'];

  container.innerHTML = `
    <!-- 基本信息 -->
    <div class="sf-section">
      <h3><span class="sf-section-title-text" data-sf-section="basics">基本信息</span> <button class="btn btn-ghost btn-sm sf-edit-title" onclick="editSectionTitle(&apos;basics&apos;,&apos;基本信息&apos;)" title="重命名">✏️</button></h3>
      <div class="sf-grid-2col">
        ${sfInput('姓名', 'name', sd.name, '张三')}
        ${sfInput('邮箱', 'email', sd.email, 'example@example.com', 'email')}
        ${sfInput('电话', 'phone', sd.phone, '13800138000')}
        ${renderOptionalFields(sd)}
      </div>
    </div>
    <div id="sf-optional-add" style="margin-top:6px;"></div>

    <!-- 教育背景 -->
    <div class="sf-section">
      <h3><span class="sf-section-title-text" data-sf-section="education">教育背景</span> <button class="btn btn-ghost btn-sm sf-edit-title" onclick="editSectionTitle(&apos;education&apos;,&apos;教育背景&apos;)" title="重命名">✏️</button></h3>
      <div id="sf-education-list"></div>
      <button class="btn btn-sm sf-add-btn" onclick="sfAddEducation()">+ 添加教育经历</button>
    </div>

    <!-- 实习经历 -->
    <div class="sf-section">
      <h3><span class="sf-section-title-text" data-sf-section="internships">实习经历</span> <button class="btn btn-ghost btn-sm sf-edit-title" onclick="editSectionTitle(&apos;internships&apos;,&apos;实习经历&apos;)" title="重命名">✏️</button></h3>
      <div id="sf-internship-list"></div>
      <button class="btn btn-sm sf-add-btn" onclick="sfAddInternship()">+ 添加实习经历</button>
    </div>

    <!-- 项目经历 -->
    <div class="sf-section">
      <h3><span class="sf-section-title-text" data-sf-section="projects">项目经历</span> <button class="btn btn-ghost btn-sm sf-edit-title" onclick="editSectionTitle(&apos;projects&apos;,&apos;项目经历&apos;)" title="重命名">✏️</button></h3>
      <div id="sf-project-list"></div>
      <button class="btn btn-sm sf-add-btn" onclick="sfAddProject()">+ 添加项目经历</button>
    </div>

    <!-- 获奖情况 -->
    <div class="sf-section">
      <h3><span class="sf-section-title-text" data-sf-section="awards">获奖情况</span> <button class="btn btn-ghost btn-sm sf-edit-title" onclick="editSectionTitle(&apos;awards&apos;,&apos;获奖情况&apos;)" title="重命名">✏️</button></h3>
      <div id="sf-award-list"></div>
      <button class="btn btn-sm sf-add-btn" onclick="sfAddAward()">+ 添加获奖</button>
    </div>

    <!-- 学生工作 -->
    <div class="sf-section">
      <h3><span class="sf-section-title-text" data-sf-section="student_work">学生工作</span> <button class="btn btn-ghost btn-sm sf-edit-title" onclick="editSectionTitle(&apos;student_work&apos;,&apos;学生工作&apos;)" title="重命名">✏️</button></h3>
      <div id="sf-studentwork-list"></div>
      <button class="btn btn-sm sf-add-btn" onclick="sfAddStudentWork()">+ 添加学生工作</button>
    </div>

    <!-- 专业技能 -->
    <div class="sf-section">
      <h3><span class="sf-section-title-text" data-sf-section="skills">专业技能</span> <button class="btn btn-ghost btn-sm sf-edit-title" onclick="editSectionTitle(&apos;skills&apos;,&apos;专业技能&apos;)" title="重命名">✏️</button></h3>
      <div class="sf-grid-2col">
        ${sfSkillRow('英语', 'english', sd.skills?.english, 'CET6 521分，可独立阅读英文技术文档')}
        ${sfSkillRow('编程', 'programming', sd.skills?.programming, 'C、C++、Python、MATLAB')}
        ${sfSkillRow('AI与数据分析', 'ai', sd.skills?.ai, 'PyTorch，模型训练与评估')}
        ${sfSkillRow('工具', 'tools', sd.skills?.tools, 'Git、VS Code、Markdown、LaTeX')}
        ${sfSkillRow('硬件', 'hardware', sd.skills?.hardware, 'STM32、I2C/SPI/UART')}
        ${sfSkillRow('其他', 'other', sd.skills?.other, '')}
      </div>
    </div>
  `;

  // 回填动态列表
  (sd.education || []).forEach((e, i) => sfRenderEducation(i, e));
  (sd.internships || []).forEach((e, i) => sfRenderInternship(i, e));
  (sd.projects || []).forEach((e, i) => sfRenderProject(i, e));
  (sd.awards || []).forEach((e, i) => sfRenderAward(i, e));
  (sd.student_work || []).forEach((e, i) => sfRenderStudentWork(i, e));

  // 应用自定义区块标题
  document.querySelectorAll('.sf-section-title-text[data-sf-section]').forEach(el => {
    const key = el.dataset.sfSection;
    if (_sectionTitles[key]) el.textContent = _sectionTitles[key];
  });
  // 渲染可选字段添加按钮
  renderOptionalAddButtons();
}

// ── 表单控件生成 ──
function sfInput(label, key, value, placeholder, type) {
  return `<div class="sf-field">
    <label>${label}</label>
    <input type="${type || 'text'}" data-sf-key="${key}" value="${escAttr(value || '')}" placeholder="${placeholder || ''}">
  </div>`;
}

function sfSkillRow(label, key, value, placeholder) {
  return `<div class="sf-field">
    <label>${label}</label>
    <input type="text" data-sf-skill="${key}" value="${escAttr(value || '')}" placeholder="${placeholder || ''}">
  </div>`;
}

function escAttr(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── 可选字段定义 ──
const OPTIONAL_FIELDS = [
  { key: 'political_status', label: '政治面貌', icon: '🏛️', placeholder: '中共党员/共青团员/群众' },
  { key: 'homepage', label: '个人主页', icon: '🌐', placeholder: 'https://...' },
  { key: 'address', label: '通讯地址', icon: '📮', placeholder: '详细地址' },
  { key: 'portfolio', label: '作品集', icon: '🔗', placeholder: 'https://github.com/...' },
];

// ── 可选字段渲染 ──
function renderOptionalFields(sd) {
  var shown = OPTIONAL_FIELDS.filter(function(f) {
    if (_hiddenFields.indexOf(f.key) >= 0) return false;
    if ((sd[f.key] || '') !== '') {
      _hiddenFields = _hiddenFields.filter(function(h) { return h !== f.key; });
      return true;
    }
    return _hiddenFields.indexOf(f.key) < 0;
  });
  return shown.map(function(f) {
    return '<div class="sf-optional-row" id="sf-opt-' + f.key + '">' +
      sfInput(f.label, f.key, sd[f.key] || '', f.placeholder) +
      '<button class="btn btn-ghost btn-sm sf-hide-field" onclick="toggleOptionalField(\'' + f.key + '\', false)" title="\u9690\u85cf\u6b64\u5b57\u6bb5">\u2715</button>' +
      '</div>';
  }).join('');
}

function toggleOptionalField(key, show) {
  if (show) {
    _hiddenFields = _hiddenFields.filter(function(h) { return h !== key; });
  } else {
    if (_hiddenFields.indexOf(key) < 0) _hiddenFields.push(key);
  }
  _structuredData = collectStructuredData();
  _structuredData._hiddenFields = [].concat(_hiddenFields);
  renderStructuredForm(_structuredData);
}

function renderOptionalAddButtons() {
  var container = document.getElementById('sf-optional-add');
  if (!container) return;
  var available = OPTIONAL_FIELDS.filter(function(f) { return _hiddenFields.indexOf(f.key) >= 0; });
  if (!available.length) { container.innerHTML = ''; return; }
  container.innerHTML = '<span style="font-size:11px;color:var(--text-secondary);">+ \u6dfb\u52a0\u5b57\u6bb5\uff1a</span> ' +
    available.map(function(f) { return '<button class="btn btn-sm" style="margin:2px;font-size:11px;" onclick="toggleOptionalField(\'' + f.key + '\', true)">' + f.icon + ' ' + f.label + '</button>'; }).join(' ');
}

// ── 收集表单数据 ──
function collectStructuredData() {
  const form = document.getElementById('structured-form');
  if (!form) return _structuredData || getDefaultStructuredData();

  const sd = getDefaultStructuredData();
  // 基本信息
  form.querySelectorAll('[data-sf-key]').forEach(el => {
    sd[el.dataset.sfKey] = el.value || '';
  });
  // 技能
  form.querySelectorAll('[data-sf-skill]').forEach(el => {
    if (!sd.skills) sd.skills = {};
    sd.skills[el.dataset.sfSkill] = el.value || '';
  });
  // 动态列表
  sd.education = sfCollectList('sf-edu-entry');
  sd.internships = sfCollectList('sf-intern-entry');
  sd.projects = sfCollectList('sf-proj-entry');
  sd.awards = sfCollectList('sf-award-entry');
  sd.student_work = sfCollectList('sf-swork-entry');

  return sd;
}

function sfCollectList(entryClass) {
  const entries = document.querySelectorAll('.' + entryClass);
  const result = [];
  entries.forEach(entry => {
    const data = {};
    entry.querySelectorAll('[data-sf-key]').forEach(el => {
      data[el.dataset.sfKey] = el.value || '';
    });
    // 收集 star_points (结构化 STAR 字段)
    const starEditors = entry.querySelectorAll('.star-editor');
    if (starEditors.length) {
      data.star_points = [];
      starEditors.forEach(ed => {
        const sp = {};
        ['situation', 'action', 'result', 'keywords'].forEach(field => {
          const el = ed.querySelector(`[data-sf-star-field="${field}"]`);
          if (el && el.value.trim()) sp[field] = el.value.trim();
        });
        if (Object.values(sp).some(v => v)) data.star_points.push(sp);
      });
    } else {
      // 兼容旧版：纯 textarea star points
      entry.querySelectorAll('[data-sf-star]').forEach(el => {
        const text = el.value.trim();
        if (text) {
          if (!data.star_points) data.star_points = [];
          data.star_points.push(text);
        }
      });
    }
    if (Object.values(data).some(v => v)) result.push(data);
  });
  return result;
}

// ── 动态条目增删 ──
function sfRemoveEntry(btn) {
  const entry = btn.closest('.sf-entry');
  if (entry) entry.remove();
}

// ── 教育经历 ──
function sfAddEducation() { sfRenderEducation(Date.now(), {}); }
function sfRenderEducation(idx, data) {
  const list = document.getElementById('sf-education-list');
  if (!list) return;
  const div = document.createElement('div');
  div.className = 'sf-entry sf-edu-entry';
  div.innerHTML = `
    <div class="sf-entry-header"><span>教育经历</span><button class="btn btn-ghost btn-sm" onclick="sfRemoveEntry(this)">✕</button></div>
    <div class="sf-grid-2col">
      ${sfInput('学校', 'school', data.school, '某大学')}
      ${sfInput('专业', 'major', data.major, '计算机科学与技术')}
      ${sfInput('学历', 'degree', data.degree, '硕士')}
      ${sfInput('时间', 'period', data.period, '2024.9 - 2027.6')}
      ${sfInput('GPA', 'gpa', data.gpa, '3.5/4.0')}
    </div>
    <div class="sf-field"><label>亮点</label><input type="text" data-sf-key="highlights" value="${escAttr(data.highlights||'')}" placeholder="研究方向、荣誉等"></div>
  `;
  list.appendChild(div);
}

// ── 实习经历 ──
function sfAddInternship() { sfRenderInternship(Date.now(), {}); }
function sfRenderInternship(idx, data) {
  const list = document.getElementById('sf-internship-list');
  if (!list) return;
  const div = document.createElement('div');
  div.className = 'sf-entry sf-intern-entry';
  div.innerHTML = `
    <div class="sf-entry-header"><span>实习经历</span><button class="btn btn-ghost btn-sm" onclick="sfRemoveEntry(this)">✕</button></div>
    <div class="sf-grid-2col">
      ${sfInput('公司', 'company', data.company, '某公司')}
      ${sfInput('岗位', 'role', data.role, '算法工程师实习生')}
      ${sfInput('时间', 'period', data.period, '2025.6 - 2025.9')}
    </div>
    <div class="sf-field"><label>概述</label><input type="text" data-sf-key="summary" value="${escAttr(data.summary||'')}" placeholder="一句话概括工作内容"></div>
    <div class="sf-star-points" data-sf-star-container>
      <label style="font-size:12px;color:var(--text-secondary);">STAR 要点</label>
      ${(data.star_points || ['']).map((sp, i) => `<textarea data-sf-star="${i}" rows="2" placeholder="STAR 要点 ${i+1}：描述你的行动和成果">${escAttr(sp)}</textarea>`).join('')}
    </div>
    <button class="btn btn-sm sf-add-btn" style="margin-top:4px;" onclick="sfAddStarPoint(this)">+ 添加要点</button>
  `;
  list.appendChild(div);
}

// ── 项目经历 ──
function sfAddProject() { sfRenderProject(Date.now(), {}); }
function sfRenderProject(idx, data) {
  const list = document.getElementById('sf-project-list');
  if (!list) return;
  const div = document.createElement('div');
  div.className = 'sf-entry sf-proj-entry';
  const starPoints = data.star_points || [{}];
  const starHtml = starPoints.map((sp, i) => {
    const s = typeof sp === 'string' ? { action: sp } : (sp || {});
    return `<div class="star-editor" data-star-idx="${i}">
      <div class="star-header">
        <span>STAR 要点 ${i+1}</span>
        <button class="btn btn-ghost btn-sm" onclick="sfRemoveStarPoint(this)">✕</button>
      </div>
      <div class="sf-field">
        <label>Situation / Task（背景与任务）<span class="star-charcount">0/200</span></label>
        <textarea data-sf-star="${i}" data-sf-star-field="situation" rows="2" placeholder="描述项目背景、痛点、你的任务目标" oninput="updateStarCharCount(this)">${escAttr(s.situation || '')}</textarea>
      </div>
      <div class="sf-field">
        <label>Action（行动）<span class="star-charcount">0/300</span></label>
        <textarea data-sf-star="${i}" data-sf-star-field="action" rows="3" placeholder="你具体做了什么？用了什么技术/方法/工具？" oninput="updateStarCharCount(this)">${escAttr(s.action || '')}</textarea>
      </div>
      <div class="sf-field">
        <label>Result（结果）<span class="star-charcount">0/200</span></label>
        <textarea data-sf-star="${i}" data-sf-star-field="result" rows="2" placeholder="量化成果：准确率提升X%、处理速度提升X倍、减少X%错误率" oninput="updateStarCharCount(this)">${escAttr(s.result || '')}</textarea>
      </div>
      <div class="sf-field">
        <label>关键词</label>
        <input type="text" data-sf-star="${i}" data-sf-star-field="keywords" value="${escAttr(s.keywords || '')}" placeholder="深度学习, PyTorch, 模型部署（逗号分隔）">
      </div>
      <button class="btn btn-sm" style="margin-bottom:8px;" onclick="toggleStarPreview(this)">👁 预览</button>
      <div class="star-preview hidden"></div>
    </div>`;
  }).join('');

  div.innerHTML = `
    <div class="sf-entry-header"><span>项目经历</span><button class="btn btn-ghost btn-sm" onclick="sfRemoveEntry(this)">✕</button></div>
    <div class="sf-grid-2col">
      ${sfInput('项目名称', 'name', data.name, '基于深度学习的...')}
      ${sfInput('角色', 'role', data.role, '项目负责人')}
      ${sfInput('时间', 'period', data.period, '2024.11 - 2025.3')}
    </div>
    <div class="sf-field"><label>概述</label><input type="text" data-sf-key="summary" value="${escAttr(data.summary||'')}" placeholder="一句话说明项目背景和目标"></div>
    <div class="sf-field"><label>标签</label><input type="text" data-sf-key="tags" value="${escAttr((data.tags||[]).join(', '))}" placeholder="PyTorch, 计算机视觉, ONNX（逗号分隔）"></div>
    <div class="star-template-hints">
      💡 <strong>STAR 模板提示：</strong> 可量化指标示例 — 准确率提升 X%、处理速度提升 X 倍、减少 X% 错误率、数据完整率 X%、延迟降低 Xms
    </div>
    <div data-sf-star-container>
      ${starHtml}
    </div>
    <button class="btn btn-sm sf-add-btn" onclick="sfAddStarPoint(this)">+ 添加 STAR 要点</button>
  `;
  list.appendChild(div);
}

function updateStarCharCount(textarea) {
  const label = textarea.closest('.sf-field').querySelector('.star-charcount');
  if (label) label.textContent = textarea.value.length + '/' + (textarea.rows * 100);
}

function toggleStarPreview(btn) {
  const editor = btn.closest('.star-editor');
  const preview = editor.querySelector('.star-preview');
  if (preview.classList.contains('hidden')) {
    // Build preview
    const sit = editor.querySelector('[data-sf-star-field="situation"]')?.value || '';
    const act = editor.querySelector('[data-sf-star-field="action"]')?.value || '';
    const res = editor.querySelector('[data-sf-star-field="result"]')?.value || '';
    const kw = editor.querySelector('[data-sf-star-field="keywords"]')?.value || '';
    preview.innerHTML = `
      <div class="star-preview-bullet">
        <strong>📋 背景:</strong> ${esc(sit)}<br>
        <strong>⚡ 行动:</strong> ${esc(act)}<br>
        <strong>📊 成果:</strong> ${esc(res)}<br>
        ${kw ? `<span style="font-size:11px;color:var(--primary);">🏷 ${esc(kw)}</span>` : ''}
      </div>
    `;
    preview.classList.remove('hidden');
    btn.textContent = '📝 编辑';
  } else {
    preview.classList.add('hidden');
    btn.textContent = '👁 预览';
  }
}

function sfRemoveStarPoint(btn) {
  const editor = btn.closest('.star-editor');
  const container = editor.parentElement;
  editor.remove();
  // Renumber remaining
  container.querySelectorAll('.star-editor').forEach((ed, i) => {
    ed.querySelector('.star-header span').textContent = 'STAR 要点 ' + (i+1);
  });
}

// ── 获奖 ──
function sfAddAward() { sfRenderAward(Date.now(), {}); }
function sfRenderAward(idx, data) {
  const list = document.getElementById('sf-award-list');
  if (!list) return;
  const div = document.createElement('div');
  div.className = 'sf-entry sf-award-entry sf-entry-inline';
  div.innerHTML = `
    <div class="sf-grid-2col" style="flex:1;">
      ${sfInput('分类', 'category', data.category, '竞赛类/荣誉类/创新类')}
      ${sfInput('奖项名称', 'name', data.name, '全国大学生数学建模竞赛（省级一等奖）')}
    </div>
    <button class="btn btn-ghost btn-sm" onclick="sfRemoveEntry(this)">✕</button>
  `;
  list.appendChild(div);
}

// ── 学生工作 ──
function sfAddStudentWork() { sfRenderStudentWork(Date.now(), {}); }
function sfRenderStudentWork(idx, data) {
  const list = document.getElementById('sf-studentwork-list');
  if (!list) return;
  const div = document.createElement('div');
  div.className = 'sf-entry sf-swork-entry sf-entry-inline';
  div.innerHTML = `
    <div class="sf-grid-2col" style="flex:1;">
      ${sfInput('部门', 'org', data.org, '某学院学生会')}
      ${sfInput('岗位', 'role', data.role, '部长')}
      ${sfInput('时间', 'period', data.period, '2021.9 - 2022.6')}
    </div>
    <div class="sf-field" style="flex:1;"><label>描述</label><input type="text" data-sf-key="desc" value="${escAttr(data.desc||'')}" placeholder="负责xxx工作"></div>
    <button class="btn btn-ghost btn-sm" onclick="sfRemoveEntry(this)">✕</button>
  `;
  list.appendChild(div);
}

// ── STAR 要点 ──
function sfAddStarPoint(btn) {
  const container = btn.parentElement.querySelector('[data-sf-star-container]');
  if (!container) return;
  const idx = container.querySelectorAll('[data-sf-star]').length;
  const ta = document.createElement('textarea');
  ta.setAttribute('data-sf-star', idx);
  ta.rows = 2;
  ta.placeholder = `STAR 要点 ${idx+1}：描述行动和成果，包含量化指标`;
  container.insertBefore(ta, btn);
}


// ═══════════════════════════════════════════
// PDF 导出 — 现代化简历模板（CSS 变量 + 用户可配置）
// ═══════════════════════════════════════════

const DEFAULT_TPL = {
  themeColor: '#2563eb', bodyFontSize: 13, pageMargin: 16, lineHeight: 1.7
};

function getTemplateConfig() {
  try {
    const raw = localStorage.getItem('resume_tpl');
    if (raw) return { ...DEFAULT_TPL, ...JSON.parse(raw) };
  } catch (e) {}
  return { ...DEFAULT_TPL };
}

function saveTemplateConfig(cfg) {
  localStorage.setItem('resume_tpl', JSON.stringify(cfg));
}

// ── 面板事件 ──
function initTemplatePanel() {
  const cfg = getTemplateConfig();
  const $ = (id) => document.getElementById(id);
  const els = {
    theme: $('tpl-theme'),
    bodySize: $('tpl-body-size'),
    margin: $('tpl-margin'),
    lineHeight: $('tpl-line-height'),
  };
  if (!els.theme) return;
  els.theme.value = cfg.themeColor;
  els.bodySize.value = cfg.bodyFontSize;
  els.margin.value = cfg.pageMargin;
  els.lineHeight.value = cfg.lineHeight;

  function onchange() {
    const c = {
      themeColor: els.theme.value,
      bodyFontSize: parseInt(els.bodySize.value),
      pageMargin: parseInt(els.margin.value),
      lineHeight: parseFloat(els.lineHeight.value),
    };
    saveTemplateConfig(c);
  }
  els.theme.addEventListener('input', onchange);
  els.bodySize.addEventListener('change', onchange);
  els.margin.addEventListener('change', onchange);
  els.lineHeight.addEventListener('change', onchange);

  const btnReset = $('btn-reset-tpl');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      saveTemplateConfig({ ...DEFAULT_TPL });
      els.theme.value = DEFAULT_TPL.themeColor;
      els.bodySize.value = DEFAULT_TPL.bodyFontSize;
      els.margin.value = DEFAULT_TPL.pageMargin;
      els.lineHeight.value = DEFAULT_TPL.lineHeight;
    });
  }
}

// 页面加载时初始化面板
initTemplatePanel();

async function exportResumePDF(id) {
  const res = await fetch('/api/resumes', { headers: authHeaders() }).then(r => r.json());
  if (!res.success) return;
  const resume = res.data.find(r => r.id === id);
  if (!resume) return alert('简历不存在');

  const sd = resume.structuredData;
  const plainText = resume.content || '';
  const tplCfg = getTemplateConfig();

  const html = buildResumeHTML(sd, plainText, resume.title, tplCfg);

  // 打开新窗口预览+打印
  const w = window.open('', '_blank', 'width=900,height=700');
  w.document.write(html);
  w.document.close();
  // 等字体和图片加载完成后自动弹出打印
  w.onload = () => {
    // 给用户先看预览，不立即弹打印；窗口里放一个打印按钮
  };
}

function buildResumeHTML(sd, plainText, title, tplCfg) {
  const hasSD = sd && typeof sd === 'object' && Object.keys(sd).length > 0;

  const name = hasSD ? (sd.name || '') : '';
  const info = {
    email: hasSD ? (sd.email || '') : '',
    phone: hasSD ? (sd.phone || '') : '',
    political: hasSD ? (sd.political_status || '') : '',
    homepage: hasSD ? (sd.homepage || '') : '',
    address: hasSD ? (sd.address || '') : '',
  };
  const education = hasSD ? (sd.education || []) : [];
  const internships = hasSD ? (sd.internships || []) : [];
  const projects = hasSD ? (sd.projects || []) : [];
  const awards = hasSD ? (sd.awards || []) : [];
  const studentWork = hasSD ? (sd.student_work || []) : [];
  const skills = hasSD ? (sd.skills || {}) : {};

  const infoItems = [];
  if (info.phone) infoItems.push(iconRow('📞', info.phone));
  if (info.email) infoItems.push(iconRow('✉️', info.email));
  if (info.political) infoItems.push(iconRow('🏛️', info.political));
  if (info.homepage) infoItems.push(iconRow('🌐', info.homepage));
  if (info.address) infoItems.push(iconRow('📮', info.address));

  const hasPhoto = hasSD && sd.photo_url;
  const c = tplCfg || getTemplateConfig();

  const tpl = {
    themeColor: c.themeColor || '#2563eb',
    nameFontSize: Math.round((c.bodyFontSize || 13) * 2),
    titleFontSize: Math.round((c.bodyFontSize || 13) * 1.15),
    bodyFontSize: c.bodyFontSize || 13,
    lineHeight: c.lineHeight || 1.7,
    pageMargin: c.pageMargin || 16,
    sectionGap: Math.round((c.pageMargin || 16) * 0.5),
    cardGap: Math.round((c.pageMargin || 16) * 0.2),
    fontFamily: "'PingFang SC','Microsoft YaHei','Noto Sans SC',system-ui,sans-serif",
  };

  const html = `<!DOCTYPE html>
	<html lang="zh-CN">
	<head>
	<meta charset="UTF-8">
	<title>${esc(name || title)} — 简历</title>
	<style>
	  :root {
	    --theme: ${tpl.themeColor};
	    --name-size: ${tpl.nameFontSize}px;
	    --title-size: ${tpl.titleFontSize}px;
	    --body-size: ${tpl.bodyFontSize}px;
	    --line-height: ${tpl.lineHeight};
	    --page-margin: ${tpl.pageMargin}mm;
	    --section-gap: ${tpl.sectionGap}mm;
	    --card-gap: ${tpl.cardGap}mm;
	    --color-title: #111827;
	    --color-body: #374151;
	    --color-muted: #6b7280;
	    --color-card-bg: #f9fafb;
	    --color-border: #e5e7eb;
	    --color-bullet: var(--theme);
	    --font-family: ${tpl.fontFamily};
	    -webkit-print-color-adjust: exact;
	    print-color-adjust: exact;
	  }

	  @page { size: A4; margin: 0; }

	  * { margin: 0; padding: 0; box-sizing: border-box; }

	  body {
	    font-family: var(--font-family);
	    font-size: var(--body-size);
	    color: var(--color-body);
	    line-height: var(--line-height);
	    background: #f3f4f6;
	    display: flex;
	    justify-content: center;
	  }

	  .page {
	    width: 210mm;
	    min-height: 297mm;
	    background: #fff;
	    padding: var(--page-margin);
	    position: relative;
	  }

	  /* ====== Header ====== */
	  .header {
	    display: flex; justify-content: space-between; align-items: flex-start;
	    padding-bottom: 12px; margin-bottom: var(--section-gap);
	    border-bottom: 2px solid var(--theme);
	    break-inside: avoid; page-break-inside: avoid;
	  }
	  .header-left { flex: 1; }
	  .header-name {
	    font-size: var(--name-size); font-weight: 700; color: var(--color-title);
	    letter-spacing: 1px; margin-bottom: 6px; line-height: 1.15;
	  }
	  .header-info { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--color-muted); }
	  .header-info span { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
	  .header-photo {
	    width: 25mm; height: 33mm; border-radius: 4px; background: #e2e8f0;
	    display: ${hasPhoto ? 'block' : 'none'}; object-fit: cover; margin-left: 8mm;
	  }

	  /* ====== Sections ====== */
	  .section { margin-bottom: var(--section-gap); }
	  .section-title {
	    font-size: var(--title-size); font-weight: 700; color: var(--color-title);
	    display: flex; align-items: center; gap: 6px;
	    margin-bottom: 5px; padding-bottom: 4px;
	    border-bottom: 1px solid var(--color-border);
	    break-after: avoid; page-break-after: avoid;
	  }
	  .section-title .icon { font-size: 16px; }

	  /* ====== Cards ====== */
	  .card {
	    background: var(--color-card-bg); border-radius: 4px;
	    padding: 3mm 3.5mm; margin-bottom: var(--card-gap);
	    break-inside: avoid; page-break-inside: avoid;
	  }
	  .card-row { display: flex; align-items: baseline; gap: 2mm; }
	  .card-left { font-weight: 600; font-size: var(--body-size); color: var(--color-title); flex-shrink: 0; }
	  .card-center { flex: 1; font-size: 12px; color: var(--color-body); }
	  .card-right { font-size: 12px; color: var(--color-muted); white-space: nowrap; flex-shrink: 0; text-align: right; }
	  .card-sub { font-size: 11.5px; color: var(--color-muted); margin-top: 1.5mm; line-height: 1.6; }

	  /* ====== Bullets ====== */
	  .bullets { list-style: none; padding: 0; margin-top: 2mm; }
	  .bullets li {
	    position: relative; padding-left: 3.5mm; margin-bottom: 1.2mm;
	    font-size: 12px; color: var(--color-body); line-height: 1.6;
	    break-inside: avoid; page-break-inside: avoid;
	  }
	  .bullets li::before {
		    content: '•'; position: absolute; left: 0;
	    color: var(--color-bullet); font-weight: 700;
	  }

	  /* ====== Skills Table ====== */
	  .skill-table { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm 4mm; }
	  .skill-row { display: flex; gap: 2mm; font-size: 12px; }
	  .skill-label { font-weight: 600; color: var(--color-title); white-space: nowrap; }
	  .skill-value { color: var(--color-body); }

	  /* ====== Awards ====== */
	  .award-list { display: flex; flex-wrap: wrap; gap: 2mm 5mm; }
	  .award-item { font-size: 12px; color: var(--color-body); }
	  .award-cat { font-weight: 600; color: var(--color-title); }

	  /* ====== Pagination (adapted from VitaFlow) ====== */
	  .item-head, .card-row, .section-title {
	    break-after: avoid; page-break-after: avoid;
	  }
	  .card, .bullets li { break-inside: avoid; page-break-inside: avoid; }

	  /* ====== Plain-text fallback ====== */
	  .plain-text { font-size: 12px; color: var(--color-body); line-height: 1.8; white-space: pre-wrap; }

	  /* ====== Print bar ====== */
	  .print-bar {
	    position: fixed; bottom: 0; left: 0; right: 0; background: var(--theme); color: #fff;
	    padding: 10px 20px; display: flex; justify-content: center; gap: 16px; z-index: 999;
	  }
	  .print-bar button { padding: 8px 24px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; }
	  .btn-print { background: #fff; color: var(--theme); }
	  .btn-close { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,.4); }

	  @media print {
	    body { background: #fff; }
	    .print-bar { display: none; }
	    .page { box-shadow: none; margin: 0; }
	  }
	</style>
</head>
<body>

<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div class="header-name">${esc(name || title || '未命名简历')}</div>
      <div class="header-info">${infoItems.join('')}</div>
    </div>
    ${hasPhoto ? `<img class="header-photo" src="${escAttr(sd.photo_url)}" alt="照片">` : ''}
  </div>

  ${hasSD ? buildSDSections(education, internships, projects, awards, studentWork, skills) : `<div class="plain-text">${esc(plainText)}</div>`}

</div>

<!-- 打印工具栏 -->
<div class="print-bar">
  <span style="line-height:36px;">📄 简历预览 — 按 <strong>Ctrl+P</strong> 或点击按钮导出 PDF</span>
  <button class="btn-print" onclick="window.print()">🖨️ 导出 PDF</button>
  <button class="btn-close" onclick="window.close()">✕ 关闭</button>
</div>

</body>
</html>`;

  return html;
}

function buildSDSections(education, internships, projects, awards, studentWork, skills) {
  let html = '';

  // 教育背景
  if (education.length) {
    html += `<div class="section"><div class="section-title"><span class="icon">🎓</span>教育背景</div>`;
    education.forEach(e => {
      html += `<div class="card"><div class="card-row">
        <span class="card-left">${esc(e.school || '')}</span>
        <span class="card-center">${esc(e.major || '')} · ${esc(e.degree || '')}</span>
        <span class="card-right">${esc(e.period || '')}</span>
      </div>`;
      if (e.gpa) html += `<div class="card-sub">GPA: ${esc(e.gpa)}</div>`;
      if (e.highlights) html += `<div class="card-sub">${esc(e.highlights)}</div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  // 实习经历
  if (internships.length) {
    html += `<div class="section"><div class="section-title"><span class="icon">💼</span>实习经历</div>`;
    internships.forEach(inv => {
      html += `<div class="card"><div class="card-row">
        <span class="card-left">${esc(inv.company || '')}</span>
        <span class="card-center">${esc(inv.role || '')}</span>
        <span class="card-right">${esc(inv.period || '')}</span>
      </div>`;
      if (inv.summary) html += `<div class="card-sub">${esc(inv.summary)}</div>`;
      const sps = inv.star_points || [];
      if (sps.length) {
        html += `<ul class="bullets">`;
        sps.forEach(sp => {
          if (typeof sp === 'string') {
            html += `<li>${esc(sp)}</li>`;
          } else {
            html += `<li>${esc(sp.action || '')}${sp.result ? '。' + esc(sp.result) : ''}</li>`;
          }
        });
        html += `</ul>`;
      }
      html += `</div>`;
    });
    html += `</div>`;
  }

  // 项目经历
  if (projects.length) {
    html += `<div class="section"><div class="section-title"><span class="icon">🚀</span>项目经历</div>`;
    projects.forEach(proj => {
      const tags = (proj.tags || []).join(' · ');
      html += `<div class="card"><div class="card-row">
        <span class="card-left">${esc(proj.name || '')}</span>
        <span class="card-center">${esc(proj.role || '')}</span>
        <span class="card-right">${esc(proj.period || '')}</span>
      </div>`;
      if (proj.summary) html += `<div class="card-sub">${esc(proj.summary)}</div>`;
      if (tags) html += `<div class="card-sub" style="color:#1E3A8A;">🏷 ${esc(tags)}</div>`;
      const sps = proj.star_points || [];
      if (sps.length) {
        html += `<ul class="bullets">`;
        sps.forEach(sp => {
          if (typeof sp === 'string') {
            html += `<li>${esc(sp)}</li>`;
          } else {
            html += `<li>${esc(sp.action || '')}${sp.result ? '。' + esc(sp.result) : ''}</li>`;
          }
        });
        html += `</ul>`;
      }
      html += `</div>`;
    });
    html += `</div>`;
  }

  // 获奖情况
  if (awards.length) {
    html += `<div class="section"><div class="section-title"><span class="icon">🏆</span>获奖情况</div>`;
    html += `<div class="card"><div class="award-list">`;
    awards.forEach(a => {
      html += `<span class="award-item"><span class="award-cat">${esc(a.category || '')}</span> ${esc(a.name || '')}</span>`;
    });
    html += `</div></div></div>`;
  }

  // 学生工作
  if (studentWork.length) {
    html += `<div class="section"><div class="section-title"><span class="icon">📋</span>学生工作</div>`;
    studentWork.forEach(sw => {
      html += `<div class="card"><div class="card-row">
        <span class="card-left">${esc(sw.org || '')}</span>
        <span class="card-center">${esc(sw.role || '')}</span>
        <span class="card-right">${esc(sw.period || '')}</span>
      </div>`;
      if (sw.desc) html += `<div class="card-sub">${esc(sw.desc)}</div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  // 专业技能
  const skillLabels = { english: '英语', programming: '编程', ai: 'AI与数据分析', tools: '工具', hardware: '硬件', other: '其他' };
  const activeSkills = Object.entries(skills).filter(([k, v]) => v).map(([k, v]) => ({ label: skillLabels[k] || k, value: v }));
  if (activeSkills.length) {
    html += `<div class="section"><div class="section-title"><span class="icon">🛠</span>专业技能</div>`;
    html += `<div class="card"><div class="skill-table">`;
    activeSkills.forEach(sk => {
      html += `<div class="skill-row"><span class="skill-label">${esc(sk.label)}</span><span class="skill-value">${esc(sk.value)}</span></div>`;
    });
    html += `</div></div></div>`;
  }

  return html;
}

function iconRow(icon, text) {
  return `<span>${icon} ${esc(text)}</span>`;
}
