// ===== 搜索页 content script：收集岗位 + 读 JD + 建立联系 =====
(function () {
  if (window.__bossExtSearch) return;
  window.__bossExtSearch = true;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

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
    // 活跃时间
    let activeTime = '';
    const onlineTag = card.querySelector(SELECTORS.jobs.bossOnlineTag);
    if (onlineTag && onlineTag.textContent.trim() === '在线') activeTime = '在线';
    else {
      const atEl = card.querySelector(SELECTORS.jobs.bossActiveTime);
      activeTime = atEl ? atEl.textContent.trim() : '';
    }
    // HR 姓名 + 职级
    let hrName = '', hrTitle = '';
    const nameEl2 = card.querySelector('.boss-name, .name, [class*="boss-name"]');
    if (nameEl2) hrName = nameEl2.textContent.trim();
    const titleEl = card.querySelector('.boss-title, .title, [class*="boss-title"]');
    if (titleEl) hrTitle = titleEl.textContent.trim();
    return { id, name: nameEl ? nameEl.textContent.trim() : '未知', salary: salEl ? salEl.textContent.trim() : '', location: areaEl ? areaEl.textContent.trim() : '', tags, company, link, activeTime, hrName, hrTitle };
  }

  async function scrape(count, welfareKeywords) {
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
    // 点击 "继续沟通"（跳转聊天页）
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
    if (msg.type === 'GO_CHAT') {
      goChat(msg.job, msg.greeting, msg.cfg).then(r => sendResponse(r)).catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }
  });
})();
