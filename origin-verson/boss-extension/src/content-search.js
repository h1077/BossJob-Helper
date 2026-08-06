// ===== 搜索页 content script：API 收集 + 读 JD + 建立联系 =====
(function () {
  if (window.__bossExtSearch) return;
  window.__bossExtSearch = true;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ── zp_stoken 动态 token 提取（每日变化，防止 API 拦截）──
  function extractZpStoken() {
    // 1. window 全局变量
    if (window.__zp_stoken__) return window.__zp_stoken__;
    // 2. cookie
    const cm = document.cookie.match(/__zp_stoken__=([^;]+)/);
    if (cm) return cm[1];
    // 3. 页面嵌入的 script 变量
    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      const m = (s.textContent || '').match(/__zp_stoken__\s*=\s*['"]([^'"]+)['"]/);
      if (m) return m[1];
    }
    return '';
  }

  // ── 方案B：调用 BOSS 搜索 API，薪资明文 ──
  async function scrapeViaApi(count) {
    const url = new URL(window.location.href);
    const query = url.searchParams.get('query') || '';
    const city = url.searchParams.get('city') || '100010000';
    if (!query) throw new Error('无法从URL提取搜索关键词');

    const jobs = [];
    const seen = {};
    const pageSize = Math.min(count, 30);

    for (let page = 1; jobs.length < count && page <= 5; page++) {
      const salary = url.searchParams.get('salary') || '';
    const apiUrl = '/wapi/zpgeek/search/joblist.json?' +
        'query=' + encodeURIComponent(query) +
        '&city=' + city +
        (salary ? '&salary=' + salary : '') +
        '&page=' + page +
        '&pageSize=' + pageSize;

      const zpStoken = extractZpStoken();
      const resp = await fetch(apiUrl, {
        credentials: 'include',
        headers: {
          'Referer': window.location.href,
          ...(zpStoken ? { 'X-ZP-Stoken': zpStoken } : {}),
        }
      });
      if (!resp.ok) throw new Error('API HTTP ' + resp.status);

      const data = await resp.json();
      if (data.code !== 0) throw new Error('API code ' + data.code + ': ' + (data.message || ''));

      const list = (data.zpData && data.zpData.jobList) || [];
      if (!list.length) break;

      for (const item of list) {
        const id = item.encryptJobId || item.jobId || '';
        if (!id || seen[id]) continue;
        seen[id] = 1;

        jobs.push({
          id: id,
          name: item.jobName || '未知',
          salary: item.salaryDesc || '',          // ← 明文薪资！
          location: (item.cityName || '') + (item.areaDistrict ? ' · ' + item.areaDistrict : ''),
          tags: (item.jobLabels || []).filter(Boolean),
          skills: (item.skills || []).filter(Boolean),       // ← 技能要求，比 tags 更精准
          company: item.brandName || '',
          link: 'https://www.zhipin.com/job_detail/' + id + '.html',
          activeTime: item.bossActiveTime || (item.bossOnline ? '在线' : ''),
          hrName: item.bossName || '',
          hrTitle: item.bossTitle || '',
          experience: item.jobExperience || '',               // ← 经验要求
          education: item.jobDegree || '',                    // ← 学历要求
          // 附加信息（可选用于后续筛选）
          brandStage: item.brandStageName || '',
          brandScale: item.brandScaleName || '',
          companyIndustry: item.brandIndustry || ''           // ← 公司行业
        });
        if (jobs.length >= count) break;
      }
    }
    return jobs.slice(0, count);
  }

  // ── DOM 降级方案（API 不可用时）──
  function getCards() {
    return Array.from(document.querySelectorAll(SELECTORS.jobs.jobCard));
  }

  function parseCard(card) {
    const nameEl = card.querySelector(SELECTORS.jobs.jobName);
    const salEl = card.querySelector(SELECTORS.jobs.jobSalary);
    const areaEl = card.querySelector(SELECTORS.jobs.jobArea);
    const linkEl = card.querySelector('a[href*="/job_detail/"]') || card.querySelector('a[ka][href]') || card.querySelector('a');
    const link = linkEl ? linkEl.href : '';
    const m = link.match(/job_detail\/([^.?]+)\.html/);
    const id = (m && m[1]) || ((nameEl ? nameEl.textContent.trim() : '') + '|' + (salEl ? salEl.textContent.trim() : ''));
    const tags = Array.from(card.querySelectorAll(SELECTORS.jobs.tagList)).map(t => t.textContent.trim()).filter(Boolean);
    let company = '';
    const compEl = card.querySelector('.company-name a, .company-name, [class*="company-name"]');
    if (compEl) company = compEl.textContent.trim();
    // 备用选择器
    if (!company) {
      const altEl = card.querySelector('[class*="company"] a, [class*="company"] span, a[href*="/gongsi/"]');
      if (altEl) company = altEl.textContent.trim();
    }
    if (!company) {
      const altEl2 = card.querySelector('.boss-name + div, [class*="boss"] ~ [class*="name"]');
      if (altEl2) company = altEl2.textContent.trim();
    }
    let activeTime = '';
    const onlineTag = card.querySelector(SELECTORS.jobs.bossOnlineTag);
    if (onlineTag && onlineTag.textContent.trim() === '在线') activeTime = '在线';
    else {
      const atEl = card.querySelector(SELECTORS.jobs.bossActiveTime);
      activeTime = atEl ? atEl.textContent.trim() : '';
    }
    let hrName = '', hrTitle = '';
    const nameEl2 = card.querySelector('.boss-name, .name, [class*="boss-name"]');
    if (nameEl2) hrName = nameEl2.textContent.trim();
    const titleEl = card.querySelector('.boss-title, .title, [class*="boss-title"]');
    if (titleEl) hrTitle = titleEl.textContent.trim();
    return {
      id, name: nameEl ? nameEl.textContent.trim() : '未知',
      salary: salEl ? salEl.textContent.trim() : '',
      location: areaEl ? areaEl.textContent.trim() : '',
      tags, skills: [], company, link,
      activeTime, hrName, hrTitle,
      experience: '', education: '',
      brandStage: '', brandScale: '', companyIndustry: ''
    };
  }

  async function scrapeViaDom(count) {
    const seen = {}, jobs = [];
    let stall = 0;
    for (let loop = 0; loop < 40 && jobs.length < count && stall < 4; loop++) {
      const cards = getCards();
      let added = 0;
      for (const c of cards) {
        const j = parseCard(c);
        if (!j.id || seen[j.id]) continue;
        seen[j.id] = 1;
        jobs.push(j);
        added++;
        if (jobs.length >= count) break;
      }
      if (added === 0) stall++; else stall = 0;
      if (jobs.length >= count) break;
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(1200);
    }
    return jobs.slice(0, count);
  }

  async function scrape(count, welfareKeywords) {
    // 优先 API（薪资明文），失败降级 DOM
    try {
      const jobs = await scrapeViaApi(count);
      if (jobs.length > 0) return jobs;
    } catch (e) {
      console.warn('[BossHelper] API 收集失败，降级 DOM:', e.message);
    }
    return scrapeViaDom(count);
  }

  function findCard(job) {
    const cards = getCards();
    for (const c of cards) { const j = parseCard(c); if (job.id && j.id === job.id) return c; }
    for (const c of cards) { const j = parseCard(c); if (j.name === job.name && (!job.company || j.company === job.company)) return c; }
    return null;
  }

  function waitFor(sel, timeout) {
    return new Promise(resolve => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) { clearInterval(iv); resolve(el); }
        else if (Date.now() - t0 > timeout) { clearInterval(iv); resolve(null); }
      }, 200);
    });
  }

  function waitForText(texts, timeout) {
    return new Promise(resolve => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        const els = document.querySelectorAll('a, button, span, div');
        for (const el of els) {
          const tx = (el.textContent || '').trim();
          if (texts.indexOf(tx) >= 0 && el.offsetParent !== null) { clearInterval(iv); resolve(el); return; }
        }
        if (Date.now() - t0 > timeout) { clearInterval(iv); resolve(null); }
      }, 200);
    });
  }

  async function openJD(job) {
    const card = findCard(job);
    if (!card) return { success: false, error: '未找到岗位卡片' };
    card.scrollIntoView({ block: 'center' });
    await sleep(400);
    card.click();
    await sleep(1600);
    let jd = '';
    const det = document.querySelector(SELECTORS.jobs.jobDetailBox);
    if (det) jd = (det.innerText || '').trim();
    if (!jd) {
      const secs = document.querySelectorAll(SELECTORS.jobs.jobDesc);
      jd = Array.from(secs).map(s => (s.innerText || '').trim()).filter(Boolean).join('\n');
    }
    return { success: true, jd: jd.slice(0, 2000) };
  }

  async function goChat(job, greeting, cfg) {
    let btn = await waitFor(SELECTORS.jobs.immediateChatBtn, 5000);
    if (!btn) {
      const all = document.querySelectorAll('a, button, span');
      for (const el of all) { const tx = (el.textContent || '').trim(); if (tx === '立即沟通' || tx === '继续沟通') { btn = el; break; } }
    }
    if (!btn) {
      const card = findCard(job);
      if (card) { card.click(); await sleep(1200); btn = await waitFor(SELECTORS.jobs.immediateChatBtn, 4000); }
    }
    if (!btn) return { success: false, error: '未找到立即沟通按钮' };
    btn.click();
    await sleep(1500);
    const go = await waitForText(['继续沟通'], 4000);
    if (go) { go.click(); return { success: true, navigated: true }; }
    return { success: true, navigated: false };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'SCRAPE') {
      scrape(msg.count || 20, msg.welfareKeywords).then(jobs => sendResponse({ success: true, jobs })).catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }
    if (msg.type === 'OPEN_JD') {
      openJD(msg.job).then(r => sendResponse(r)).catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }
    if (msg.type === 'SCROLL_SIMULATE') {
      // 模拟真人浏览：慢速滚动页面
      const duration = msg.duration || 15;
      const steps = Math.max(1, Math.floor(duration / 3));
      const scrollStep = document.body.scrollHeight / steps;
      let step = 0;
      const iv = setInterval(() => {
        step++;
        window.scrollTo(0, Math.min(scrollStep * step, document.body.scrollHeight));
        if (step >= steps) { clearInterval(iv); sendResponse({ success: true }); }
      }, 3000);
      return true;
    }
    if (msg.type === 'GO_CHAT') {
      goChat(msg.job, msg.greeting, msg.cfg).then(r => sendResponse(r)).catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }
  });
})();
