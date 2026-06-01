  async function init() {
    try {

      const midnight = new Date();
      midnight.setDate(midnight.getDate() + 1);
      midnight.setHours(0, 0, 0, 0);
      setTimeout(() => {
        localStorage.removeItem(STORAGE.AI_COUNT);
        localStorage.removeItem(STORAGE.AI_DATE);
        localStorage.removeItem(STORAGE.LETTER);
      }, midnight - Date.now());
      UI.init();
      StatsManager.load();
      UI.updateStatsDisplay();
      document.body.style.position = "relative";
      const today = getToday();
      if (location.pathname.includes("/jobs")) {
        if (localStorage.getItem(STORAGE.LETTER) !== today) {
          letter.showLetterToUser();
          localStorage.setItem(STORAGE.LETTER, today);
        } else if (localStorage.getItem(STORAGE.GUIDE) !== "true") {
          guide.showGuideToUser();
          localStorage.setItem(STORAGE.GUIDE, "true");
        }
        Core.log("欢迎使用AI-Boss海投助手，我将自动投递岗位！");
      } else if (location.pathname.includes("/chat")) {
        Core.log("欢迎使用AI-Boss海投助手，我将自动发送简历！");
      } else if (location.pathname.includes("/notify-set")) {
        Core.log("欢迎使用AI-Boss海投助手，我将自动启用招呼语功能！");
        Core.handleGreetSettingsPage();
      } else {
        Core.log("当前页面暂不支持，请移步至职位页面！");
      }
    } catch (error) {
      console.error("初始化失败:", error);
      if (UI.notify) UI.notify("初始化失败", "error");
    }
  }

  window.addEventListener("load", init);

  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // 评论功能已移除
    }
  }).observe(document, { subtree: true, childList: true });

  function addGreetingItem() {
    if (!state.settings.greetingsList) {
      state.settings.greetingsList = [];
    }

    const hasEmpty = state.settings.greetingsList.some(
      (greeting) => !greeting.content.trim()
    );

    if (hasEmpty) {
      return;
    }

    const newGreeting = {
      id: Date.now().toString(),
      content: "",
    };

    state.settings.greetingsList.push(newGreeting);
    StatePersistence.saveState();
    renderGreetingsList();
  }

  function renderGreetingsList() {
    const greetingsList = document.getElementById("greetings-list");
    if (!greetingsList) return;

    greetingsList.innerHTML = "";

    if (
      !state.settings.greetingsList ||
      state.settings.greetingsList.length === 0
    ) {
      greetingsList.innerHTML =
        '<div style="color: #6b7280; text-align: center; padding: 20px;">暂无自我介绍内容</div>';
      return;
    }

    state.settings.greetingsList.forEach((greeting, index) => {
      const greetingElement = document.createElement("div");
      greetingElement.className = "greeting-item";
      greetingElement.style.cssText = `
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 6px;
        margin-bottom: 6px;
        background: #f9fafb;
      `;

      greetingElement.innerHTML = `
        <div style="display: flex; gap: 8px; align-items: center;">
          <span style="color: #6b7280; font-size: 12px; min-width: 20px;">${index + 1}.</span>
          <div style="flex: 1;">
            <input type="text" class="greeting-input" data-id="${greeting.id}" value="${greeting.content}" placeholder="输入自我介绍内容" style="
              width: 100%;
              padding: 4px 6px;
              border: 1px solid #d1d5db;
              border-radius: 3px;
              font-size: 13px;
            ">
          </div>
          <button class="delete-greeting-btn" data-id="${greeting.id}" style="
            padding: 3px 6px;
            border: 1px solid #ef4444;
            background: #fef2f2;
            color: #dc2626;
            border-radius: 3px;
            font-size: 11px;
            cursor: pointer;
            white-space: nowrap;
          ">删除</button>
        </div>
      `;

      greetingsList.appendChild(greetingElement);
    });

    attachGreetingEventListeners();
  }

  function attachGreetingEventListeners() {
    document.querySelectorAll(".delete-greeting-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const greetingId = e.target.dataset.id;
        state.settings.greetingsList = state.settings.greetingsList.filter(
          (g) => g.id !== greetingId
        );
        StatePersistence.saveState();
        renderGreetingsList();
      });
    });

    document.querySelectorAll(".greeting-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const greetingId = e.target.dataset.id;
        const greeting = state.settings.greetingsList.find(
          (g) => g.id === greetingId
        );
        if (greeting) {
          greeting.content = e.target.value;
          StatePersistence.saveState();
        }
      });
    });
  }

  function loadGreetings() {
    if (!state.settings.greetingsList) {
      state.settings.greetingsList = [];
    }
    renderGreetingsList();
  }

  function loadSettingsIntoUI() {
    const aiRoleInput = document.getElementById("ai-role-input");
    if (aiRoleInput) {
      aiRoleInput.value = settings.ai.role;
    }

    const autoReplyInput = document.querySelector(
      "#toggle-auto-reply-mode input"
    );
    if (autoReplyInput) {
      autoReplyInput.checked = settings.autoReply;
    }

    const autoSendResumeInput = document.querySelector(
      "#toggle-auto-send-resume input"
    );
    if (autoSendResumeInput) {
      autoSendResumeInput.checked = settings.useAutoSendResume;
    }

    const excludeHeadhuntersInput = document.querySelector(
      "#toggle-exclude-headhunters input"
    );
    if (excludeHeadhuntersInput) {
      excludeHeadhuntersInput.checked = settings.excludeHeadhunters;
    }

    const autoSendImageResumeInput = document.querySelector(
      "#toggle-auto-send-image-resume input"
    );
    if (autoSendImageResumeInput) {
      autoSendImageResumeInput.checked = settings.useAutoSendImageResume;
    }

    loadGreetings();
  }
})();

