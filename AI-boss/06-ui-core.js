  const UI = {
    PAGE_TYPES: {
      JOB_LIST: "jobList",
      CHAT: "chat",
    },

    currentPageType: null,

    init() {
      this.currentPageType = location.pathname.includes("/chat")
        ? this.PAGE_TYPES.CHAT
        : this.PAGE_TYPES.JOB_LIST;
      this._applyTheme();
      this.createControlPanel();
      this.createMiniIcon();

      this.setupJobCardClickListener();
    },

    setupJobCardClickListener() {
      // 评论功能已移除
    },

    createControlPanel() {
      if (document.getElementById("boss-pro-panel")) {
        document.getElementById("boss-pro-panel").remove();
      }

      elements.panel = this._createPanel();

      const header = this._createHeader();
      const controls = this._createPageControls();
      elements.log = this._createLogger();
      const footer = this._createFooter();

      elements.panel.append(header, controls, elements.log, footer);
      document.body.appendChild(elements.panel);
      this._makeDraggable(elements.panel);
    },

    _applyTheme() {
      CONFIG.COLORS =
        this.currentPageType === this.PAGE_TYPES.JOB_LIST
          ? this.THEMES.JOB_LIST
          : this.THEMES.CHAT;

      document.documentElement.style.setProperty(
        "--primary-color",
        CONFIG.COLORS.primary
      );
      document.documentElement.style.setProperty(
        "--secondary-color",
        CONFIG.COLORS.secondary
      );
      document.documentElement.style.setProperty(
        "--accent-color",
        CONFIG.COLORS.accent
      );
      document.documentElement.style.setProperty(
        "--neutral-color",
        CONFIG.COLORS.neutral
      );
    },

    THEMES: {
      JOB_LIST: {
        primary: "#4285f4",
        secondary: "#f5f7fa",
        accent: "#e8f0fe",
        neutral: "#6b7280",
      },
      CHAT: {
        primary: "#34a853",
        secondary: "#f0fdf4",
        accent: "#dcfce7",
        neutral: "#6b7280",
      },
    },

    _createPanel() {
      const panel = document.createElement("div");
      panel.id = "boss-pro-panel";
      panel.className =
        this.currentPageType === this.PAGE_TYPES.JOB_LIST
          ? "boss-joblist-panel"
          : "boss-chat-panel";

      const baseStyles = `
            position: fixed;
            top: 36px;
            right: 24px;
            width: clamp(300px, 80vw, 400px);
            border-radius: 12px;
            padding: 12px;
            font-family: 'Segoe UI', system-ui, sans-serif;
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            transition: all 0.3s ease;
            background: #ffffff;
            box-shadow: 0 10px 25px rgba(var(--primary-rgb), 0.15);
            border: 1px solid var(--accent-color);
            cursor: default;
        `;

      panel.style.cssText = baseStyles;

      const rgbColor = this._hexToRgb(CONFIG.COLORS.primary);
      document.documentElement.style.setProperty("--primary-rgb", rgbColor);

      return panel;
    },

    _createHeader() {
      const header = document.createElement("div");
      header.className =
        this.currentPageType === this.PAGE_TYPES.JOB_LIST
          ? "boss-header"
          : "boss-chat-header";

      header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 10px 15px;
            margin-bottom: 15px;
            border-bottom: 1px solid var(--accent-color);
        `;

      const title = this._createTitle();

      const buttonContainer = document.createElement("div");
      buttonContainer.style.cssText = `
            display: flex;
            gap: 8px;
        `;

      const buttonTitles =
        this.currentPageType === this.PAGE_TYPES.JOB_LIST
          ? {
            ai: "AI配置",
            settings: "插件设置",
            close: "最小化海投面板",
          }
          : {
            ai: "AI配置",
            settings: "海投设置",
            close: "最小化聊天面板",
          };

      // AI配置按钮图标（使用机器人/AI图标）
      const aiConfigIcon = `<svg t="1767250169245" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5617" width="200" height="200"><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64z m0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z" fill="#4285f4"/><path d="M512 540m-80 0a80 80 0 1 0 160 0 80 80 0 1 0-160 0Z" fill="#4285f4"/><path d="M512 300c-26.5 0-48 21.5-48 48v96c0 26.5 21.5 48 48 48s48-21.5 48-48v-96c0-26.5-21.5-48-48-48zM300 512c0-26.5-21.5-48-48-48h-96c-26.5 0-48 21.5-48 48s21.5 48 48 48h96c26.5 0 48-21.5 48-48zM512 724c-26.5 0-48 21.5-48 48v96c0 26.5 21.5 48 48 48s48-21.5 48-48v-96c0-26.5-21.5-48-48-48zM868 464h-96c-26.5 0-48 21.5-48 48s21.5 48 48 48h96c26.5 0 48-21.5 48-48s-21.5-48-48-48z" fill="#4285f4"/></svg>`;
      
      const aiConfigBtn = this._createIconButton(
        aiConfigIcon,
        () => {
          showActivationDialog();
        },
        buttonTitles.ai
      );

      aiConfigBtn.style.color = "#fff";
      aiConfigBtn.title = "AI配置";

      const settingsBtn = this._createIconButton(
        "⚙",
        () => {
          showSettingsDialog();
        },
        buttonTitles.settings
      );

      const closeBtn = this._createIconButton(
        "✕",
        () => {
          state.isMinimized = true;
          elements.panel.style.transform = "translateY(160%)";
          elements.miniIcon.style.display = "flex";
        },
        buttonTitles.close
      );

      // 联系作者按钮
      const contactBtn = this._createIconButton(
        "📱",
        () => {
          this._showContactDialog();
        },
        "联系作者"
      );
      contactBtn.title = "联系作者";

      buttonContainer.append(aiConfigBtn, settingsBtn, contactBtn, closeBtn);
      header.append(title, buttonContainer);
      return header;
    },

    _createTitle() {
      const title = document.createElement("div");
      title.style.display = "flex";
      title.style.alignItems = "center";
      title.style.gap = "10px";

      const customSvg = `
        <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" 
            style="width: 100%; height: 100%; fill: white;">
            <path d="M896 256H640V160c0-35.3-28.7-64-64-64H448c-35.3 0-64 28.7-64 64v96H128c-35.3 0-64 28.7-64 64v512c0 35.3 28.7 64 64 64h768c35.3 0 64-28.7 64-64V320c0-35.3-28.7-64-64-64zM448 160h128v96H448V160zm448 672H128V320h768v512z" />
            <path d="M512 480c-70.7 0-128 57.3-128 128s57.3 128 128 128 128-57.3 128-128-57.3-128-128-128zm0 192c-35.3 0-64-28.7-64-64s28.7-64 64-64 64 28.7 64 64-28.7 64-64 64z" />
        </svg>
    `;

      const titleConfig =
        this.currentPageType === this.PAGE_TYPES.JOB_LIST
          ? {
            main: `<span style="color:var(--primary-color);">AI</span>-Boss海投助手`,
            sub: "高效求职 · 智能匹配",
          }
          : {
            main: `<span style="color:var(--primary-color);">AI</span>-Boss智能聊天`,
            sub: "智能对话 · 高效沟通",
          };

      title.innerHTML = `
        <div style="
            width: 40px;
            height: 40px;
            background: var(--primary-color);
            border-radius: 10px;
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
            font-weight: bold;
            box-shadow: 0 2px 8px rgba(var(--primary-rgb), 0.3);
        ">
            ${customSvg}
        </div>
        <div>
            <h3 style="
                margin: 0;
                color: #2c3e50;
                font-weight: 600;
                font-size: 1.2rem;
            ">
                ${titleConfig.main}
            </h3>
            <span style="
                font-size:0.8em;
                color:var(--neutral-color);
            ">
                ${titleConfig.sub}
            </span>
        </div>
    `;

      return title;
    },

    _createPageControls() {
      if (this.currentPageType === this.PAGE_TYPES.JOB_LIST) {
        return this._createJobListControls();
      } else {
        return this._createChatControls();
      }
    },

    _createJobListControls() {
      const container = document.createElement("div");
      container.className = "boss-joblist-controls";
      container.style.marginBottom = "15px";
      container.style.padding = "0 10px";

      const filterContainer = this._createFilterContainer();

      container.append(filterContainer);
      return container;
    },

    _createChatControls() {
      const container = document.createElement("div");
      container.className = "boss-chat-controls";
      container.style.cssText = `
            background: var(--secondary-color);
            border-radius: 12px;
            padding: 15px;
            margin-left: 10px;
            margin-right: 10px;
            margin-bottom: 15px;
        `;

      const configRow = document.createElement("div");
      configRow.style.cssText = `
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        `;

      const communicationIncludeCol = this._createInputControl(
        "沟通岗位包含：",
        "communication-include",
        "如：技术,产品,设计"
      );

      const communicationModeCol = this._createSelectControl(
        "沟通模式：",
        "communication-mode-selector",
        [
          { value: "new-only", text: "仅新消息" },
          { value: "auto", text: "自动轮询" },
        ]
      );

      elements.communicationIncludeInput =
        communicationIncludeCol.querySelector("input");
      elements.communicationModeSelector =
        communicationModeCol.querySelector("select");
      configRow.append(communicationIncludeCol, communicationModeCol);

      elements.communicationModeSelector.addEventListener("change", (e) => {
        settings.communicationMode = e.target.value;
        saveSettings();
      });

      elements.communicationIncludeInput.addEventListener("input", (e) => {
        settings.communicationIncludeKeywords = e.target.value;
        saveSettings();
      });

      elements.controlBtn = this._createTextButton(
        "开始智能聊天",
        "var(--primary-color)",
        () => {
          toggleChatProcess();
        }
      );

      container.append(configRow, elements.controlBtn);
      return container;
    },

    _createFilterContainer() {
      const filterContainer = document.createElement("div");
      filterContainer.style.cssText = `
            background: var(--secondary-color);
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 0px;
        `;

      const filterRow = document.createElement("div");
      filterRow.style.cssText = `
            display: flex;
            gap: 10px;
            margin-bottom: 12px;
        `;

      const includeFilterCol = this._createInputControl(
        "职位名包含：",
        "include-filter",
        "如：前端,开发"
      );
      const locationFilterCol = this._createInputControl(
        "工作地包含：",
        "location-filter",
        "如：杭州,滨江"
      );

      elements.includeInput = includeFilterCol.querySelector("input");
      elements.locationInput = locationFilterCol.querySelector("input");

      filterRow.append(includeFilterCol, locationFilterCol);

      elements.controlBtn = this._createTextButton(
        "启动海投",
        "var(--primary-color)",
        () => {
          toggleProcess();
        }
      );

      filterContainer.append(filterRow, elements.controlBtn);
      return filterContainer;
    },

    _createInputControl(labelText, id, placeholder) {
      const controlCol = document.createElement("div");
      controlCol.style.cssText = "flex: 1;";

      const label = document.createElement("label");
      label.textContent = labelText;
      label.style.cssText =
        "display:block; margin-bottom:5px; font-weight: 500; color: #333; font-size: 0.9rem;";

      const input = document.createElement("input");
      input.id = id;
      input.placeholder = placeholder;
      input.style.cssText = `
            width: 100%;
            padding: 8px 10px;
            border-radius: 8px;
            border: 1px solid #d1d5db;
            font-size: 14px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            transition: all 0.2s ease;
        `;

      controlCol.append(label, input);
      return controlCol;
    },

    _createSelectControl(labelText, id, options) {
      const controlCol = document.createElement("div");
      controlCol.style.cssText = "flex: 1;";

      const label = document.createElement("label");
      label.textContent = labelText;
      label.style.cssText =
        "display:block; margin-bottom:5px; font-weight: 500; color: #333; font-size: 0.9rem;";

      const select = document.createElement("select");
      select.id = id;
      select.style.cssText = `
            width: 100%;
            padding: 8px 10px;
            border-radius: 8px;
            border: 1px solid #d1d5db;
            font-size: 14px;
            background: white;
            color: #333;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            transition: all 0.2s ease;
        `;

      options.forEach((option) => {
        const opt = document.createElement("option");
        opt.value = option.value;
        opt.textContent = option.text;
        select.appendChild(opt);
      });

      controlCol.append(label, select);
      return controlCol;
    },

    _createLogger() {
      const log = document.createElement("div");
      log.id = "pro-log";
      log.className =
        this.currentPageType === this.PAGE_TYPES.JOB_LIST
          ? "boss-joblist-log"
          : "boss-chat-log";

      const height =
        this.currentPageType === this.PAGE_TYPES.JOB_LIST ? "260px" : "260px";

      log.style.cssText = `
            height: ${height};
            overflow-y: auto;
            background: var(--secondary-color);
            border-radius: 12px;
            padding: 12px;
            font-size: 13px;
            line-height: 1.5;
            margin-bottom: 15px;
            margin-left: 10px;
            margin-right: 10px;
            transition: all 0.3s ease;
            user-select: text;
            scrollbar-width: thin;
            scrollbar-color: var(--primary-color) var(--secondary-color);
        `;

      log.innerHTML += `
            <style>
                #pro-log::-webkit-scrollbar {
                    width: 6px;
                }
                #pro-log::-webkit-scrollbar-track {
                    background: var(--secondary-color);
                    border-radius: 4px;
                }
                #pro-log::-webkit-scrollbar-thumb {
                    background-color: var(--primary-color);
                    border-radius: 4px;
                }
            </style>
        `;

      return log;
    },

    _createFooter() {
      const footer = document.createElement("div");
      footer.className =
        this.currentPageType === this.PAGE_TYPES.JOB_LIST
          ? "boss-joblist-footer"
          : "boss-chat-footer";

      footer.style.cssText = `
            text-align: center;
            font-size: 0.8em;
            color: var(--neutral-color);
            padding-top: 15px;
            border-top: 1px solid var(--accent-color);
            margin-top: auto;
            padding: 0px;
        `;

      const statsContainer = document.createElement("div");
      statsContainer.id = "boss-stats-container";
      statsContainer.style.cssText = `
            display: flex;
            justify-content: space-around;
            margin-bottom: 12px;
            gap: 6px;
        `;

      const statItems = [
        { key: "greetsSent", label: "打招呼", icon: "👋" },
        { key: "hrReplies", label: "HR回复", icon: "💬" },
        { key: "interviewInvites", label: "面试邀约", icon: "🎯" },
      ];

      statItems.forEach((item) => {
        const statEl = document.createElement("div");
        statEl.id = `stat-${item.key}`;
        statEl.style.cssText = `
            flex: 1;
            text-align: center;
            padding: 6px 2px;
            background: var(--secondary-color);
            border-radius: 8px;
        `;
        statEl.innerHTML = `
            <div style="font-size: 16px;">${item.icon}</div>
            <div style="font-size: 18px; font-weight: 700; color: var(--primary-color);">0</div>
            <div style="font-size: 10px; color: var(--neutral-color);">${item.label}</div>
        `;
        statsContainer.appendChild(statEl);
      });

      footer.append(
        statsContainer,
        document.createTextNode("© 2026 小胡版AI-boss海投助手 · Based on Yangshengzhou's open source project · AGPL-3.0-or-later")
      );
      return footer;
    },

    updateStatsDisplay() {
      const mapping = {
        greetsSent: "stat-greetsSent",
        hrReplies: "stat-hrReplies",
        interviewInvites: "stat-interviewInvites",
      };
      Object.entries(mapping).forEach(([key, elId]) => {
        const el = document.getElementById(elId);
        if (el) {
          const countEl = el.querySelector("div:nth-child(2)");
          if (countEl) countEl.textContent = state.stats[key] || 0;
        }
      });
    },

    _createTextButton(text, bgColor, onClick) {
      const btn = document.createElement("button");
      btn.className = "boss-btn";
      btn.textContent = text;
      btn.style.cssText = `
            width: 100%;
            padding: 10px 16px;
            background: ${bgColor};
            color: #fff;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-size: 15px;
            font-weight: 500;
            transition: all 0.3s ease;
            display: flex;
            justify-content: center;
            align-items: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            transform: translateY(0px);
            margin: 0 auto;
        `;

      this._addButtonHoverEffects(btn);
      btn.addEventListener("click", onClick);

      return btn;
    },

    _createIconButton(icon, onClick, title) {
      const btn = document.createElement("button");
      btn.className = "boss-icon-btn";
      btn.innerHTML = icon;
      btn.title = title;

      btn.style.cssText = `
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: none;
            background: ${this.currentPageType === this.PAGE_TYPES.JOB_LIST
          ? "var(--accent-color)"
          : "var(--accent-color)"
        };
            cursor: pointer;
            font-size: 16px;
            transition: all 0.2s ease;
            display: flex;
            justify-content: center;
            align-items: center;
            color: var(--primary-color);
            overflow: hidden;
            opacity: 1;
        `;

      if (icon.includes("<svg")) {
        btn.style.padding = "4px";
      }

      // 添加点击事件
      btn.addEventListener("click", onClick);

      // 保存 SVG 的原始 fill 颜色
      let originalSvgFill = null;
      if (icon.includes("<svg")) {
        const svgElement = btn.querySelector("svg");
        if (svgElement) {
          const pathElement = svgElement.querySelector("path");
          if (pathElement) {
            originalSvgFill = pathElement.getAttribute("fill");
          }
        }
      }

      btn.addEventListener("mouseenter", () => {
        btn.style.backgroundColor = "var(--primary-color)";
        btn.style.color = "#fff";
        btn.style.transform = "scale(1.1)";

        if (icon.includes("<svg")) {
          const svgElement = btn.querySelector("svg");
          if (svgElement) {
            const pathElement = svgElement.querySelector("path");
            if (pathElement) {
              pathElement.setAttribute("fill", "#fff");
            }
          }
        }
      });

      btn.addEventListener("mouseleave", () => {
        btn.style.backgroundColor =
          this.currentPageType === this.PAGE_TYPES.JOB_LIST
            ? "var(--accent-color)"
            : "var(--accent-color)";
        btn.style.color = "var(--primary-color)";
        btn.style.transform = "scale(1)";

        // 如果按钮包含 SVG，恢复 SVG 的原始颜色
        if (icon.includes("<svg") && originalSvgFill) {
          const svgElement = btn.querySelector("svg");
          if (svgElement) {
            const pathElement = svgElement.querySelector("path");
            if (pathElement) {
              pathElement.setAttribute("fill", originalSvgFill);
            }
          }
        }
      });

      return btn;
    },

    _addButtonHoverEffects(btn) {
      btn.addEventListener("mouseenter", () => {
        btn.style.boxShadow = `0 6px 15px rgba(var(--primary-rgb), 0.3)`;
      });

      btn.addEventListener("mouseleave", () => {
        btn.style.boxShadow = "0 4px 10px rgba(0,0,0,0.1)";
      });
    },

    _showContactDialog() {
      // 创建遮罩层
      const overlay = document.createElement("div");
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 2147483647;
        display: flex;
        justify-content: center;
        align-items: center;
      `;

      // 创建对话框
      const dialog = document.createElement("div");
      dialog.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        animation: fadeInUp 0.3s ease-out;
      `;

      dialog.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 48px; margin-bottom: 10px;">👋</div>
          <h3 style="margin: 0; color: #333; font-size: 20px;">联系作者</h3>
          <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">有问题或有更好的想法欢迎进群反馈</p>
        </div>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <div style="font-size: 14px; color: #666; margin-bottom: 8px;">抖音主页：</div>
          <a href="https://v.douyin.com/2E13eMjgAeU/" 
             target="_blank" 
             style="color: #4285f4; text-decoration: none; font-size: 14px; word-break: break-all;">
            点击访问小胡的抖音主页
          </a>
        </div>
        <button id="contact-close-btn" style="
          width: 100%;
          padding: 12px;
          background: #4285f4;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.3s;
        ">关闭</button>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      // 关闭按钮事件
      dialog.querySelector("#contact-close-btn").addEventListener("click", () => {
        overlay.remove();
      });

      // 点击遮罩关闭
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          overlay.remove();
        }
      });
    },

    _makeDraggable(panel) {
      const header = panel.querySelector(".boss-header, .boss-chat-header");

      if (!header) return;

      header.style.cursor = "move";

      let isDragging = false;
      let startX = 0,
        startY = 0;
      let initialX = panel.offsetLeft,
        initialY = panel.offsetTop;

      header.addEventListener("mousedown", (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = panel.offsetLeft;
        initialY = panel.offsetTop;
        panel.style.transition = "none";
        panel.style.zIndex = "2147483647";
      });

      document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        panel.style.left = `${initialX + dx}px`;
        panel.style.top = `${initialY + dy}px`;
        panel.style.right = "auto";
      });

      document.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          panel.style.transition = "all 0.3s ease";
          panel.style.zIndex = "2147483646";
        }
      });
    },

    createMiniIcon() {
      elements.miniIcon = document.createElement("div");
      elements.miniIcon.style.cssText = `
        width: ${CONFIG.MINI_ICON_SIZE || 48}px;
        height: ${CONFIG.MINI_ICON_SIZE || 48}px;
        position: fixed;
        bottom: 40px;
        left: 40px;
        background: var(--primary-color);
        border-radius: 50%;
        box-shadow: 0 6px 16px rgba(var(--primary-rgb), 0.4);
        cursor: pointer;
        display: none;
        justify-content: center;
        align-items: center;
        color: #fff;
        z-index: 2147483647;
        transition: all 0.3s ease;
        overflow: hidden;

    `;

      const customSvg = `
        <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" 
            style="width: 100%; height: 100%; fill: white;">
            <path d="M512 116.032a160 160 0 0 1 52.224 311.232v259.008c118.144-22.272 207.552-121.088 207.552-239.36 0-25.152 21.568-45.568 48.128-45.568 26.624 0 48.128 20.416 48.128 45.632 0 184.832-158.848 335.232-354.048 335.232S160 631.808 160 446.976c0-25.152 21.568-45.632 48.128-45.632 26.624 0 48.128 20.48 48.128 45.632 0 118.144 89.088 216.96 206.976 239.296V428.416A160.064 160.064 0 0 1 512 116.032z m0 96a64 64 0 1 0 0 128 64 64 0 0 0 0-128z m-36.672 668.48l-21.888-19.584a17.92 17.92 0 0 0-24.64 0l-21.952 19.584a56.32 56.32 0 0 1-77.504 0l-21.952-19.584a17.92 17.92 0 0 0-24.64 0l-28.288 25.6c-9.6 8.704-23.36 6.4-30.72-4.992a29.696 29.696 0 0 1 4.16-36.672l28.352-25.6a56.32 56.32 0 0 1 77.568 0l21.888 19.584a17.92 17.92 0 0 0 24.704 0l21.824-19.52a56.32 56.32 0 0 1 77.568 0l21.888 19.52a17.92 17.92 0 0 0 24.64 0l21.952-19.52a56.32 56.32 0 0 1 77.504 0l21.952 19.52a17.92 17.92 0 0 0 24.64 0l21.824-19.52a56.32 56.32 0 0 1 77.632 0l21.824 19.52c9.664 8.704 11.52 25.152 4.224 36.672-7.296 11.52-21.12 13.696-30.72 4.992l-21.888-19.584a17.92 17.92 0 0 0-24.64 0l-21.888 19.584a56.32 56.32 0 0 1-77.568 0l-21.888-19.584a17.92 17.92 0 0 0-24.64 0l-21.888 19.584a57.408 57.408 0 0 1-38.656 15.488 58.176 58.176 0 0 1-38.784-15.488z" />
        </svg>
    `;

      elements.miniIcon.innerHTML = customSvg;

      elements.miniIcon.addEventListener("mouseenter", () => {
        elements.miniIcon.style.transform = "scale(1.1)";
        elements.miniIcon.style.boxShadow = `0 8px 20px rgba(var(--primary-rgb), 0.5)`;
      });

      elements.miniIcon.addEventListener("mouseleave", () => {
        elements.miniIcon.style.transform = "scale(1)";
        elements.miniIcon.style.boxShadow = `0 6px 16px rgba(var(--primary-rgb), 0.4)`;
      });

      elements.miniIcon.addEventListener("click", () => {
        state.isMinimized = false;
        elements.panel.style.transform = "translateY(0)";
        elements.miniIcon.style.display = "none";
      });

      document.body.appendChild(elements.miniIcon);
    },

    _hexToRgb(hex) {
      hex = hex.replace("#", "");

      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      return `${r}, ${g}, ${b}`;
    },
  };

