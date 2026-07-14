// ===== Boss海投助手 Service Worker：编排 收集→投递→跨页面接力 =====
importScripts('/src/selectors.js');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => sleep(a + Math.random() * (b - a));

// SW-safe sleep: 长睡眠拆成小块 + storage 心跳，防止 MV3 SW 被杀死导致 Promise 丢失
const safeSleep = async (ms) => {
  const CHUNK = 5000; // 每 5 秒心跳一次
  while (ms > 0) {
    const t = Math.min(ms, CHUNK);
    await sleep(t);
    ms -= t;
    // 心跳：storage 写入是"活动"，重置 SW 的 30s 倒计时
    if (ms > 0) {
      await chrome.storage.local.set({ _sw_heartbeat: Date.now() }).catch(() => {});
    }
  }
};

let state = {
  phase: 'idle', paused: false, aborted: false,
  jobs: [], queue: [], queueIndex: 0, results: [],
  processed: {}, greetings: {}
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
  const emptyCompanyJobs = [];  // 无公司名的岗位不参与去重
  for (const job of queue) {
    const raw = (job.company || '').trim();
    if (!raw) {
      emptyCompanyJobs.push(job);  // 保留所有无公司名的岗位
      continue;
    }
    const norm = normalizeCompany(raw);
    if (!companyMap[norm]) companyMap[norm] = job;
    else {
      const existing = scoreHRTitle(companyMap[norm].hrTitle);
      const current = scoreHRTitle(job.hrTitle);
      if (current > existing) companyMap[norm] = job;
    }
  }
  // 排序：HR职级高的在前；无公司名岗位追加在末尾
  const ranked = Object.values(companyMap).sort((a, b) =>
    scoreHRTitle(b.hrTitle) - scoreHRTitle(a.hrTitle)
  );
  // 无公司岗位也按 HR 职级排序后追加
  emptyCompanyJobs.sort((a, b) => scoreHRTitle(b.hrTitle) - scoreHRTitle(a.hrTitle));
  return ranked.concat(emptyCompanyJobs);
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
  cfg.count = parseInt(cfg.count) || 60;
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

// ── AI 直接调用（兼容多平台）──
async function callAI(cfg, messages, maxTokens, temperature) {
  const apiKey = cfg.aiApiKey || '';
  const apiUrl = cfg.aiApiUrl || 'https://api.deepseek.com/v1/chat/completions';
  const model = cfg.aiModel || 'deepseek-chat';
  if (!apiKey) throw new Error('未配置AI API Key');
  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens || 500, temperature: temperature != null ? temperature : 0.5 })
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

// ── 招呼语生成（带缓存 + 重试 + 降级兜底）──
const GREETING_MIN_LENGTH = 30;   // 招呼语最少30字
const GREETING_MAX_RETRIES = 2;   // 最多重试2次（共3次尝试）

async function generateGreeting(cfg, job, jd) {
  const cacheKey = greetingCacheKey(job);
  const cached = await getCachedGreeting(cacheKey);
  if (cached) return cached;

  const resumeText = (cfg.resumeText || '').trim();
  const resumeAnalysis = (cfg.resumeAnalysis || '').trim();
  const smartPrompt = (cfg.smartGreetingPrompt || '').trim();
  const strategy = STRATEGY_NOTES[cfg.conversationStrategy] || STRATEGY_NOTES.balanced;

  // ── 构建 prompt（自然语言，避免模板化指令导致模型偷懒）──
  function buildSystemPrompt(retryLevel) {
    let prompt = '你是求职者本人，在BOSS直聘上给HR发第一条打招呼消息。你的回复会被原样发送给HR。\n\n' +
      '【核心要求】\n' +
      '1. 必须写满80-120字，不能少于一整段话。\n' +
      '2. 内容结构：用1-2个你具备且JD要求的核心技能或相关经验直接开头（不要以"你好，对贵司XX岗感兴趣"开头）→ 简短自我介绍 → 用一句话说明相关项目/经历 → 表达对该岗位的兴趣。\n' +
      '3. 语气真诚自然，像真人聊天，不要像机器生成的模板。\n' +
      '4. 适当体现你的策略倾向：「' + strategy + '」\n' +
      '5. 不要提及学历、专业、在读/毕业状态。招呼语聚焦于你的技能、项目经验和岗位匹配度。\n\n' +
      '【绝对禁止】\n' +
      '- 不要加任何注释、括号备注、字数标记、emoji、引号包裹\n' +
      '- 不要以"你好，对贵司XX岗位感兴趣"或"您好，我是XX"这类空洞模板开头\n' +
      '- 不要只写一两句话就结束，必须写满一整段\n' +
      '- 不要提及学历、专业名称、毕业时间或在读/毕业状态\n' +
      '- 不要编造简历中没有的工作经历或技能';
    if (retryLevel >= 1) {
      prompt += '\n\n【⚠️ 重要提醒】上次你生成的招呼语太短了！这次请务必写满80-120字，包含完整的问候+技能匹配+项目经历+意向表达四个部分。';
    }
    return prompt;
  }

  function buildUserMessage() {
    const jdText = (jd && jd.trim()) ? jd.trim().slice(0, 2000) : ((job.tags || []).join('、'));
    const companyInfo = job.company ? ('（' + job.company + '）') : '';
    const salaryInfo = job.salary ? (' | 薪资：' + job.salary) : '';
    let extraBlocks = '';
    if (resumeAnalysis) extraBlocks += '\n\n【简历AI分析（核心技能/经验亮点/优势）】\n' + resumeAnalysis.slice(0, 600);
    if (smartPrompt) extraBlocks += '\n\n【用户额外要求】\n' + smartPrompt;

    return '【我的简历】\n' + (resumeText || '无') + extraBlocks +
      '\n\n【目标岗位】' + (job.name || '') + companyInfo + salaryInfo +
      '\n\n【该岗位JD】\n' + jdText +
      '\n\n请生成打招呼消息（80-120字自然段落，直接输出，不要任何前缀/后缀/引号）：';
  }

  // ── 降级模板（AI 全部失败时的兜底）──
  function buildFallbackGreeting() {
    const jdText = (jd && jd.trim()) ? jd.trim().slice(0, 2000) : ((job.tags || []).join('、'));
    // 从 JD 文本中提取高频中文词组（2-4字），不依赖写死的技能列表
    const jdWords = jdText.replace(/[^一-龥a-zA-Z]/g, ' ').split(/\s+/).filter(w => w.length >= 2 && w.length <= 6);
    const wordFreq = {};
    jdWords.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
    const topWords = Object.entries(wordFreq)
      .filter(([w]) => !/有限公司|岗位|职责|要求|任职|资格|以上|以下|相关|具有|具备|优先|能力|经验|工作|负责|公司|提供|欢迎|加入|我们|团队|进行|完成|协助|参与|熟悉|了解/.test(w))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([w]) => w);
    const skillStr = topWords.length > 0 ? topWords.join('、') : (job.tags || []).slice(0, 3).join('、');
    const companyStr = job.company || '贵公司';
    // 技能/经验开头，匹配 System Prompt 标准，不提及学历
    return '我有' + (skillStr || '相关领域') + '方面的实际经验，之前参与过相关项目的方案设计与交付落地。' +
      '看到' + companyStr + '的' + (job.name || '招聘信息') + '与我的经历比较匹配，希望能有机会进一步沟通。';
  }

  // ── 重试循环 ──
  let lastGreeting = '';
  for (let attempt = 0; attempt <= GREETING_MAX_RETRIES; attempt++) {
    try {
      const sys = buildSystemPrompt(attempt);
      const user = buildUserMessage();
      const temperature = 0.5 + attempt * 0.2;  // 每次重试提高 temperature 增加多样性
      let greeting = await callAISmart(cfg, [
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ], 500, temperature);
      greeting = (greeting || '').trim();

      // 清理常见的前缀/后缀噪音
      greeting = greeting.replace(/^["'「『"""]+|["'」』"""]+$/g, '');
      greeting = greeting.replace(/^(招呼语|打招呼|消息)[：:]\s*/i, '');
      greeting = greeting.replace(/^\([^)]*\)\s*/, '');  // 去掉开头的括号注释

      if (greeting.length >= GREETING_MIN_LENGTH) {
        // 合格！缓存并返回
        await setCachedGreeting(cacheKey, greeting);
        return greeting;
      }

      // 太短，记录并准备重试
      lastGreeting = greeting;
      if (attempt < GREETING_MAX_RETRIES) {
        log('  招呼语过短(' + greeting.length + '字)，重试第' + (attempt + 1) + '次...', 'warn');
      }
    } catch (e) {
      if (attempt < GREETING_MAX_RETRIES) {
        log('  招呼语生成失败(' + e.message + ')，重试第' + (attempt + 1) + '次...', 'warn');
      }
    }
  }

  // 所有重试都失败，使用降级模板
  const fallback = buildFallbackGreeting();
  log('  ⚠ AI生成均不达标，使用规则模板兜底(' + fallback.length + '字)', 'warn');
  // 不缓存降级模板，下次投递同一岗位时重新尝试 AI 生成
  return fallback;
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
async function callAISmart(cfg, messages, maxTokens, temperature) {
  if (cfg.useDesktopBridge) {
    const result = await desktopProxy(messages, maxTokens, temperature);
    if (result) return result;
  }
  return callAI(cfg, messages, maxTokens, temperature);
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

// 从简历分析文本中提取弱项关键词（用于扣分）
function extractWeaknesses(analysisText) {
  if (!analysisText) return [];
  const weaknesses = [];
  // 尝试从 JSON 中提取 weaknesses 数组
  try {
    const parsed = JSON.parse(analysisText);
    if (parsed.weaknesses && Array.isArray(parsed.weaknesses)) {
      for (const w of parsed.weaknesses) {
        // 提取关键字词（2-6个汉字）
        const words = w.match(/[一-龥]{2,6}/g) || [];
        weaknesses.push(...words);
      }
      return [...new Set(weaknesses)];
    }
  } catch (e) { /* 非JSON文本，走文本解析 */ }
  // 文本解析：找"短板"、"缺乏"、"不足"等关键词所在的行
  const lines = analysisText.split(/[\n\r]+/);
  for (const line of lines) {
    if (/短板|弱点|缺乏|不足|缺失|薄弱|欠缺|无.*经验|经验不足/.test(line)) {
      const words = line.match(/[一-龥a-zA-Z]{2,8}/g) || [];
      weaknesses.push(...words.filter(w => !/短板|弱点|缺乏|不足|缺失|薄弱|欠缺|经验不足/.test(w)));
    }
  }
  return [...new Set(weaknesses)];
}

// 检查岗位是否要求了候选人的弱项（用于扣分）
function penalizeWeakness(job, weaknesses) {
  if (!weaknesses || !weaknesses.length) return 0;
  const haystack = ((job.name || '') + ' ' + (job.tags || []).join(' ')).toLowerCase();
  let penalty = 0;
  for (const w of weaknesses) {
    if (w.length < 2) continue;
    if (haystack.includes(w.toLowerCase())) {
      penalty += 5; // 每个弱项命中扣5分
    }
  }
  return Math.min(penalty, 20); // 最多扣20分
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
let _desktopToken = '';
async function getDesktopToken() {
  if (_desktopToken) return _desktopToken;
  try {
    const resp = await fetch('http://localhost:5001/api/local-token', { signal: AbortSignal.timeout(2000) });
    if (resp.ok) { const d = await resp.json(); _desktopToken = d.token || ''; }
  } catch (e) {}
  return _desktopToken;
}
async function desktopProxy(messages, maxTokens, temperature) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    const token = await getDesktopToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const body = { messages, max_tokens: maxTokens || 500 };
    if (temperature != null) body.temperature = temperature;
    const resp = await fetch('http://localhost:5001/api/ai/proxy', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
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
  if (increment) t[field] = (t[field] || 0) + (typeof increment === 'number' ? increment : 1);
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
      count: cfg.count || 60,
      welfareKeywords: welfareKeywords
    });
    if (r && r.success && r.jobs) {
      allJobs.push(...r.jobs.map(j => ({ ...j, city: cityObj.name })));
      log('  ' + cityObj.name + '：收集到 ' + r.jobs.length + ' 个岗位');
    }
    await rand(2000, 4000);
  }
  state.jobs = allJobs;
  await updateJobTracker('total', state.jobs.length);
  log('共收集 ' + state.jobs.length + ' 个岗位（' + cities.length + ' 个城市）', 'success');
  if (!state.jobs.length) { state.phase = 'idle'; pushPhase(); return; }

  // ── 同步到桌面端职位追踪 ──
  if (cfg.useDesktopBridge) {
    let synced = 0;
    log('同步到桌面端...');
    for (const job of state.jobs) {
      try {
        await fetch('http://localhost:5001/api/jobs/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId: job.id, id: job.id,
            companyName: job.company, jobName: job.name,
            salary: job.salary, location: job.location,
            experience: job.experience, education: job.education,
            jd: job.jd, companyStage: job.companyStage,
            companyScale: job.companyScale, companyIndustry: job.companyIndustry,
            status: 'not_applied'
          }),
          signal: AbortSignal.timeout(3000)
        });
        synced++;
      } catch (e) { /* 桌面端未运行，静默跳过 */ }
      await sleep(50);
    }
    if (synced > 0) {
      log('  ✓ 同步完成：' + synced + '/' + state.jobs.length + ' 个岗位已入库');
    } else {
      log('  ⚠ 桌面端未运行，同步跳过（将在投递时入库）');
    }
  }

  // ── 筛选 ──
  state.phase = 'screening'; pushPhase();
  // 只在有 AI 分析结果时才提取关键词；原始简历文本不适合暴力切词匹配
  const keywords = cfg.useResumeMatch ? extractKeywords(cfg.resumeAnalysis || '') : [];
  // 提取弱项关键词用于扣分
  const weaknesses = cfg.useResumeMatch ? extractWeaknesses(cfg.resumeAnalysis || '') : [];
  const applied = await chrome.storage.local.get('appliedCompanies');
  const appliedSet = new Set((applied.appliedCompanies || '').split(',').filter(Boolean));

  // ── 调试日志：筛选配置 ──
  log('─── 🔍 筛选配置 ───', 'info');
  log('useResumeMatch: ' + cfg.useResumeMatch, 'info');
  log('matchMinScore: ' + cfg.matchMinScore, 'info');
  log('resumeText 前100字: ' + ((cfg.resumeText || '(未填写)') + '').slice(0, 100), 'info');
  log('resumeAnalysis 前100字: ' + ((cfg.resumeAnalysis || '(未填写)') + '').slice(0, 100), 'info');
  log('提取关键词(' + keywords.length + '个): ' + (keywords.length ? keywords.slice(0, 30).join(', ') : '(无)'), 'info');
  if (weaknesses.length > 0) {
    log('提取弱项(' + weaknesses.length + '个): ' + weaknesses.slice(0, 15).join(', '), 'info');
  }
  if (cfg.useResumeMatch && keywords.length === 0) {
    log('⚠ 已开启简历匹配但未填写简历分析，匹配功能实际未生效（需先点"AI分析简历"）', 'warn');
  }
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

    // 排除猎头（tag 标记 + HR头衔 + 匿名公司名模式，三个维度）
    const isHeadhunter = (job.tags || []).some(t => t.includes('猎头'))
      || (job.hrTitle || '').includes('猎头');
    const isAnonymized = /某[A-Za-z一-龥]{1,6}(公司|集团|企业|科技)/.test(job.company || '');
    if (cfg.excludeHeadhunters && (isHeadhunter || isAnonymized)) {
      filterStats.headhunter++;
      if (isAnonymized && !isHeadhunter) filterStats.headhunterAnonymized = (filterStats.headhunterAnonymized || 0) + 1;
      continue;
    }

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
      // 弱项扣分：岗位JD要求了候选人的弱项技能
      const penalty = penalizeWeakness(job, weaknesses);
      if (penalty > 0) {
        matchScore = Math.max(0, matchScore - penalty);
      }
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
  // 统计公司分布（调试用）
  const emptyCompanyCount = state.queue.filter(j => !(j.company || '').trim()).length;
  if (emptyCompanyCount > 0) {
    log('⚠ 有 ' + emptyCompanyCount + ' 个岗位缺少公司名（可能页面选择器失效），这些岗位不参与公司去重', 'warn');
  }
  const companySet = new Set();
  state.queue.forEach(j => { const c = (j.company || '').trim(); if (c) companySet.add(normalizeCompany(c)); });
  log('📊 公司去重前: ' + beforeRank + ' 个岗位, ' + companySet.size + ' 家不同公司' + (emptyCompanyCount > 0 ? ', ' + emptyCompanyCount + ' 个无公司名' : ''), 'info');
  state.queue = rankJobsByHR(state.queue);
  const bossCount = state.queue.filter(j => j.isBoss).length;
  const rankLog = beforeRank > state.queue.length ? '（去重+排序，保留' + state.queue.length + '个）' : '';
  if (bossCount > 0) log('👔 检测到 ' + bossCount + ' 个法人/老板直招岗位', 'success');
  log('筛选完成：匹配 ' + state.queue.length + ' / ' + state.jobs.length + ' ' + rankLog, 'success');

  // 保存
  await chrome.storage.local.set({ sw_queue: state.queue, sw_queue_index: 0 });

  // ── 批量预生成招呼语（3个并发，省去投递阶段的逐个AI调用）──
  state.greetings = {};
  const total = state.queue.length;
  if (total > 0) {
    log('⚡ 预生成 ' + total + ' 个岗位的招呼语（3个并发）...');
    const CONC = 3;
    let done = 0;
    for (let i = 0; i < total; i += CONC) {
      const batch = state.queue.slice(i, i + CONC);
      await Promise.all(batch.map(async (job) => {
        try {
          const greeting = await generateGreeting(cfg, job, '');
          if (greeting && greeting.length >= GREETING_MIN_LENGTH) {
            state.greetings[job.id] = greeting;
          }
        } catch (e) { /* 单个失败不阻塞其他 */ }
        done++;
        if (done % 10 === 0 || done === total) {
          log('  预生成进度: ' + done + '/' + total);
        }
      }));
    }
    const okCount = Object.keys(state.greetings).length;
    log('✓ 预生成完成: ' + okCount + '/' + total + ' 个招呼语就绪');
    await chrome.storage.local.set({ sw_greetings: state.greetings });
  }

  state.phase = 'review'; pushPhase();
  chrome.runtime.sendMessage({ type: 'QUEUE_READY', queue: state.queue }).catch(() => {});
}

// ── 流程 2：投递 ──
async function runDeliver() {
  state.aborted = false; state.paused = false; state.results = [];
  let skippedCount = 0;
  let skippedReasons = {};
  state.phase = 'delivering'; pushPhase();

  // 从 storage 恢复（SW 可能被回收）
  if (!state.queue.length) {
    const d = await chrome.storage.local.get(['sw_queue', 'sw_queue_index', 'sw_greetings']);
    state.queue = d.sw_queue || [];
    state.queueIndex = d.sw_queue_index || 0;
    state.greetings = d.sw_greetings || {};
  }
  const cfg = defaultCfg(await getCfg());
  const searchUrl = buildSearchUrl(cfg);

  const total = state.queue.length;
  for (let i = state.queueIndex; i < total; i++) {
    if (state.aborted || state.paused) break;

    // 智能调度（仅保留午休/周末检测）
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
        await safeSleep(60000); // wait 1 min (SW-safe)
        i--;
        continue;
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
        skippedCount++;
        skippedReasons['公司评分低'] = (skippedReasons['公司评分低'] || 0) + 1;
        progress(i + 1, total, '投递');
        continue;
      }
    }

    // 3. 获取招呼语（优先用预生成，未命中则现场生成）
    let greeting = state.greetings[job.id] || '';
    if (greeting && greeting.length >= GREETING_MIN_LENGTH) {
      log('  招呼语(' + greeting.length + '字，预生成): ' + greeting.slice(0, 60) + '...');
    } else {
      log('  生成招呼语（预生成未命中，现场生成）...');
      try { greeting = await generateGreeting(cfg, job, jd); } catch (e) { log('  生成异常：' + e.message, 'error'); }
      if (!greeting || greeting.length < GREETING_MIN_LENGTH) {
        const reason = !greeting ? 'AI返回空' : '招呼语过短(' + greeting.length + '字)';
        log('  招呼语不合格（' + (greeting ? greeting.length + '字' : '空') + '），跳过', 'warn');
        skippedCount++;
        skippedReasons[reason] = (skippedReasons[reason] || 0) + 1;
        progress(i + 1, total, '投递');
        continue;
      }
      log('  招呼语(' + greeting.length + '字): ' + greeting.slice(0, 60) + '...');
    }

    // 3. 点击"立即沟通" → 跳转聊天页
    log('  建立联系...');
    await sendToTab(tab.id, { type: 'GO_CHAT', job, greeting, cfg });
    await waitTabComplete(tab.id); await sleep(2500);

    // 4. 在聊天页发送
    const u = await curUrl(tab.id);
    if (u.indexOf('/web/geek/chat') < 0) {
      log('  未进入聊天页，跳过', 'error');
      skippedCount++;
      skippedReasons['未进入聊天页'] = (skippedReasons['未进入聊天页'] || 0) + 1;
      progress(i + 1, total, '投递');
      continue;
    }
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
            body: JSON.stringify({ jobId: job.id, id: job.id, company: job.company, position: job.name, salary: job.salary, location: job.location, status: 'applied', match_score: job.matchScore }),
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

    // 快速模式：固定 2.5-4.5s 随机延迟（风控异常时 RiskManager 在上方已处理暂停）
    await rand(2500, 4500);
  }

  const ok = state.results.filter(r => r.ok).length;
  const fail = state.results.length - ok;
  state.phase = 'done'; pushPhase();
  log('投递完成：成功 ' + ok + ' | 跳过 ' + skippedCount + ' | 失败 ' + fail, 'success');
  if (Object.keys(skippedReasons).length > 0) {
    log('  跳过原因：' + Object.entries(skippedReasons).map(([k, v]) => k + ' ×' + v).join(' | '), 'info');
  }
  await chrome.storage.local.remove(['sw_queue', 'sw_queue_index']);
  chrome.runtime.sendMessage({ type: 'DONE', ok, fail, skipped: skippedCount }).catch(() => {});
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
