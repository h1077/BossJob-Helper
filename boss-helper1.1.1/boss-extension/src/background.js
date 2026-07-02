// ===== Boss海投助手 Service Worker：编排 收集→投递→跨页面接力 =====
importScripts('/src/selectors.js');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => sleep(a + Math.random() * (b - a));

let state = {
  phase: 'idle', paused: false, aborted: false,
  jobs: [], queue: [], queueIndex: 0, results: [],
  processed: {}
};

// ── 风险控制 / 冷却退避系统 ──
const RiskManager = {
  consecutiveErrors: 0,
  baseDelay: 3000,
  maxDelay: 120000,
  dangerSigns: /验证|滑块|点击完成验证|安全验证|访问频率|频繁|异常|封禁|banned|captcha|verify/i,

  reset() { this.consecutiveErrors = 0; },

  onError(pageText) {
    this.consecutiveErrors++;
    if (pageText && this.dangerSigns.test(pageText)) {
      this.consecutiveErrors = Math.max(this.consecutiveErrors, 4); // 立即跳到大延迟
    }
    return this.getDelay();
  },

  onSuccess() {
    this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 2);
  },

  getDelay() {
    if (this.consecutiveErrors <= 0) return 3000;
    const exp = Math.min(this.consecutiveErrors, 6);
    const delay = this.baseDelay * Math.pow(2, exp - 1);
    const jitter = delay * (0.5 + Math.random() * 0.5);
    return Math.min(Math.round(jitter), this.maxDelay);
  },

  isDangerous() { return this.consecutiveErrors >= 5; }
};

// ── HR 职级排序 ──
function scoreHRTitle(title) {
  if (!title) return 20;
  const t = title.toLowerCase();
  if (/创始人|法人|ceo|总裁|院长|合伙人/.test(t)) return 200;
  if (/总监|经理|主管/.test(t)) return 100;
  if (/hrbp|hrd/.test(t)) return 90;
  if (/招聘.*(主管|经理|负责人)/.test(t)) return 85;
  if (/hr|人事/.test(t)) return 50;
  if (/专员|助理/.test(t)) return 30;
  if (/猎头/.test(t)) return 10;
  return 20;
}

function rankJobsByHR(queue) {
  // 按公司分组，每个公司保留 HR 职级最高的岗位（排前面）
  const companyMap = {};
  for (const job of queue) {
    const norm = normalizeCompany(job.company || '');
    if (!companyMap[norm]) companyMap[norm] = job;
    else {
      const existing = scoreHRTitle(companyMap[norm].hrTitle);
      const current = scoreHRTitle(job.hrTitle);
      if (current > existing) companyMap[norm] = job;
    }
  }
  // 返回排序结果：HR职级高的在前
  return Object.values(companyMap).sort((a, b) =>
    scoreHRTitle(b.hrTitle) - scoreHRTitle(a.hrTitle)
  );
}

// ── 法人/老板识别 ──
function detectBoss(hrName, hrTitle, companyName) {
  if (!hrTitle) return false;
  const t = hrTitle.toLowerCase();
  // 头衔直判
  if (/法人|创始人|老板|ceo|总裁|总经理|院长|合伙人|董事长/.test(t)) return true;
  // 名字-公司名交叉匹配
  if (hrName && companyName) {
    const surname = hrName.charAt(0);
    if (surname && companyName.length >= 2 && companyName.includes(surname)) {
      // 排除常见词（科技、信息、网络等）
      if (!/科技|信息|网络|电子|软件|数据|互联|商务|咨询|贸易|实业/.test(companyName.slice(companyName.indexOf(surname), companyName.indexOf(surname) + 4))) {
        return true;
      }
    }
  }
  return false;
}

// ── 小工具 ──
function log(text, level) {
  chrome.runtime.sendMessage({ type: 'LOG', text, level: level || 'info' }).catch(() => {});
}
function pushPhase() {
  chrome.runtime.sendMessage({ type: 'PHASE', phase: state.phase }).catch(() => {});
}
function progress(cur, total, label) {
  chrome.runtime.sendMessage({ type: 'PROGRESS', cur, total, label: label || '' }).catch(() => {});
}
async function getCfg() {
  return chrome.storage.local.get([
    'keyword', 'city', 'count', 'welfare', 'dailyLimit',
    'useAutoSendResume', 'useAutoSendImageResume', 'imageResumes',
    'recruiterActivityStatus', 'excludeHeadhunters',
    'useResumeMatch', 'matchMinScore', 'resumeText', 'resumeAnalysis',
    'aiApiKey', 'aiApiUrl', 'aiModel', 'aiRole',
    'enableCompanyCheck', 'enableCompanyResearch',
    'hrInactiveDays', 'useDesktopBridge', 'conversationStrategy',
    'blacklist', 'salaryRange', 'smartSchedule', 'smartGreetingPrompt'
  ]);
}
function defaultCfg(cfg) {
  cfg.count = parseInt(cfg.count) || 20;
  cfg.matchMinScore = parseInt(cfg.matchMinScore) || 3;
  cfg.useResumeMatch = cfg.useResumeMatch !== false;
  return cfg;
}

// ── 城市解析 ──
function resolveCity(cfg) {
  const firstCity = (cfg.city || '').split(/[\/、,，\s]+/)[0].replace(/[市省]$/, '') || '';
  const code = CITY_MAP[firstCity] || '100010000';
  return { name: firstCity, code, found: code !== '100010000' || firstCity === '全国' };
}
function buildSearchUrl(cfg) {
  const c = resolveCity(cfg);
  return 'https://www.zhipin.com/web/geek/jobs?query=' + encodeURIComponent(cfg.keyword || '') + '&city=' + c.code;
}

// ── Tab 管理 ──
function waitTabComplete(tabId) {
  return new Promise(resolve => {
    function lis(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(lis);
        setTimeout(resolve, 1200);
      }
    }
    chrome.tabs.onUpdated.addListener(lis);
    chrome.tabs.get(tabId, t => {
      if (t && t.status === 'complete') { chrome.tabs.onUpdated.removeListener(lis); setTimeout(resolve, 1200); }
    });
  });
}
async function curUrl(tabId) {
  return new Promise(res => chrome.tabs.get(tabId, t => res((t && t.url) || '')));
}
async function ensureTab(url) {
  let tabs = await chrome.tabs.query({ url: '*://*.zhipin.com/*' });
  let tab = tabs[0];
  if (!tab) tab = await chrome.tabs.create({ url });
  else await chrome.tabs.update(tab.id, { url });
  await waitTabComplete(tab.id);
  await sleep(2000);
  return tab;
}
async function ensureInjected(tabId, file) {
  try { await chrome.scripting.executeScript({ target: { tabId }, files: ['src/selectors.js', file] }); }
  catch (e) { /* already injected */ }
}
function sendToTab(tabId, msg) {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, msg, resp => {
      if (chrome.runtime.lastError) resolve({ success: false, error: chrome.runtime.lastError.message });
      else resolve(resp || { success: false, error: 'no response' });
    });
  });
}

// ── AI 调用（兼容多平台）──
async function callAISmart(cfg, messages, maxTokens) {
  const apiKey = cfg.aiApiKey || '';
  const apiUrl = cfg.aiApiUrl || 'https://api.deepseek.com/v1/chat/completions';
  const model = cfg.aiModel || 'deepseek-chat';
  if (!apiKey) throw new Error('未配置AI API Key');
  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens || 500, temperature: 0.5 })
  });
  if (!resp.ok) { const t = await resp.text().catch(() => ''); throw new Error('AI ' + resp.status + ': ' + t.slice(0, 120)); }
  const data = await resp.json();
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}

// ── 招呼语缓存（24h TTL）──
function greetingCacheKey(job) {
  return 'greet_' + (job.id || (job.name + '_' + (job.company || ''))).replace(/[^a-zA-Z0-9一-龥]/g, '_').slice(0, 80);
}
async function getCachedGreeting(key) {
  const data = await chrome.storage.local.get(key);
  const cached = data[key];
  if (cached && cached.time && (Date.now() - cached.time < 24 * 3600 * 1000)) {
    return cached.text;
  }
  return null;
}
async function setCachedGreeting(key, text) {
  await chrome.storage.local.set({ [key]: { text, time: Date.now() } });
}

// ── 策略注入 ──
const STRATEGY_NOTES = {
  aggressive: '主动出击：快速问清待遇关键点，满意后积极约面。',
  balanced: '有来有往：自然聊天，问清楚细节后再表态。',
  conservative: '宁缺毋滥：严格筛选，多问挑剔，对不合理条件表达疑虑。'
};

// ── 招呼语生成（带缓存）──
async function generateGreeting(cfg, job, jd) {
  const cacheKey = greetingCacheKey(job);
  const cached = await getCachedGreeting(cacheKey);
  if (cached) return cached;

  const resumeText = (cfg.resumeText || '').trim();
  const resumeAnalysis = (cfg.resumeAnalysis || '').trim();
  const smartPrompt = (cfg.smartGreetingPrompt || '').trim();
  const strategy = STRATEGY_NOTES[cfg.conversationStrategy] || STRATEGY_NOTES.balanced;
  const sys = '你是求职者本人，在BOSS直聘给HR发招呼语。回复会原样发给HR。\n' +
    '【严禁】任何注释、说明、括号备注、字数统计、引导语、emoji。\n' +
    '【策略】' + strategy + '\n' +
    '【格式要求】1.开头前15字必须是"您好，熟悉XXX、XXX"（填该JD要求且你简历具备的核心技能1-2个，必须真实存在于简历中）。' +
    '2.紧接"做过XXX"说明简历里与该岗位相关的具体项目/经历。3.全文80-120字，真诚自然，像一个真人在打字。';
  const jdText = (jd && jd.trim()) ? jd.trim().slice(0, 2000) : ((job.tags || []).join('、'));
  const companyInfo = job.company ? ('（' + job.company + '）') : '';
  const salaryInfo = job.salary ? (' | 薪资：' + job.salary) : '';
  // 交叉引用：简历分析 + 自定义提示词
  let extraBlocks = '';
  if (resumeAnalysis) extraBlocks += '\n\n【简历AI分析（核心技能/经验亮点/优势）】\n' + resumeAnalysis.slice(0, 600);
  if (smartPrompt) extraBlocks += '\n\n【用户额外要求】\n' + smartPrompt;

  const user = '【我的简历】\n' + (resumeText || '无') + extraBlocks +
    '\n\n【目标岗位】' + (job.name || '') + companyInfo + salaryInfo +
    '\n\n【该岗位JD】\n' + jdText +
    '\n\n请按格式生成招呼语，直接输出招呼语本身，不要任何多余内容。';
  try {
    let greeting = await callAISmart(cfg, [{ role: 'system', content: sys }, { role: 'user', content: user }], 300);
    greeting = (greeting || '').trim();
    if (greeting) await setCachedGreeting(cacheKey, greeting);
    return greeting;
  } catch (e) {
    return '';
  }
}

// ── 公司背景评估 ──
async function evaluateCompany(cfg, job, jd) {
  if (!cfg.enableCompanyCheck) return { score: 5, comment: '未启用公司评估' };
  const jdText = (jd || '').slice(0, 1500) || (job.tags || []).join('、');
  const sys = '你是资深招聘顾问。评估这个岗位JD的质量和靠谱度，1-10分。考虑：JD描述详细程度、薪资透明度、公司信息完整性、是否有明显red flag。只输出JSON: {"score":数字,"comment":"一句话理由"}';
  try {
    const raw = await callAISmart(cfg, [{ role: 'system', content: sys }, { role: 'user', content: '岗位：' + (job.name || '') + '\n公司：' + (job.company || '') + '\nJD：\n' + jdText }], 150);
    const p = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
    if (p && typeof p.score === 'number') return { score: p.score, comment: p.comment || '' };
    return { score: 5, comment: '评估解析失败' };
  } catch (e) {
    return { score: 5, comment: '评估异常' };
  }
}

// ── AI 调用（含桌面桥接）──
async function callAISmart(cfg, messages, maxTokens) {
  if (cfg.useDesktopBridge) {
    const result = await desktopProxy(messages, maxTokens);
    if (result) return result;
  }
  return callAI(cfg, messages, maxTokens);
}

// ── AI 缓存键（通用）──
function aiCacheKey(prefix, text) {
  return 'ai_ck_' + prefix + '_' + (text || '').slice(0, 60).replace(/[^a-zA-Z0-9]/g, '_');
}
async function getAiCache(key) {
  const data = await chrome.storage.local.get(key);
  const c = data[key];
  if (c && c.time && (Date.now() - c.time < 24 * 3600 * 1000)) return c.text;
  return null;
}
async function setAiCache(key, text) {
  await chrome.storage.local.set({ [key]: { text, time: Date.now() } });
}

// ── 简历匹配评分 ──
function extractKeywords(text) {
  if (!text) return [];
  const keywords = new Set();
  const lines = text.split(/[\n\r]+/);
  for (const line of lines) {
    const trimmed = line.trim().replace(/^[\d\.\-\*\s、：:]+|[:：]/g, '').trim();
    if (!trimmed || trimmed.length < 2) continue;
    const tokens = trimmed.split(/[,，、\s\/]+/);
    for (const t of tokens) {
      const kw = t.trim();
      if (kw.length >= 2 && kw.length <= 15) keywords.add(kw);
    }
  }
  return Array.from(keywords);
}
function scoreJobMatch(job, keywords) {
  if (!keywords || !keywords.length) return 99;
  const title = (job.name || '').toLowerCase();
  const tags = (job.tags || []).join(' ').toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    const k = kw.toLowerCase();
    if (title.includes(k)) score += CONFIG.MATCH.TITLE_WEIGHT;
    if (tags.includes(k)) score += CONFIG.MATCH.DESC_WEIGHT;
  }
  return score;
}

// ── 公司去重 ──
function normalizeCompany(name) {
  return (name || '').replace(/[（(].*?[）)]/g, '').replace(/有限(责任)?公司|股份有限(责任)?公司|集团有限公司?|有限公司/g, '').replace(/\s/g, '').toLowerCase();
}
function parseInactiveDays(activeTime) {
  if (!activeTime || activeTime === '在线' || activeTime === '刚刚活跃') return 0;
  if (activeTime.includes('今日')) return 1;
  if (activeTime.includes('3日内')) return 3;
  if (activeTime.includes('本周')) return 7;
  if (activeTime.includes('2周')) return 14;
  const mM = activeTime.match(/(\d+)月/); if (mM) return parseInt(mM[1]) * 30;
  const mD = activeTime.match(/(\d+)天/); if (mD) return parseInt(mD[1]);
  return 0;
}

// ── 每日上限检测 ──
async function checkDailyLimit(cfg) {
  const limit = cfg.dailyLimit || 100;
  const today = new Date().toDateString();
  const key = 'dailyStats_' + today.replace(/\s/g, '_');
  const stats = await chrome.storage.local.get(key);
  const count = (stats[key] || 0);
  return { reached: count >= limit, count, limit, key };
}
async function incrDailyCount(key) {
  const stats = await chrome.storage.local.get(key);
  const count = (stats[key] || 0) + 1;
  await chrome.storage.local.set({ [key]: count });
}

// ── 高峰时段检测 ──
function isPeakHour() {
  const h = new Date().getHours();
  return CONFIG.PEAK_HOURS.some(p => h >= p.start && h < p.end);
}

// ── 多城市解析 ──
function parseCities(cityStr) {
  if (!cityStr || !cityStr.trim()) return [{ name: '全国', code: '100010000' }];
  return cityStr.split(/[\/、,，\s]+/).filter(Boolean).map(c => {
    const name = c.replace(/[市省]$/, '') || '';
    const code = CITY_MAP[name] || '100010000';
    return { name, code, found: code !== '100010000' || name === '全国' };
  });
}
function buildSearchUrlForCity(cfg, cityObj) {
  let url = 'https://www.zhipin.com/web/geek/jobs?query=' + encodeURIComponent(cfg.keyword || '') + '&city=' + cityObj.code;
  if (cfg.salaryRange) url += '&salary=' + cfg.salaryRange;
  return url;
}

// ── 福利过滤 ──
function parseWelfare(welfareStr) {
  if (!welfareStr || !welfareStr.trim()) return [];
  return welfareStr.split(/[，,、\s]+/).map(k => k.trim()).filter(Boolean);
}

// ── 桌面桥接 ──
async function desktopProxy(messages, maxTokens) {
  try {
    const resp = await fetch('http://localhost:5001/api/ai/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, max_tokens: maxTokens || 500 }),
      signal: AbortSignal.timeout(15000)
    });
    if (resp.ok) {
      const data = await resp.json();
      return (data.content || data.text || data.reply || '');
    }
  } catch (e) {}
  return null;
}

// ── 仪表盘追踪 ──
async function updateJobTracker(field, increment) {
  const d = await chrome.storage.local.get('jobTracker');
  const t = d.jobTracker || { total: 0, highMatch: 0, applied: 0, interviewing: 0, rejected: 0 };
  if (increment) t[field] = (t[field] || 0) + 1;
  else t[field] = (t[field] || 0);
  await chrome.storage.local.set({ jobTracker: t });
}

// ── 流程 1：收集 + 筛选（多城市）──
async function runCollect() {
  state.aborted = false; state.paused = false;
  state.jobs = []; state.queue = []; state.results = [];
  state.phase = 'collecting'; pushPhase();
  const cfg = defaultCfg(await getCfg());
  if (!cfg.keyword) { log('请先填写岗位关键词', 'error'); state.phase = 'idle'; pushPhase(); return; }

  // 高峰时段检测
  if (!isPeakHour()) {
    log('⚠ 当前非最佳投递时段（上午9-11点、下午2-5点），继续运行...', 'warn');
  }

  // 每日上限检测
  const daily = await checkDailyLimit(cfg);
  if (daily.reached) {
    log('今日投递已达上限（' + daily.limit + '），请明天再试', 'warn');
    state.phase = 'idle'; pushPhase(); return;
  }
  log('今日已投递：' + daily.count + ' / ' + daily.limit);

  // 多城市收集
  const cities = parseCities(cfg.city);
  const welfareKeywords = parseWelfare(cfg.welfare);
  log('关键词：' + cfg.keyword + ' | 城市：' + cities.map(c => c.name).join('、') +
    (welfareKeywords.length ? ' | 福利：' + welfareKeywords.join('、') : ''));

  const allJobs = [];
  for (const cityObj of cities) {
    if (state.aborted) break;
    log('🏙 切换城市：' + cityObj.name + (cityObj.found ? '' : '（未识别，按全国）'));
    const url = buildSearchUrlForCity(cfg, cityObj);
    const tab = await ensureTab(url);
    await ensureInjected(tab.id, 'src/content-search.js');

    const r = await sendToTab(tab.id, {
      type: 'SCRAPE',
      count: cfg.count || 20,
      welfareKeywords: welfareKeywords
    });
    if (r && r.success && r.jobs) {
      allJobs.push(...r.jobs.map(j => ({ ...j, city: cityObj.name })));
      log('  ' + cityObj.name + '：收集到 ' + r.jobs.length + ' 个岗位');
    }
    await rand(2000, 4000);
  }
  state.jobs = allJobs;
  await updateJobTracker('total', true);
  log('共收集 ' + state.jobs.length + ' 个岗位（' + cities.length + ' 个城市）', 'success');
  if (!state.jobs.length) { state.phase = 'idle'; pushPhase(); return; }

  // ── 筛选 ──
  state.phase = 'screening'; pushPhase();
  const keywords = cfg.useResumeMatch ? extractKeywords(cfg.resumeAnalysis || cfg.resumeText || '') : [];
  const applied = await chrome.storage.local.get('appliedCompanies');
  const appliedSet = new Set((applied.appliedCompanies || '').split(',').filter(Boolean));

  // ── 调试日志：筛选配置 ──
  log('─── 🔍 筛选配置 ───', 'info');
  log('useResumeMatch: ' + cfg.useResumeMatch, 'info');
  log('matchMinScore: ' + cfg.matchMinScore, 'info');
  log('resumeText 前100字: ' + ((cfg.resumeText || '(未填写)') + '').slice(0, 100), 'info');
  log('resumeAnalysis 前100字: ' + ((cfg.resumeAnalysis || '(未填写)') + '').slice(0, 100), 'info');
  log('提取关键词(' + keywords.length + '个): ' + (keywords.length ? keywords.slice(0, 30).join(', ') : '(无)'), 'info');
  log('welfare: "' + (cfg.welfare || '(未设置)') + '" → ' + welfareKeywords.length + ' 个关键词: [' + welfareKeywords.join(', ') + ']', 'info');
  log('excludeHeadhunters: ' + cfg.excludeHeadhunters, 'info');
  log('hrInactiveDays: ' + cfg.hrInactiveDays, 'info');
  log('blacklist 行数: ' + ((cfg.blacklist || '').split('\n').filter(Boolean).length), 'info');
  log('已投递公司数: ' + appliedSet.size, 'info');
  log('dailyLimit: ' + cfg.dailyLimit, 'info');

  // 过滤计数器
  const filterStats = { welfare: 0, headhunter: 0, inactive: 0, blacklist: 0, duplicate: 0, lowMatch: 0, passed: 0, noResume: 0 };
  const sampleRejects = [];

  state.queue = [];
  for (const job of state.jobs) {
    if (state.aborted) break;

    // 排除猎头
    const isHeadhunter = (job.tags || []).some(t => t.includes('猎头'));
    if (cfg.excludeHeadhunters && isHeadhunter) { filterStats.headhunter++; continue; }

    // 福利筛选（AND 逻辑：从收集阶段移到筛选阶段，检查岗位名称/标签/公司）
    if (welfareKeywords && welfareKeywords.length > 0) {
      const haystack = [job.name, ...(job.tags || []), job.company].filter(Boolean).join(' ').toLowerCase();
      const allMatch = welfareKeywords.every(kw => haystack.includes(kw.toLowerCase()));
      if (!allMatch) {
        filterStats.welfare++;
        if (sampleRejects.length < 3) sampleRejects.push({ name: job.name, reason: '福利不匹配', detail: '需要: [' + welfareKeywords.join(', ') + '] | 岗位文本: ' + haystack.slice(0, 100) });
        continue;
      }
    }

    // HR 不活跃阈值
    if (cfg.hrInactiveDays > 0 && job.activeTime) {
      const days = parseInactiveDays(job.activeTime);
      if (days > cfg.hrInactiveDays) {
        filterStats.inactive++;
        if (sampleRejects.length < 3) sampleRejects.push({ name: job.name, reason: 'HR不活跃', detail: '活跃度: ' + job.activeTime + ' → ' + days + '天 > 阈值' + cfg.hrInactiveDays + '天' });
        continue;
      }
    }

    // 公司黑名单
    const blacklist = (cfg.blacklist || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (blacklist.length > 0) {
      const companyLower = (job.company || '').toLowerCase();
      if (blacklist.some(b => companyLower.includes(b.toLowerCase()))) { filterStats.blacklist++; continue; }
    }

    // 公司去重
    const norm = normalizeCompany(job.company || '');
    if (norm && appliedSet.has(norm)) { filterStats.duplicate++; continue; }

    // 简历匹配
    let matchScore = 0;
    if (keywords.length > 0) {
      matchScore = scoreJobMatch(job, keywords);
      if (matchScore < cfg.matchMinScore) {
        filterStats.lowMatch++;
        if (sampleRejects.length < 5) sampleRejects.push({ name: job.name, reason: '简历匹配分低', detail: '得分' + matchScore + ' < 阈值' + cfg.matchMinScore + ' | tags: ' + (job.tags || []).slice(0, 5).join(', ') });
        continue;
      }
    } else {
      filterStats.noResume++;
    }

    // 法人识别标记
    if (detectBoss(job.hrName, job.hrTitle, job.company)) {
      job.isBoss = true;
    }
    filterStats.passed++;
    state.queue.push({ ...job, matchScore });
  }

  // ── 调试日志：筛选统计 ──
  log('─── 📊 筛选统计 ───', 'info');
  log('总收集: ' + state.jobs.length + ' | ✅通过: ' + filterStats.passed + ' | ❌福利: ' + filterStats.welfare + ' | ❌猎头: ' + filterStats.headhunter + ' | ❌不活跃: ' + filterStats.inactive + ' | ❌黑名单: ' + filterStats.blacklist + ' | ❌去重: ' + filterStats.duplicate + ' | ❌低匹配分: ' + filterStats.lowMatch + ' | ℹ️无简历关键词: ' + filterStats.noResume, 'info');
  if (sampleRejects.length > 0) {
    log('─── 📋 被拒样本（前' + sampleRejects.length + '个）───', 'warn');
    sampleRejects.forEach(s => log('  ✗ ' + s.name + ' → ' + s.reason + ' | ' + (s.detail || ''), 'warn'));
  }
  if (filterStats.passed === 0 && filterStats.lowMatch === state.jobs.length) {
    log('⚠ 全部被简历匹配过滤！请检查：1) 简历是否填写了相关内容 2) matchMinScore 是否过高（当前' + cfg.matchMinScore + '） 3) 关键词是否与岗位完全不相关', 'error');
  }
  if (filterStats.passed === 0 && filterStats.welfare === state.jobs.length) {
    log('⚠ 全部被福利过滤！岗位名称/tags中未找到福利关键词 [' + welfareKeywords.join(', ') + ']，建议暂时清空福利筛选再试', 'error');
  }

  // HR 职级排序 + 去重：每公司只保留 HR 职级最高的岗位
  const beforeRank = state.queue.length;
  state.queue = rankJobsByHR(state.queue);
  const bossCount = state.queue.filter(j => j.isBoss).length;
  const rankLog = beforeRank > state.queue.length ? '（去重+排序，保留' + state.queue.length + '个）' : '';
  if (bossCount > 0) log('👔 检测到 ' + bossCount + ' 个法人/老板直招岗位', 'success');
  log('筛选完成：匹配 ' + state.queue.length + ' / ' + state.jobs.length + ' ' + rankLog, 'success');

  // 保存
  await chrome.storage.local.set({ sw_queue: state.queue, sw_queue_index: 0 });

  state.phase = 'review'; pushPhase();
  chrome.runtime.sendMessage({ type: 'QUEUE_READY', queue: state.queue }).catch(() => {});
}

// ── 流程 2：投递 ──
async function runDeliver() {
  state.aborted = false; state.paused = false; state.results = [];
  state.phase = 'delivering'; pushPhase();

  // 从 storage 恢复（SW 可能被回收）
  if (!state.queue.length) {
    const d = await chrome.storage.local.get(['sw_queue', 'sw_queue_index']);
    state.queue = d.sw_queue || [];
    state.queueIndex = d.sw_queue_index || 0;
  }
  const cfg = defaultCfg(await getCfg());
  const searchUrl = buildSearchUrl(cfg);

  const total = state.queue.length;
  for (let i = state.queueIndex; i < total; i++) {
    if (state.aborted || state.paused) break;

    // 智能调度
    if (cfg.smartSchedule) {
      const now = new Date();
      const dow = now.getDay(); // 0=Sun, 6=Sat
      const hour = now.getHours();
      if (dow === 0 || dow === 6) {
        log('⏸ 周末暂停投递（智能调度），周一自动恢复', 'warn');
        state.paused = true;
        break;
      }
      if (hour >= 12 && hour < 14) {
        log('⏸ 午休时段暂停（12-14点），14点后恢复', 'warn');
        await sleep(60000); // wait 1 min
        i--;
        continue;
      }
      // 每投3个岗位后间隔加长
      if (i > 0 && i % 3 === 0) {
        log('  智能间隔：休息30秒...');
        await sleep(30000);
      }
    }

    // 每日上限检查
    const daily = await checkDailyLimit(cfg);
    if (daily.reached) { log('今日投递已达上限（' + daily.limit + '）', 'warn'); break; }

    const job = state.queue[i];
    log('[' + (i + 1) + '/' + total + '] ' + job.name + ' - ' + (job.company || '') + (job.matchScore ? ' (匹配' + job.matchScore + '分)' : ''));

    // 1. 打开搜索页，读取 JD
    const tab = await ensureTab(searchUrl);
    await ensureInjected(tab.id, 'src/content-search.js');
    log('  读取岗位JD...');
    const jdr = await sendToTab(tab.id, { type: 'OPEN_JD', job });
    const jd = (jdr && jdr.jd) || '';

    // 2. 公司背景评估
    if (cfg.enableCompanyCheck) {
      const evalR = await evaluateCompany(cfg, job, jd);
      log('  公司评估：' + evalR.score + '/10 - ' + evalR.comment);
      if (evalR.score <= CONFIG.COMPANY_CHECK.REJECT_THRESHOLD) {
        log('  ✗ 公司评分过低（' + evalR.score + '/10），跳过', 'warn');
        progress(i + 1, total, '投递');
        continue;
      }
    }

    // 3. 生成招呼语
    log('  生成招呼语...');
    let greeting = '';
    try { greeting = await generateGreeting(cfg, job, jd); } catch (e) { log('  生成失败：' + e.message, 'error'); }
    if (!greeting) { log('  招呼语为空，跳过', 'warn'); progress(i + 1, total, '投递'); continue; }

    // 3. 点击"立即沟通" → 跳转聊天页
    log('  建立联系...');
    await sendToTab(tab.id, { type: 'GO_CHAT', job, greeting, cfg });
    await waitTabComplete(tab.id); await sleep(2500);

    // 4. 在聊天页发送
    const u = await curUrl(tab.id);
    if (u.indexOf('/web/geek/chat') < 0) { log('  未进入聊天页，跳过', 'error'); progress(i + 1, total, '投递'); continue; }
    await ensureInjected(tab.id, 'src/content-chat.js');
    log('  发送招呼语 + 简历...');
    const r2 = await sendToTab(tab.id, {
      type: 'SEND_ALL',
      greeting,
      useAutoSendResume: cfg.useAutoSendResume,
      useAutoSendImageResume: cfg.useAutoSendImageResume,
      imageResumes: cfg.imageResumes || []
    });

    if (r2 && r2.success) {
      log('  ✓ 投递成功', 'success');
      state.results.push({ id: job.id, name: job.name, ok: true });
      await incrDailyCount(daily.key);
      await updateJobTracker('applied', true);
      if (job.matchScore >= 7) await updateJobTracker('highMatch', true);
      RiskManager.onSuccess();
      // 同步到桌面数据库
      if (cfg.useDesktopBridge) {
        try {
          await fetch('http://localhost:5001/api/jobs/collect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company: job.company, position: job.name, salary: job.salary, location: job.location, status: 'applied', match_score: job.matchScore }),
            signal: AbortSignal.timeout(3000)
          });
        } catch (e) { /* 桌面端未运行，静默跳过 */ }
      }
      const norm = normalizeCompany(job.company || '');
      const prev = await chrome.storage.local.get('appliedCompanies');
      const set = new Set((prev.appliedCompanies || '').split(',').filter(Boolean));
      set.add(norm);
      await chrome.storage.local.set({ appliedCompanies: Array.from(set).join(',') });
    } else {
      const errMsg = (r2 && r2.error) || '';
      const pageText = (r2 && r2.pageText) || '';
      log('  失败：' + errMsg, 'error');
      state.results.push({ id: job.id, name: job.name, ok: false, msg: errMsg });
      const riskDelay = RiskManager.onError(pageText);
      if (RiskManager.isDangerous()) {
        log('⚠ 检测到风控信号！自动降速至 ' + Math.round(riskDelay/1000) + 's 间隔', 'warn');
        if (RiskManager.consecutiveErrors >= 6) {
          log('🛑 连续异常过多，暂停投递。请稍后手动恢复', 'error');
          state.paused = true;
          break;
        }
      }
    }

    state.queueIndex = i + 1;
    await chrome.storage.local.set({ sw_queue_index: i + 1 });
    progress(i + 1, total, '投递');

    // 使用风险感知延迟替代固定延迟
    const dynamicDelay = RiskManager.getDelay();
    await sleep(dynamicDelay);
  }

  const ok = state.results.filter(r => r.ok).length;
  const fail = state.results.length - ok;
  state.phase = 'done'; pushPhase();
  log('投递完成：成功 ' + ok + ' | 失败 ' + fail, 'success');
  await chrome.storage.local.remove(['sw_queue', 'sw_queue_index']);
  chrome.runtime.sendMessage({ type: 'DONE', ok, fail }).catch(() => {});
}

// ── 消息入口 ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_COLLECT') { runCollect(); sendResponse({ ok: true }); return; }
  if (msg.type === 'START_DELIVER') {
    chrome.storage.local.get(['sw_queue', 'sw_queue_index'], (d) => {
      if (d.sw_queue && d.sw_queue.length) { state.queue = d.sw_queue; state.queueIndex = 0; }
      runDeliver();
    });
    sendResponse({ ok: true }); return;
  }
  if (msg.type === 'PAUSE') { state.paused = true; log('已暂停', 'warn'); sendResponse({ ok: true }); return; }
  if (msg.type === 'RESUME') { state.paused = false; runDeliver(); sendResponse({ ok: true }); return; }
  if (msg.type === 'STOP') { state.aborted = true; state.paused = false; log('已停止', 'warn'); state.phase = 'idle'; pushPhase(); sendResponse({ ok: true }); return; }
  if (msg.type === 'RESET') {
    state.queue = []; state.queueIndex = 0; state.jobs = []; state.results = [];
    chrome.storage.local.remove(['sw_queue', 'sw_queue_index']);
    state.phase = 'idle'; pushPhase();
    log('已重置', 'warn'); sendResponse({ ok: true }); return;
  }
  if (msg.type === 'GET_STATE') { sendResponse({ phase: state.phase, queue: state.queue, queueIndex: state.queueIndex }); return; }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
try { chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {}); } catch (e) {}
