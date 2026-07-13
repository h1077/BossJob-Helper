// ===== 聊天页 content script：发图片简历 + 发招呼语 + 发附件简历 =====
(function () {
  if (window.__bossExtChat) return;
  window.__bossExtChat = true;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const INPUT_SELS = ['div#chat-input', '#chat-input', 'div.chat-input', '.chat-input[contenteditable]', '[contenteditable="true"]', 'textarea.input-area', 'textarea[placeholder]', 'textarea'];
  const SEND_SELS = ['button.btn-send', '.btn-send', 'button[class*="send"]'];
  const IMG_SELS = ['.btn-sendimg input[type=file]', '.toolbar input[type=file]', 'input[type=file]'];

  function findVisible(selList) {
    for (const sel of selList) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el && (el.offsetParent !== null || getComputedStyle(el).display !== 'none')) return el;
      }
    }
    return null;
  }

  async function waitVisible(selList, timeout) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const el = findVisible(selList);
      if (el) return el;
      await sleep(250);
    }
    return null;
  }

  function dataURLtoFile(dataUrl, name) {
    if (!dataUrl || !dataUrl.includes(',')) return null;
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const bin = atob(parts[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name || 'resume.png', { type: mime });
  }

  async function sendImage(image) {
    if (!image) return true;
    const input = findVisible(IMG_SELS) || document.querySelector('input[type=file]');
    if (!input) return false;
    const file = dataURLtoFile(image, 'resume.png');
    if (!file) return false;
    const dt = new DataTransfer();
    dt.items.add(file);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files').set;
    setter.call(input, dt.files);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(2500);
    return true;
  }

  function inputText(el) {
    return (el.isContentEditable || el.getAttribute('contenteditable') === 'true') ? (el.textContent || '') : (el.value || '');
  }

  function pressEnter(el) {
    const opt = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent('keydown', opt));
    el.dispatchEvent(new KeyboardEvent('keypress', opt));
    el.dispatchEvent(new KeyboardEvent('keyup', opt));
  }

  async function sendText(text) {
    const input = await waitVisible(INPUT_SELS, 10000);
    if (!input) return { ok: false, err: '未找到输入框' };
    input.focus();
    await sleep(300);
    const editable = input.isContentEditable || input.getAttribute('contenteditable') === 'true';
    if (editable) {
      input.textContent = text;
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    } else {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await sleep(700);
    if (!inputText(input).trim()) return { ok: false, err: '文字未填入输入框' };

    const before = document.querySelectorAll(SELECTORS.chat.messageSent).length;
    pressEnter(input);
    const btn = findVisible(SEND_SELS);
    if (btn && !btn.classList.contains('disabled') && !btn.disabled) btn.click();

    for (let i = 0; i < 12; i++) {
      await sleep(300);
      if (!inputText(input).trim()) return { ok: true };
      const after = document.querySelectorAll(SELECTORS.chat.messageSent).length;
      if (after > before) return { ok: true };
    }
    return { ok: false, err: '发送未确认' };
  }

  async function sendResume() {
    const btn = [...document.querySelectorAll(SELECTORS.chat.toolbarBtns)].find(el => el.textContent.trim() === '发简历');
    if (!btn) return { ok: false, err: '未找到发简历按钮' };
    if (btn.classList.contains('unable')) return { ok: false, err: '对方未回复，无法发送简历' };
    btn.click();
    await sleep(1500);
    const confirmBtn = document.querySelector('.btn-sure-v2');
    if (confirmBtn) { confirmBtn.click(); await sleep(1000); }
    return { ok: true };
  }

  async function sendMultipleImages(imageResumes) {
    if (!imageResumes || !imageResumes.length) return 0;
    const input = findVisible(IMG_SELS) || document.querySelector('input[type=file]');
    if (!input) return 0;
    let sent = 0;
    for (const resume of imageResumes) {
      if (!resume || !resume.data) continue;
      try {
        const file = dataURLtoFile(resume.data, resume.path || 'resume.png');
        if (!file) continue;
        const dt = new DataTransfer();
        dt.items.add(file);
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files').set;
        setter.call(input, dt.files);
        input.dispatchEvent(new Event('change', { bubbles: true }));
        sent++;
        await sleep(1200);
      } catch (e) { /* skip */ }
    }
    return sent;
  }

  async function sendAll(msg) {
    // 打开最近的会话（刚建联的在顶部）
    const items = document.querySelectorAll(SELECTORS.chat.userList);
    if (items.length > 0) { items[0].click(); await sleep(1600); }

    // 1. 发图片简历
    if (msg.useAutoSendImageResume && msg.imageResumes && msg.imageResumes.length) {
      await sendMultipleImages(msg.imageResumes);
      await sleep(800);
    }

    // 2. 发附件简历
    if (msg.useAutoSendResume) {
      await sendResume();
      await sleep(800);
    }

    // 3. 发招呼语
    if (msg.greeting) {
      const tr = await sendText(msg.greeting);
      if (!tr.ok) return { success: false, error: tr.err };
    }

    return { success: true };
  }

  // ── AI 自动回复（MutationObserver 监听新消息）──
  let autoReplyObserver = null;
  let lastProcessedText = '';

  async function setupAutoReply() {
    const cfg = await new Promise(res => {
      chrome.storage.local.get(['autoReply', 'aiApiKey', 'aiApiUrl', 'aiModel', 'aiRole'], res);
    });
    if (!cfg.autoReply || !cfg.aiApiKey) return;

    const chatList = document.querySelector('.chat-message .im-list') ||
      document.querySelector('[class*="chat-list"]') ||
      document.querySelector('[class*="message-list"]');
    if (!chatList) return;

    if (autoReplyObserver) autoReplyObserver.disconnect();

    autoReplyObserver = new MutationObserver(async (mutations) => {
      for (const m of mutations) {
        if (!m.addedNodes.length) continue;
        for (const node of m.addedNodes) {
          if (!node.classList || !node.classList.contains('item-friend')) continue;
          const text = (node.textContent || '').trim();
          if (!text || text === lastProcessedText) continue;
          lastProcessedText = text;

          // 生成 AI 回复
          try {
            const apiUrl = cfg.aiApiUrl || 'https://api.deepseek.com/v1/chat/completions';
            const model = cfg.aiModel || 'deepseek-chat';
            const sys = cfg.aiRole || '你是求职者，回复HR消息。要求：简短自然，40字以内，有来有往。';
            const resp = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.aiApiKey },
              body: JSON.stringify({ model, max_tokens: 150, temperature: 0.7, messages: [
                { role: 'system', content: sys },
                { role: 'user', content: 'HR说：' + text + '\n\n请回复：' }
              ]})
            });
            if (!resp.ok) return;
            const data = await resp.json();
            const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
            if (reply && reply.trim()) {
              await sendText(reply.trim());
            }
          } catch (e) { /* AI reply failed, skip */ }
        }
      }
    });

    autoReplyObserver.observe(chatList, { childList: true, subtree: true });
  }

  // 初始化自动回复（延迟等待页面加载）
  setTimeout(setupAutoReply, 5000);

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'SEND_ALL') {
      sendAll(msg).then(r => sendResponse(r)).catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }
  });
})();
