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
          rejectedHRs: [...state.hrInteractions.rejectedHRs],
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

        const rejectedHRs = StorageManager.getParsedItem("rejectedHRs", []);
        if (Array.isArray(rejectedHRs))
          state.hrInteractions.rejectedHRs = new Set(rejectedHRs);

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

  const InterviewManager = {
    KEY: "bossInterviews",

    add(company, position, time, location, notes) {
      const interview = {
        id: Date.now().toString(),
        company: company || "未知公司",
        position: position || "未知岗位",
        time: time || "待确认",
        location: location || "待确认",
        notes: notes || "",
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      state.interviews.push(interview);
      this.save();
      if (typeof UI !== "undefined" && UI.updateStatsDisplay) {
        UI.updateStatsDisplay();
      }
      return interview;
    },

    save() {
      localStorage.setItem(this.KEY, JSON.stringify(state.interviews));
    },

    remove(id) {
      state.interviews = state.interviews.filter(i => i.id !== id);
      this.save();
    },

    getPending() {
      return state.interviews.filter(i => i.status === "pending");
    },
  };

  const ReportManager = {
    getWeeklyReport() {
      const stats = state.stats;
      const interviews = state.interviews.filter(i => {
        const d = new Date(i.createdAt);
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return d.getTime() > weekAgo;
      });
      const hrReplyRate = stats.greetsSent > 0 ? ((stats.hrReplies / stats.greetsSent) * 100).toFixed(1) : "0";
      return `📊 本周投递周报（${StatsManager.getToday()}）
━━━━━━━━━━━━━
👋 打招呼：${stats.greetsSent} 次
💬 HR回复：${stats.hrReplies} 次（回复率 ${hrReplyRate}%）
🎯 面试邀约：${stats.interviewInvites} 个
📅 待面试：${interviews.length} 家
━━━━━━━━━━━━━
小胡版AI-boss海投助手 · 自动生成`;
    },
  };

  const JobTracker = {
    KEY: "bossJobTracker",

    add(job) {
      const exists = state.jobTracker.find(j => j.companyName === job.companyName && j.jobName === job.jobName);
      if (exists) {
        exists.matchScore = job.matchScore || exists.matchScore;
        exists.matchLevel = job.matchLevel || exists.matchLevel;
        exists.matchReasons = job.matchReasons || exists.matchReasons;
        exists.matchedSkills = job.matchedSkills || exists.matchedSkills;
        exists.jd = job.jd || exists.jd;
        exists.updatedAt = Date.now();
        if (job.companyInfo) exists.companyInfo = { ...exists.companyInfo, ...job.companyInfo };
      } else {
        state.jobTracker.push({
          id: Date.now().toString(),
          companyName: job.companyName || "未知",
          jobName: job.jobName || "未知",
          salary: job.salary || "",
          location: job.location || "",
          status: "interested",
          matchScore: job.matchScore || 0,
          matchLevel: job.matchLevel || "未评估",
          matchReasons: job.matchReasons || [],
          matchedSkills: job.matchedSkills || [],
          companyInfo: job.companyInfo || {},
          jd: job.jd || "",
          collectedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      this.save();
    },

    updateStatus(companyName, jobName, status) {
      const job = state.jobTracker.find(j => j.companyName === companyName && j.jobName === jobName);
      if (!job) return;
      job.status = status;
      job.updatedAt = Date.now();
      this.save();
      if (typeof UI !== "undefined" && UI.updateDashboard) UI.updateDashboard();
    },

    getStats() {
      const jobs = state.jobTracker;
      return {
        total: jobs.length,
        interested: jobs.filter(j => j.status === "interested").length,
        applied: jobs.filter(j => j.status === "applied").length,
        interviewing: jobs.filter(j => j.status === "interviewing").length,
        rejected: jobs.filter(j => j.status === "rejected").length,
        highMatch: jobs.filter(j => j.matchScore >= 7).length,
      };
    },

    findByCompany(companyName) {
      return state.jobTracker.filter(j => j.companyName && j.companyName.includes(companyName));
    },

    save() {
      localStorage.setItem(this.KEY, JSON.stringify(state.jobTracker));
    },
  };

  const Analytics = {
    KEY: "bossAnalytics",
    MAX: 500,
    MAX_AGE: 7 * 24 * 60 * 60 * 1000,

    track(eventType, page, metadata) {
      if (!state.analyticsEvents) state.analyticsEvents = [];
      state.analyticsEvents.push({
        eventType, page: page || "", metadata: metadata || {}, clientTs: Date.now(),
      });
      // 清理
      const cutoff = Date.now() - this.MAX_AGE;
      state.analyticsEvents = state.analyticsEvents.filter(e => e.clientTs > cutoff).slice(-this.MAX);
      this.save();
      // 同步到桌面管家
      if (typeof DesktopBridge !== 'undefined') {
        DesktopBridge.trackEvent(eventType, metadata);
      }
    },

    save() {
      localStorage.setItem(this.KEY, JSON.stringify(state.analyticsEvents));
    },
  };

