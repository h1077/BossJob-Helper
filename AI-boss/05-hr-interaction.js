  class HRInteractionManager {
    /**
     * 从聊天界面获取岗位名称
     * @returns {string}
     */
    static getPositionNameFromChat() {
      try {
        // 尝试多种选择器获取岗位名称
        const selectors = [
          '.chat-header .position-name',
          '.chat-header .job-name',
          '.chat-header .name',
          '.chat-basic-info .name',
          '.chat-basic-info .position-name',
          '.position-card .name',
          '.chat-top-info .name',
          '.chat-top-info .position-name'
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
        
        // 尝试从聊天标题获取
        const titleEl = document.querySelector('.chat-header-title, .chat-title');
        if (titleEl) {
          const text = titleEl.textContent.trim();
          if (text) return text;
        }
        
        return '';
      } catch (e) {
        return '';
      }
    }

    /**
     * 处理HR交互
     * @param {string} hrKey - HR唯一标识
     * @returns {Promise<void>}
     */
    static async handleHRInteraction(hrKey) {
      const hasResponded = await this.hasHRResponded();

      if (!state.hrInteractions.sentGreetingsHRs.has(hrKey)) {
        await this._handleFirstInteraction(hrKey);
        return;
      }

      if (
        !state.hrInteractions.sentResumeHRs.has(hrKey) ||
        !state.hrInteractions.sentImageResumeHRs.has(hrKey)
      ) {
        if (hasResponded) {
          await this._handleFollowUpResponse(hrKey);
        }
        // 无论是否发送简历，都尝试AI回复
        await Core.aiReply();
        return;
      }

      // 所有流程完成后，调用AI回复
      await Core.aiReply();
    }

    static async _handleFirstInteraction(hrKey) {
      const strategyLabel = STRATEGIES[getConversationStrategy()] ? STRATEGIES[getConversationStrategy()].label : "平衡";
      Core.log(`首次沟通(对话策略:${strategyLabel}): ${hrKey}`);
      const sentGreeting = await this.sendGreetings();

      if (sentGreeting) {
        StorageManager.addRecordWithLimit(
          CONFIG.STORAGE_KEYS.SENT_GREETINGS_HRS,
          hrKey,
          state.hrInteractions.sentGreetingsHRs,
          CONFIG.STORAGE_LIMITS.SENT_GREETINGS_HRS
        );

        await this._handleResumeSending(hrKey);
      }
    }

    static async _handleResumeSending(hrKey) {
      if (
        state.settings.useAutoSendResume &&
        !state.hrInteractions.sentResumeHRs.has(hrKey)
      ) {
        const sentResume = await this.sendResume();
        if (sentResume) {
          StorageManager.addRecordWithLimit(
            CONFIG.STORAGE_KEYS.SENT_RESUME_HRS,
            hrKey,
            state.hrInteractions.sentResumeHRs,
            CONFIG.STORAGE_LIMITS.SENT_RESUME_HRS
          );
        }
      }

      if (
        state.settings.useAutoSendImageResume &&
        !state.hrInteractions.sentImageResumeHRs.has(hrKey)
      ) {
        const sentImageResume = await this.sendImageResume();
        if (sentImageResume) {
          StorageManager.addRecordWithLimit(
            CONFIG.STORAGE_KEYS.SENT_IMAGE_RESUME_HRS,
            hrKey,
            state.hrInteractions.sentImageResumeHRs,
            CONFIG.STORAGE_LIMITS.SENT_IMAGE_RESUME_HRS
          );
        }
      }
    }

    static async _handleFollowUpResponse(hrKey) {
      if (this.hasCardMessage()) {
        const handled = await this.handleCardMessage(hrKey);
        if (handled) {
          return;
        }
      }

      const lastMessage = await Core.getLastFriendMessageText();

      if (
        lastMessage &&
        (lastMessage.includes("简历") || lastMessage.includes("发送简历"))
      ) {
        Core.log(`HR提到"简历"，发送简历: ${hrKey}`);

        if (
          state.settings.useAutoSendImageResume &&
          !state.hrInteractions.sentImageResumeHRs.has(hrKey)
        ) {
          const sentImageResume = await this.sendImageResume();
          if (sentImageResume) {
            state.hrInteractions.sentImageResumeHRs.add(hrKey);
            StatePersistence.saveState();
            Core.log(`已向 ${hrKey} 发送图片简历`);
            return;
          }
        }

        if (!state.hrInteractions.sentResumeHRs.has(hrKey)) {
          const sentResume = await this.sendResume();
          if (sentResume) {
            state.hrInteractions.sentResumeHRs.add(hrKey);
            StatePersistence.saveState();
            Core.log(`已向 ${hrKey} 发送简历`);
          }
        }
      }
    }

    /**
     * 发送自定义回复
     * @param {string} replyText - 回复文本
     * @returns {Promise<boolean>} 是否发送成功
     */
    static async sendCustomReply(replyText) {
      try {
        const inputBox = await Core.waitForElement("#chat-input");
        if (!inputBox) {
          Core.log("未找到聊天输入框");
          return false;
        }

        inputBox.textContent = "";
        inputBox.focus();
        document.execCommand("insertText", false, replyText);
        await Core.delay(CONFIG.OPERATION_INTERVAL / 10);

        const sendButton = DOMCache.get(".btn-send");
        if (sendButton) {
          await Core.simulateClick(sendButton);
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
        ErrorHandler.handle(error, 'HRInteractionManager.sendCustomReply');
        Core.log(`发送自定义回复出错: ${error.message}`);
        return false;
      }
    }

    static async hasHRResponded() {
      await Core.delay(state.settings.actionDelays.click);

      const chatContainer = DOMCache.get(".chat-message .im-list");
      if (!chatContainer) return false;

      const friendMessages = Array.from(
        chatContainer.querySelectorAll("li.message-item.item-friend")
      );
      return friendMessages.length > 0;
    }

    static hasCardMessage() {
      try {
        const chatContainer = DOMCache.get(".chat-message .im-list");
        if (!chatContainer) return false;

        const friendMessages = Array.from(
          chatContainer.querySelectorAll("li.message-item.item-friend")
        );
        if (friendMessages.length === 0) return false;

        const lastMessageEl = friendMessages[friendMessages.length - 1];
        const cardWrap = lastMessageEl.querySelector(".message-card-wrap");
        return cardWrap !== null;
      } catch (error) {
        Core.log(`检测卡片消息出错: ${error.message}`);
        return false;
      }
    }

    static async handleCardMessage(hrKey) {
      try {
        const chatContainer = DOMCache.get(".chat-message .im-list");
        if (!chatContainer) {
          Core.log("未找到聊天容器");
          return false;
        }

        const friendMessages = Array.from(
          chatContainer.querySelectorAll("li.message-item.item-friend")
        );
        if (friendMessages.length === 0) {
          Core.log("未找到HR消息");
          return false;
        }

        const lastMessageEl = friendMessages[friendMessages.length - 1];
        const cardButtons = lastMessageEl.querySelectorAll(".card-btn");

        if (!cardButtons || cardButtons.length === 0) {
          Core.log("未找到卡片按钮");
          return false;
        }

        for (const btn of cardButtons) {
          if (btn.textContent.trim() === "同意") {
            await Core.simulateClick(btn);
            await Core.delay(state.settings.actionDelays.click);
            return true;
          }
        }

        Core.log(`未找到"同意"按钮`);
        return false;
      } catch (error) {
        Core.log(`处理卡片消息出错: ${error.message}`);
        return false;
      }
    }

    static async sendGreetings() {
      try {
        if (state.customGreeting) {
          Core.log("发送JD定制化打招呼...");
          await this.sendCustomReply(state.customGreeting);
          await Core.delay(state.settings.actionDelays.click);
          state.customGreeting = null;
          StatsManager.increment("greetsSent");
          return true;
        }

        if (
          !state.settings.greetingsList ||
          state.settings.greetingsList.length === 0
        ) {
          return false;
        }

        for (let i = 0; i < state.settings.greetingsList.length; i++) {
          const greeting = state.settings.greetingsList[i];
          if (!greeting.content || !greeting.content.trim()) {
            continue;
          }
          Core.log(
            `发送自我介绍：第${i + 1}条/共${state.settings.greetingsList.length}条`
          );
          await this.sendCustomReply(greeting.content);
          await Core.delay(state.settings.actionDelays.click);
        }

        StatsManager.increment("greetsSent");
        return true;
      } catch (error) {
        Core.log(`发送自我介绍出错: ${error.message}`);
        return false;
      }
    }

    static _findMatchingResume(resumeItems, positionName) {
      try {
        const positionNameLower = positionName.toLowerCase();
        const twoCharKeywords = Core.extractTwoCharKeywords(positionNameLower);

        for (const keyword of twoCharKeywords) {
          for (const item of resumeItems) {
            const resumeNameElement = item.querySelector(".resume-name");
            if (!resumeNameElement) continue;

            const resumeName = resumeNameElement.textContent
              .trim()
              .toLowerCase();

            if (resumeName.includes(keyword)) {
              const resumeNameText = resumeNameElement.textContent.trim();
              Core.log(`智能匹配: "${resumeNameText}" 依据: "${keyword}"`);
              return item;
            }
          }
        }

        return null;
      } catch (error) {
        Core.log(`简历匹配出错: ${error.message}`);
        return null;
      }
    }

    static async sendResume() {
      try {
        const resumeBtn = await Core.waitForElement(() => {
          return [...document.querySelectorAll(".toolbar-btn")].find(
            (el) => el.textContent.trim() === "发简历"
          );
        });

        if (!resumeBtn) {
          Core.log("无法发送简历，未找到发简历按钮");
          return false;
        }

        if (resumeBtn.classList.contains("unable")) {
          Core.log("对方未回复，您无权发送简历");
          return false;
        }

        let positionName = Core.getPositionName();
        if (!positionName) {
          Core.log("未找到岗位名称元素");
        }

        await Core.simulateClick(resumeBtn);
        await Core.smartDelay(state.settings.actionDelays.click, "click");
        await Core.smartDelay(800, "resume_load");

        const confirmDialog = document.querySelector(
          ".panel-resume.sentence-popover"
        );
        if (confirmDialog) {
          Core.log("您只有一份附件简历");

          const confirmBtn = confirmDialog.querySelector(".btn-sure-v2");
          if (!confirmBtn) {
            Core.log("未找到确认按钮");
            return false;
          }

          await Core.simulateClick(confirmBtn);
          return true;
        }

        const resumeList = await Core.waitForElement("ul.resume-list");
        if (!resumeList) {
          Core.log("未找到简历列表");
          return false;
        }

        const resumeItems = Array.from(
          resumeList.querySelectorAll("li.list-item")
        );
        if (resumeItems.length === 0) {
          Core.log("未找到简历列表项");
          return false;
        }

        let selectedResumeItem = null;
        if (positionName) {
          selectedResumeItem = this._findMatchingResume(
            resumeItems,
            positionName
          );
        }

        if (!selectedResumeItem) {
          selectedResumeItem = resumeItems[0];
          const resumeName = selectedResumeItem
            .querySelector(".resume-name")
            .textContent.trim();
          Core.log('使用第一个简历: "' + resumeName + '"');
        }

        await Core.simulateClick(selectedResumeItem);
        await Core.smartDelay(state.settings.actionDelays.click, "click");
        await Core.smartDelay(500, "selection");

        const sendBtn = await Core.waitForElement(
          "button.btn-v2.btn-sure-v2.btn-confirm"
        );
        if (!sendBtn) {
          Core.log("未找到发送按钮");
          return false;
        }

        if (sendBtn.disabled) {
          Core.log("发送按钮不可用，可能简历未正确选择");
          return false;
        }

        await Core.simulateClick(sendBtn);
        return true;
      } catch (error) {
        Core.log(`发送简历出错: ${error.message}`);
        return false;
      }
    }

    static selectImageResume(positionName) {
      try {
        const positionNameLower = positionName.toLowerCase();

        if (state.settings.imageResumes.length === 1) {
          return state.settings.imageResumes[0];
        }

        const twoCharKeywords = Core.extractTwoCharKeywords(positionNameLower);

        for (const keyword of twoCharKeywords) {
          for (const resume of state.settings.imageResumes) {
            const resumeNameLower = resume.path.toLowerCase();

            if (resumeNameLower.includes(keyword)) {
              Core.log(`智能匹配: "${resume.path}" 依据: "${keyword}"`);
              return resume;
            }
          }
        }

        return state.settings.imageResumes[0];
      } catch (error) {
        Core.log(`选择图片简历出错: ${error.message}`);
        return state.settings.imageResumes[0] || null;
      }
    }

    static async sendImageResume() {
      try {
        if (
          !state.settings.useAutoSendImageResume ||
          !state.settings.imageResumes ||
          state.settings.imageResumes.length === 0
        ) {
          return false;
        }

        let positionName = Core.getPositionName();
        if (!positionName) {
          Core.log("未找到岗位名称元素");
        }

        const imageSendBtn = await Core.waitForElement(
          '.toolbar-btn-content.icon.btn-sendimg input[type="file"]'
        );
        if (!imageSendBtn) {
          Core.log("未找到图片发送按钮");
          return false;
        }

        // 发送所有图片简历
        let sentCount = 0;
        for (const resume of state.settings.imageResumes) {
          if (!resume || !resume.data) {
            Core.log(`跳过无效简历: ${resume?.path || 'unknown'}`);
            continue;
          }

          try {
            const byteCharacters = atob(resume.data.split(",")[1]);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: "image/jpeg" });

            const file = new File([blob], resume.path, {
              type: "image/jpeg",
              lastModified: new Date().getTime(),
            });

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            imageSendBtn.files = dataTransfer.files;

            const event = new Event("change", { bubbles: true });
            imageSendBtn.dispatchEvent(event);

            sentCount++;
            Core.log(`已发送图片简历: ${resume.path}`);

            // 等待一下再发送下一张，避免过快
            if (sentCount < state.settings.imageResumes.length) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (err) {
            Core.log(`发送图片简历失败 ${resume.path}: ${err.message}`);
          }
        }

        Core.log(`共发送 ${sentCount} 张图片简历`);
        return sentCount > 0;
      } catch (error) {
        Core.log(`发送图片出错: ${error.message}`);
        return false;
      }
    }
  }

