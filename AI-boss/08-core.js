  const Core = {
    CONFIG,

    messageObserver: null,
    lastProcessedMessage: null,
    processingMessage: false,
    currentMonitoredHR: null,

    domCache: {},

    getCachedElement(selector, forceRefresh = false) {
      if (forceRefresh || !this.domCache[selector]) {
        this.domCache[selector] = document.querySelector(selector);
      }
      return this.domCache[selector];
    },

    getCachedElements(selector, forceRefresh = false) {
      if (forceRefresh || !this.domCache[selector + "[]"]) {
        this.domCache[selector + "[]"] = document.querySelectorAll(selector);
      }
      return this.domCache[selector + "[]"];
    },

    clearDomCache() {
      this.domCache = {};
    },

    async startProcessing() {
      if (location.pathname.includes("/jobs")) await this.autoScrollJobList();

      while (state.isRunning) {
        if (location.pathname.includes("/jobs")) {
          await this.processJobList();
        } else if (location.pathname.includes("/chat")) {
          // 根据通信模式选择处理方式
          if (settings.communicationMode === "new-only") {
            // 仅新消息模式：使用MutationObserver监听新消息
            await this.processNewMessagesOnly();
          } else {
            // 自动模式：轮询所有聊天窗口
            await this.pollAllChatWindows();
          }
        }
        await this.delay(this.getRandomInterval());
      }
    },

    async processNewMessagesOnly() {
      // 仅新消息模式：只处理最顶部（最新）的聊天窗口
      // 这是原作者的实现方式，不轮询所有窗口，只关注最新的消息
      const latestChatLi = await this.waitForElement(this.getLatestChatLi);
      if (!latestChatLi) {
        this.log("未找到聊天窗口");
        return;
      }

      const nameEl = latestChatLi.querySelector(".name-text");
      const companyEl = latestChatLi.querySelector(
        ".name-box span:nth-child(2)"
      );
      const name = (nameEl?.textContent || "未知").trim();
      const company = (companyEl?.textContent || "").trim();
      const hrKey = `${name}-${company}`.toLowerCase();

      // 如果当前正在监控同一个 HR，且 observer 正常，则查找下一个未处理的聊天
      if (this.currentMonitoredHR === hrKey && this.messageObserver) {
        const allChats = document.querySelectorAll('.friend-content, .friend-content.selected, li[role="listitem"]:has(.friend-content-warp)');
        let foundCurrent = false;
        for (const chat of allChats) {
          const cn = chat.querySelector(".name-text");
          const cc = chat.querySelector(".name-box span:nth-child(2)");
          const cKey = `${(cn?.textContent || "未知").trim()}-${(cc?.textContent || "").trim()}`.toLowerCase();
          if (cKey === hrKey) { foundCurrent = true; continue; }
          if (foundCurrent && cKey !== hrKey && !chat.classList.contains("last-clicked")) {
            this.currentMonitoredHR = null;
            if (this.messageObserver) { this.messageObserver.disconnect(); this.messageObserver = null; }
            await this.simulateClick(chat.querySelector(".figure") || chat);
            await this.delay(CONFIG.OPERATION_INTERVAL);
            break;
          }
        }
        return;
      }

      this.currentMonitoredHR = hrKey;
      this.resetMessageState();

      if (this.messageObserver) {
        this.messageObserver.disconnect();
        this.messageObserver = null;
      }

      // 检查关键词过滤
      if (
        settings.communicationIncludeKeywords &&
        settings.communicationIncludeKeywords.trim()
      ) {
        await this.simulateClick(latestChatLi.querySelector(".figure"));
        await this.delay(CONFIG.OPERATION_INTERVAL * 2);

        const positionName = this.getPositionName();
        const includeKeywords = settings.communicationIncludeKeywords
          .toLowerCase()
          .split(/[,]/)
          .map((kw) => kw.trim())
          .filter((kw) => kw.length > 0);

        const positionNameLower = positionName.toLowerCase();
        const isMatch = includeKeywords.some((keyword) =>
          positionNameLower.includes(keyword)
        );

        if (!isMatch) {
          this.log(`跳过岗位对话，不含关键词[${includeKeywords.join(", ")}]`);
          return;
        }
      }

      // 点击并处理
      if (!latestChatLi.classList.contains("last-clicked")) {
        await this.simulateClick(latestChatLi.querySelector(".figure"));
        latestChatLi.classList.add("last-clicked");

        await this.delay(CONFIG.OPERATION_INTERVAL);
        await HRInteractionManager.handleHRInteraction(hrKey);
      }

      // 设置消息监听
      await this.setupMessageObserver(hrKey);
      this.log(`正在监听新消息: ${hrKey}`);
    },

    async getCurrentHRName() {
      // 尝试多种选择器获取HR名称
      const selectors = [
        '.chat-header .name-text',
        '.chat-header .name',
        '.chat-title .name',
        '.chat-basic-info .name',
        '.header-name',
        '.user-name',
        '.friend-name',
        '.chat-user-name',
        '.name-box .name-text',
        '[class*="name"]'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.trim();
          if (text && text.length > 0 && text !== "未知") {
            return text;
          }
        }
      }
      return "未知";
    },

    async getCurrentHRCompany() {
      // 尝试多种选择器获取公司名称
      const selectors = [
        '.chat-header .company-name',
        '.chat-header .company',
        '.chat-title .company',
        '.chat-basic-info .company',
        '.company-name',
        '.user-company',
        '.friend-company',
        '.name-box span:nth-child(2)',
        '[class*="company"]'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.trim();
          if (text && text.length > 0) {
            return text;
          }
        }
      }
      return "";
    },

    async pollAllChatWindows() {
      // 先滚动加载所有聊天窗口
      await this.scrollToLoadAllChats();

      // 使用截图中的class选择器: friend-content
      const chatListItems = document.querySelectorAll('.friend-content, .friend-content.selected');
      if (chatListItems.length === 0) {
        this.log("未找到聊天列表，尝试其他选择器...");
        // 备用选择器
        const backupItems = document.querySelectorAll('ul[role="group"] li[role="listitem"], .user-list-item, .chat-list-item');
        if (backupItems.length === 0) {
          this.log("所有选择器都未找到聊天列表");
          return;
        }
      }

      this.log(`开始轮询 ${chatListItems.length} 个聊天窗口...`);

      for (let i = 0; i < chatListItems.length; i++) {
        if (!state.isRunning) break;

        const chatItem = chatListItems[i];
        
        // 从截图看，结构是: 陆女士 至简动力 招聘者
        // 尝试多种可能的选择器
        const nameEl = chatItem.querySelector(".name-text") || 
                      chatItem.querySelector(".name") ||
                      chatItem.querySelector("[class*='name']") ||
                      chatItem.querySelector("h3, h4, .title");
        
        const companyEl = chatItem.querySelector(".name-box span:nth-child(2)") ||
                         chatItem.querySelector(".company") ||
                         chatItem.querySelector("[class*='company']");
        
        const name = (nameEl?.textContent || "未知").trim();
        const company = (companyEl?.textContent || "").trim();
        const hrKey = `${name}-${company}`.toLowerCase();

        // 检查是否有未读消息 - 截图中没有显示未读标记的class，尝试常见class
        const unreadBadge = chatItem.querySelector(".unread-count, .badge, .message-count, .red-dot, .dot, .unread, [class*='unread']");
        const hasUnread = unreadBadge && unreadBadge.textContent.trim() !== "";

        // 检查最后一条消息预览（扩展选择器）
        const lastMsgSelectors = [
          ".last-msg-text", ".last-message", ".message-text", ".content-text",
          ".preview", ".msg-preview", ".last-msg", ".recent-msg", ".summary",
          ".conversation-preview", ".chat-preview",
          "[class*='message']", "[class*='content']", "[class*='preview']",
          "[class*='last']", "[class*='summary']",
        ];
        let lastMessageEl = null;
        for (const sel of lastMsgSelectors) {
          lastMessageEl = chatItem.querySelector(sel);
          if (lastMessageEl) break;
        }
        const lastMessage = lastMessageEl?.textContent?.trim() || "";

        // 获取岗位名称
        const positionEl = chatItem.querySelector(".position-name, .job-name, .position, [class*='position']");
        const positionName = positionEl?.textContent?.trim() || "";

        // 检查是否需要回复
        const shouldReply = await this.shouldReplyToChat(chatItem, hrKey, lastMessage);

        if (shouldReply) {
          this.log(`[${i + 1}/${chatListItems.length}] 需要回复: ${hrKey}`);

          // 点击整个chatItem进入聊天窗口
          this.log(`点击 ${hrKey} 的聊天窗口...`);
          await this.simulateClick(chatItem);
          await this.delay(2000);

          // 验证是否成功进入聊天
          const chatContainer = document.querySelector(".chat-message") ||
                               document.querySelector(".chat-container") ||
                               document.querySelector(".chat-box") ||
                               document.querySelector(".message-list");

          if (chatContainer) {
            this.log(`成功进入 ${hrKey} 的聊天窗口`);
            // 处理这个HR的消息
            await this.handleSingleChat(hrKey, positionName);
          } else {
            this.log(`未能进入 ${hrKey} 的聊天窗口，可能点击失败`);
          }

          // 返回聊天列表
          await this.delay(1000);
        } else {
          if (hasUnread) {
            this.log(`[${i + 1}/${chatListItems.length}] 有未读但无需回复: ${hrKey}`);
          }
        }

        await this.delay(500);
      }

      this.log("完成一轮聊天轮询");
    },

    async scrollToLoadAllChats() {
      // 找到聊天列表容器 - 使用截图中的class
      const userListContent = document.querySelector(".user-list-content") ||
                            document.querySelector(".chat-list") ||
                            document.querySelector('ul[role="group"]') ||
                            document.querySelector(".friend-list") ||
                            document.querySelector(".message-list");

      if (!userListContent) {
        this.log("未找到聊天列表容器");
        return;
      }

      this.log("正在加载更多聊天窗口...");

      let previousCount = 0;
      let sameCountTimes = 0;
      const maxAttempts = 10;

      for (let i = 0; i < maxAttempts; i++) {
        if (!state.isRunning) break;

        // 使用截图中的class: friend-content
        const currentItems = userListContent.querySelectorAll('.friend-content, .friend-content.selected');
        const currentCount = currentItems.length;

        this.log(`已加载 ${currentCount} 个聊天窗口...`);

        if (currentCount === previousCount) {
          sameCountTimes++;
          if (sameCountTimes >= 3) {
            this.log("聊天窗口加载完成");
            break;
          }
        } else {
          sameCountTimes = 0;
        }

        previousCount = currentCount;

        // 滚动到底部加载更多
        userListContent.scrollTo({
          top: userListContent.scrollHeight,
          behavior: 'smooth'
        });

        await this.delay(1000);
      }

      // 滚动回顶部
      userListContent.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      await this.delay(500);
    },

    async shouldReplyToChat(chatItem, hrKey, lastMessage) {
      // 检查是否已经处理过这个HR（5分钟内不再处理）
      if (state.hrInteractions.processedHRs.has(hrKey)) {
        const lastProcessed = state.hrInteractions.lastMessageTime?.[hrKey] || 0;
        const now = Date.now();
        if (now - lastProcessed < 5 * 60 * 1000) {
          return false;
        }
      }

      // 检查是否有未读消息标记（扩展选择器覆盖Boss直聘常见DOM）
      const unreadSelectors = [
        ".notice-badge", ".unread-count", ".badge", ".message-count",
        ".red-dot", ".dot", ".unread",
        "[class*='unread']", "[class*='badge']", "[class*='count']",
        ".conversation-unread", ".chat-unread", ".msg-unread",
        ".conversation-item .unread", ".red", "[class*='dot']",
        ".blue-dot", ".boss-badge",
      ];
      let unreadBadge = null;
      for (const sel of unreadSelectors) {
        unreadBadge = chatItem.querySelector(sel);
        if (unreadBadge && unreadBadge.textContent.trim()) break;
        if (unreadBadge && unreadBadge.offsetParent !== null) break;
        unreadBadge = null;
      }
      if (unreadBadge) {
        this.log(`${hrKey} 有未读标记`);
        return true;
      }

      // 检查是否有新消息提示（如"新"标记）
      const newBadge = chatItem.querySelector(".new-badge, .new-tag, [class*='new']");
      if (newBadge) {
        this.log(`${hrKey} 有新消息标记`);
        return true;
      }

      // 过滤掉系统消息和无意义内容
      const systemMsgs = ["[送达]", "[图片]", "[语音]", "[文件]", "[位置]", "[链接]", "[红包]", "交换手机号", "交换微信", "你好", "您好"];
      const isSystemMsg = systemMsgs.some(m => lastMessage.includes(m));

      if (lastMessage && lastMessage.length > 0 && !isSystemMsg) {
        // 检查是否已回复过这条消息
        const messageKey = `${hrKey}-${lastMessage.slice(0, 20)}`;
        if (this.repliedMessages && this.repliedMessages.has(messageKey)) {
          return false;
        }
        this.log(`${hrKey} 有新消息内容: ${lastMessage.slice(0, 20)}...`);
        return true;
      }

      return false;
    },

    async handleSingleChat(hrKey, positionName) {
      try {
        // 获取最后一条HR消息
        const lastMessage = await this.getLastFriendMessageText();
        if (!lastMessage) {
          this.log(`${hrKey}: 未找到HR消息`);
          return;
        }

        this.log(`${hrKey} 的最后消息: ${lastMessage.slice(0, 30)}...`);

        // 检查是否已经回复过这条消息
        const messageKey = `${hrKey}-${this.cleanMessage(lastMessage)}`;
        if (this.lastProcessedMessage === messageKey) {
          this.log(`${hrKey}: 已回复过此消息`);
          return;
        }

        // 生成个性化回复
        const replyText = await this.generatePersonalizedReply(lastMessage, positionName);
        if (!replyText) {
          this.log(`${hrKey}: 无法生成回复`);
          return;
        }

        // 发送回复
        const inputBox = await this.waitForElement("#chat-input");
        if (!inputBox) {
          this.log(`${hrKey}: 未找到输入框`);
          return;
        }

        inputBox.textContent = "";
        inputBox.focus();
        document.execCommand("insertText", false, replyText);
        await this.delay(500);

        const sendButton = document.querySelector(".btn-send");
        if (sendButton) {
          await this.simulateClick(sendButton);
          this.log(`已回复 ${hrKey}: ${replyText.slice(0, 30)}...`);

          // 记录已处理
          this.lastProcessedMessage = messageKey;
          if (!this.repliedMessages) {
            this.repliedMessages = new Set();
          }
          this.repliedMessages.add(messageKey);
          state.hrInteractions.processedHRs.add(hrKey);
          if (!state.hrInteractions.lastMessageTime) {
            state.hrInteractions.lastMessageTime = {};
          }
          state.hrInteractions.lastMessageTime[hrKey] = Date.now();
          StatePersistence.saveState();
        }

        // 如果HR提到简历，发送简历
        if (lastMessage.includes("简历") || lastMessage.includes("发送")) {
          await this.delay(1000);
          const sent = await HRInteractionManager.sendResume();
          if (sent) {
            this.log(`已向 ${hrKey} 发送简历`);
          }
        }

      } catch (error) {
        this.log(`处理 ${hrKey} 的聊天出错: ${error.message}`);
      }
    },

    async autoScrollJobList() {
      return new Promise((resolve) => {
        const cardSelector = "li.job-card-box";
        const maxHistory = 3;
        const waitTime = CONFIG.BASIC_INTERVAL;
        let cardCountHistory = [];
        let isStopped = false;

        const scrollStep = async () => {
          if (isStopped) return;

          window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: "smooth",
          });
          await this.delay(waitTime);

          const cards = document.querySelectorAll(cardSelector);
          const currentCount = cards.length;
          cardCountHistory.push(currentCount);

          if (cardCountHistory.length > maxHistory) cardCountHistory.shift();

          if (
            cardCountHistory.length === maxHistory &&
            new Set(cardCountHistory).size === 1
          ) {
            this.log("当前页面岗位加载完成，开始沟通");
            resolve(cards);
            return;
          }

          scrollStep();
        };

        scrollStep();

        this.stopAutoScroll = () => {
          isStopped = true;
          resolve(null);
        };
      });
    },

    async processJobList() {
      const activeStatusFilter = settings.recruiterActivityStatus;

      if (!state.jobList || state.jobList.length === 0) {
        const excludeHeadhunters = settings.excludeHeadhunters;
        
        // 先滚动页面加载更多职位
        await this.scrollToLoadMoreJobs();
        
        state.jobList = Array.from(
          document.querySelectorAll("li.job-card-box")
        ).filter((card) => {
          const title =
            card.querySelector(".job-name")?.textContent?.toLowerCase() || "";

          const addressText = (
            card.querySelector(".job-address-desc")?.textContent ||
            card.querySelector(".company-location")?.textContent ||
            card.querySelector(".job-area")?.textContent ||
            ""
          )
            .toLowerCase()
            .trim();
          const headhuntingElement = card.querySelector(".job-tag-icon");
          const altText = headhuntingElement ? headhuntingElement.alt : "";

          const includeMatch =
            state.includeKeywords.length === 0 ||
            state.includeKeywords.some((kw) => kw && title.includes(kw.trim()));

          const locationMatch =
            state.locationKeywords.length === 0 ||
            state.locationKeywords.some(
              (kw) => kw && addressText.includes(kw.trim())
            );

          const excludeHeadhunterMatch =
            !excludeHeadhunters || !altText.includes("猎头");

          return includeMatch && locationMatch && excludeHeadhunterMatch;
        });

        if (state.settings.resumeAnalysis) {
          const keywords = this.extractResumeKeywords();
          if (keywords && keywords.length > 0) {
            const before = state.jobList.length;
            state.jobList = state.jobList.filter(card => {
              const { score } = this.scoreJobMatch(card, keywords);
              card.setAttribute("data-match-score", score);
              return score >= CONFIG.MATCH.MIN_SCORE;
            });
            const after = state.jobList.length;
            this.log(
              `岗位匹配度预筛: ${before} 个岗位 -> ${after} 个` +
              (before > after ? `，跳过 ${before - after} 个低匹配岗位` : "")
            );
          }
        }

        if (!state.jobList.length) {
          this.log("没有符合条件的职位");
          toggleProcess();
          return;
        }

        this.log(`已加载 ${state.jobList.length} 个符合条件的职位`);
      }

      if (state.currentIndex >= state.jobList.length) {
        this.resetCycle();
        state.jobList = [];
        return;
      }

      const currentCard = state.jobList[state.currentIndex];
      currentCard.scrollIntoView({ behavior: "smooth", block: "center" });
      currentCard.click();

      await this.delay(this.getRandomInterval());

      state.customGreeting = null;
      const jdText = this.extractJobDetail();
      if (jdText && state.settings.resumeText) {
        this.log("正在生成针对此岗位的定制化打招呼...");
        const customGreeting = await this.generateCustomGreeting(jdText);
        if (customGreeting) {
          state.customGreeting = customGreeting;
          this.log(`已生成定制化打招呼: ${customGreeting.substring(0, 30)}...`);
        }
      }

      let activeTime = "未知";
      const onlineTag = document.querySelector(".boss-online-tag");
      if (onlineTag && onlineTag.textContent.trim() === "在线") {
        activeTime = "在线";
      } else {
        const activeTimeElement = document.querySelector(".boss-active-time");
        activeTime = activeTimeElement?.textContent?.trim() || "未知";
      }

      const isActiveStatusMatch =
        activeStatusFilter.includes("不限") ||
        activeStatusFilter.includes(activeTime);

      if (!isActiveStatusMatch) {
        this.log(`跳过: 招聘者状态 "${activeTime}"`);
        state.currentIndex++;
        return;
      }

      const includeLog = state.includeKeywords.length
        ? `职位名包含[${state.includeKeywords.join("、")}]`
        : "职位名不限";
      const locationLog = state.locationKeywords.length
        ? `工作地包含[${state.locationKeywords.join("、")}]`
        : "工作地不限";
      this.log(
        `正在沟通：${++state.currentIndex}/${state.jobList.length
        }，${includeLog}，${locationLog}，招聘者"${activeTime}"`
      );

      const chatBtn = document.querySelector("a.op-btn-chat");
      if (chatBtn) {
        const btnText = chatBtn.textContent.trim();
        if (btnText === "立即沟通") {
          chatBtn.click();
          await this.handleGreetingModal();
        }
      }
    },

    async handleGreetingModal() {
      await this.delay(CONFIG.OPERATION_INTERVAL * 4);

      const btn = [
        ...document.querySelectorAll(".default-btn.cancel-btn"),
      ].find((b) => b.textContent.trim() === "留在此页");

      if (btn) {
        btn.click();
        await this.delay(CONFIG.OPERATION_INTERVAL * 2);
      }
    },

    async handleChatPage() {
      const latestChatLi = await this.waitForElement(this.getLatestChatLi);
      if (!latestChatLi) return;

      const nameEl = latestChatLi.querySelector(".name-text");
      const companyEl = latestChatLi.querySelector(
        ".name-box span:nth-child(2)"
      );
      const name = (nameEl?.textContent || "未知").trim();
      const company = (companyEl?.textContent || "").trim();
      const hrKey = `${name}-${company}`.toLowerCase();

      // 如果当前正在监控同一个 HR，且 observer 正常，则跳过繁重逻辑
      if (this.currentMonitoredHR === hrKey && this.messageObserver) {
        return;
      }

      this.currentMonitoredHR = hrKey;
      this.resetMessageState();

      if (this.messageObserver) {
        this.messageObserver.disconnect();
        this.messageObserver = null;
      }

      if (
        settings.communicationIncludeKeywords &&
        settings.communicationIncludeKeywords.trim()
      ) {
        await this.simulateClick(latestChatLi.querySelector(".figure"));
        await this.delay(CONFIG.OPERATION_INTERVAL * 2);

        const positionName = this.getPositionName();
        const includeKeywords = settings.communicationIncludeKeywords
          .toLowerCase()
          .split(/[，,]/)
          .map((kw) => kw.trim())
          .filter((kw) => kw.length > 0);

        const positionNameLower = positionName.toLowerCase();
        const isMatch = includeKeywords.some((keyword) =>
          positionNameLower.includes(keyword)
        );

        if (!isMatch) {
          this.log(`跳过岗位对话，不含关键词[${includeKeywords.join(", ")}]`);

          if (settings.communicationMode === "auto") {
            await this.scrollUserList();
          }
          return;
        }
      }

      if (!latestChatLi.classList.contains("last-clicked")) {
        await this.simulateClick(latestChatLi.querySelector(".figure"));
        latestChatLi.classList.add("last-clicked");

        await this.delay(CONFIG.OPERATION_INTERVAL);
        await HRInteractionManager.handleHRInteraction(hrKey);

        if (settings.communicationMode === "auto") {
          await this.scrollUserList();
        }
      }

      await this.setupMessageObserver(hrKey);
    },

    async scrollUserList() {
      const userListContent = document.querySelector(".user-list-content");
      if (userListContent) {
        const totalHeight = userListContent.scrollHeight;
        const clientHeight = userListContent.clientHeight;
        const maxScrollTop = totalHeight - clientHeight;

        if (maxScrollTop <= 0) {
          return;
        }

        const scrollSteps = Math.floor(Math.random() * 3) + 3;

        for (let i = 0; i < scrollSteps; i++) {
          const randomTop = Math.floor(Math.random() * maxScrollTop);

          userListContent.scrollTo({
            top: randomTop,
            behavior: "smooth",
          });

          const randomDelay = Math.floor(Math.random() * 2000) + 1000;
          await this.delay(randomDelay);
        }

        const finalPosition = Math.random() > 0.5 ? maxScrollTop : 0;
        userListContent.scrollTo({
          top: finalPosition,
          behavior: "smooth",
        });
      }
    },

    resetMessageState() {
      this.lastProcessedMessage = null;
      this.processingMessage = false;
      if (!this.repliedMessages) {
        this.repliedMessages = new Set();
      }
    },

    async scrollToLoadMoreJobs() {
      const jobListContainer = document.querySelector('.job-list-box') || document.querySelector('.search-job-result') || window;
      const scrollHeight = document.body.scrollHeight;
      const viewportHeight = window.innerHeight;
      
      // 滚动3次加载更多职位
      for (let i = 0; i < 3; i++) {
        const currentScroll = window.scrollY || document.documentElement.scrollTop;
        const targetScroll = currentScroll + viewportHeight * 0.8;
        
        window.scrollTo({
          top: targetScroll,
          behavior: 'smooth'
        });
        
        this.log(`正在加载更多职位... (${i + 1}/3)`);
        await this.delay(1500); // 等待职位加载
      }
      
      // 滚动回顶部
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      await this.delay(500);
    },

    async setupMessageObserver(hrKey) {
      const chatContainer = await this.waitForElement(".chat-message .im-list");
      if (!chatContainer) return;

      this.messageObserver = new MutationObserver(async (mutations) => {
        let hasNewFriendMessage = false;
        for (const mutation of mutations) {
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            hasNewFriendMessage = Array.from(mutation.addedNodes).some((node) =>
              node.classList?.contains("item-friend")
            );
            if (hasNewFriendMessage) break;
          }
        }

        if (hasNewFriendMessage) {
          await this.handleNewMessage(hrKey);
        }
      });

      this.messageObserver.observe(chatContainer, {
        childList: true,
        subtree: true,
      });
    },

    async handleNewMessage(hrKey) {
      if (!state.isRunning) return;
      if (this.processingMessage) return;

      this.processingMessage = true;

      try {
        await this.delay(CONFIG.OPERATION_INTERVAL);

        const lastMessage = await this.getLastFriendMessageText();
        if (!lastMessage) return;

        const cleanedMessage = this.cleanMessage(lastMessage);
        const shouldSendResumeOnly = cleanedMessage.includes("简历");

        if (cleanedMessage === this.lastProcessedMessage) return;

        this.lastProcessedMessage = cleanedMessage;

        StatsManager.increment("hrReplies");

        const interviewKeywords = ["面试", "聊聊", "见一面", "面谈", "过来面试", "来公司"];
        if (interviewKeywords.some(kw => cleanedMessage.includes(kw))) {
          StatsManager.increment("interviewInvites");
        }
        this.log(`已同意交换，对方: ${lastMessage}`);

        await this.delay(CONFIG.DELAYS.MEDIUM_SHORT);
        const updatedMessage = await this.getLastFriendMessageText();
        if (
          updatedMessage &&
          this.cleanMessage(updatedMessage) !== cleanedMessage
        ) {
          await this.handleNewMessage(hrKey);
          return;
        }

        const autoSendResume = settings.useAutoSendResume;
        const autoReplyEnabled = settings.autoReply;

        if (shouldSendResumeOnly && autoSendResume) {
          this.log('对方提到"简历"，正在发送简历');
          const sent = await HRInteractionManager.sendResume();
          if (sent) {
            state.hrInteractions.sentResumeHRs.add(hrKey);
            StatePersistence.saveState();
            this.log(`已向 ${hrKey} 发送简历`);
          }
        } else if (autoReplyEnabled) {
          await HRInteractionManager.handleHRInteraction(hrKey);
        }

        await this.delay(CONFIG.DELAYS.MEDIUM_SHORT);
      } catch (error) {
        this.log(`处理消息出错: ${error.message}`);
      } finally {
        this.processingMessage = false;
      }
    },

    cleanMessage(message) {
      if (!message) return "";

      let clean = message.replace(/<[^>]*>/g, "");
      clean = clean
        .trim()
        .replace(/\s+/g, " ")
        .replace(/[\u200B-\u200D\uFEFF]/g, "");
      return clean;
    },

    getLatestChatLi() {
      return document.querySelector(
        'ul[role="group"] li[role="listitem"][class]:has(.friend-content-warp)'
      );
    },

    getPositionName() {
      try {
        const positionNameElement =
          Core.getCachedElement(".position-name", true) ||
          Core.getCachedElement(".job-name", true) ||
          Core.getCachedElement(
            '[class*="position-content"] .left-content .position-name',
            true
          ) ||
          document.querySelector(".position-name") ||
          document.querySelector(".job-name");

        if (positionNameElement) {
          return positionNameElement.textContent.trim();
        } else {
          // Silent failure is better here as we might check multiple times
          return "";
        }
      } catch (e) {
        Core.log(`获取岗位名称出错: ${e.message}`);
        return "";
      }
    },

    async aiReply() {
      if (!state.isRunning) return;
      try {
        const autoReplyEnabled = JSON.parse(
          localStorage.getItem("autoReply") || "false"
        );
        if (!autoReplyEnabled) {
          return false;
        }

        const lastMessage = await this.getLastFriendMessageText();
        if (!lastMessage) return false;

        // 免费版本：移除每日回复次数限制
        // const today = new Date().toISOString().split("T")[0];
        // if (state.ai.lastAiDate !== today) {
        //   state.ai.replyCount = 0;
        //   state.ai.lastAiDate = today;
        //   StatePersistence.saveState();
        // }

        // 获取岗位名称
        const positionName = HRInteractionManager.getPositionNameFromChat();
        
        // 使用个性化回复（基于简历）
        const aiReplyText = await this.generatePersonalizedReply(lastMessage, positionName);
        if (!aiReplyText) return false;

        this.log(`AI回复: ${aiReplyText.slice(0, 30)}...`);

        const inputBox = await this.waitForElement("#chat-input");
        if (!inputBox) return false;

        inputBox.textContent = "";
        inputBox.focus();
        document.execCommand("insertText", false, aiReplyText);
        await this.delay(CONFIG.OPERATION_INTERVAL / 10);

        const sendButton = DOMCache.get(".btn-send");
        if (sendButton) {
          await this.simulateClick(sendButton);
        } else {
          const enterKeyEvent = new KeyboardEvent("keydown", {
            key: "Enter",
            keyCode: 13,
            code: "Enter",
            which: 13,
            bubbles: true,
          });
          inputBox.dispatchEvent(enterKeyEvent);
        }

        return true;
      } catch (error) {
        ErrorHandler.handle(error, 'Core.aiReply');
        this.log(`AI回复出错: ${error.message}`);
        return false;
      }
    },

    async _requestAiOnce(message) {
      // 获取用户自定义配置
      const customApiKey = localStorage.getItem("aiApiKey");
      const customApiUrl = localStorage.getItem("aiApiUrl");
      const customModel = localStorage.getItem("aiModel");
      const customRole = localStorage.getItem("aiRole");

      // 使用用户自定义配置
      const authToken = customApiKey;
      const apiUrl = customApiUrl;
      const model = customModel;
      // 默认AI角色设定
      const defaultSystemRole = "你是求职的应届生正在面对HR，回复需满足：20字内，编造专业对口/实习经验/证书任一岗位优势；被问个人信息或岗位条件，直接配合提供合理数据；全程积极真诚无拒绝言辞。";
      const systemRole = customRole || defaultSystemRole;

      // 检查是否配置了AI
      if (!authToken || !apiUrl || !model) {
        this.log("⚠️ 未配置AI API，请先点击AI配置按钮设置API Key");
        return "您好，我对这个岗位很感兴趣，希望能有机会进一步沟通。";
      }

      // 构建请求体，兼容不同API
      const requestBody = {
        model: model,
        messages: [
          { role: "user", content: message }
        ],
        max_tokens: 512
      };
      
      // 只有非硅基流动API才添加system role和额外参数
      // 硅基流动的某些模型可能不支持system role
      if (!apiUrl.includes("siliconflow.cn")) {
        requestBody.messages.unshift({
          role: "system",
          content: systemRole,
        });
        requestBody.temperature = 0.9;
        requestBody.top_p = 0.8;
      }

      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "POST",
          url: apiUrl,
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + authToken,
          },
          data: JSON.stringify(requestBody),
          onload: (response) => {
            try {
              const result = JSON.parse(response.responseText);
              // 处理不同API的响应格式
              if (result.choices && result.choices[0] && result.choices[0].message) {
                // OpenAI格式
                resolve(result.choices[0].message.content.trim());
              } else if (result.code !== undefined && result.code !== 0) {
                // 讯飞格式错误
                throw new Error(
                  "API错误: " + result.message + "（Code: " + result.code + "）"
                );
              } else if (result.choices && result.choices[0]) {
                // 其他格式
                resolve(result.choices[0].message?.content?.trim() || result.choices[0].text?.trim() || "");
              } else {
                throw new Error("无法解析API响应格式");
              }
            } catch (error) {
              reject(
                new Error(
                  "响应解析失败: " +
                  error.message +
                  "\n原始响应: " +
                  response.responseText
                )
              );
            }
          },
          onerror: (error) => reject(new Error("网络请求失败: " + error)),
        });
      });
    },

    async requestAi(message) {
      const maxRetries = CONFIG.API.RETRY_COUNT;
      let lastError = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 1) {
            this.log(`AI请求重试 (${attempt}/${maxRetries})...`);
          }
          const result = await this._requestAiOnce(message);
          return result;
        } catch (error) {
          lastError = error;
          if (attempt < maxRetries) {
            this.log(`AI请求失败: ${error.message}，${CONFIG.API.RETRY_DELAY}ms后重试`);
            await this.delay(CONFIG.API.RETRY_DELAY);
          }
        }
      }

      this.log(`AI请求最终失败，已重试 ${maxRetries} 次`);
      throw lastError;
    },

        // 读取简历文件内容
    async readResumeFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
          try {
            const content = e.target.result;

            if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
              const text = await this.extractTextFromPDF(content);
              if (!text || text.length < 100) {
                resolve({
                  success: false,
                  text: "",
                  message: "【PDF提取失败】\n\n浏览器无法直接读取此PDF的文本内容。\n\n可能原因：\n1. PDF是扫描件（图片格式）\n2. PDF使用了特殊字体编码\n3. PDF有密码保护\n\n【解决方案】\n请直接打开PDF文件，按 Ctrl+A 全选，Ctrl+C 复制，\n然后粘贴到下方的简历内容文本框中。\n\n这是最简单可靠的方法！"
                });
              } else {
                resolve({ success: true, text: text });
              }
            } else if (file.name.endsWith('.docx')) {
              const text = await this.extractTextFromDocx(content);
              if (!text || text.length < 50) {
                resolve({
                  success: false,
                  text: "",
                  message: "【Word提取失败】\n\n无法从此.docx文件中提取文本。\n\n可能原因：\n1. 文件使用了特殊格式\n2. 文件内容主要是图片\n\n【解决方案】\n请直接打开Word文件，按 Ctrl+A 全选，Ctrl+C 复制，\n然后粘贴到下方的简历内容文本框中。"
                });
              } else {
                resolve({ success: true, text: text });
              }
            } else if (file.name.endsWith('.doc')) {
              const text = this.extractTextFromWordLegacy(content);
              if (!text || text.length < 50) {
                resolve({
                  success: false,
                  text: "",
                  message: "【.doc格式不支持】\n\n旧版.doc格式无法在浏览器中直接解析。\n\n【解决方案】\n1. 用Word打开后另存为.docx格式重新上传\n2. 或直接按 Ctrl+A 全选，Ctrl+C 复制，粘贴到下方文本框"
                });
              } else {
                resolve({ success: true, text: text });
              }
            } else {
              resolve({ success: true, text: content });
            }
          } catch (error) {
            reject(new Error("文件解析失败: " + error.message));
          }
        };

        reader.onerror = () => {
          reject(new Error("文件读取失败"));
        };

        if (file.type === 'application/pdf' || file.name.endsWith('.pdf') ||
            file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
          reader.readAsArrayBuffer(file);
        } else {
          reader.readAsText(file, 'UTF-8');
        }
      });
    },

    // 从.docx文件提取文本（ZIP解压+XML解析）
    async extractTextFromDocx(arrayBuffer) {
      try {
        const uint8Array = new Uint8Array(arrayBuffer);
        const files = await this._parseZipAsync(uint8Array);
        const documentXml = files["word/document.xml"];

        if (!documentXml) {
          return "";
        }

        const decoder = new TextDecoder('utf-8');
        const xmlText = decoder.decode(documentXml);

        let text = xmlText
          .replace(/<w:p[^>]*>/g, '\n')
          .replace(/<w:br[^>]*\/>/g, '\n')
          .replace(/<w:tab[^>]*\/>/g, '\t')
          .replace(/<[^>]+>/g, '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]+/g, ' ')
          .trim();

        return text;
      } catch (error) {
        console.error("DOCX解析错误:", error);
        return "";
      }
    },

    // 从旧版.doc文件提取文本（尽力而为）
    extractTextFromWordLegacy(arrayBuffer) {
      try {
        const uint8Array = new Uint8Array(arrayBuffer);
        const decoder = new TextDecoder('utf-8');
        let text = decoder.decode(uint8Array);

        text = text
          .replace(/<[^>]+>/g, ' ')
          .replace(/\{[^}]+\}/g, ' ')
          .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s\n\.,;:!?，。；：！?@＠\-#＃]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        return text;
      } catch (error) {
        return "";
      }
    },

    // 异步ZIP文件解析器
    async _parseZipAsync(uint8Array) {
      const files = {};

      const eocdOffset = this._findEOCD(uint8Array);
      if (eocdOffset < 0) return files;

      const view = new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);

      let centralDirOffset = view.getUint32(eocdOffset + 16, true);
      const totalEntries = view.getUint16(eocdOffset + 10, true);

      for (let i = 0; i < totalEntries; i++) {
        const signature = view.getUint32(centralDirOffset, true);
        if (signature !== 0x02014b50) break;

        const compressionMethod = view.getUint16(centralDirOffset + 10, true);
        const compressedSize = view.getUint32(centralDirOffset + 20, true);
        const fileNameLength = view.getUint16(centralDirOffset + 28, true);
        const extraFieldLength = view.getUint16(centralDirOffset + 30, true);
        const fileCommentLength = view.getUint16(centralDirOffset + 32, true);
        const localHeaderOffset = view.getUint32(centralDirOffset + 42, true);

        const fileNameBytes = uint8Array.slice(centralDirOffset + 46, centralDirOffset + 46 + fileNameLength);
        const fileName = new TextDecoder('utf-8').decode(fileNameBytes);

        const localSig = view.getUint32(localHeaderOffset, true);
        if (localSig !== 0x04034b50) {
          centralDirOffset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
          continue;
        }

        const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
        const localExtraFieldLength = view.getUint16(localHeaderOffset + 28, true);
        const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;

        const compressedData = uint8Array.slice(dataOffset, dataOffset + compressedSize);

        if (compressedSize === 0) {
          files[fileName] = new Uint8Array(0);
        } else if (compressionMethod === 0) {
          files[fileName] = compressedData;
        } else if (compressionMethod === 8) {
          try {
            const blob = new Blob([compressedData]);
            const stream = blob.stream().pipeThrough(new DecompressionStream('deflate-raw'));
            const result = await new Response(stream).arrayBuffer();
            files[fileName] = new Uint8Array(result);
          } catch (e) {
            files[fileName] = compressedData;
          }
        } else {
          files[fileName] = compressedData;
        }

        centralDirOffset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
      }

      return files;
    },

    // 查找ZIP EOCD记录末尾
    _findEOCD(uint8Array) {
      const view = new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);
      const maxOffset = uint8Array.length - 22;

      for (let i = maxOffset; i >= 0; i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
          return i;
        }
      }
      return -1;
    },

    async extractTextFromPDF(arrayBuffer) {
      try {
        const uint8Array = new Uint8Array(arrayBuffer);

        const text = new TextDecoder('latin1').decode(uint8Array);

        const streams = [];
        const streamRegex = /(\d+ \d+ obj[\s\S]*?\/Filter\s*\/FlateDecode[\s\S]*?)>>\s*\nstream\r?\n([\s\S]*?)\r?\nendstream/g;
        let match;
        while ((match = streamRegex.exec(text)) !== null) {
          const header = match[1];
          const data = match[2];
          const lengthMatch = header.match(/\/Length\s+(\d+)/);
          const expectedLen = lengthMatch ? parseInt(lengthMatch[1]) : data.length;
          streams.push(data.substring(0, expectedLen));
        }

        if (streams.length === 0) {
          return this._extractTextFromPDFLegacy(arrayBuffer);
        }

        const allDecompressedChunks = [];
        for (const compressedStr of streams) {
          const bytes = new Uint8Array(compressedStr.length);
          for (let i = 0; i < compressedStr.length; i++) {
            bytes[i] = compressedStr.charCodeAt(i) & 0xff;
          }
          try {
            const decompressed = await this._decompressPdfBytes(bytes);
            allDecompressedChunks.push(...decompressed);
          } catch (e) {
            continue;
          }
        }

        if (allDecompressedChunks.length === 0) return "";
        const combined = new Uint8Array(allDecompressedChunks);
        const extractedText = this._extractTextFromPdfBytes(combined);
        if (extractedText.length >= 50) return extractedText;

        return this._extractTextFromPDFLegacy(arrayBuffer);
      } catch (error) {
        console.error("PDF解析错误:", error);
        return "";
      }
    },

    async _decompressPdfBytes(bytes) {
      const blob = new Blob([bytes]);
      let stream;
      try {
        stream = blob.stream().pipeThrough(new DecompressionStream('deflate'));
      } catch (e) {
        stream = blob.stream().pipeThrough(new DecompressionStream('deflate-raw'));
      }
      const result = await new Response(stream).arrayBuffer();
      return new Uint8Array(result);
    },

    _extractTextFromPdfBytes(bytes) {
      let text = '';
      const content = new TextDecoder('latin1').decode(bytes);

      // 策略1: (xxxx) Tj — 括号内可能是 UTF-16BE 中文
      const tjRegex = /\(([\x00-\xff]*?)\)\s*Tj/g;
      let m;
      while ((m = tjRegex.exec(content)) !== null) {
        const raw = m[1];
        if (raw.length >= 2) {
          const rawBytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) rawBytes[i] = raw.charCodeAt(i) & 0xff;
          try {
            const decoded = new TextDecoder('utf-16be', { fatal: false }).decode(rawBytes);
            if (/[一-龥]/.test(decoded)) text += decoded;
          } catch (e) {}
        }
        if (/^[\x20-\x7e]+$/.test(raw) && raw.length > 1) {
          text += ' ' + raw;
        }
      }

      // 策略2: [...] TJ 模式
      const TJRegex = /\[([^\]]*)\]\s*TJ/g;
      while ((m = TJRegex.exec(content)) !== null) {
        const inner = m[1];
        const innerMatches = inner.match(/\(([^)]*)\)/g);
        if (innerMatches) {
          for (const s of innerMatches) {
            const raw = s.slice(1, -1);
            if (raw.length >= 2) {
              const rawBytes = new Uint8Array(raw.length);
              for (let i = 0; i < raw.length; i++) rawBytes[i] = raw.charCodeAt(i) & 0xff;
              try {
                const decoded = new TextDecoder('utf-16be', { fatal: false }).decode(rawBytes);
                if (/[一-龥]/.test(decoded)) text += decoded;
              } catch (e) {}
            }
          }
        }
      }

      // 策略3: 整个内容尝试多编码直接提取中文
      if (text.length < 50) {
        for (const enc of ['utf-8', 'gbk', 'gb2312', 'utf-16be', 'utf-16le']) {
          try {
            const decoded = new TextDecoder(enc, { fatal: false }).decode(bytes);
            const chineseChars = decoded.match(/[一-龥]{2,}/g);
            if (chineseChars && chineseChars.join('').length > 50) {
              text += ' ' + chineseChars.join(' ');
              break;
            }
          } catch (e) { continue; }
        }
      }

      text = text.replace(/\s+/g, ' ').trim();
      if (text.length < 50) return '';

      const commonWords = ['公司', '工作', '大学', '经验', '负责', '项目', '技术', '学历', '电话', '邮箱', '专业', '毕业', '开发', '管理', '设计', '年', '月'];
      const matchCount = commonWords.filter(w => text.includes(w)).length;
      if (text.length > 200 && matchCount < 2) return '';

      return text;
    },

    _extractTextFromPDFLegacy(arrayBuffer) {
      try {
        const uint8Array = new Uint8Array(arrayBuffer);
        let pdfContent = '';
        const encodings = ['utf-8', 'gbk', 'gb2312', 'big5'];

        for (const encoding of encodings) {
          try {
            const decoder = new TextDecoder(encoding, { fatal: false });
            pdfContent = decoder.decode(uint8Array);
            if (/[一-龥]{10,}/.test(pdfContent)) break;
          } catch (e) { continue; }
        }

        let extractedText = '';
        const tjMatches = pdfContent.match(/\(([^)]+)\)\s*T[jJ]/g);
        if (tjMatches && tjMatches.length > 0) {
          extractedText = tjMatches.map(match => {
            const content = match.match(/\(([^)]+)\)/);
            return content ? content[1] : '';
          }).filter(t => t.length > 0).join(' ');
        }

        if (extractedText.length < 200) {
          const chineseMatches = pdfContent.match(/[一-龥]{2,}/g);
          if (chineseMatches && chineseMatches.length > 0) extractedText += ' ' + chineseMatches.join(' ');
        }

        extractedText = extractedText.replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, ' ').replace(/\s+/g, ' ').trim();

        if (extractedText.length < 100) return '';

        const commonWords = ['公司', '工作', '大学', '经验', '负责', '项目', '技术', '学历', '电话', '邮箱', '专业', '毕业', '开发', '管理', '设计', '年', '月'];
        const matchCount = commonWords.filter(w => extractedText.includes(w)).length;
        if (extractedText.length > 200 && matchCount < 2) return '';

        return extractedText;
      } catch (error) {
        return "";
      }
    },

    // AI分析简历
    // 截断简历文本到指定长度（避免超过AI token限制）
    truncateResumeText(resumeText, maxLength = 8000) {
      if (!resumeText || resumeText.length <= maxLength) {
        return resumeText;
      }
      
      // 尝试在句子边界截断
      let truncated = resumeText.substring(0, maxLength);
      const lastPeriod = truncated.lastIndexOf('。');
      const lastNewline = truncated.lastIndexOf('\n');
      const lastSpace = truncated.lastIndexOf(' ');
      
      // 找到最后一个合适的截断点
      const cutPoint = Math.max(lastPeriod, lastNewline, lastSpace);
      if (cutPoint > maxLength * 0.8) {
        truncated = truncated.substring(0, cutPoint + 1);
      }
      
      return truncated + "\n[简历内容已截断，仅显示前" + truncated.length + "字符]";
    },

    async analyzeResumeWithAI(resumeText) {
      try {
        this.log("正在使用AI分析简历...");
        
        // 检查简历内容是否为空
        if (!resumeText || resumeText.trim().length < 50) {
          throw new Error("简历内容太短或为空，请检查是否正确上传了简历文件");
        }
        
        // 截断简历文本，避免超过token限制
        const truncatedResume = this.truncateResumeText(resumeText, 6000);
        
        if (truncatedResume.length < resumeText.length) {
          this.log(`简历内容已截断: ${resumeText.length} -> ${truncatedResume.length} 字符`);
        }
        
        // 记录简历前200字符用于调试
        this.log(`简历内容前200字符: ${truncatedResume.substring(0, 200)}...`);
        
        const analysisPrompt = `【重要】请基于以下提供的真实简历内容进行分析，不要生成示例或模板内容：

  ===简历开始===
  ${truncatedResume}
  ===简历结束===

  请严格基于上述简历中的真实信息，分析并输出以下内容：
  1. 核心技能（从简历中提取的具体技能，不要编造）
  2. 工作经验亮点（基于简历中的工作经历）
  3. 教育背景（简历中的真实教育信息）
  4. 个人优势（基于简历内容总结）
  5. 适合岗位类型（根据简历技能匹配）

  【警告】如果简历内容为空或不清晰，请直接回复"简历内容无法识别，请检查上传的文件"。
  不要生成示例数据！必须基于真实简历内容分析。`;

        const analysis = await this.requestAi(analysisPrompt);
        
        // 检查AI是否返回了示例内容（包含"某知名大学"、"某顶尖大学"等模板词汇）
        const templateKeywords = ['某知名大学', '某顶尖大学', '某大学', '示例', '模板', '某某'];
        const isTemplate = templateKeywords.some(keyword => analysis.includes(keyword));
        
        if (isTemplate) {
          this.log("警告：AI返回了模板内容，可能未正确读取简历");
          return "【警告】AI未能正确识别简历内容，请检查：\n1. 文件是否正确上传\n2. 简历内容是否可提取（PDF可能是扫描件）\n3. 尝试直接粘贴简历文本到文本框中\n\n原始返回内容：\n" + analysis;
        }
        
        this.log("简历分析完成");
        return analysis;
      } catch (error) {
        this.log(`简历分析失败: ${error.message}`);
        throw error;
      }
    },

    // 根据简历生成自我介绍
    async generateGreetingsFromResume(resumeText, analysis) {
      try {
        this.log("正在生成自我介绍...");
        
        // 截断简历文本
        const truncatedResume = this.truncateResumeText(resumeText, 4000);
        
        const greetingPrompt = `基于以下简历信息，生成一段简洁的自我介绍，用于求职时首次与HR沟通：

  简历内容：
  ${truncatedResume}

  简历分析：
  ${analysis}

  要求：
  1. 一句话，200字左右
  2. 内容包含：求职意向、核心技能、经验亮点、个人优势
  3. 语气真诚、专业、自信
  4. 不要出现"您好"开头，直接说内容
  5. 直接输出内容，不要加任何前缀或编号`;

        const response = await this.requestAi(greetingPrompt);
        const content = response.trim();

        if (content && content.length > 30) {
          const greetings = [{ id: "1", content }];
          state.settings.greetingsList = greetings;
          localStorage.setItem("greetingsList", JSON.stringify(greetings));
          this.log(`已生成自我介绍（${content.length}字）`);
          
          // 刷新UI
          setTimeout(() => {
            if (typeof renderGreetingsList === 'function') {
              renderGreetingsList();
            }
          }, 100);
          
          return greetings;
        } else {
          this.log("生成的自我介绍数量不足，使用默认内容");
          return null;
        }
      } catch (error) {
        this.log(`生成自我介绍失败: ${error.message}`);
        return null;
      }
    },

    // 根据简历和岗位信息生成个性化回复
    async generatePersonalizedReply(hrMessage, positionName = "") {
      try {
        const resumeText = state.settings.resumeText || "";
        const resumeAnalysis = state.settings.resumeAnalysis || "";
        const strategy = getConversationStrategy();

        if (!resumeText && !resumeAnalysis) {
          const prompt = buildPrompt(PHASES.GENERAL, hrMessage, positionName, "", "", strategy);
          return await this.requestAi(prompt);
        }

        const phase = detectPhase(hrMessage);
        this.log(`对话阶段: ${Object.keys(PHASES).find(k => PHASES[k] === phase)} (${STRATEGIES[strategy].label})`);

        const prompt = buildPrompt(phase, hrMessage, positionName, resumeText, resumeAnalysis, strategy);
        const reply = await this.requestAi(prompt);
        return reply;
      } catch (error) {
        this.log(`生成个性化回复失败: ${error.message}`);
        return await this.requestAi(hrMessage);
      }
    },

    async getLastFriendMessageText() {
      try {
        let container = document.querySelector(".chat-message .im-list");
        if (container) {
          const friendMsgs = container.querySelectorAll("li.message-item.item-friend");
          if (friendMsgs.length > 0) {
            const last = friendMsgs[friendMsgs.length - 1];
            const textEl = last.querySelector(".text span");
            if (textEl?.textContent?.trim()) return textEl.textContent.trim();
          }
        }

        const chatTextEls = document.querySelectorAll(".text p span, .text span");
        for (let i = chatTextEls.length - 1; i >= 0; i--) {
          const el = chatTextEls[i];
          if (el.closest(".friend-content") || el.closest(".last-msg")) continue;
          const t = el.textContent?.trim();
          if (t && t.length > 1 && t !== "立即沟通" && !t.includes("发送自我介绍")) return t;
        }

        const selectedChat = document.querySelector(".friend-content.selected, .friend-content-warp:has(.friend-content.selected)");
        if (selectedChat) {
          const previewEl = selectedChat.querySelector(".last-msg-text");
          if (previewEl?.textContent?.trim()) return previewEl.textContent.trim();
        }

        return null;
      } catch (error) {
        ErrorHandler.handle(error, 'Core.getLastFriendMessageText');
        this.log(`获取消息出错: ${error.message}`);
        return null;
      }
    },

    async simulateClick(element) {
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      const dispatchMouseEvent = (type, options = {}) => {
        const event = new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: document.defaultView,
          clientX: x,
          clientY: y,
          ...options,
        });
        element.dispatchEvent(event);
      };

      dispatchMouseEvent("mouseover");
      await this.delay(CONFIG.DELAYS.SHORT);
      dispatchMouseEvent("mousemove");
      await this.delay(CONFIG.DELAYS.SHORT);
      dispatchMouseEvent("mousedown", { button: 0 });
      await this.delay(CONFIG.DELAYS.SHORT);
      dispatchMouseEvent("mouseup", { button: 0 });
      await this.delay(CONFIG.DELAYS.SHORT);
      dispatchMouseEvent("click", { button: 0 });
    },

    async waitForElement(selectorOrFunction, timeout = 5000) {
      return new Promise((resolve) => {
        let element;
        if (typeof selectorOrFunction === "function")
          element = selectorOrFunction();
        else element = document.querySelector(selectorOrFunction);

        if (element) return resolve(element);

        const timeoutId = setTimeout(() => {
          observer.disconnect();
          resolve(null);
        }, timeout);
        const observer = new MutationObserver(() => {
          if (typeof selectorOrFunction === "function")
            element = selectorOrFunction();
          else element = document.querySelector(selectorOrFunction);
          if (element) {
            clearTimeout(timeoutId);
            observer.disconnect();
            resolve(element);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      });
    },

    getContextMultiplier(context) {
      const multipliers = {
        dict_load: 1.0,
        click: 0.8,
        selection: 0.8,
        default: 1.0,
      };
      return multipliers[context] || multipliers["default"];
    },

    async smartDelay(baseTime, context = "default") {
      const multiplier = this.getContextMultiplier(context);
      const adjustedTime = baseTime * multiplier;
      return this.delay(adjustedTime);
    },

    async delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },

    getRandomInterval() {
      const min = CONFIG.SMART_INTERVAL.MIN;
      const max = CONFIG.SMART_INTERVAL.MAX;
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    isPeakHour() {
      const hour = new Date().getHours();
      return CONFIG.PEAK_HOURS.some(
        (range) => hour >= range.start && hour < range.end
      );
    },

    getPeakHourRanges() {
      return CONFIG.PEAK_HOURS.map((r) => r.label).join("、");
    },

    async handleGreetSettingsPage() {
      try {
        localStorage.setItem(STORAGE.VISITED_GREET_SET, "true");

        await this.delay(1000);

        const titleElement = document.querySelector("h3.title-wrap");

        if (titleElement) {
          titleElement.textContent = "请务必打开 打招呼语功能";
          titleElement.style.color = "red";
          titleElement.style.fontWeight = "bold";
          titleElement.style.fontSize = "18px";
        }

        const possibleSelectors = [
          "h4 .ui-switch",
          ".ui-switch",
          "span.ui-switch",
          "[class*='ui-switch']"
        ];

        let switchElement = null;
        for (const selector of possibleSelectors) {
          switchElement = document.querySelector(selector);
          if (switchElement) {
            break;
          }
        }

        if (switchElement) {
          const isChecked = switchElement.classList.contains("ui-switch-checked");
          if (!isChecked) {
            await this.simulateClick(switchElement);
            await this.delay(800);

            const newSwitchElement = document.querySelector(possibleSelectors.find(s => document.querySelector(s)));
            if (newSwitchElement && newSwitchElement.classList.contains("ui-switch-checked")) {
              UI.notify("招呼语功能已启用", "success");
            } else {
              await this.simulateClick(switchElement);
              await this.delay(500);

              const finalSwitchElement = document.querySelector(possibleSelectors.find(s => document.querySelector(s)));
              if (finalSwitchElement && finalSwitchElement.classList.contains("ui-switch-checked")) {
                UI.notify("招呼语功能已启用", "success");
              } else {
                UI.notify("请手动启用招呼语功能", "warning");
              }
            }
          } else {
            UI.notify("招呼语功能已启用", "success");
          }
        } else {
          const allSwitches = document.querySelectorAll("[class*='switch']");
          allSwitches.forEach((el, index) => {
            this.log(`开关 ${index + 1}: ${el.className}, 文本: ${el.textContent?.trim()}`);
          });
        }
      } catch (error) {
        ErrorHandler.handle(error, 'Core.handleGreetSettingsPage');
      }
    },

    extractTwoCharKeywords(text) {
      const keywords = [];
      const cleanedText = text.replace(/[\s,，.。:：;；""''\[\]\(\)\{\}]/g, "");

      for (let i = 0; i < cleanedText.length - 1; i++) {
        keywords.push(cleanedText.substring(i, i + 2));
      }

      return keywords;
    },

    extractResumeKeywords() {
      const analysis = state.settings.resumeAnalysis;
      if (!analysis || analysis.trim().length === 0) return null;

      const text = analysis.toLowerCase();
      const keywords = new Set();

      const sectionHeaders = ["核心技能", "适合岗位类型", "技能", "工作经验亮点", "个人优势"];
      let relevantText = text;
      for (const header of sectionHeaders) {
        const idx = text.indexOf(header.toLowerCase());
        if (idx !== -1) {
          relevantText += " " + text.substring(idx);
          break;
        }
      }

      const lines = relevantText.split(/[\n\r]+/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 2) continue;
        const cleaned = trimmed.replace(/^[\d\.\-\*\s、：:]+|[:：]|\d+\./g, "").trim();
        if (!cleaned || cleaned.length < 2) continue;

        const tokens = cleaned.split(/[,，、\s\/]+/);
        for (const token of tokens) {
          const t = token.trim();
          if (!t || t.length < 2) continue;
          const stopWords = ["熟悉", "了解", "掌握", "具备", "能够", "经验", "以上", "相关", "良好", "较强"];
          if (stopWords.includes(t)) continue;
          if (t.length <= 15) keywords.add(t);
        }

        if (cleaned.length >= 2 && cleaned.length <= 15 && !cleaned.includes(" ")) {
          keywords.add(cleaned);
        }
      }

      const result = Array.from(keywords);
      this.log(`从简历中提取 ${result.length} 个关键词用于岗位匹配`);
      return result;
    },

    scoreJobMatch(jobCard, keywords) {
      if (!keywords || keywords.length === 0) return { score: 99, matched: [] };

      const titleEl = jobCard.querySelector(".job-name");
      const title = (titleEl?.textContent || "").toLowerCase().trim();

      let fullDesc = "";
      const descEl = jobCard.querySelector(".job-info-desc, .job-desc, [class*='desc']");
      if (descEl) fullDesc = descEl.textContent.toLowerCase();
      if (!fullDesc) {
        const tagsEl = jobCard.querySelectorAll(".tag-item");
        fullDesc = Array.from(tagsEl).map(el => el.textContent).join(" ").toLowerCase();
      }

      let score = 0;
      const matched = [];

      for (const kw of keywords) {
        const kwLower = kw.toLowerCase();
        let matchCount = 0;
        if (title.includes(kwLower)) matchCount += CONFIG.MATCH.TITLE_WEIGHT;
        if (fullDesc.includes(kwLower)) matchCount += CONFIG.MATCH.DESC_WEIGHT;
        if (matchCount > 0) {
          score += matchCount;
          matched.push(kw);
        }
      }

      return { score, matched };
    },

    async resetCycle() {
      // 检查是否配置了多个城市
      const cities = state.locationKeywords.filter(kw => kw.trim() !== '');
      
      if (cities.length > 1 && state.currentCityIndex < cities.length - 1) {
        // 切换到下一个城市
        state.currentCityIndex = (state.currentCityIndex || 0) + 1;
        const nextCity = cities[state.currentCityIndex];
        
        this.log(`当前城市职位投递完成，准备切换到: ${nextCity}`);
        
        // 切换城市
        const switched = await this.switchCity(nextCity);
        if (switched) {
          // 重置状态，继续投递
          state.currentIndex = 0;
          state.jobList = [];
          this.log(`已切换到 ${nextCity}，继续投递...`);
          
          // 延迟后重新开始
          await this.delay(3000);
          toggleProcess(); // 停止当前循环
          await this.delay(1000);
          toggleProcess(); // 重新开始
          return;
        }
      }
      
      // 所有城市都投递完成
      toggleProcess();
      this.log("所有城市岗位沟通完成，恭喜您即将找到理想工作！");
      state.currentIndex = 0;
      state.currentCityIndex = 0;
    },

    async switchCity(cityName) {
      try {
        // 1. 点击城市选择器
        const citySelector = document.querySelector('.city-label') || 
                            document.querySelector('[class*="city"]') ||
                            document.querySelector('.filter-city');
        
        if (!citySelector) {
          this.log("未找到城市选择器，尝试直接修改搜索框");
          return await this.switchCityBySearch(cityName);
        }
        
        citySelector.click();
        await this.delay(1000);
        
        // 2. 在弹出的城市列表中查找目标城市
        const cityInput = document.querySelector('.city-search input') ||
                        document.querySelector('.filter-city-search input');
        
        if (cityInput) {
          // 输入城市名搜索
          cityInput.value = cityName;
          cityInput.dispatchEvent(new Event('input', { bubbles: true }));
          await this.delay(1000);
        }
        
        // 3. 点击目标城市
        const cityItems = document.querySelectorAll('.city-item, .filter-city-item, [class*="city-list"] li');
        for (const item of cityItems) {
          if (item.textContent.includes(cityName)) {
            item.click();
            this.log(`已选择城市: ${cityName}`);
            await this.delay(2000); // 等待页面刷新
            return true;
          }
        }
        
        // 如果没找到，尝试直接搜索
        return await this.switchCityBySearch(cityName);
        
      } catch (error) {
        this.log(`切换城市失败: ${error.message}`);
        return false;
      }
    },

    async switchCityBySearch(cityName) {
      try {
        // 通过搜索框切换城市
        const searchInput = document.querySelector('.search-input') ||
                          document.querySelector('input[placeholder*="搜索"]') ||
                          document.querySelector('.ipt-search');
        
        if (!searchInput) {
          this.log("未找到搜索框，无法切换城市");
          return false;
        }
        
        // 清空并输入新的搜索条件
        searchInput.value = `${state.includeKeywords[0] || ''} ${cityName}`;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await this.delay(500);
        
        // 触发搜索
        const searchBtn = document.querySelector('.search-btn') ||
                        document.querySelector('.btn-search') ||
                        document.querySelector('button[type="submit"]');
        
        if (searchBtn) {
          searchBtn.click();
        } else {
          // 按回车键搜索
          searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 }));
        }
        
        this.log(`已通过搜索切换到: ${cityName}`);
        await this.delay(3000); // 等待搜索结果加载
        return true;
        
      } catch (error) {
        this.log(`通过搜索切换城市失败: ${error.message}`);
        return false;
      }
    },

    log(message) {
      const logEntry = `[${new Date().toLocaleTimeString()}] ${message}`;
      const logPanel = document.querySelector("#pro-log");
      if (logPanel) {
        if (state.comments.isCommentMode) {
          return;
        }

        const logItem = document.createElement("div");
        logItem.className = "log-item";
        logItem.style.padding = "0px 8px";
        logItem.textContent = logEntry;
        logPanel.appendChild(logItem);
        logPanel.scrollTop = logPanel.scrollHeight;
      }
    },

    async getCurrentCompanyName() {
      try {
        let companyName = "";
        let retries = 0;
        const maxRetries = 10;

        while (retries < maxRetries && !companyName) {
          const bossInfoAttr = document.querySelector(".boss-info-attr");
          if (bossInfoAttr) {
            const text = bossInfoAttr.textContent.trim();
            if (text) {
              const parts = text.split("·");
              if (parts.length >= 1) {
                companyName = parts[0].trim();
                if (companyName) {
                  return companyName;
                }
              }
            }
          }

          retries++;
          if (retries < maxRetries) {
            await this.delay(200);
          }
        }

        return companyName;
      } catch (error) {
        console.log(`获取公司名失败: ${error.message}`);
        return "";
      }
    },

    async fetchCompanyComments(companyName, page = 1, size = 10) {
      return new Promise((resolve, reject) => {
        if (!companyName) {
          resolve({ success: false, data: null, message: "公司名不能为空" });
          return;
        }

        const apiUrl = `https://jasun.xyz/api/public/boss-reviews?company_name=${encodeURIComponent(companyName)}&page=${page}&size=${size}`;

        GM_xmlhttpRequest({
          method: "GET",
          url: apiUrl,
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
          onload: (response) => {
            try {
              const data = JSON.parse(response.responseText);
              if (data.code === 200) {
                resolve({ success: true, data: data.data, message: data.message });
              } else {
                resolve({ success: false, data: null, message: data.message || "获取评论失败" });
              }
            } catch (error) {
              console.log(`解析评论数据失败: ${error.message}`);
              resolve({ success: false, data: null, message: "响应解析失败" });
            }
          },
          onerror: (error) => {
            console.log(`获取评论失败: ${error.message}`);
            resolve({ success: false, data: null, message: "网络请求失败" });
          },
          ontimeout: () => {
            console.log("获取评论超时");
            resolve({ success: false, data: null, message: "请求超时" });
          },
        });
      });
    },

    async submitCompanyComment(companyName, comment) {
      return new Promise((resolve, reject) => {
        if (!companyName || !comment) {
          resolve({ success: false, message: "公司名和评论不能为空" });
          return;
        }

        const apiUrl = `https://jasun.xyz/api/public/boss-reviews`;

        GM_xmlhttpRequest({
          method: "POST",
          url: apiUrl,
          headers: {
            "Content-Type": "application/json",
          },
          data: JSON.stringify({
            company_name: companyName,
            content: comment,
          }),
          timeout: 10000,
          onload: (response) => {
            try {
              const data = JSON.parse(response.responseText);
              if (data.code === 200) {
                resolve({ success: true, message: data.message || "评论发布成功" });
              } else {
                resolve({ success: false, message: data.message || "评论提交失败" });
              }
            } catch (error) {
              resolve({ success: false, message: "响应解析失败" });
            }
          },
          onerror: (error) => {
            resolve({ success: false, message: "网络请求失败" });
          },
          ontimeout: () => {
            resolve({ success: false, message: "请求超时" });
          },
        });
      });
    },

    displayComments(comments, companyName) {
      const logPanel = document.querySelector("#pro-log");
      if (!logPanel) return;

      logPanel.innerHTML = "";
      logPanel.style.position = "relative";
      logPanel.style.padding = "0";
      logPanel.style.height = "260px";
      logPanel.style.display = "flex";
      logPanel.style.flexDirection = "column";

      if (!companyName) {
        const noCompanyItem = document.createElement("div");
        noCompanyItem.className = "comment-item";
        noCompanyItem.style.cssText = "padding: 0px; border-bottom: 1px solid #e5e7eb; color: #6b7280; text-align: center;";
        noCompanyItem.textContent = "未找到公司信息";
        logPanel.appendChild(noCompanyItem);
        return;
      }

      const contentContainer = document.createElement("div");
      contentContainer.className = "comment-content-container";
      contentContainer.style.cssText = "flex: 1; overflow-y: auto; padding: 12px; scrollbar-width: thin; scrollbar-color: var(--primary-color) var(--secondary-color);";

      const headerItem = document.createElement("div");
      headerItem.className = "comment-header";
      headerItem.style.cssText = "padding: 0px; border-radius: 0px; margin-bottom: 0px;";
      headerItem.innerHTML = `
        <div style="color: #1f2937; font-size: 12px; margin-bottom: 0px;">${companyName}</div>
      `;
      contentContainer.appendChild(headerItem);

      if (!comments || comments.length === 0) {
        const noCommentsItem = document.createElement("div");
        noCommentsItem.className = "comment-item";
        noCommentsItem.style.cssText = "padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; text-align: center;";
        noCommentsItem.textContent = "这家公司还没有评论哦，来评论一下吧！";
        contentContainer.appendChild(noCommentsItem);
      } else {
        comments.forEach((comment, index) => {
          const commentItem = document.createElement("div");
          commentItem.className = "comment-item";
          commentItem.style.cssText = "padding: 12px; border-bottom: 1px solid #e5e7eb; margin-bottom: 8px; background: #ffffff; border-radius: 8px;";

          const contentDiv = document.createElement("div");
          contentDiv.style.cssText = "color: #374151; font-size: 13px; line-height: 1.6; margin-bottom: 6px; word-break: break-word;";
          contentDiv.textContent = comment.content || comment.comment || comment;

          const metaDiv = document.createElement("div");
          metaDiv.style.cssText = "font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between;";

          const timeText = comment.createdAt || comment.time || new Date().toLocaleString();
          metaDiv.innerHTML = `<span>${timeText}</span>`;

          commentItem.appendChild(contentDiv);
          commentItem.appendChild(metaDiv);
          contentContainer.appendChild(commentItem);
        });
      }

      logPanel.appendChild(contentContainer);

      const inputContainer = document.createElement("div");
      inputContainer.className = "comment-input-container";
      inputContainer.style.cssText = "flex-shrink: 0; padding: 12px; background: var(--secondary-color); border-top: 1px solid #e5e7eb; display: flex; gap: 8px; align-items: center;";

      const input = document.createElement("input");
      input.type = "text";
      input.id = "comment-input";
      input.placeholder = "说点什么呢...";
      input.style.cssText = "flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: inherit; box-sizing: border-box; outline: none;";
      input.onfocus = () => {
        input.style.borderColor = "var(--primary-color)";
      };
      input.onblur = () => {
        input.style.borderColor = "#d1d5db";
      };

      const submitBtn = document.createElement("button");
      submitBtn.textContent = "发送";
      submitBtn.style.cssText = "padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: all 0.2s ease;";
      submitBtn.onmouseenter = () => {
        submitBtn.style.opacity = "0.9";
      };
      submitBtn.onmouseleave = () => {
        submitBtn.style.opacity = "1";
      };

      submitBtn.onclick = async () => {
        const commentText = input.value.trim();
        if (!commentText) {
          alert("请输入评论内容");
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "提交中...";

        const result = await this.submitCompanyComment(companyName, commentText);

        if (result.success) {
          alert("评论提交成功！");
          input.value = "";
          // 评论功能已移除
        } else {
          alert(result.message || "评论提交失败");
        }

        submitBtn.disabled = false;
        submitBtn.textContent = "发送";
      };

      inputContainer.appendChild(input);
      inputContainer.appendChild(submitBtn);
      logPanel.appendChild(inputContainer);

      contentContainer.scrollTop = contentContainer.scrollHeight;
    },

    async loadAndDisplayComments() {
      const companyName = await this.getCurrentCompanyName();
      state.comments.currentCompanyName = companyName;
      state.comments.isCommentMode = true;

      if (state.comments.isLoading) return;

      state.comments.isLoading = true;
      const logPanel = document.querySelector("#pro-log");
      if (logPanel) {
        logPanel.innerHTML = '<div style="padding: 12px; text-align: center; color: #6b7280;">加载评论中...</div>';
      }

      const result = await this.fetchCompanyComments(companyName);
      state.comments.isLoading = false;

      const comments = result.success && result.data ? result.data.records : [];
      state.comments.commentsList = comments;

      this.displayComments(comments, companyName);
    },

    extractJobDetail() {
      const selectors = [
        ".job-sec-text", ".job-detail", ".detail-text", ".job-main",
        ".job_sec", "[class*='job-detail']", "[class*='job-sec']",
        ".job-detail-box", ".job-description",
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 30) {
          return el.textContent.trim();
        }
      }
      const panel = document.querySelector(".job-detail-box, .job-box, [class*='detail']");
      if (panel) return panel.textContent.trim();
      return null;
    },

    async generateCustomGreeting(jdText) {
      if (!jdText || jdText.length < 20) return null;
      const resumeText = state.settings.resumeText || "";
      const resumeAnalysis = state.settings.resumeAnalysis || "";
      if (!resumeText && !resumeAnalysis) return null;

      const truncatedResume = this.truncateResumeText(resumeText, 3000);
      const truncatedJd = jdText.length > 2000 ? jdText.substring(0, 2000) : jdText;

      const prompt = `基于我的简历和这个岗位的JD，生成一段精准的求职打招呼语：

我的简历：${truncatedResume}
简历分析：${resumeAnalysis || "暂无"}
岗位JD：${truncatedJd}

要求：
1. 80-150字，一句话
2. 突出简历与JD的匹配点（技能、经验、项目）
3. 展示对岗位的理解和兴趣
4. 语气真诚、自信、像真人
5. 不要"您好"开头，直接说内容`;

      try {
        const reply = await this.requestAi(prompt);
        if (reply && reply.length > 20) return reply.trim();
      } catch (e) {}
      return null;
    },
  };

