  class StorageManager {
    static setItem(key, value) {
      try {
        localStorage.setItem(
          key,
          typeof value === "string" ? value : JSON.stringify(value)
        );
        return true;
      } catch (error) {
        Core.log(`设置存储项 ${key} 失败: ${error.message}`);
        return false;
      }
    }

    static getItem(key, defaultValue = null) {
      try {
        const value = localStorage.getItem(key);
        return value !== null ? value : defaultValue;
      } catch (error) {
        Core.log(`获取存储项 ${key} 失败: ${error.message}`);
        return defaultValue;
      }
    }

    static addRecordWithLimit(storageKey, record, currentSet, limit) {
      try {
        if (currentSet.has(record)) {
          return;
        }

        let records = this.getParsedItem(storageKey, []);
        records = Array.isArray(records) ? records : [];

        if (records.length >= limit) {
          records.shift();
        }

        records.push(record);
        currentSet.add(record);
        this.setItem(storageKey, records);

        console.log(
          `存储管理: 添加记录${records.length >= limit ? "并删除最早记录" : ""
          }，当前${storageKey}数量: ${records.length}/${limit}`
        );
      } catch (error) {
        console.log(`存储管理出错: ${error.message}`);
      }
    }

    static getParsedItem(storageKey, defaultValue = []) {
      try {
        const data = this.getItem(storageKey);
        return data ? JSON.parse(data) : defaultValue;
      } catch (error) {
        Core.log(`解析存储记录出错: ${error.message}`);
        return defaultValue;
      }
    }

    static ensureStorageLimits() {
      const limitConfigs = [
        {
          key: CONFIG.STORAGE_KEYS.PROCESSED_HRS,
          set: state.hrInteractions.processedHRs,
          limit: CONFIG.STORAGE_LIMITS.PROCESSED_HRS,
        },
        {
          key: CONFIG.STORAGE_KEYS.SENT_GREETINGS_HRS,
          set: state.hrInteractions.sentGreetingsHRs,
          limit: CONFIG.STORAGE_LIMITS.SENT_GREETINGS_HRS,
        },
        {
          key: CONFIG.STORAGE_KEYS.SENT_RESUME_HRS,
          set: state.hrInteractions.sentResumeHRs,
          limit: CONFIG.STORAGE_LIMITS.SENT_RESUME_HRS,
        },
        {
          key: CONFIG.STORAGE_KEYS.SENT_IMAGE_RESUME_HRS,
          set: state.hrInteractions.sentImageResumeHRs,
          limit: CONFIG.STORAGE_LIMITS.SENT_IMAGE_RESUME_HRS,
        },
      ];

      limitConfigs.forEach(({ key, set, limit }) => {
        const records = this.getParsedItem(key, []);
        if (records.length > limit) {
          const trimmedRecords = records.slice(-limit);
          this.setItem(key, trimmedRecords);

          set.clear();
          trimmedRecords.forEach((record) => set.add(record));

          console.log(
            `存储管理: 清理${key}记录，从${records.length}减少到${trimmedRecords.length}`
          );
        }
      });
    }
  }

  class StatePersistence {
    static saveState() {
      try {
        const stateMap = {
          aiReplyCount: state.ai.replyCount,
          lastAiDate: state.ai.lastAiDate,

          useAiReply: state.ai.useAiReply,
          useAutoSendResume: state.settings.useAutoSendResume,
          useAutoSendImageResume: state.settings.useAutoSendImageResume,
          imageResumeData: state.settings.imageResumeData,
          imageResumes: state.settings.imageResumes || [],
          greetingsList: state.settings.greetingsList || [],
          theme: state.ui.theme,
          clickDelay: state.settings.actionDelays.click,
          includeKeywords: state.includeKeywords,
          locationKeywords: state.locationKeywords,
        };

        Object.entries(stateMap).forEach(([key, value]) => {
          StorageManager.setItem(key, value);
        });
      } catch (error) {
        Core.log(`保存状态失败: ${error.message}`);
      }
    }

    static loadState() {
      try {
        state.includeKeywords = StorageManager.getParsedItem(
          "includeKeywords",
          []
        );
        state.locationKeywords =
          StorageManager.getParsedItem("locationKeywords") ||
          StorageManager.getParsedItem("excludeKeywords", []);

        const imageResumes = StorageManager.getParsedItem("imageResumes", []);
        if (Array.isArray(imageResumes))
          state.settings.imageResumes = imageResumes;

        const greetingsList = StorageManager.getParsedItem("greetingsList", []);
        if (Array.isArray(greetingsList))
          state.settings.greetingsList = greetingsList;

        StorageManager.ensureStorageLimits();
      } catch (error) {
        Core.log(`加载状态失败: ${error.message}`);
      }
    }
  }

  const StatsManager = {
    KEY: "bossDailyStats",

    getToday() {
      return new Date().toISOString().split("T")[0];
    },

    load() {
      const today = this.getToday();
      try {
        const raw = StorageManager.getItem(this.KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data.date === today) {
            state.stats.greetsSent = data.greetsSent || 0;
            state.stats.hrReplies = data.hrReplies || 0;
            state.stats.interviewInvites = data.interviewInvites || 0;
            state.stats.date = data.date;
            return;
          }
        }
      } catch (e) {}
      state.stats.greetsSent = 0;
      state.stats.hrReplies = 0;
      state.stats.interviewInvites = 0;
      state.stats.date = today;
      this.save();
    },

    save() {
      state.stats.date = this.getToday();
      StorageManager.setItem(this.KEY, JSON.stringify({
        greetsSent: state.stats.greetsSent,
        hrReplies: state.stats.hrReplies,
        interviewInvites: state.stats.interviewInvites,
        date: state.stats.date,
      }));
    },

    increment(key) {
      if (key === "greetsSent") state.stats.greetsSent++;
      else if (key === "hrReplies") state.stats.hrReplies++;
      else if (key === "interviewInvites") state.stats.interviewInvites++;
      this.save();
      if (typeof UI !== "undefined" && UI.updateStatsDisplay) {
        UI.updateStatsDisplay();
      }
    },
  };

