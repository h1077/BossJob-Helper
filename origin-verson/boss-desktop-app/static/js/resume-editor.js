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

// ── AI 助手面板 ──
(function initAiPanel() {
  // 快捷卡片
  document.querySelectorAll('.ai-quick-card').forEach(card => {
    card.addEventListener('click', () => {
      const action = card.dataset.action;
      const sd = collectStructuredData();
      const resumeText = JSON.stringify(sd, null, 2);
      const panel = document.getElementById('ai-chat-result');
      panel.innerHTML = '<div class="loading">AI 处理中...</div>';

      const endpoints = {
        score: { url: '/api/ai/score-resume', body: { resume_text: resumeText } },
        polish: { url: '/api/ai/optimize-section', body: { section_type: 'projects', section_data: JSON.stringify(sd.projects || []), full_resume_context: resumeText } },
        summary: { url: '/api/ai/optimize-section', body: { section_type: 'summary', section_data: sd.name || '', full_resume_context: resumeText } },
        match: { url: null, handler: 'jdMatch' },
      };

      const ep = endpoints[action];
      if (ep.handler === 'jdMatch') {
        document.getElementById('ai-chat-input').value = '请帮我分析以下JD与我的简历匹配度：\n\n（在此粘贴JD内容）';
        document.getElementById('ai-chat-input').focus();
        panel.innerHTML = '<p style="font-size:12px;color:#888;">👆 请在上方输入框中粘贴目标岗位的 JD，然后点击发送</p>';
        return;
      }

      fetch(ep.url, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify(ep.body),
      }).then(r => r.json()).then(res => {
        if (!res.success) { panel.innerHTML = `<p style="color:#dc2626;">${escHtml(res.error||'失败')}</p>`; return; }
        if (action === 'score') {
          const d = res.data;
          panel.innerHTML = `<div style="font-size:28px;font-weight:700;color:var(--primary);">${d.score}分 <span style="font-size:14px;">${escHtml(d.level||'')}</span></div>
            ${(d.strengths||[]).map(s => `<p style="font-size:12px;">✅ ${escHtml(s)}</p>`).join('')}
            ${(d.weaknesses||[]).map(s => `<p style="font-size:12px;">⚠️ ${escHtml(s)}</p>`).join('')}
            ${(d.suggestions||[]).map(s => `<p style="font-size:12px;">💡 ${escHtml(s)}</p>`).join('')}`;
        } else {
          const changes = res.data?.changes || [];
          panel.innerHTML = `<p style="color:#16a34a;">✅ 润色完成</p>${changes.map(c => `<p style="font-size:12px;">• ${escHtml(c)}</p>`).join('')}`;
        }
      }).catch(e => { panel.innerHTML = `<p style="color:#dc2626;">网络错误</p>`; });
    });
  });

  // 聊天输入
  document.getElementById('btn-ai-chat-send')?.addEventListener('click', () => {
    const input = document.getElementById('ai-chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    const panel = document.getElementById('ai-chat-result');
    panel.innerHTML = '<div class="loading">AI 处理中...</div>';

    const resumeText = JSON.stringify(collectStructuredData(), null, 2);
    // 判断意图
    if (msg.includes('JD') || msg.includes('jd') || msg.includes('匹配') || msg.includes('岗位要求')) {
      fetch('/api/ai/jd-match', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ resume_text: resumeText, jd_text: msg, job_title: '' }),
      }).then(r => r.json()).then(res => {
        if (!res.success) { panel.innerHTML = `<p style="color:#dc2626;">${escHtml(res.error||'失败')}</p>`; return; }
        const d = res.data;
        panel.innerHTML = `<div style="font-size:24px;font-weight:700;color:var(--primary);">匹配度: ${d.score||0}分</div>
          ${(d.suggestions||[]).map(s => `<p style="font-size:12px;">• ${escHtml(s)}</p>`).join('')}`;
      }).catch(e => { panel.innerHTML = `<p style="color:#dc2626;">网络错误</p>`; });
    } else {
      // 通用润色
      fetch('/api/ai/optimize-section', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ section_type: 'general', section_data: msg, full_resume_context: resumeText }),
      }).then(r => r.json()).then(res => {
        if (!res.success) { panel.innerHTML = `<p style="color:#dc2626;">${escHtml(res.error||'失败')}</p>`; return; }
        panel.innerHTML = `<p style="color:#16a34a;">✅ 已处理</p><p style="font-size:12px;white-space:pre-wrap;">${escHtml(JSON.stringify(res.data,null,2))}</p>`;
      }).catch(e => { panel.innerHTML = `<p style="color:#dc2626;">网络错误</p>`; });
    }
    input.value = '';
  });
})();

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
  const aiPanel = document.getElementById('panel-ai');
  if (aiPanel) aiPanel.classList.toggle('hidden', mode !== 'ai');

  // 切换到 AI 模式时，同步预览
  if (mode === 'ai') {
    const mainFrame = document.getElementById('preview-frame');
    const aiFrame = document.getElementById('preview-frame-ai');
    if (mainFrame && aiFrame && mainFrame.getAttribute('srcdoc')) {
      aiFrame.setAttribute('srcdoc', mainFrame.getAttribute('srcdoc'));
    }
  }

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
  location.href = '/editor.html';
});

// ── 取消 ──
document.getElementById('btn-cancel-editor').addEventListener('click', () => {
  backToResumeList();
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
  // 更新顶部栏
  const topBar = document.getElementById('resume-top-bar');
  const topTitle = document.getElementById('topbar-resume-title');
  if (topBar) topBar.style.display = '';
  if (topTitle) topTitle.value = resume.title || '';
  // 全屏模式默认用结构化编辑
  if (document.body.classList.contains('editor-fullscreen')) {
    _editorMode = 'structured';
    document.querySelectorAll('#editor-tabs .editor-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === 'structured'));
    document.getElementById('panel-richtext').classList.add('hidden');
    document.getElementById('panel-structured').classList.remove('hidden');
  }
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
    custom_fields: [],
    skill_groups: [],
    custom_sections: [],
  };
}

// ── 简易 Markdown → HTML ──
function mdToHtml(md) {
  if (!md) return '';
  let h = escHtml(md);
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\n\n/g, '</p><p>');
  h = h.replace(/\n- (.+)/g, '<br>• $1');
  h = h.replace(/\n/g, '<br>');
  h = '<p>' + h + '</p>';
  h = h.replace(/<p><\/p>/g, '');
  return h;
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
    <!-- 模块 Tab 栏 -->
    <!-- 模块 Tab 栏 -->
    <div class="module-tabs" id="module-tabs"></div>

    <!-- 基本信息 -->
    <div class="sf-section" data-module="basics">
      <h3><span class="sf-section-title-text" data-sf-section="basics">基本信息</span> <button class="btn btn-ghost btn-sm sf-edit-title" onclick="editSectionTitle(&apos;basics&apos;,&apos;基本信息&apos;)" title="重命名">✏️</button></h3>
      <div class="sf-grid-2col">
        ${sfInput('姓名', 'name', sd.name, '张三')}
        ${sfInput('邮箱', 'email', sd.email, 'example@example.com', 'email')}
        ${sfInput('电话', 'phone', sd.phone, '13800138000')}
        ${renderOptionalFields(sd)}
      </div>
    </div>
    <div id="sf-optional-add" style="margin-top:6px;"></div>

    <!-- 自定义字段 -->
    <div id="sf-custom-fields" style="margin-top:8px;"></div>
    <button class="btn btn-sm" style="margin-top:4px;border-style:dashed;" onclick="addCustomField()">+ 添加自定义字段</button>

    <!-- 教育背景 -->
    <div class="sf-section" data-module="education">
      <h3><span class="sf-section-title-text" data-sf-section="education">教育背景</span> <button class="btn btn-ghost btn-sm sf-edit-title" onclick="editSectionTitle(&apos;education&apos;,&apos;教育背景&apos;)" title="重命名">✏️</button></h3>
      <div id="sf-education-list"></div>
      <button class="btn btn-sm sf-add-btn" onclick="sfAddEducation()">+ 添加教育经历</button>
    </div>

    <!-- 实习经历 -->
    <div class="sf-section" data-module="internships">
      <h3><span class="sf-section-title-text" data-sf-section="internships">实习经历</span> <button class="btn btn-ghost btn-sm sf-edit-title" onclick="editSectionTitle(&apos;internships&apos;,&apos;实习经历&apos;)" title="重命名">✏️</button></h3>
      <div id="sf-internship-list"></div>
      <button class="btn btn-sm sf-add-btn" onclick="sfAddInternship()">+ 添加实习经历</button>
    </div>

    <!-- 项目经历 -->
    <div class="sf-section" data-module="projects">
      <h3><span class="sf-section-title-text" data-sf-section="projects">项目经历</span> <button class="btn btn-ghost btn-sm sf-edit-title" onclick="editSectionTitle(&apos;projects&apos;,&apos;项目经历&apos;)" title="重命名">✏️</button></h3>
      <div id="sf-project-list"></div>
      <button class="btn btn-sm sf-add-btn" onclick="sfAddProject()">+ 添加项目经历</button>
    </div>

    <!-- 获奖情况 -->
    <div class="sf-section" data-module="awards">
      <h3><span class="sf-section-title-text" data-sf-section="awards">获奖情况</span> <button class="btn btn-ghost btn-sm sf-edit-title" onclick="editSectionTitle(&apos;awards&apos;,&apos;获奖情况&apos;)" title="重命名">✏️</button></h3>
      <div id="sf-award-list"></div>
      <button class="btn btn-sm sf-add-btn" onclick="sfAddAward()">+ 添加获奖</button>
    </div>

    <!-- 学生工作 -->
    <div class="sf-section" data-module="student_work">
      <h3><span class="sf-section-title-text" data-sf-section="student_work">学生工作</span> <button class="btn btn-ghost btn-sm sf-edit-title" onclick="editSectionTitle(&apos;student_work&apos;,&apos;学生工作&apos;)" title="重命名">✏️</button></h3>
      <div id="sf-studentwork-list"></div>
      <button class="btn btn-sm sf-add-btn" onclick="sfAddStudentWork()">+ 添加学生工作</button>
    </div>

    <!-- 专业技能 -->
    <div class="sf-section" data-module="skills">
      <h3><span class="sf-section-title-text" data-sf-section="skills">专业技能</span> <button class="btn btn-ghost btn-sm sf-edit-title" onclick="editSectionTitle(&apos;skills&apos;,&apos;专业技能&apos;)" title="重命名">✏️</button></h3>
      <div id="sf-skills-container"></div>
      <button class="btn btn-sm sf-add-btn" onclick="sfAddSkillGroup()" style="margin-top:8px;">+ 添加技能分组</button>
    <!-- 自定义模块 -->
    <div id="sf-custom-sections"></div>
    </div>
  `;

  // 回填动态列表

  // 渲染自定义模块
  renderCustomSections(sd.custom_sections || []);
  (sd.education || []).forEach((e, i) => sfRenderEducation(i, e));
  (sd.internships || []).forEach((e, i) => sfRenderInternship(i, e));
  (sd.projects || []).forEach((e, i) => sfRenderProject(i, e));
  (sd.awards || []).forEach((e, i) => sfRenderAward(i, e));
  (sd.student_work || []).forEach((e, i) => sfRenderStudentWork(i, e));

  // 回填技能分组（从旧格式迁移到新格式）
  sfRenderSkillGroups(sd);

  // 初始化 _hiddenModules
  if (sd._hiddenModules) {
    _hiddenModules = [...sd._hiddenModules];
  } else {
    _hiddenModules = [];
  }

  // ── 渲染 Tab 栏 ──
  renderModuleTabs(sd);
  renderVisibilityPanel();

  // 给 section 标题加 👁 显示/隐藏按钮
  document.querySelectorAll('.sf-section[data-module]').forEach(section => {
    const key = section.dataset.module;
    const h3 = section.querySelector('h3');
    if (!h3 || key === 'basics') return;
    const isHidden = _hiddenModules.includes(key);
    if (isHidden) section.style.opacity = '0.35';
    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost btn-sm';
    btn.style.cssText = 'margin-left:auto;font-size:12px;';
    btn.title = isHidden ? '在预览中显示' : '在预览中隐藏';
    btn.textContent = isHidden ? '🙈' : '👁';
    btn.onclick = (e) => { e.stopPropagation(); toggleModuleVisibility(key); };
    h3.appendChild(btn);
  });

  // 应用隐藏模块的透明度
  _hiddenModules.forEach(key => {
    const s = document.querySelector('.sf-section[data-module="' + key + '"]');
    if (s) s.style.opacity = '0.35';
  });

  // ── Tab 切换：默认显示 basics，其余隐藏 ──
  switchToModule('basics');

  // 渲染自定义字段
  renderCustomFields(sd.custom_fields || []);

  // 渲染可选字段添加按钮
  renderOptionalAddButtons();

  // ── 触发实时预览 ──
  updateLivePreview();
}

// ═══════════════════════════════════════════════════════════════
// 实时预览 (Live Preview)
// ═══════════════════════════════════════════════════════════════

let _previewTimer = null;

function updateLivePreview() {
  clearTimeout(_previewTimer);
  _previewTimer = setTimeout(() => {
    const sd = collectStructuredData();
    const title = document.getElementById('resume-title-input')?.value || '简历预览';
    const tplCfg = getTemplateConfig();
    const html = buildResumeHTML(sd, '', title, tplCfg);
    const frame = document.getElementById('preview-frame');
    if (frame) {
      frame.style.transform = `scale(${_previewZoom})`;
      frame.style.transformOrigin = 'top center';
      frame.srcdoc = html;
    }
  }, 400);
}

// ── 自动保存 ──
let _autoSaveTimer = null;
let _autoSaveStatus = '';

function autoSave() {
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(async () => {
    if (!state.editingResumeId) return;
    const sd = collectStructuredData();
    sd._hiddenModules = [..._hiddenModules];
    const title = document.getElementById('resume-title-input')?.value || '';

    try {
      const res = await fetch('/api/resumes/' + state.editingResumeId + '/structured', {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ structuredData: sd }),
      }).then(r => r.json());

      if (res.success) {
        document.getElementById('resume-title-input')?.value &&
          fetch('/api/resumes/' + state.editingResumeId, {
            method: 'PUT', headers: authHeaders(),
            body: JSON.stringify({ title: title }),
          });
        showAutoSaveStatus('已自动保存');
      }
    } catch (e) { /* 静默失败 */ }
  }, 2000);
}

function showAutoSaveStatus(msg) {
  let el = document.getElementById('autosave-status');
  if (!el) {
    el = document.createElement('span');
    el.id = 'autosave-status';
    el.style.cssText = 'font-size:11px;color:#16a34a;margin-left:12px;transition:opacity .3s;';
    const btn = document.getElementById('btn-save-resume');
    if (btn) btn.parentElement.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0.3'; }, 1500);
}

// 结构化表单中的任何输入变化 → 自动更新预览 + 自动保存
document.getElementById('structured-form')?.addEventListener('input', () => {
  updateLivePreview();
  autoSave();
});

// 强制刷新
document.getElementById('btn-refresh-preview')?.addEventListener('click', () => updateLivePreview());

// 可见性切换（预览控制栏）
document.getElementById('btn-toggle-visibility')?.addEventListener('click', () => {
  const panel = document.getElementById('visibility-panel');
  if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
});

function renderVisibilityPanel() {
  const panel = document.getElementById('visibility-panel');
  if (!panel) return;
  const modules = ['education', 'internships', 'projects', 'awards', 'student_work', 'skills'];
  const labels = { education: '教育背景', internships: '实习经历', projects: '项目经历', awards: '获奖情况', student_work: '学生工作', skills: '专业技能' };
  panel.innerHTML = '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">预览中显示的模块：</div>' +
    modules.map(m => {
      const hidden = _hiddenModules.includes(m);
      return `<label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;padding:2px 0;">
        <input type="checkbox" ${hidden?'':'checked'} onchange="toggleModuleVisibility('${m}')"> ${labels[m]||m}
      </label>`;
    }).join('');
}

// ── 模块显示/隐藏 ──
let _hiddenModules = [];

function toggleModuleVisibility(key) {
  if (_hiddenModules.includes(key)) {
    _hiddenModules = _hiddenModules.filter(k => k !== key);
  } else {
    _hiddenModules.push(key);
  }
  _structuredData = collectStructuredData();
  _structuredData._hiddenModules = [..._hiddenModules];
  updateLivePreview();
  renderModuleTabs(_structuredData);
  // 更新 section 透明度
  const section = document.querySelector('.sf-section[data-module="' + key + '"]');
  if (section) section.style.opacity = _hiddenModules.includes(key) ? '0.35' : '';
}

// ── 渲染 Tab 栏 ──
const BUILTIN_MODULES = [
  { key: 'basics', label: '基本信息', removable: false, hideable: false },
  { key: 'education', label: '教育背景', removable: false, hideable: true },
  { key: 'internships', label: '实习经历', removable: false, hideable: true },
  { key: 'projects', label: '项目经历', removable: false, hideable: true },
  { key: 'awards', label: '获奖情况', removable: false, hideable: true },
  { key: 'student_work', label: '学生工作', removable: false, hideable: true },
  { key: 'skills', label: '专业技能', removable: false, hideable: true },
];

function renderModuleTabs(sd) {
  const container = document.getElementById('module-tabs');
  if (!container) return;

  const customSections = sd?.custom_sections || [];
  const allModules = [...BUILTIN_MODULES];
  customSections.forEach(cs => {
    allModules.push({ key: cs.id, label: cs.title, removable: true, hideable: true, custom: true });
  });

  container.innerHTML = allModules.map(m => {
    const isHidden = _hiddenModules.includes(m.key);
    const title = _sectionTitles[m.key] || m.label;
    const eyeIcon = '';
    const delBtn = m.removable ? `<button class="tab-del" title="删除此模块" data-action="delete" data-key="${m.key}">✕</button>` : '';
    return `<button class="module-tab" data-mkey="${m.key}">
      <span class="tab-label">${escHtml(title)}</span>${eyeIcon}${delBtn}
    </button>`;
  }).join('') +
    `<button class="module-tab-add" id="btn-add-module">+ 添加模块</button>` +
    `<span id="add-module-wrap" style="display:none;">
      <input id="add-module-input" class="skill-tag-input" placeholder="输入模块名" style="width:100px;"
        onkeydown="if(event.key==='Enter')confirmAddModule(); if(event.key==='Escape')cancelAddModule();"
        onblur="setTimeout(cancelAddModule,150)">
      <button class="btn btn-sm" style="padding:2px 8px;" onclick="confirmAddModule()">✓</button>
      <button class="btn btn-ghost btn-sm" style="padding:2px 6px;" onclick="cancelAddModule()">✕</button>
    </span>`;

  // 事件委托
  container.querySelectorAll('.module-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const action = e.target.dataset?.action;
      const key = e.target.dataset?.key;
      if (action === 'toggle') { e.stopPropagation(); toggleModuleVisibility(key); return; }
      if (action === 'delete') { e.stopPropagation(); deleteCustomModule(key); return; }
      switchToModule(tab.dataset.mkey);
    });
  });

  // 添加模块按钮
  const addBtn = container.querySelector('#btn-add-module');
  if (addBtn) {
    addBtn.addEventListener('click', () => addCustomModule());
  }

  // 恢复 active 状态
  const activeKey = container.querySelector('.module-tab.active')?.dataset?.mkey || 'basics';
  container.querySelectorAll('.module-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mkey === activeKey);
  });

  // 自定义标题同步
  container.querySelectorAll('.module-tab .tab-label').forEach(label => {
    const key = label.closest('.module-tab')?.dataset?.mkey;
    if (_sectionTitles[key]) label.textContent = _sectionTitles[key];
  });
}

function addCustomModule() {
  const btn = document.getElementById('btn-add-module');
  if (!btn) return;

  // 显示内联输入框
  const wrap = document.getElementById('add-module-wrap');
  const input = document.getElementById('add-module-input');
  btn.style.display = 'none';
  if (wrap) wrap.style.display = '';
  if (input) { input.value = ''; input.focus(); }
}

function confirmAddModule() {
  const input = document.getElementById('add-module-input');
  const title = input?.value?.trim();
  const btn = document.getElementById('btn-add-module');
  const wrap = document.getElementById('add-module-wrap');
  btn.style.display = '';
  if (wrap) wrap.style.display = 'none';
  if (!title) return;

  _structuredData = collectStructuredData();
  if (!_structuredData.custom_sections) _structuredData.custom_sections = [];
  _structuredData.custom_sections.push({ id: 'cs_' + Date.now(), title: title, content: '' });
  renderStructuredForm(_structuredData);
}

function cancelAddModule() {
  const btn = document.getElementById('btn-add-module');
  const wrap = document.getElementById('add-module-wrap');
  if (btn) btn.style.display = '';
  if (wrap) wrap.style.display = 'none';
}

function deleteCustomModule(id) {
  if (!confirm('确定删除此模块？')) return;
  _structuredData = collectStructuredData();
  _structuredData.custom_sections = (_structuredData.custom_sections || []).filter(cs => cs.id !== id);
  renderStructuredForm(_structuredData);
}

function renderCustomSections(customSections) {
  const container = document.getElementById('sf-custom-sections');
  if (!container) return;
  if (!customSections || !customSections.length) { container.innerHTML = ''; return; }
  container.innerHTML = customSections.map(cs => `
    <div class="sf-section" data-module="${escAttr(cs.id)}" style="display:none;">
      <h3><span>${escHtml(cs.title)}</span></h3>
      <div class="sf-field">
        <label>内容</label>
        <textarea data-sf-key="cs_${escAttr(cs.id)}" rows="6" placeholder="输入该模块的内容...">${escHtml(cs.content || '')}</textarea>
      </div>
    </div>
  `).join('');
}

// ── 收藏自定义模块数据 ──
function sfCollectCustomSections() {
  const result = [];
  const container = document.getElementById('sf-custom-sections');
  if (!container) return result;
  container.querySelectorAll('[data-sf-key]').forEach(el => {
    const id = el.dataset.sfKey.replace('cs_', '');
    result.push({ id, title: '', content: el.value || '' });
  });
  // 恢复 title
  if (_structuredData && _structuredData.custom_sections) {
    result.forEach(cs => {
      const orig = _structuredData.custom_sections.find(o => o.id === cs.id);
      if (orig) cs.title = orig.title;
    });
  }
  return result;
}

// ── 模块 Tab 切换 ──
function switchToModule(key) {
  // 隐藏所有 section
  document.querySelectorAll('#structured-form .sf-section[data-module]').forEach(s => {
    s.style.display = 'none';
  });
  // 显示目标 section
  const target = document.querySelector('#structured-form .sf-section[data-module="' + key + '"]');
  if (target) target.style.display = '';

  // 更新 Tab 按钮状态
  document.querySelectorAll('#module-tabs .module-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mkey === key);
  });
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

// \u2500\u2500 \u81ea\u5b9a\u4e49\u5b57\u6bb5 \u2500\u2500
function addCustomField() {
  const label = prompt('\u8bf7\u8f93\u5165\u81ea\u5b9a\u4e49\u5b57\u6bb5\u540d\uff08\u5982\uff1a\u5fae\u4fe1\u3001\u671f\u671b\u57ce\u5e02\u3001\u6bd5\u4e1a\u65f6\u95f4\uff09\uff1a');
  if (!label || !label.trim()) return;
  _structuredData = collectStructuredData();
  if (!_structuredData.custom_fields) _structuredData.custom_fields = [];
  const key = 'custom_' + Date.now();
  _structuredData.custom_fields.push({ key: key, label: label.trim(), value: '' });
  renderStructuredForm(_structuredData);
}

function removeCustomField(key) {
  _structuredData = collectStructuredData();
  _structuredData.custom_fields = (_structuredData.custom_fields || []).filter(f => f.key !== key);
  renderStructuredForm(_structuredData);
}

function renderCustomFields(customFields) {
  const container = document.getElementById('sf-custom-fields');
  if (!container) return;
  if (!customFields || !customFields.length) { container.innerHTML = ''; return; }
  container.innerHTML = customFields.map(f => {
    return '<div class="sf-optional-row" style="margin-bottom:4px;">' +
      sfInput(f.label, f.key, f.value || '', '\u8f93\u5165' + f.label) +
      '<button class="btn btn-ghost btn-sm sf-hide-field" onclick="removeCustomField(\'' + f.key + '\')" title="\u5220\u9664">\u2715</button>' +
      '</div>';
  }).join('');
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
  // 技能（新格式：skill_groups）
  sd.skill_groups = [];
  form.querySelectorAll('.skill-group').forEach(sg => {
    const g = { key: '', label: '', tags: [], desc: '' };
    sg.querySelectorAll('[data-sf-key]').forEach(el => {
      if (el.dataset.sfKey === 'sg_label') g.label = el.value || '';
      if (el.dataset.sfKey === 'sg_desc') g.desc = el.value || '';
    });
    const tagSpans = sg.querySelectorAll('.skill-tag');
    tagSpans.forEach(span => {
      const t = span.childNodes[0]?.textContent?.trim();
      if (t && t !== '×') g.tags.push(t);
    });
    if (g.label || g.tags.length) sd.skill_groups.push(g);
  });
  // 兼容旧格式
  if (!sd.skill_groups.length && sd.skills) {
    Object.entries(sd.skills).filter(([k,v]) => v).forEach(([k,v]) => {
      sd.skill_groups.push({ key: k, label: SKILL_LABELS[k]||k, tags: v.split(/[,，、]/).map(s=>s.trim()).filter(Boolean), desc: '' });
    });
  }
  // 动态列表
  sd.education = sfCollectList('sf-edu-entry');
  sd.internships = sfCollectList('sf-intern-entry');
  sd.projects = sfCollectList('sf-proj-entry');
  sd.awards = sfCollectList('sf-award-entry');
  sd.student_work = sfCollectList('sf-swork-entry');

  // 收集自定义字段
  const customContainer = document.getElementById('sf-custom-fields');
  sd._hiddenModules = [..._hiddenModules];
  sd.custom_sections = sfCollectCustomSections();
  sd.custom_fields = [];
  if (customContainer) {
    customContainer.querySelectorAll('[data-sf-key]').forEach(el => {
      sd.custom_fields.push({ key: el.dataset.sfKey, label: '', value: el.value || '' });
    });
  }
  // 从 _structuredData 恢复 label
  if (_structuredData && _structuredData.custom_fields) {
    sd.custom_fields.forEach(f => {
      const orig = _structuredData.custom_fields.find(o => o.key === f.key);
      if (orig) f.label = orig.label;
    });
  }

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
    <div class="sf-field"><label>标签</label><input type="text" data-sf-key="tags" value="${escAttr(typeof data.tags === 'string' ? data.tags : (data.tags||[]).join(', '))}" placeholder="PyTorch, 计算机视觉, ONNX（逗号分隔）"></div>
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

// ═══════════════════════════════════════════════════════════════
// 技能标签编辑器
// ═══════════════════════════════════════════════════════════════

const SKILL_LABELS = { english: '英语', programming: '编程语言', ai: 'AI与数据分析', tools: '开发工具', hardware: '硬件', other: '其他' };

function sfRenderSkillGroups(sd) {
  const container = document.getElementById('sf-skills-container');
  if (!container) return;

  // 将旧格式 skills { english: "str", ... } 转为 skill_groups [{key,label,tags[],desc}]
  let groups = sd.skill_groups || [];
  if (!groups.length && sd.skills && typeof sd.skills === 'object') {
    groups = Object.entries(sd.skills)
      .filter(([k, v]) => v && v.trim())
      .map(([k, v]) => {
        const parts = v.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
        return { key: 'skill_' + k, label: SKILL_LABELS[k] || k, tags: parts.length > 1 ? parts : [v], desc: '' };
      });
    if (!groups.length) {
      groups = [{ key: 'skill_dev', label: '开发技能', tags: [], desc: '' }];
    }
  }
  if (!groups.length) {
    groups = [{ key: 'skill_dev', label: '开发技能', tags: [], desc: '' }];
  }

  container.innerHTML = groups.map((g, i) => {
    const tags = g.tags || [];
    return `<div class="skill-group" data-sg-idx="${i}">
      <div class="skill-group-header">
        <label>分组名</label>
        <input type="text" data-sf-key="sg_label" value="${escAttr(g.label || '')}" placeholder="如：后端开发">
        <button class="btn btn-ghost btn-sm" onclick="sfRemoveSkillGroup(this)" title="删除分组">✕</button>
      </div>
      <div class="skill-tags" data-sg-tags>
        ${tags.map(t => `<span class="skill-tag">${escHtml(t)}<button onclick="sfRemoveSkillTag(this,'${escAttr(t)}')">×</button></span>`).join('')}
        <input class="skill-tag-input" placeholder="+ 标签" onkeydown="sfAddSkillTag(event, this)">
      </div>
      <div class="sf-field">
        <textarea data-sf-key="sg_desc" rows="2" placeholder="描述（可选）：熟悉 RESTful API 设计...">${escAttr(g.desc || '')}</textarea>
      </div>
    </div>`;
  }).join('');
}

function sfAddSkillGroup() {
  _structuredData = collectStructuredData();
  const gs = _structuredData.skill_groups || [{ key: 'sg_' + Date.now(), label: '', tags: [], desc: '' }];
  gs.push({ key: 'sg_' + Date.now(), label: '新技能', tags: [], desc: '' });
  _structuredData.skill_groups = gs;
  renderStructuredForm(_structuredData);
}

function sfRemoveSkillGroup(btn) {
  const idx = parseInt(btn.closest('.skill-group').dataset.sgIdx);
  _structuredData = collectStructuredData();
  _structuredData.skill_groups = (_structuredData.skill_groups || []).filter((g, i) => i !== idx);
  renderStructuredForm(_structuredData);
}

function sfAddSkillTag(event, input) {
  if (event.key !== 'Enter' && event.key !== ',') return;
  event.preventDefault();
  const val = input.value.replace(/[,，]$/, '').trim();
  if (!val) return;

  const idx = parseInt(input.closest('.skill-group').dataset.sgIdx);
  _structuredData = collectStructuredData();
  const gs = _structuredData.skill_groups || [];
  if (gs[idx] && !gs[idx].tags.includes(val)) {
    gs[idx].tags.push(val);
    _structuredData.skill_groups = gs;
    renderStructuredForm(_structuredData);
  }
}

function sfRemoveSkillTag(btn, tag) {
  const idx = parseInt(btn.closest('.skill-group').dataset.sgIdx);
  _structuredData = collectStructuredData();
  const gs = _structuredData.skill_groups || [];
  if (gs[idx]) {
    gs[idx].tags = gs[idx].tags.filter(t => t !== tag);
    _structuredData.skill_groups = gs;
    renderStructuredForm(_structuredData);
  }
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

  ${hasSD ? buildSDSections(education, internships, projects, awards, studentWork, skills, sd, tplCfg) : `<div class="plain-text">${esc(plainText)}</div>`}

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

function buildSDSections(education, internships, projects, awards, studentWork, skills, sd, tplCfg) {
  let html = '';

  // 自定义模块
  const customSections = sd?.custom_sections || [];
  customSections.forEach(cs => {
    if ((_hiddenModules || []).includes(cs.id)) return;
    html += `<div class="section"><div class="section-title">📌 ${esc(cs.title)}</div>`;
    html += `<div class="card"><div class="markdown-body">${mdToHtml(cs.content || '')}</div></div></div>`;
  });

  // 教育背景
  if (education.length && !(_hiddenModules || []).includes('education')) {
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
  if (internships.length && !(_hiddenModules || []).includes('internships')) {
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
  if (projects.length && !(_hiddenModules || []).includes('projects')) {
    html += `<div class="section"><div class="section-title"><span class="icon">🚀</span>项目经历</div>`;
    projects.forEach(proj => {
      const tags = typeof proj.tags === 'string' ? proj.tags : (proj.tags || []).join(' · ');
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
  if (awards.length && !(_hiddenModules || []).includes('awards')) {
    html += `<div class="section"><div class="section-title"><span class="icon">🏆</span>获奖情况</div>`;
    html += `<div class="card"><div class="award-list">`;
    awards.forEach(a => {
      html += `<span class="award-item"><span class="award-cat">${esc(a.category || '')}</span> ${esc(a.name || '')}</span>`;
    });
    html += `</div></div></div>`;
  }

  // 学生工作
  if (studentWork.length && !(_hiddenModules || []).includes('student_work')) {
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

  // 专业技能（支持新旧两种格式）
  const skillGroups = sd.skill_groups || [];
  const activeSkills = skillGroups.length ? skillGroups
    : Object.entries(sd.skills || {}).filter(([k, v]) => v).map(([k, v]) => ({ label: SKILL_LABELS[k] || k, tags: v.split(/[,，、]/).map(s => s.trim()).filter(Boolean), desc: '' }));

  if (activeSkills.length && !(_hiddenModules || []).includes('skills')) {
    html += `<div class="section"><div class="section-title"><span class="icon">🛠</span>${esc(sd._sectionTitles?.skills || '专业技能')}</div>`;
    html += `<div class="card">`;
    activeSkills.forEach(sg => {
      html += `<div style="margin-bottom:6px;">`;
      if (sg.label) html += `<div style="font-weight:600;font-size:12px;color:#111827;margin-bottom:3px;">${esc(sg.label)}</div>`;
      const tags = sg.tags || [];
      if (sg.value && !tags.length) {
        html += `<span style="font-size:12px;color:#374151;">${esc(sg.value)}</span>`;
      } else if (tags.length) {
        tags.forEach(t => {
          html += `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;background:${esc(tplCfg.themeColor)};color:#fff;margin:2px 3px 2px 0;">${esc(t)}</span>`;
        });
      }
      if (sg.desc) html += `<div style="font-size:11px;color:#6b7280;margin-top:3px;">${mdToHtml(sg.desc)}</div>`;
      html += `</div>`;
    });
    html += `</div></div>`;
  }

  return html;
}

function iconRow(icon, text) {
  return `<span>${icon} ${esc(text)}</span>`;
}

// ═══════════════════════════════════════════════════════════════
// Phase 2: AI 生成简历 / 评分 / JD 匹配 UI 逻辑
// ═══════════════════════════════════════════════════════════════

// ── 工具函数 ──
function getCurrentResumeText() {
  if (_editorMode === 'structured') {
    _structuredData = collectStructuredData();
    return JSON.stringify(_structuredData, null, 2);
  }
  return document.getElementById('editor-content').innerText.trim();
}

// ── AI 生成简历 ──
(function initGenerateModal() {
  const overlay = document.getElementById('modal-generate-overlay');
  if (!overlay) return;

  document.getElementById('btn-ai-generate').addEventListener('click', () => {
    document.getElementById('generate-result').classList.add('hidden');
    overlay.classList.remove('hidden');
  });
  document.getElementById('btn-close-generate-modal').addEventListener('click', () => overlay.classList.add('hidden'));
  document.getElementById('btn-cancel-generate-modal').addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });

  document.getElementById('btn-confirm-generate').addEventListener('click', async () => {
    const targetPosition = document.getElementById('gen-target-position').value.trim();
    const personalInfo = document.getElementById('gen-personal-info').value.trim();
    if (!personalInfo) { alert('请填写个人背景描述'); return; }

    const panel = document.getElementById('generate-result');
    panel.classList.remove('hidden');
    panel.innerHTML = '<div class="loading">🤖 AI 正在生成简历...</div>';
    const btn = document.getElementById('btn-confirm-generate');
    btn.disabled = true;
    btn.textContent = '生成中...';

    try {
      const res = await fetch('/api/ai/generate-resume', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ target_position: targetPosition, personal_info: personalInfo }),
      }).then(r => r.json());

      if (!res.success) {
        panel.innerHTML = `<p style="color:#dc2626;">生成失败: ${escHtml(res.error || '未知错误')}</p>`;
        return;
      }

      _structuredData = res.data.structured_data;
      document.getElementById('resume-list').classList.add('hidden');
      document.getElementById('resume-editor').classList.remove('hidden');
      document.getElementById('resume-title-input').value = targetPosition || 'AI 生成简历';
      document.getElementById('analysis-result').classList.add('hidden');
      document.getElementById('optimize-result').classList.add('hidden');
      state.editingResumeId = null;
      switchEditorMode('structured');
      renderStructuredForm(_structuredData);
      overlay.classList.add('hidden');
    } catch (e) {
      panel.innerHTML = `<p style="color:#dc2626;">网络错误: ${escHtml(e.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '🚀 生成简历';
    }
  });
})();

// ── AI 评分 ──
(function initScoreModal() {
  const overlay = document.getElementById('modal-score-overlay');
  if (!overlay) return;

  document.getElementById('btn-ai-score').addEventListener('click', () => {
    document.getElementById('score-result').innerHTML = '';
    overlay.classList.remove('hidden');
  });
  document.getElementById('btn-close-score-modal').addEventListener('click', () => overlay.classList.add('hidden'));
  document.getElementById('btn-cancel-score-modal').addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });

  document.getElementById('btn-confirm-score').addEventListener('click', async () => {
    const resumeText = getCurrentResumeText();
    if (!resumeText || resumeText.length < 20) { alert('请先输入简历内容'); return; }

    const panel = document.getElementById('score-result');
    panel.innerHTML = '<div class="loading">📊 AI 评分中...</div>';
    const btn = document.getElementById('btn-confirm-score');
    btn.disabled = true;
    btn.textContent = '评分中...';

    try {
      const res = await fetch('/api/ai/score-resume', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          resume_text: resumeText,
          jd_text: document.getElementById('score-jd-text').value.trim(),
          target_position: document.getElementById('score-target-position').value.trim(),
        }),
      }).then(r => r.json());

      if (!res.success) { panel.innerHTML = `<p style="color:#dc2626;">评分失败: ${escHtml(res.error || '')}</p>`; return; }

      const d = res.data;
      const levelColors = { '优秀': '#16a34a', '良好': '#2563eb', '合格': '#e65100', '待优化': '#dc2626', '需重点完善': '#dc2626' };
      const levelColor = levelColors[d.level] || '#2563eb';

      let detailsHtml = '';
      if (d.details && d.details.length) {
        detailsHtml = d.details.map(dim => {
          const pct = Math.round((dim.score / dim.max_score) * 100);
          const barColor = pct >= 80 ? '#16a34a' : pct >= 60 ? '#2563eb' : pct >= 40 ? '#e65100' : '#dc2626';
          return `<div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;">
              <span>${escHtml(dim.dimension)} <span style="color:#888;">(${Math.round((dim.weight||0)*100)}%)</span></span>
              <span style="font-weight:600;">${dim.score}/${dim.max_score}</span>
            </div>
            <div style="background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden;">
              <div style="width:${pct}%;background:${barColor};height:100%;border-radius:4px;"></div>
            </div>
            <p style="font-size:11px;color:#666;margin:2px 0;">${escHtml(dim.comment||'')}</p>
          </div>`;
        }).join('');
      }

      panel.innerHTML = `
        <div style="text-align:center;margin:16px 0;">
          <div style="font-size:36px;font-weight:700;color:${levelColor};">${d.score||0}<span style="font-size:16px;">分</span></div>
          <div style="font-size:14px;color:${levelColor};font-weight:600;">${escHtml(d.level||'')}</div>
          ${d.summary ? `<p style="font-size:12px;color:#666;margin-top:4px;">${escHtml(d.summary)}</p>` : ''}
        </div>
        ${detailsHtml}
        ${d.strengths && d.strengths.length ? `<p style="margin-top:12px;"><strong>✅ 优势:</strong> ${d.strengths.map(escHtml).join('、')}</p>` : ''}
        ${d.weaknesses && d.weaknesses.length ? `<p><strong>⚠️ 短板:</strong> ${d.weaknesses.map(escHtml).join('、')}</p>` : ''}
        ${d.missing_keywords && d.missing_keywords.length ? `<p><strong>🔑 缺失关键词:</strong> ${d.missing_keywords.map(escHtml).join('、')}</p>` : ''}
        ${d.suggestions && d.suggestions.length ? `<p><strong>💡 建议:</strong> ${d.suggestions.map(escHtml).join('；')}</p>` : ''}
      `;
    } catch (e) {
      panel.innerHTML = `<p style="color:#dc2626;">网络错误: ${escHtml(e.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '📊 开始评分';
    }
  });
})();

// ── JD 匹配 ──
(function initJdMatchModal() {
  const overlay = document.getElementById('modal-jdmatch-overlay');
  if (!overlay) return;

  document.getElementById('btn-ai-match').addEventListener('click', () => {
    document.getElementById('jdmatch-result').innerHTML = '';
    overlay.classList.remove('hidden');
  });
  document.getElementById('btn-close-jdmatch-modal').addEventListener('click', () => overlay.classList.add('hidden'));
  document.getElementById('btn-cancel-jdmatch-modal').addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });

  document.getElementById('btn-confirm-jdmatch').addEventListener('click', async () => {
    const jdText = document.getElementById('jdmatch-jd-text').value.trim();
    if (!jdText || jdText.length < 30) { alert('请粘贴岗位 JD（至少30个字符）'); return; }

    const resumeText = getCurrentResumeText();
    if (!resumeText || resumeText.length < 20) { alert('请先输入简历内容'); return; }

    const panel = document.getElementById('jdmatch-result');
    panel.innerHTML = '<div class="loading">🎯 JD 匹配分析中...</div>';
    const btn = document.getElementById('btn-confirm-jdmatch');
    btn.disabled = true;
    btn.textContent = '分析中...';

    try {
      const res = await fetch('/api/ai/jd-match', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          resume_text: resumeText,
          jd_text: jdText,
          job_title: document.getElementById('jdmatch-job-title').value.trim(),
          company: document.getElementById('jdmatch-company').value.trim(),
        }),
      }).then(r => r.json());

      if (!res.success) { panel.innerHTML = `<p style="color:#dc2626;">匹配失败: ${escHtml(res.error || '')}</p>`; return; }

      const d = res.data;
      const matchColor = (d.score || 0) >= 80 ? '#16a34a' : (d.score || 0) >= 60 ? '#2563eb' : '#dc2626';

      let kwHtml = '';
      if (d.job_keywords) {
        const jk = d.job_keywords;
        kwHtml = `<div style="background:#f9fafb;padding:12px;border-radius:6px;margin-bottom:12px;">
          <strong>📋 岗位关键词</strong>
          ${jk.target_position ? `<p style="font-size:12px;margin:4px 0;"><strong>目标岗位:</strong> ${escHtml(jk.target_position)}</p>` : ''}
          ${jk.core_skills && jk.core_skills.length ? `<p style="font-size:12px;margin:4px 0;"><strong>核心技能:</strong> ${jk.core_skills.map(escHtml).join('、')}</p>` : ''}
          ${jk.core_responsibilities && jk.core_responsibilities.length ? `<p style="font-size:12px;margin:4px 0;"><strong>核心职责:</strong> ${jk.core_responsibilities.map(escHtml).join('、')}</p>` : ''}
          ${jk.hard_requirements && jk.hard_requirements.length ? `<p style="font-size:12px;margin:4px 0;"><strong>硬性条件:</strong> ${jk.hard_requirements.map(escHtml).join('、')}</p>` : ''}
        </div>`;
      }

      let analysisHtml = '';
      if (d.match_analysis) {
        const ma = d.match_analysis;
        analysisHtml = `<div style="margin-bottom:12px;">
          ${ma.matched && ma.matched.length ? `<p style="font-size:12px;">✅ <strong>已匹配:</strong> ${ma.matched.map(escHtml).join('、')}</p>` : ''}
          ${ma.partial_match && ma.partial_match.length ? `<p style="font-size:12px;">⚠️ <strong>部分匹配:</strong> ${ma.partial_match.map(escHtml).join('、')}</p>` : ''}
          ${ma.missing_evidence && ma.missing_evidence.length ? `<p style="font-size:12px;">❌ <strong>缺失证据:</strong> ${ma.missing_evidence.map(escHtml).join('、')}</p>` : ''}
          ${ma.potential_risks && ma.potential_risks.length ? `<p style="font-size:12px;">🔴 <strong>潜在风险:</strong> ${ma.potential_risks.map(escHtml).join('、')}</p>` : ''}
        </div>`;
      }

      panel.innerHTML = `
        <div style="text-align:center;margin:8px 0;">
          <span style="font-size:28px;font-weight:700;color:${matchColor};">${d.score||0}分</span>
          <span style="font-size:12px;color:#888;"> 匹配度</span>
        </div>
        ${kwHtml}
        ${analysisHtml}
        ${d.suggestions && d.suggestions.length ? `<div style="margin-bottom:12px;"><strong>💡 建议:</strong><ul style="margin:4px 0;padding-left:20px;font-size:12px;">${d.suggestions.map(s => `<li>${escHtml(s)}</li>`).join('')}</ul></div>` : ''}
        ${d.optimized_resume_data ? `<button class="btn btn-primary btn-sm" onclick="adoptJdOptimized()" style="margin-top:8px;">采纳优化版简历</button>` : ''}
      `;

      // 缓存优化结果供采纳按钮使用
      panel._optimizedData = d.optimized_resume_data;
    } catch (e) {
      panel.innerHTML = `<p style="color:#dc2626;">网络错误: ${escHtml(e.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '🎯 分析匹配';
    }
  });
})();

// ── 采纳 JD 优化结果 ──
function adoptJdOptimized() {
  const panel = document.getElementById('jdmatch-result');
  if (panel && panel._optimizedData) {
    _structuredData = panel._optimizedData;
    document.getElementById('modal-jdmatch-overlay').classList.add('hidden');
    switchEditorMode('structured');
    renderStructuredForm(_structuredData);
  }
}

// ── LaTeX PDF 导出 ──
(function initLatexExport() {
  const btn = document.getElementById('btn-ai-export-latex');
  if (!btn) return;

  // 启动时检测 LaTeX 状态
  (async function checkLatex() {
    try {
      const res = await fetch('/api/ai/latex-status', { headers: authHeaders() }).then(r => r.json());
      if (res.success && res.data && res.data.available) {
        btn.title = '📐 LaTeX 专业排版';
        btn.style.opacity = '1';
      } else {
        btn.title = '未安装 LaTeX。点击查看安装说明。';
        btn.style.opacity = '0.5';
        btn._latexMsg = (res.data && res.data.message) || '未安装 LaTeX';
      }
    } catch (e) {}
  })();

  btn.addEventListener('click', async () => {
    if (btn.style.opacity === '0.5') {
      alert('📐 LaTeX 未安装\n\n' + (btn._latexMsg || '请安装 TeX Live 或 MiKTeX。') +
        '\n\nTeX Live: https://tug.org/texlive/\nMiKTeX: https://miktex.org/\n\n安装后刷新页面即可使用。\n\n安装大小: 约 2-4GB');
      return;
    }

    if (!state.editingResumeId) { alert('请先保存简历后再导出'); return; }

    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = '编译中...';

    try {
      const res = await fetch('/api/ai/export-pdf-latex', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ resume_id: state.editingResumeId }),
      }).then(r => r.json());

      if (!res.success) { alert(res.error); return; }

      const byteChars = atob(res.data.pdf_base64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = res.data.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('导出失败: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });
})();

// ── HTML PDF 导出 ──
(function initPdfExport() {
  const btn = document.getElementById('btn-ai-export-pdf');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!state.editingResumeId) { alert('请先保存简历后再导出'); return; }

    btn.disabled = true;
    btn.textContent = '导出中...';

    try {
      const res = await fetch('/api/ai/export-pdf', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ resume_id: state.editingResumeId, template_config: getTemplateConfig() }),
      }).then(r => r.json());

      if (!res.success) { alert(res.error); return; }

      const byteChars = atob(res.data.pdf_base64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = res.data.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('导出失败: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '🖨️ 导出 PDF';
    }
  });
})();

// ── 分隔线拖拽 ──
(function initSplitDivider() {
  const divider = document.getElementById('split-divider');
  const left = () => document.querySelector('.editor-split-left');
  const right = () => document.querySelector('.editor-split-right');
  if (!divider) return;

  let dragging = false;
  divider.addEventListener('mousedown', () => { dragging = true; divider.style.background = 'var(--primary)'; });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const split = document.querySelector('.editor-split');
    if (!split) return;
    const rect = split.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    if (pct > 20 && pct < 80) {
      const l = left(); const r = right();
      if (l) l.style.flex = '0 0 ' + pct + '%';
      if (r) r.style.width = (100 - pct) + '%';
    }
  });
  document.addEventListener('mouseup', () => { dragging = false; divider.style.background = ''; });
})();

// ── 顶栏标题同步 ──
(function initTopbarSync() {
  const titleInput = document.getElementById('resume-title-input');
  const topbarTitle = document.getElementById('topbar-resume-title');
  if (titleInput && topbarTitle) {
    titleInput.addEventListener('input', () => { topbarTitle.value = titleInput.value; });
    topbarTitle.addEventListener('input', () => { titleInput.value = topbarTitle.value; });
  }
})();

// ── 预览缩放按钮 ──
let _previewZoom = 0.65;
(function initPreviewZoom() {
  const frame = document.getElementById('preview-frame');
  const label = document.getElementById('preview-zoom-label');
  const applyZoom = () => {
    if (frame) { frame.style.transform = `scale(${_previewZoom})`; frame.style.transformOrigin = 'top center'; }
    if (label) label.textContent = `简历预览 · ${Math.round(_previewZoom*100)}%`;
  };
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => { _previewZoom = Math.max(0.3, _previewZoom - 0.1); applyZoom(); });
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => { _previewZoom = Math.min(1.5, _previewZoom + 0.1); applyZoom(); });
  applyZoom();
})();

// ═══════════════════════════════════════════════════════════════
// 初始化：检查 hash 路由（等 token 就绪）
// ═══════════════════════════════════════════════════════════════
if (location.hash && typeof handleHash === 'function') {
  const waitForToken = () => {
    if (typeof _localToken !== 'undefined' && _localToken) { handleHash(); }
    else { setTimeout(waitForToken, 100); }
  };
  setTimeout(waitForToken, 300);
}
