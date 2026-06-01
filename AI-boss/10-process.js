  async function toggleProcess() {
    state.isRunning = !state.isRunning;

    if (state.isRunning) {
      state.comments.isCommentMode = false;
      state.jobList = [];
      state.currentCityIndex = 0;

      state.includeKeywords = elements.includeInput.value
        .trim()
        .toLowerCase()
        .split(/[，,]/)
        .filter((keyword) => keyword.trim() !== "");
      state.locationKeywords = (elements.locationInput?.value || "")
        .trim()
        .toLowerCase()
        .split(/[，,]/)
        .filter((keyword) => keyword.trim() !== "");

      elements.controlBtn.textContent = "停止海投";
      elements.controlBtn.style.background = "#4285f4";

      const logPanel = document.querySelector("#pro-log");
      if (logPanel) {
        logPanel.innerHTML = "";
      }

      const startTime = new Date();
      Core.log(`开始自动海投，时间：${startTime.toLocaleTimeString()}`);
      Core.log(
        `筛选条件：职位名包含【${state.includeKeywords.join("、") || "无"
        }】，工作地包含【${state.locationKeywords.join("、") || "无"}】`
      );

      // 如果有多个城市，先切换到第一个城市
      const cities = state.locationKeywords.filter(kw => kw.trim() !== '');
      if (cities.length > 0) {
        const firstCity = cities[0];
        Core.log(`准备切换到第一个城市: ${firstCity}`);
        const switched = await Core.switchCity(firstCity);
        if (switched) {
          Core.log(`已切换到 ${firstCity}，等待页面加载...`);
          await Core.delay(3000);
        } else {
          Core.log(`切换城市失败，使用当前页面`);
        }
      }

      if (!Core.isPeakHour()) {
        const peakRanges = Core.getPeakHourRanges();
        const confirmed = confirm(
          "【投递时间段提醒】\n\n当前不在最佳投递时段内。\n\n最佳投递时间：" + peakRanges + "\n\n非高峰时段投递，HR 在线率和回复率可能较低。\n\n是否仍要继续启动海投？"
        );
        if (!confirmed) {
          state.isRunning = false;
          elements.controlBtn.textContent = "启动海投";
          elements.controlBtn.style.background = "#4285f4";
          return;
        }
        Core.log("用户确认在非高峰时段继续投递");
      } else {
        Core.log("当前处于最佳投递时段 (" + Core.getPeakHourRanges() + ")");
      }

      Core.startProcessing();
    } else {
      elements.controlBtn.textContent = "启动海投";
      elements.controlBtn.style.background = "#4285f4";

      state.isRunning = false;
      state.currentIndex = 0;

      // 评论功能已移除
    }
  }

  function toggleChatProcess() {
    state.isRunning = !state.isRunning;

    if (state.isRunning) {
      elements.controlBtn.textContent = "停止智能聊天";
      elements.controlBtn.style.background = "#34a853";

      const startTime = new Date();
      Core.log(`开始智能聊天，时间：${startTime.toLocaleTimeString()}`);

      Core.startProcessing();
    } else {
      elements.controlBtn.textContent = "开始智能聊天";
      elements.controlBtn.style.background = "#34a853";

      state.isRunning = false;

      if (Core.messageObserver) {
        Core.messageObserver.disconnect();
        Core.messageObserver = null;
      }

      const stopTime = new Date();
      Core.log(`停止智能聊天，时间：${stopTime.toLocaleTimeString()}`);
    }
  }

  const STORAGE = {
    LETTER: "letterLastShown",
    GUIDE: "shouldShowGuide",
    AI_COUNT: "aiReplyCount",
    AI_DATE: "lastAiDate",
    VISITED_GREET_SET: "hasVisitedGreetSet",
  };

