// ==UserScript==
// @name         小胡版AI-boss海投助手
// @namespace    https://github.com/DYxiaochen
// @version      2.0.0.0
// @description  基于Yangshengzhou开源项目改进的求职工具！小胡开发用于提高BOSS直聘投递效率，AI智能回复，批量沟通，高效求职
// @author       小胡 (基于Yangshengzhou开源项目)
// @match        https://www.zhipin.com/web/*
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @supportURL   https://github.com/DYxiaochen/AI-BossJob
// @homepageURL  https://github.com/DYxiaochen/AI-BossJob
// @license      AGPL-3.0-or-later
// @icon         https://gitee.com/Yangshengzhou/jobs_helper/raw/Boss/assets/icon.ico
// @connect      zhipin.com
// @connect      spark-api-open.xf-yun.com
// @connect      jasun.xyz
// @connect      api.siliconflow.cn
// @connect      ark.cn-beijing.volces.com
// @connect      api.openai.com
// @connect      api.deepseek.com
// @connect      localhost
// @noframes
// @require      https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.min.js
// ==/UserScript==

(function () {
  "use strict";

  /**
   * @typedef {Object} HRInteraction
   * @property {string} hrKey - HR唯一标识
   * @property {boolean} hasGreeted - 是否已打招呼
   * @property {boolean} hasSentResume - 是否已发送简历
   * @property {boolean} hasSentImageResume - 是否已发送图片简历
   */

  /**
   * @typedef {Object} JobInfo
   * @property {string} jobId - 职位ID
   * @property {string} title - 职位标题
   * @property {string} company - 公司名称
   * @property {string} salary - 薪资范围
   * @property {string} location - 工作地点
   * @property {string} hrKey - HR标识
   */

  /**
   * @typedef {Object} GreetingItem
   * @property {string} id - 问候语ID
   * @property {string} content - 问候语内容
   */

  /**
   * @typedef {Object} ImageResume
   * @property {string} id - 图片简历ID
   * @property {string} name - 图片简历名称
   * @property {string} data - Base64编码的图片数据
   */

  /**
   * @typedef {Object} ErrorInfo
   * @property {string} message - 错误消息
   * @property {string} stack - 错误堆栈
   * @property {string} context - 错误上下文
   * @property {string} timestamp - 时间戳
   */
  const CONFIG = {
    BASIC_INTERVAL: 1000,
    OPERATION_INTERVAL: 1200,

    DELAYS: {
      SHORT: 30,
      MEDIUM_SHORT: 200,
    },
    MINI_ICON_SIZE: 40,
    STORAGE_KEYS: {
      PROCESSED_HRS: "processedHRs",
      SENT_GREETINGS_HRS: "sentGreetingsHRs",
      SENT_RESUME_HRS: "sentResumeHRs",
      SENT_IMAGE_RESUME_HRS: "sentImageResumeHRs",
      AI_REPLY_COUNT: "aiReplyCount",
      LAST_AI_DATE: "lastAiDate",
      DAILY_STATS: "bossDailyStats",
      JOB_TRACKER: "bossJobTracker",
      ANALYTICS: "bossAnalytics",
    },
    STORAGE_LIMITS: {
      PROCESSED_HRS: 500,
      SENT_GREETINGS_HRS: 500,
      SENT_RESUME_HRS: 300,
      SENT_IMAGE_RESUME_HRS: 300,
    },

    API: {
      TIMEOUT: 10000,
      BASE_URL: 'https://jasun.xyz/api',
      RETRY_COUNT: 3,
      RETRY_DELAY: 1000
    },

    UI: {
      MINI_ICON_SIZE: 40,
      ANIMATION_DURATION: 300,
      DEBOUNCE_DELAY: 300
    },

    PERFORMANCE: {
      DOM_CACHE_MAX_AGE: 5000,
      BATCH_SIZE: 10,
      CONCURRENT_LIMIT: 3
    },

    SMART_INTERVAL: {
      MIN: 3000,
      MAX: 8000,
    },

    MATCH: {
      MIN_SCORE: 3,
      TITLE_WEIGHT: 2,
      DESC_WEIGHT: 1,
    },

    COMPANY_CHECK: {
      REJECT_THRESHOLD: 6,
    },

    PEAK_HOURS: [
      { start: 9, end: 11, label: "上午 9:00-11:00" },
      { start: 14, end: 17, label: "下午 14:00-17:00" },
    ],

    REJECTION_KEYWORDS: [
      "不合适", "不太符合", "不考虑", "抱歉", "遗憾",
      "已招到", "招满了", "暂时不需要", "有更合适的人选",
      "下次合作", "以后再说", "不需要了", "不太匹配",
      "经验不符", "技能不匹配", "已停止招聘", "岗位关闭",
      "已找到合适人选", "不录用", "暂时不招", "目前已招满",
      "已经找到", "不符合要求", "暂不匹配", "祝您找到",
      "祝你找到", "感谢你的关注", "感谢关注",
    ],

    DESKTOP_APP: {
      BASE_URL: 'http://localhost:5001',
      ENABLED: true,
      CHECK_INTERVAL: 10000,
    },
  };

  const getStoredJSON = (key, defaultValue) => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : defaultValue;
    } catch (e) {
      console.error(`Error parsing ${key}:`, e);
      return defaultValue;
    }
  };

  // 安全地存储大文本到localStorage（自动截断）
  const setLargeItem = (key, value, maxLength = 500000) => {
    try {
      let textToStore = value;
      
      // 如果文本太长，截断它
      if (textToStore && textToStore.length > maxLength) {
        console.warn(`文本太长(${textToStore.length}字符)，已截断到${maxLength}字符`);
        textToStore = textToStore.substring(0, maxLength) + "\n[内容已截断，仅保存前" + maxLength + "字符]";
      }
      
      const jsonString = JSON.stringify(textToStore);
      
      // 检查是否超过localStorage限制
      if (jsonString.length > 2000000) { // 约2MB
        console.warn(`存储数据太大(${jsonString.length}字节)，尝试进一步截断`);
        textToStore = textToStore.substring(0, Math.floor(maxLength / 2)) + "\n[内容已大幅截断以符合存储限制]";
      }
      
      localStorage.setItem(key, JSON.stringify(textToStore));
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
        console.error(`存储空间不足，无法保存${key}`);
        // 尝试保存截断版本
        try {
          const truncated = String(value).substring(0, 100000) + "\n[因存储限制已截断]";
          localStorage.setItem(key, JSON.stringify(truncated));
          return 'truncated';
        } catch (e2) {
          console.error(`即使截断后仍无法保存${key}`);
          return false;
        }
      }
      console.error(`Error saving ${key}:`, e);
      return false;
    }
  };
  const state = {
    isRunning: false,
    currentIndex: 0,
    currentCityIndex: 0,

    includeKeywords: [],
    locationKeywords: [],

    jobList: [],

    ui: {
      isMinimized: false,
      theme: localStorage.getItem("theme") || "light",
    },

    hrInteractions: {
      processedHRs: new Set(getStoredJSON("processedHRs", [])),
      sentGreetingsHRs: new Set(getStoredJSON("sentGreetingsHRs", [])),
      sentResumeHRs: new Set(getStoredJSON("sentResumeHRs", [])),
      sentImageResumeHRs: new Set(getStoredJSON("sentImageResumeHRs", [])),
      lastMessageTime: getStoredJSON("lastMessageTime", {}),
      lastSentMsg: getStoredJSON("lastSentMsg", {}),
      rejectedHRs: new Set(getStoredJSON("rejectedHRs", [])),
    },

    ai: {
      replyCount: getStoredJSON("aiReplyCount", 0),
      lastAiDate: localStorage.getItem("lastAiDate") || "",
      useAiReply: true,
    },

  stats: {
    greetsSent: 0,
    hrReplies: 0,
    interviewInvites: 0,
    date: "",
  },

  interviews: getStoredJSON("bossInterviews", []),

    settings: {
      useAutoSendResume: getStoredJSON("useAutoSendResume", false),
      actionDelays: {
        click: parseInt(localStorage.getItem("clickDelay") || "130"),
      },
      ai: {
        role:
          localStorage.getItem("aiRole") ||
          "你是求职的应届生正在面对HR，回复需满足：20字内，编造专业对口/实习经验/证书任一岗位优势；被问个人信息或岗位条件，直接配合提供合理数据；全程积极真诚无拒绝言辞。",
        // 免费版本：用户自定义AI API配置
        apiKey: localStorage.getItem("aiApiKey") || "",
        apiUrl: localStorage.getItem("aiApiUrl") || "https://spark-api-open.xf-yun.com/v1/chat/completions",
        model: localStorage.getItem("aiModel") || "lite",
        useCustomApi: localStorage.getItem("useCustomApi") === "true",
        conversationStrategy: localStorage.getItem("conversationStrategy") || "balanced",
        enableCompanyCheck: localStorage.getItem("enableCompanyCheck") !== "false",
        enableCompanyResearch: localStorage.getItem("enableCompanyResearch") === "true",
      },
      autoReply: getStoredJSON("autoReply", false),
      useAutoSendImageResume: getStoredJSON("useAutoSendImageResume", false),
      imageResumeData: localStorage.getItem("imageResumeData") || null,
      communicationMode:
        localStorage.getItem("communicationMode") || "new-only",
      recruiterActivityStatus: getStoredJSON(
        "recruiterActivityStatus",
        ["不限"]
      ),
      excludeHeadhunters: getStoredJSON("excludeHeadhunters", false),
      imageResumes: getStoredJSON("imageResumes", []),
      resumeText: getStoredJSON("resumeText", ""),
      resumeAnalysis: getStoredJSON("resumeAnalysis", ""),
      greetingsList: getStoredJSON("greetingsList", [

      ]),
      resumes: getStoredJSON("bossResumes", []),
    },

    customGreeting: null,
    lastJdText: null,

    comments: {
      currentCompanyName: "",
      commentsList: [],
      isLoading: false,
      isCommentMode: false,
    },

    conversationMemory: {},

    jobTracker: getStoredJSON("bossJobTracker", []),
    analyticsEvents: getStoredJSON("bossAnalytics", []),
  };

  const elements = {
    panel: null,
    controlBtn: null,
    log: null,
    includeInput: null,
    locationInput: null,
    miniIcon: null,
  };
  class ErrorHandler {
    static handle(error, context = '') {
      const errorInfo = {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString()
      };

      console.error(`[${context}]`, error);

      if (state.settings && state.settings.errorReporting) {
        this.report(errorInfo);
      }

      return errorInfo;
    }

    static async wrap(fn, context) {
      try {
        return await fn();
      } catch (error) {
        return this.handle(error, context);
      }
    }

    static report(errorInfo) {
      console.log('Error reported:', errorInfo);
    }
  }

  class DOMCache {
    static cache = new Map();
    static maxAge = CONFIG.PERFORMANCE.DOM_CACHE_MAX_AGE;

    static get(selector) {
      const cached = this.cache.get(selector);
      if (cached && Date.now() - cached.time < this.maxAge) {
        return cached.element;
      }

      const element = document.querySelector(selector);
      if (element) {
        this.cache.set(selector, { element, time: Date.now() });
      }
      return element;
    }

    static getAll(selector) {
      return document.querySelectorAll(selector);
    }

    static clear() {
      this.cache.clear();
    }

    static remove(selector) {
      this.cache.delete(selector);
    }
  }

  class ManagedSet {
    constructor(maxSize = 500) {
      this.items = new Set();
      this.maxSize = maxSize;
    }

    add(item) {
      if (this.items.size >= this.maxSize) {
        const firstItem = this.items.values().next().value;
        this.items.delete(firstItem);
      }
      this.items.add(item);
    }

    has(item) {
      return this.items.has(item);
    }

    delete(item) {
      return this.items.delete(item);
    }

    clear() {
      this.items.clear();
    }

    get size() {
      return this.items.size;
    }

    toArray() {
      return Array.from(this.items);
    }
  }

  class EventManager {
    static listeners = new Map();

    static add(element, event, handler, options = {}) {
      const key = `${element.id || element.className || element.tagName}-${event}-${Date.now()}`;

      if (this.listeners.has(key)) {
        this.remove(key);
      }

      element.addEventListener(event, handler, options);
      this.listeners.set(key, { element, event, handler });
      return key;
    }

    static remove(key) {
      const listener = this.listeners.get(key);
      if (listener) {
        listener.element.removeEventListener(
          listener.event,
          listener.handler
        );
        this.listeners.delete(key);
      }
    }

    static removeAll() {
      this.listeners.forEach((_, key) => this.remove(key));
    }

    static getByElement(element) {
      const results = [];
      this.listeners.forEach((listener, key) => {
        if (listener.element === element) {
          results.push({ key, ...listener });
        }
      });
      return results;
    }
  }

  class DOMUtils {
    static async waitForAndAct(selector, action, options = {}) {
      const {
        timeout = 5000,
        retryInterval = 100,
        maxRetries = 3
      } = options;

      for (let i = 0; i < maxRetries; i++) {
        try {
          const element = await Core.waitForElement(selector, timeout);
          if (element) {
            const result = await action(element);
            return result;
          }
        } catch (error) {
          if (i === maxRetries - 1) throw error;
          await Core.delay(retryInterval);
        }
      }
      return null;
    }

    static async clickElement(selector, options = {}) {
      return this.waitForAndAct(selector, async (element) => {
        await Core.simulateClick(element);
        return true;
      }, options);
    }

    static async inputText(selector, text, options = {}) {
      return this.waitForAndAct(selector, async (element) => {
        element.textContent = "";
        element.focus();
        document.execCommand("insertText", false, text);
        return true;
      }, options);
    }

    static debounce(fn, delay = CONFIG.UI.DEBOUNCE_DELAY) {
      let timer = null;
      return function (...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    }

    static throttle(fn, delay = CONFIG.UI.DEBOUNCE_DELAY) {
      let lastTime = 0;
      return function (...args) {
        const now = Date.now();
        if (now - lastTime >= delay) {
          lastTime = now;
          return fn.apply(this, args);
        }
      };
    }
  }
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

      // 自动拒绝岗位
      const rejectRow = document.createElement("div");
      rejectRow.style.cssText = "margin-bottom: 12px;";
      const rejectCol = this._createInputControl(
        "自动拒绝岗位包含：",
        "communication-reject",
        "如：主播,客服,保险"
      );
      elements.communicationRejectInput = rejectCol.querySelector("input");
      elements.communicationRejectInput.addEventListener("input", (e) => {
        settings.communicationRejectKeywords = e.target.value;
        saveSettings();
      });
      rejectRow.append(rejectCol);

      elements.controlBtn = this._createTextButton(
        "开始智能聊天",
        "var(--primary-color)",
        () => {
          toggleChatProcess();
        }
      );

      container.append(configRow, rejectRow, elements.controlBtn);
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

      // 求职仪表盘
      const dashboard = document.createElement("div");
      dashboard.id = "boss-dashboard";
      dashboard.style.cssText = "margin: 0 0 10px 0; padding: 8px 10px; background: var(--secondary-color); border-radius: 8px;";
      dashboard.innerHTML = '<div style="font-size: 12px; font-weight: 600; color: var(--primary-color); margin-bottom: 4px;">📋 求职仪表盘</div><div id="dashboard-stats" style="display: flex; gap: 6px; flex-wrap: wrap; font-size: 10px; color: #666;"></div>';

      // 面试日程卡片
      const interviewCard = document.createElement("div");
      interviewCard.id = "boss-interview-card";
      interviewCard.style.cssText = "margin: 0 0 12px 0; padding: 8px 10px; background: var(--secondary-color); border-radius: 8px; display: none;";
      interviewCard.innerHTML = '<div style="font-size: 12px; font-weight: 600; color: var(--primary-color); margin-bottom: 4px;">📅 待面试: <span id="interview-count">0</span> 家</div><div id="interview-list" style="font-size: 11px; color: #666;"></div>';

      // 周报按钮
      const reportBtn = document.createElement("button");
      reportBtn.textContent = "📊 周报";
      reportBtn.style.cssText = "width: 100%; padding: 6px; margin-bottom: 8px; border-radius: 6px; border: 1px solid #667eea; background: rgba(102,126,234,0.08); color: #667eea; cursor: pointer; font-size: 12px;";
      reportBtn.addEventListener("click", () => {
        const report = ReportManager.getWeeklyReport();
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:2147483647;display:flex;align-items:center;justify-content:center;";
        const box = document.createElement("div");
        box.style.cssText = "background:#fff;border-radius:12px;padding:20px;max-width:320px;width:90%;font-size:14px;line-height:1.8;white-space:pre-wrap;";
        box.textContent = report;
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "关闭";
        closeBtn.style.cssText = "margin-top:12px;width:100%;padding:8px;border-radius:6px;border:none;background:#4285f4;color:#fff;cursor:pointer;font-size:14px;";
        closeBtn.onclick = () => overlay.remove();
        box.appendChild(closeBtn);
        overlay.appendChild(box);
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        document.body.appendChild(overlay);
      });

      footer.append(
        statsContainer,
        dashboard,
        interviewCard,
        reportBtn,
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
      this.updateInterviewDisplay();
      this.updateDashboard();
    },

    updateInterviewDisplay() {
      const card = document.getElementById("boss-interview-card");
      if (!card) return;
      const pending = state.interviews.filter(i => i.status === "pending");
      if (pending.length === 0) { card.style.display = "none"; return; }
      card.style.display = "block";
      document.getElementById("interview-count").textContent = pending.length;
      const listEl = document.getElementById("interview-list");
      listEl.innerHTML = pending.slice(0, 3).map(i =>
        `<div style="margin:2px 0;">${i.company} · ${i.position} · ${i.time}</div>`
      ).join("");
      if (pending.length > 3) listEl.innerHTML += `<div>...还有 ${pending.length - 3} 家</div>`;
    },

    updateDashboard() {
      const stats = JobTracker.getStats();
      const container = document.getElementById("dashboard-stats");
      if (!container) return;
      const items = [
        { label: "总岗位", value: stats.total },
        { label: "高匹配", value: stats.highMatch },
        { label: "已投递", value: stats.applied },
        { label: "面试中", value: stats.interviewing },
        { label: "已拒绝", value: stats.rejected },
      ];
      container.innerHTML = items.map(i =>
        `<span style="background:#fff;border-radius:4px;padding:2px 6px;">${i.label} <b>${i.value}</b></span>`
      ).join("");
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
  const settings = {
    useAutoSendResume: JSON.parse(
      localStorage.getItem("useAutoSendResume") || "false"
    ),
    actionDelays: {
      click: parseInt(localStorage.getItem("clickDelay") || "130"),
    },
    ai: {
      role:
        localStorage.getItem("aiRole") ||
        "你是求职的应届生正在面对HR，回复需满足：20字内，编造专业对口/实习经验/证书任一岗位优势；被问个人信息或岗位条件，直接配合提供合理数据；全程积极真诚无拒绝言辞。",
    },

    autoReply: JSON.parse(localStorage.getItem("autoReply") || "false"),

    useAutoSendImageResume: JSON.parse(
      localStorage.getItem("useAutoSendImageResume") || "false"
    ),
    imageResumeData: localStorage.getItem("imageResumeData") || null,

    communicationMode: localStorage.getItem("communicationMode") || "new-only",

    recruiterActivityStatus: JSON.parse(
      localStorage.getItem("recruiterActivityStatus") || '["不限"]'
    ),

    excludeHeadhunters: JSON.parse(
      localStorage.getItem("excludeHeadhunters") || "false"
    ),
  };

  function saveSettings() {
    localStorage.setItem(
      "useAutoSendResume",
      settings.useAutoSendResume.toString()
    );
    localStorage.setItem("clickDelay", settings.actionDelays.click.toString());
    localStorage.setItem("aiRole", settings.ai.role);

    localStorage.setItem("autoReply", settings.autoReply.toString());

    localStorage.setItem(
      "useAutoSendImageResume",
      settings.useAutoSendImageResume.toString()
    );

    if (settings.imageResumes) {
      localStorage.setItem(
        "imageResumes",
        JSON.stringify(settings.imageResumes)
      );
    }

    if (settings.imageResumeData) {
      localStorage.setItem("imageResumeData", settings.imageResumeData);
    } else {
      localStorage.removeItem("imageResumeData");
    }

    localStorage.setItem(
      "recruiterActivityStatus",
      JSON.stringify(settings.recruiterActivityStatus)
    );

    localStorage.setItem(
      "excludeHeadhunters",
      settings.excludeHeadhunters.toString()
    );

    localStorage.setItem(
      "conversationStrategy",
      settings.ai.conversationStrategy || "balanced"
    );

    if (state.settings) {
      Object.assign(state.settings, settings);
    }
  }

  function createSettingsDialog() {
    const dialog = document.createElement("div");
    dialog.id = "boss-settings-dialog";
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: clamp(300px, 90vw, 550px);
        height: 80vh;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        z-index: 999999;
        display: none;
        flex-direction: column;
        font-family: 'Segoe UI', sans-serif;
        overflow: hidden;
        transition: all 0.3s ease;
    `;

    dialog.innerHTML += `
        <style>
            #boss-settings-dialog {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.95);
            }
            #boss-settings-dialog.active {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
            .setting-item {
                transition: all 0.2s ease;
            }
            .setting-item:hover {
                background-color: rgba(0, 123, 255, 0.05);
            }
            .multi-select-container {
                position: relative;
                width: 100%;
                margin-top: 10px;
            }
            .multi-select-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px;
                border-radius: 8px;
                border: 1px solid #d1d5db;
                background: white;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .multi-select-header:hover {
                border-color: rgba(0, 123, 255, 0.7);
            }
            .multi-select-options {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                max-height: 200px;
                overflow-y: auto;
                border-radius: 8px;
                border: 1px solid #d1d5db;
                background: white;
                z-index: 100;
                box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                display: none;
            }
            .multi-select-option {
                padding: 10px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .multi-select-option:hover {
                background-color: rgba(0, 123, 255, 0.05);
            }
            .multi-select-option.selected {
                background-color: rgba(0, 123, 255, 0.1);
            }
            .multi-select-clear {
                color: #666;
                cursor: pointer;
                margin-left: 5px;
            }
            .multi-select-clear:hover {
                color: #333;
            }
        </style>
    `;

    const dialogHeader = createDialogHeader("AI-Boss海投助手·设置");

    const dialogContent = document.createElement("div");
    dialogContent.style.cssText = `
        padding: 18px;
        flex: 1;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: rgba(0, 123, 255, 0.5) rgba(0, 0, 0, 0.05);
    `;

    dialogContent.innerHTML += `
    <style>
        #boss-settings-dialog ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        #boss-settings-dialog ::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.05);
            border-radius: 10px;
            margin: 8px 0;
        }
        #boss-settings-dialog ::-webkit-scrollbar-thumb {
            background: rgba(0, 123, 255, 0.5);
            border-radius: 10px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            transition: all 0.2s ease;
        }
        #boss-settings-dialog ::-webkit-scrollbar-thumb:hover {
            background: rgba(0, 123, 255, 0.7);
            box-shadow: 0 1px 5px rgba(0,0,0,0.15);
        }
    </style>
    `;

    const tabsContainer = document.createElement("div");
    tabsContainer.style.cssText = `
        display: flex;
        border-bottom: 1px solid rgba(0, 123, 255, 0.2);
        margin-bottom: 20px;
    `;

    const aiTab = document.createElement("button");
    aiTab.textContent = "聊天设置";
    aiTab.className = "settings-tab active";
    aiTab.style.cssText = `
        padding: 9px 15px;
        background: rgba(0, 123, 255, 0.9);
        color: white;
        border: none;
        border-radius: 8px 8px 0 0;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-right: 5px;
    `;

    const advancedTab = document.createElement("button");
    advancedTab.textContent = "高级设置";
    advancedTab.className = "settings-tab";
    advancedTab.style.cssText = `
        padding: 9px 15px;
        background: rgba(0, 0, 0, 0.05);
        color: #333;
        border: none;
        border-radius: 8px 8px 0 0;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-right: 5px;
    `;

    tabsContainer.append(aiTab, advancedTab);

    const aiSettingsPanel = document.createElement("div");
    aiSettingsPanel.id = "ai-settings-panel";

    const roleSettingResult = createSettingItem(
      "AI角色定位",
      "定义AI在对话中的角色和语气特点",
      () => document.getElementById("ai-role-input")
    );

    const roleSetting = roleSettingResult.settingItem;

    const roleInput = document.createElement("textarea");
    roleInput.id = "ai-role-input";
    roleInput.rows = 5;
    roleInput.style.cssText = `
        width: 100%;
        padding: 12px;
        border-radius: 8px;
        border: 1px solid #d1d5db;
        resize: vertical;
        font-size: 14px;
        transition: all 0.2s ease;
        margin-top: 10px;
        opacity: 1;
        pointer-events: auto;
    `;

    addFocusBlurEffects(roleInput);
    roleSetting.append(roleInput);
    aiSettingsPanel.append(roleSetting);

    // 对话策略选择器
    const strategySettingResult = createSettingItem(
      "对话策略",
      "选择AI在求职对话中的沟通风格",
      () => document.querySelector(".strategy-option input:checked")
    );

    const strategySetting = strategySettingResult.settingItem;

    const strategyContainer = document.createElement("div");
    strategyContainer.style.cssText = `
      width: 100%;
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    const strategyOptions = [
      { value: "aggressive", label: STRATEGIES.aggressive.label, desc: STRATEGIES.aggressive.description },
      { value: "balanced", label: STRATEGIES.balanced.label, desc: STRATEGIES.balanced.description },
      { value: "conservative", label: STRATEGIES.conservative.label, desc: STRATEGIES.conservative.description },
    ];

    const currentStrategy = state.settings.ai.conversationStrategy || "balanced";

    strategyOptions.forEach((opt) => {
      const optionCard = document.createElement("label");
      optionCard.className = "strategy-option";
      optionCard.style.cssText = `
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 12px;
        border: 2px solid ${opt.value === currentStrategy ? "rgba(0, 123, 255, 0.7)" : "#e5e7eb"};
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        background: ${opt.value === currentStrategy ? "rgba(0, 123, 255, 0.05)" : "white"};
      `;

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "conversation-strategy";
      radio.value = opt.value;
      radio.checked = opt.value === currentStrategy;
      radio.style.cssText = "margin-top: 2px; accent-color: rgba(0, 123, 255, 0.9);";

      const textBlock = document.createElement("div");
      textBlock.style.cssText = "flex: 1;";

      const title = document.createElement("div");
      title.textContent = opt.label;
      title.style.cssText = "font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 2px;";

      const desc = document.createElement("div");
      desc.textContent = opt.desc;
      desc.style.cssText = "font-size: 12px; color: #6b7280; line-height: 1.4;";

      textBlock.append(title, desc);
      optionCard.append(radio, textBlock);

      optionCard.addEventListener("mouseenter", () => {
        if (!radio.checked) {
          optionCard.style.borderColor = "rgba(0, 123, 255, 0.3)";
          optionCard.style.background = "rgba(0, 123, 255, 0.02)";
        }
      });
      optionCard.addEventListener("mouseleave", () => {
        if (!radio.checked) {
          optionCard.style.borderColor = "#e5e7eb";
          optionCard.style.background = "white";
        }
      });

      radio.addEventListener("change", () => {
        if (radio.checked) {
          document.querySelectorAll(".strategy-option").forEach((card) => {
            card.style.borderColor = "#e5e7eb";
            card.style.background = "white";
          });
          optionCard.style.borderColor = "rgba(0, 123, 255, 0.7)";
          optionCard.style.background = "rgba(0, 123, 255, 0.05)";

          settings.ai.conversationStrategy = opt.value;
          state.settings.ai.conversationStrategy = opt.value;
        }
      });

      strategyContainer.appendChild(optionCard);
    });

    strategySetting.appendChild(strategyContainer);
    aiSettingsPanel.append(strategySetting);

    // 简历上传和分析设置
    const resumeUploadSettingResult = createSettingItem(
      "简历上传与AI分析",
      "上传简历文件(PDF/Word/TXT)，AI将自动分析并生成个性化回复",
      () => document.getElementById("resume-upload-container")
    );

    const resumeUploadSetting = resumeUploadSettingResult.settingItem;
    const resumeUploadContainer = document.createElement("div");
    resumeUploadContainer.id = "resume-upload-container";
    resumeUploadContainer.style.cssText = `
        width: 100%;
        margin-top: 10px;
    `;

    // 文件上传区域
    const fileUploadArea = document.createElement("div");
    fileUploadArea.style.cssText = `
        border: 2px dashed #d1d5db;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        background: #f9fafb;
        cursor: pointer;
        transition: all 0.3s ease;
    `;

    fileUploadArea.addEventListener("mouseenter", () => {
      fileUploadArea.style.borderColor = "#667eea";
      fileUploadArea.style.background = "#f0f4ff";
    });

    fileUploadArea.addEventListener("mouseleave", () => {
      fileUploadArea.style.borderColor = "#d1d5db";
      fileUploadArea.style.background = "#f9fafb";
    });

    // 隐藏的文件输入
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".pdf,.doc,.docx,.txt";
    fileInput.style.display = "none";

    // 上传图标和文字
    const uploadIcon = document.createElement("div");
    uploadIcon.innerHTML = "📄";
    uploadIcon.style.cssText = `
        font-size: 48px;
        margin-bottom: 10px;
    `;

    const uploadText = document.createElement("div");
    uploadText.textContent = "点击上传简历，或将简历拖拽到此处";
    uploadText.style.cssText = `
        font-size: 16px;
        color: #374151;
        margin-bottom: 5px;
    `;

    const uploadSubText = document.createElement("div");
    uploadSubText.textContent = "支持 Word、TXT 格式（PDF因转化格式问题暂不支持）";
    uploadSubText.style.cssText = `
        font-size: 12px;
        color: #6b7280;
    `;

    const resumeFileNameDisplay = document.createElement("div");
    resumeFileNameDisplay.id = "resume-file-name";
    resumeFileNameDisplay.style.cssText = `
        margin-top: 10px;
        font-size: 13px;
        color: #667eea;
        font-weight: 500;
    `;

    fileUploadArea.append(uploadIcon, uploadText, uploadSubText, resumeFileNameDisplay);

    // 拖拽上传
    fileUploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileUploadArea.style.borderColor = "#667eea";
      fileUploadArea.style.background = "#eef2ff";
    });

    fileUploadArea.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileUploadArea.style.borderColor = "#d1d5db";
      fileUploadArea.style.background = "#f9fafb";
    });

    fileUploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileUploadArea.style.borderColor = "#d1d5db";
      fileUploadArea.style.background = "#f9fafb";

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        fileInput.files = files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    // 点击上传区域触发文件选择
    fileUploadArea.addEventListener("click", () => {
      fileInput.click();
    });

    // 文件选择处理
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // 检查文件类型
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      const validExtensions = ['.pdf', '.doc', '.docx', '.txt'];
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
      
      if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        showNotification("不支持的文件格式，请上传 PDF、Word 或 TXT 文件", "error");
        return;
      }

      // 检查文件大小 (最大10MB)
      if (file.size > 10 * 1024 * 1024) {
        showNotification("文件太大，请上传小于 10MB 的文件", "error");
        return;
      }

      resumeFileNameDisplay.textContent = `已选择: ${file.name}`;
      
      try {
        showNotification("正在读取文件内容...", "info");
        const result = await Core.readResumeFile(file);
        
        if (result.success) {
          // 保存简历文本（使用安全存储）
          state.settings.resumeText = result.text;
          const saveResult = setLargeItem("resumeText", result.text);
          
          // 显示在文本框中（可编辑）
          resumeTextArea.value = result.text;
          
          if (saveResult === 'truncated') {
            showNotification(`文件读取成功！共 ${result.text.length} 字符。（内容已截断以符合存储限制）`, "warning");
          } else if (saveResult === false) {
            showNotification(`文件读取成功！共 ${result.text.length} 字符。（无法保存到本地存储，但当前会话可用）`, "warning");
          } else {
            showNotification(`文件读取成功！共 ${result.text.length} 字符。点击 AI分析简历 进行分析`, "success");
          }
        } else {
          // 提取失败，显示部分内容和提示
          if (result.text && result.text.length > 0) {
            resumeTextArea.value = result.text + "\n\n" + result.message;
            showNotification("文件内容提取不完整，请检查文本框中的提示", "warning");
          } else {
            resumeTextArea.value = result.message;
            showNotification(result.message, "error");
          }
        }
      } catch (error) {
        showNotification("读取文件失败: " + error.message, "error");
      }
    });

    // 简历文本编辑区域（读取文件后可编辑）
    const resumeTextLabel = document.createElement("div");
    resumeTextLabel.textContent = "简历内容（可编辑）：";
    resumeTextLabel.style.cssText = `
        font-size: 14px;
        font-weight: 600;
        color: #374151;
        margin-top: 15px;
        margin-bottom: 8px;
    `;

    // 添加提示说明
    const pasteHint = document.createElement("div");
    pasteHint.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
        border: 1px solid #3b82f6;
        border-radius: 8px;
        padding: 12px 15px;
        margin-bottom: 12px;
        font-size: 13px;
        color: #1e40af;
        line-height: 1.6;
      ">
        <strong>💡 提示：</strong>如果文件上传失败，请直接打开简历文件，
        <kbd style="background:#fff;padding:2px 6px;border-radius:3px;border:1px solid #93c5fd;">Ctrl+A</kbd> 
        全选后 
        <kbd style="background:#fff;padding:2px 6px;border-radius:3px;border:1px solid #93c5fd;">Ctrl+C</kbd> 
        复制，然后粘贴到下方文本框中。
      </div>
    `;

    const resumeTextArea = document.createElement("textarea");
    resumeTextArea.id = "resume-text-input";
    resumeTextArea.placeholder = "请上传简历文件，或在此直接粘贴简历内容...\n\n如果PDF/Word文件上传后显示乱码，请直接复制粘贴文本内容到这里";
    resumeTextArea.value = state.settings.resumeText || "";
    resumeTextArea.style.cssText = `
        width: 100%;
        min-height: 200px;
        padding: 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 14px;
        resize: vertical;
        font-family: inherit;
        line-height: 1.5;
    `;

    // 按钮容器
    const resumeBtnContainer = document.createElement("div");
    resumeBtnContainer.style.cssText = `
        display: flex;
        gap: 10px;
        margin-top: 10px;
    `;

    // AI分析按钮
    const analyzeBtn = document.createElement("button");
    analyzeBtn.textContent = "AI分析简历";
    analyzeBtn.style.cssText = `
        flex: 1;
        padding: 10px 16px;
        border-radius: 6px;
        border: none;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.3s ease;
    `;

    analyzeBtn.addEventListener("mouseenter", () => {
      analyzeBtn.style.transform = "translateY(-2px)";
      analyzeBtn.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.4)";
    });

    analyzeBtn.addEventListener("mouseleave", () => {
      analyzeBtn.style.transform = "translateY(0)";
      analyzeBtn.style.boxShadow = "none";
    });

    analyzeBtn.addEventListener("click", async () => {
      const resumeText = resumeTextArea.value.trim();
      if (!resumeText) {
        showNotification("请先上传简历文件或输入简历内容", "error");
        return;
      }
      
      // 保存简历文本（使用安全存储）
      state.settings.resumeText = resumeText;
      const saveResult = setLargeItem("resumeText", resumeText);
      if (saveResult === 'truncated') {
        showNotification("简历内容已截断以符合存储限制", "warning");
      } else if (saveResult === false) {
        showNotification("无法保存到本地存储，但当前会话可用", "warning");
      }
      
      analyzeBtn.textContent = "🔄 分析中...";
      analyzeBtn.disabled = true;
      
      try {
        const analysis = await Core.analyzeResumeWithAI(resumeText);
        if (analysis) {
          state.settings.resumeAnalysis = analysis;
          setLargeItem("resumeAnalysis", analysis);
          analysisResultArea.value = analysis;
          showNotification("简历分析完成！", "success");
          
          // 自动生成自我介绍
          await Core.generateGreetingsFromResume(resumeText, analysis);
        }
      } catch (error) {
        showNotification("分析失败: " + error.message, "error");
      } finally {
        analyzeBtn.textContent = "🤖 AI分析简历";
        analyzeBtn.disabled = false;
      }
    });

    // 保存按钮
    const saveResumeBtn = document.createElement("button");
    saveResumeBtn.textContent = "保存简历";
    saveResumeBtn.style.cssText = `
        padding: 10px 16px;
        border-radius: 6px;
        border: 1px solid #10b981;
        background: rgba(16, 185, 129, 0.1);
        color: #10b981;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.3s ease;
    `;

    saveResumeBtn.addEventListener("mouseenter", () => {
      saveResumeBtn.style.background = "rgba(16, 185, 129, 0.2)";
    });

    saveResumeBtn.addEventListener("mouseleave", () => {
      saveResumeBtn.style.background = "rgba(16, 185, 129, 0.1)";
    });

    saveResumeBtn.addEventListener("click", () => {
      state.settings.resumeText = resumeTextArea.value;
      const saveResult = setLargeItem("resumeText", resumeTextArea.value);
      if (saveResult === 'truncated') {
        showNotification("简历已保存（内容已截断以符合存储限制）", "warning");
      } else if (saveResult === false) {
        showNotification("无法保存到本地存储，但当前会话可用", "warning");
      } else {
        showNotification("简历已保存！", "success");
      }
    });

    // 清空简历按钮
    const clearResumeBtn = document.createElement("button");
    clearResumeBtn.textContent = "清空";
    clearResumeBtn.title = "清除简历内容和AI分析结果";
    clearResumeBtn.style.cssText = `
        padding: 10px 12px;
        border-radius: 6px;
        border: 1px solid #ef4444;
        background: rgba(239, 68, 68, 0.08);
        color: #ef4444;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s ease;
        white-space: nowrap;
    `;

    clearResumeBtn.addEventListener("mouseenter", () => {
      clearResumeBtn.style.background = "rgba(239, 68, 68, 0.15)";
    });
    clearResumeBtn.addEventListener("mouseleave", () => {
      clearResumeBtn.style.background = "rgba(239, 68, 68, 0.08)";
    });

    clearResumeBtn.addEventListener("click", () => {
      resumeTextArea.value = "";
      analysisResultArea.value = "";
      state.settings.resumeText = "";
      state.settings.resumeAnalysis = "";
      localStorage.removeItem("resumeText");
      localStorage.removeItem("resumeAnalysis");
      showNotification("简历已清空", "success");
    });

    resumeBtnContainer.append(analyzeBtn, saveResumeBtn, clearResumeBtn);

    // 分析结果显示区域
    const analysisLabel = document.createElement("div");
    analysisLabel.textContent = "AI分析结果（用于智能回复）：";
    analysisLabel.style.cssText = `
        font-size: 14px;
        font-weight: 600;
        color: #374151;
        margin-top: 15px;
        margin-bottom: 8px;
    `;

    const analysisResultArea = document.createElement("textarea");
    analysisResultArea.id = "resume-analysis-result";
    analysisResultArea.placeholder = "AI分析结果将显示在这里...";
    analysisResultArea.value = state.settings.resumeAnalysis || "";
    analysisResultArea.style.cssText = `
        width: 100%;
        min-height: 100px;
        padding: 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 13px;
        resize: vertical;
        font-family: inherit;
        line-height: 1.5;
        background: #f9fafb;
    `;

    // 简历切换
    const resumeSwitchContainer = document.createElement("div");
    resumeSwitchContainer.style.cssText = "display: flex; gap: 8px; margin-bottom: 10px; align-items: center;";

    const resumeSelect = document.createElement("select");
    resumeSelect.id = "resume-select";
    resumeSelect.style.cssText = "flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid #d1d5db; font-size: 13px;";

    const loadResumeOptions = () => {
      resumeSelect.innerHTML = '<option value="">-- 选择简历 --</option>';
      const resumes = state.settings.resumes || [];
      if (resumes.length === 0) {
        const opt = document.createElement("option");
        opt.value = "__current__";
        opt.textContent = "默认简历";
        resumeSelect.appendChild(opt);
      } else {
        resumes.forEach((r, i) => {
          const opt = document.createElement("option");
          opt.value = String(i);
          opt.textContent = r.name || ("简历 " + (i + 1));
          resumeSelect.appendChild(opt);
        });
      }
    };
    loadResumeOptions();

    resumeSelect.addEventListener("change", () => {
      const idx = resumeSelect.value;
      if (idx === "__current__") return;
      const resumes = state.settings.resumes || [];
      const selected = resumes[parseInt(idx)];
      if (selected) {
        state.settings.resumeText = selected.text || "";
        state.settings.resumeAnalysis = selected.analysis || "";
        if (typeof setLargeItem === "function") {
          setLargeItem("resumeText", selected.text || "");
          setLargeItem("resumeAnalysis", selected.analysis || "");
        }
        resumeTextArea.value = selected.text || "";
        analysisResultArea.value = selected.analysis || "";
        showNotification(`已切换到: ${selected.name}`, "success");
      }
    });

    const saveAsNewBtn = document.createElement("button");
    saveAsNewBtn.textContent = "另存为";
    saveAsNewBtn.style.cssText = "padding: 6px 10px; border-radius: 6px; border: 1px solid #667eea; background: rgba(102,126,234,0.1); color: #667eea; cursor: pointer; font-size: 12px; white-space: nowrap;";
    saveAsNewBtn.addEventListener("click", () => {
      const name = prompt("给这份简历起个名字：", "新简历");
      if (!name) return;
      const text = resumeTextArea.value.trim();
      const analysis = analysisResultArea.value.trim();
      if (!text) { showNotification("简历内容为空", "error"); return; }
      if (!state.settings.resumes) state.settings.resumes = [];
      state.settings.resumes.push({ id: Date.now().toString(), name, text, analysis });
      localStorage.setItem("bossResumes", JSON.stringify(state.settings.resumes));
      loadResumeOptions();
      resumeSelect.value = String(state.settings.resumes.length - 1);
      showNotification(`简历 "${name}" 已保存`, "success");
    });

    const deleteResumeBtn = document.createElement("button");
    deleteResumeBtn.textContent = "删除";
    deleteResumeBtn.style.cssText = "padding: 6px 10px; border-radius: 6px; border: 1px solid #ef4444; background: rgba(239,68,68,0.08); color: #ef4444; cursor: pointer; font-size: 12px; white-space: nowrap;";
    deleteResumeBtn.addEventListener("click", () => {
      const idx = parseInt(resumeSelect.value);
      if (isNaN(idx) || !state.settings.resumes || !state.settings.resumes[idx]) {
        showNotification("请先选择要删除的简历", "error"); return;
      }
      const name = state.settings.resumes[idx].name;
      if (confirm(`确定删除简历 "${name}"？`)) {
        state.settings.resumes.splice(idx, 1);
        localStorage.setItem("bossResumes", JSON.stringify(state.settings.resumes));
        loadResumeOptions();
        showNotification("已删除", "success");
      }
    });

    resumeSwitchContainer.append(resumeSelect, saveAsNewBtn, deleteResumeBtn);

    resumeUploadContainer.append(
      resumeSwitchContainer,
      fileUploadArea,
      fileInput,
      pasteHint,
      resumeTextLabel,
      resumeTextArea,
      resumeBtnContainer,
      analysisLabel,
      analysisResultArea
    );
    resumeUploadSetting.append(resumeUploadContainer);
    aiSettingsPanel.append(resumeUploadSetting);

    // 原有的自我介绍设置（保留但折叠）
    const greetingsSettingResult = createSettingItem(
      "自我介绍（可选）",
      "AI分析后会自动生成，也可手动编辑",
      () => document.getElementById("greetings-container")
    );

    const greetingsSetting = greetingsSettingResult.settingItem;
    const greetingsContainer = document.createElement("div");
    greetingsContainer.id = "greetings-container";
    greetingsContainer.style.cssText = `
        width: 100%;
        margin-top: 10px;
        display: none;
    `;

    const toggleGreetingsBtn = document.createElement("button");
    toggleGreetingsBtn.textContent = "显示/隐藏自我介绍设置";
    toggleGreetingsBtn.style.cssText = `
        padding: 6px 12px;
        border-radius: 4px;
        border: 1px solid #6b7280;
        background: rgba(107, 114, 128, 0.1);
        color: #6b7280;
        cursor: pointer;
        font-size: 13px;
        width: 100%;
        margin-bottom: 10px;
    `;
    toggleGreetingsBtn.addEventListener("click", () => {
      greetingsContainer.style.display = greetingsContainer.style.display === "none" ? "block" : "none";
    });

    const greetingsList = document.createElement("div");
    greetingsList.id = "greetings-list";
    greetingsList.style.cssText = `
        max-height: 200px;
        overflow-y: auto;
        margin-bottom: 10px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 10px;
    `;

    const addGreetingBtn = document.createElement("button");
    addGreetingBtn.textContent = "添加自我介绍";
    addGreetingBtn.style.cssText = `
        padding: 6px 12px;
        border-radius: 4px;
        border: 1px solid rgba(0, 123, 255, 0.7);
        background: rgba(0, 123, 255, 0.1);
        color: rgba(0, 123, 255, 0.9);
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s ease;
        width: 100%;
        margin-top: 8px;
    `;

    addGreetingBtn.addEventListener("mouseenter", () => {
      addGreetingBtn.style.backgroundColor = "rgba(0, 123, 255, 0.2)";
    });

    addGreetingBtn.addEventListener("mouseleave", () => {
      addGreetingBtn.style.backgroundColor = "rgba(0, 123, 255, 0.1)";
    });

    addGreetingBtn.addEventListener("click", () => {
      addGreetingItem();
    });

    greetingsContainer.append(greetingsList, addGreetingBtn);
    greetingsSetting.append(toggleGreetingsBtn, greetingsContainer);
    aiSettingsPanel.append(greetingsSetting);

    const advancedSettingsPanel = document.createElement("div");
    advancedSettingsPanel.id = "advanced-settings-panel";
    advancedSettingsPanel.style.display = "none";

    const autoReplySettingResult = createSettingItem(
      "Ai回复模式",
      "开启后Ai将自动回复消息",
      () => document.querySelector("#toggle-auto-reply-mode input")
    );

    const autoReplySetting = autoReplySettingResult.settingItem;
    const autoReplyDescriptionContainer =
      autoReplySettingResult.descriptionContainer;

    const autoReplyToggle = createToggleSwitch(
      "auto-reply-mode",
      settings.autoReply,
      (checked) => {
        settings.autoReply = checked;
      }
    );

    autoReplyDescriptionContainer.append(autoReplyToggle);

    const autoSendResumeSettingResult = createSettingItem(
      "自动发送附件简历",
      "开启后系统将自动发送附件简历给HR",
      () => document.querySelector("#toggle-auto-send-resume input")
    );

    const autoSendResumeSetting = autoSendResumeSettingResult.settingItem;
    const autoSendResumeDescriptionContainer =
      autoSendResumeSettingResult.descriptionContainer;

    const autoSendResumeToggle = createToggleSwitch(
      "auto-send-resume",
      settings.useAutoSendResume,
      (checked) => {
        settings.useAutoSendResume = checked;
      }
    );

    autoSendResumeDescriptionContainer.append(autoSendResumeToggle);

    const excludeHeadhuntersSettingResult = createSettingItem(
      "投递时排除猎头",
      "开启后将不会向猎头职位自动投递简历",
      () => document.querySelector("#toggle-exclude-headhunters input")
    );

    const excludeHeadhuntersSetting =
      excludeHeadhuntersSettingResult.settingItem;
    const excludeHeadhuntersDescriptionContainer =
      excludeHeadhuntersSettingResult.descriptionContainer;

    const excludeHeadhuntersToggle = createToggleSwitch(
      "exclude-headhunters",
      settings.excludeHeadhunters,
      (checked) => {
        settings.excludeHeadhunters = checked;
      }
    );

    excludeHeadhuntersDescriptionContainer.append(excludeHeadhuntersToggle);

    const imageResumeSettingResult = createSettingItem(
      "发送图片简历",
      "首次沟通发送图片简历（需先选择JPG格式图片）",
      () => document.querySelector("#toggle-auto-send-image-resume input")
    );

    const imageResumeSetting = imageResumeSettingResult.settingItem;
    const imageResumeDescriptionContainer =
      imageResumeSettingResult.descriptionContainer;

    if (!state.settings.imageResumes) {
      state.settings.imageResumes = [];
    }

    const fileInputContainer = document.createElement("div");
    fileInputContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 100%;
        margin-top: 10px;
    `;

    const addResumeBtn = document.createElement("button");
    addResumeBtn.id = "add-image-resume-btn";
    addResumeBtn.textContent = "添加图片简历";
    addResumeBtn.style.cssText = `
        padding: 8px 16px;
        border-radius: 6px;
        border: 1px solid rgba(0, 123, 255, 0.7);
        background: rgba(0, 123, 255, 0.1);
        color: rgba(0, 123, 255, 0.9);
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;
        align-self: flex-start;
        white-space: nowrap;
    `;

    const fileNameDisplay = document.createElement("div");
    fileNameDisplay.id = "image-resume-filename";
    fileNameDisplay.style.cssText = `
        flex: 1;
        padding: 8px;
        border-radius: 6px;
        border: 1px solid #d1d5db;
        background: #f8fafc;
        color: #334155;
        font-size: 14px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    `;
    const resumeCount = state.settings.imageResumes
      ? state.settings.imageResumes.length
      : 0;
    fileNameDisplay.textContent =
      resumeCount > 0 ? `已上传 ${resumeCount} 个简历` : "未选择文件";

    const autoSendImageResumeToggle = (() => {
      const hasImageResumes =
        state.settings.imageResumes && state.settings.imageResumes.length > 0;
      const isValidState = hasImageResumes && settings.useAutoSendImageResume;
      if (!hasImageResumes) settings.useAutoSendImageResume = false;

      return createToggleSwitch(
        "auto-send-image-resume",
        isValidState,
        (checked) => {
          if (
            checked &&
            (!state.settings.imageResumes ||
              state.settings.imageResumes.length === 0)
          ) {
            showNotification("请先选择图片文件", "error");

            const slider = document.querySelector(
              "#toggle-auto-send-image-resume .toggle-slider"
            );
            const container = document.querySelector(
              "#toggle-auto-send-image-resume .toggle-switch"
            );

            container.style.backgroundColor = "#e5e7eb";
            slider.style.transform = "translateX(0)";
            document.querySelector(
              "#toggle-auto-send-image-resume input"
            ).checked = false;
          }
          settings.useAutoSendImageResume = checked;
          return true;
        },
        true
      );
    })();

    const hiddenFileInput = document.createElement("input");
    hiddenFileInput.id = "image-resume-input";
    hiddenFileInput.type = "file";
    hiddenFileInput.accept = ".jpg,.jpeg";
    hiddenFileInput.style.display = "none";

    const uploadedResumesContainer = document.createElement("div");
    uploadedResumesContainer.id = "uploaded-resumes-container";
    uploadedResumesContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
    `;

    function renderResumeItem(index, resume) {
      const resumeItem = document.createElement("div");
      resumeItem.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            border-radius: 6px;
            background: rgba(0, 0, 0, 0.05);
            font-size: 14px;
        `;

      const fileNameSpan = document.createElement("span");
      fileNameSpan.textContent = resume.path;
      fileNameSpan.style.cssText = `
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-right: 8px;
        `;

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "删除";
      deleteBtn.style.cssText = `
            padding: 4px 12px;
            border-radius: 4px;
            border: 1px solid rgba(255, 70, 70, 0.7);
            background: rgba(255, 70, 70, 0.1);
            color: rgba(255, 70, 70, 0.9);
            cursor: pointer;
            font-size: 12px;
        `;

      deleteBtn.addEventListener("click", () => {
        state.settings.imageResumes.splice(index, 1);

        resumeItem.remove();

        if (state.settings.imageResumes.length === 0) {
          state.settings.useAutoSendImageResume = false;
          const toggleInput = document.querySelector(
            "#toggle-auto-send-image-resume input"
          );
          if (toggleInput) {
            toggleInput.checked = false;
            toggleInput.dispatchEvent(new Event("change"));
          }
        }

        if (
          typeof StatePersistence !== "undefined" &&
          StatePersistence.saveState
        ) {
          StatePersistence.saveState();
        }
      });

      resumeItem.appendChild(fileNameSpan);
      resumeItem.appendChild(deleteBtn);

      return resumeItem;
    }

    if (state.settings.imageResumes && state.settings.imageResumes.length > 0) {
      state.settings.imageResumes.forEach((resume, index) => {
        const resumeItem = renderResumeItem(index, resume);
        uploadedResumesContainer.appendChild(resumeItem);
      });
    }

    addResumeBtn.addEventListener("click", () => {
      if (state.settings.imageResumes.length >= 5) {
        if (typeof showNotification !== "undefined") {
          showNotification("免费版最多添加5个图片简历", "info");
        } else {
          alert("免费版最多添加5个图片简历");
        }
      } else {
        hiddenFileInput.click();
      }
    });

    hiddenFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];

        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.jpg') && !fileName.endsWith('.jpeg')) {
          if (typeof showNotification !== "undefined") {
            showNotification("仅支持JPG格式的图片文件", "error");
          } else {
            alert("仅支持JPG格式的图片文件");
          }
          hiddenFileInput.value = "";
          return;
        }

        const isDuplicate = state.settings.imageResumes.some(
          (resume) => resume.path === file.name
        );
        if (isDuplicate) {
          if (typeof showNotification !== "undefined") {
            showNotification("该文件名已存在", "error");
          } else {
            alert("该文件名已存在");
          }
          return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
          const newResume = {
            path: file.name,
            data: event.target.result,
          };

          state.settings.imageResumes.push(newResume);

          const index = state.settings.imageResumes.length - 1;
          const resumeItem = renderResumeItem(index, newResume);
          uploadedResumesContainer.appendChild(resumeItem);

          if (!state.settings.useAutoSendImageResume) {
            state.settings.useAutoSendImageResume = true;
            const toggleInput = document.querySelector(
              "#toggle-auto-send-image-resume input"
            );
            if (toggleInput) {
              toggleInput.checked = true;
              toggleInput.dispatchEvent(new Event("change"));
            }
          }

          if (
            typeof StatePersistence !== "undefined" &&
            StatePersistence.saveState
          ) {
            StatePersistence.saveState();
          }
        };
        reader.readAsDataURL(file);
      }
    });

    fileInputContainer.append(
      addResumeBtn,
      uploadedResumesContainer,
      hiddenFileInput
    );
    imageResumeDescriptionContainer.append(autoSendImageResumeToggle);
    imageResumeSetting.append(fileInputContainer);

    const recruiterStatusSettingResult = createSettingItem(
      "投递招聘者状态（多选）",
      "筛选活跃状态符合要求的招聘者进行投递",
      () => document.querySelector("#recruiter-status-select .select-header")
    );

    const recruiterStatusSetting = recruiterStatusSettingResult.settingItem;

    const statusSelect = document.createElement("div");
    statusSelect.id = "recruiter-status-select";
    statusSelect.className = "custom-select";
    statusSelect.style.cssText = `
        position: relative;
        width: 100%;
        margin-top: 10px;
    `;

    const statusHeader = document.createElement("div");
    statusHeader.className = "select-header";
    statusHeader.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        background: white;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        min-height: 44px;
    `;

    const statusDisplay = document.createElement("div");
    statusDisplay.className = "select-value";
    statusDisplay.style.cssText = `
        flex: 1;
        text-align: left;
        color: #334155;
        font-size: 14px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    `;
    statusDisplay.textContent = getStatusDisplayText();

    const statusIcon = document.createElement("div");
    statusIcon.className = "select-icon";
    statusIcon.innerHTML = "&#9660;";
    statusIcon.style.cssText = `
        margin-left: 10px;
        color: #64748b;
        transition: transform 0.2s ease;
    `;

    const statusClear = document.createElement("button");
    statusClear.className = "select-clear";
    statusClear.innerHTML = "×";
    statusClear.style.cssText = `
        background: none;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        font-size: 16px;
        margin-left: 8px;
        display: none;
        transition: color 0.2s ease;
    `;

    statusHeader.append(statusDisplay, statusClear, statusIcon);

    const statusOptions = document.createElement("div");
    statusOptions.className = "select-options";
    statusOptions.style.cssText = `
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        right: 0;
        max-height: 240px;
        overflow-y: auto;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        background: white;
        z-index: 100;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        display: none;
        transition: all 0.2s ease;
        scrollbar-width: thin;
        scrollbar-color: #cbd5e1 #f1f5f9;
    `;

    statusOptions.innerHTML += `
        <style>
            .select-options::-webkit-scrollbar {
                width: 6px;
            }
            .select-options::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 10px;
            }
            .select-options::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 10px;
            }
            .select-options::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
            }
        </style>
    `;

    const statusOptionsList = [
      { value: "不限", text: "不限" },
      { value: "在线", text: "在线" },
      { value: "刚刚活跃", text: "刚刚活跃" },
      { value: "今日活跃", text: "今日活跃" },
      { value: "3日内活跃", text: "3日内活跃" },
      { value: "本周活跃", text: "本周活跃" },
      { value: "本月活跃", text: "本月活跃" },
      { value: "半年前活跃", text: "半年前活跃" },
    ];

    statusOptionsList.forEach((option) => {
      const statusOption = document.createElement("div");
      statusOption.className =
        "select-option" +
        (settings.recruiterActivityStatus &&
          Array.isArray(settings.recruiterActivityStatus) &&
          settings.recruiterActivityStatus.includes(option.value)
          ? " selected"
          : "");
      statusOption.dataset.value = option.value;
      statusOption.style.cssText = `
            padding: 12px 16px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            font-size: 14px;
            color: #334155;
        `;

      const checkIcon = document.createElement("span");
      checkIcon.className = "check-icon";
      checkIcon.innerHTML = "✓";
      checkIcon.style.cssText = `
            margin-right: 8px;
            color: rgba(0, 123, 255, 0.9);
            font-weight: bold;
            display: ${settings.recruiterActivityStatus &&
          Array.isArray(settings.recruiterActivityStatus) &&
          settings.recruiterActivityStatus.includes(option.value)
          ? "inline"
          : "none"
        };
        `;

      const textSpan = document.createElement("span");
      textSpan.textContent = option.text;

      statusOption.append(checkIcon, textSpan);

      statusOption.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleStatusOption(option.value);
      });

      statusOptions.appendChild(statusOption);
    });

    statusHeader.addEventListener("click", () => {
      statusOptions.style.display =
        statusOptions.style.display === "block" ? "none" : "block";
      statusIcon.style.transform =
        statusOptions.style.display === "block"
          ? "rotate(180deg)"
          : "rotate(0)";
    });

    statusClear.addEventListener("click", (e) => {
      e.stopPropagation();
      settings.recruiterActivityStatus = [];
      updateStatusOptions();
    });

    document.addEventListener("click", (e) => {
      if (!statusSelect.contains(e.target)) {
        statusOptions.style.display = "none";
        statusIcon.style.transform = "rotate(0)";
      }
    });

    statusHeader.addEventListener("mouseenter", () => {
      statusHeader.style.borderColor = "rgba(0, 123, 255, 0.5)";
      statusHeader.style.boxShadow = "0 0 0 3px rgba(0, 123, 255, 0.1)";
    });

    statusHeader.addEventListener("mouseleave", () => {
      if (!statusHeader.contains(document.activeElement)) {
        statusHeader.style.borderColor = "#e2e8f0";
        statusHeader.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.05)";
      }
    });

    statusHeader.addEventListener("focus", () => {
      statusHeader.style.borderColor = "rgba(0, 123, 255, 0.7)";
      statusHeader.style.boxShadow = "0 0 0 3px rgba(0, 123, 255, 0.2)";
    });

    statusHeader.addEventListener("blur", () => {
      statusHeader.style.borderColor = "#e2e8f0";
      statusHeader.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.05)";
    });

    statusSelect.append(statusHeader, statusOptions);
    recruiterStatusSetting.append(statusSelect);

    // 公司背景评估开关
    const companyCheckSettingResult = createSettingItem(
      "公司背景评估",
      "AI分析岗位JD判断岗位靠谱度，1-6分自动拒绝（基于岗位JD内容评估）",
      () => document.querySelector("#toggle-company-check input")
    );
    const companyCheckSetting = companyCheckSettingResult.settingItem;
    const companyCheckDesc = companyCheckSettingResult.descriptionContainer;

    const companyCheckToggle = createToggleSwitch(
      "company-check",
      settings.ai.enableCompanyCheck !== false,
      (checked) => {
        settings.ai.enableCompanyCheck = checked;
        state.settings.ai.enableCompanyCheck = checked;
        localStorage.setItem("enableCompanyCheck", checked);
      }
    );
    companyCheckDesc.append(companyCheckToggle);

    // 企业背景调查开关
    const companyResearchSettingResult = createSettingItem(
      "企业背景调查",
      "AI基于训练数据评估公司背景（规模、口碑、负面新闻、劳动纠纷），与JD评估合并为一次API调用",
      () => document.querySelector("#toggle-company-research input")
    );
    const companyResearchSetting = companyResearchSettingResult.settingItem;
    const companyResearchDesc = companyResearchSettingResult.descriptionContainer;

    const companyResearchToggle = createToggleSwitch(
      "company-research",
      settings.ai.enableCompanyResearch === true,
      (checked) => {
        settings.ai.enableCompanyResearch = checked;
        state.settings.ai.enableCompanyResearch = checked;
        localStorage.setItem("enableCompanyResearch", checked);
      }
    );
    companyResearchDesc.append(companyResearchToggle);

    advancedSettingsPanel.append(
      autoReplySetting,
      autoSendResumeSetting,
      companyCheckSetting,
      companyResearchSetting,
      excludeHeadhuntersSetting,
      imageResumeSetting,
      recruiterStatusSetting
    );

    aiTab.addEventListener("click", () => {
      setActiveTab(aiTab, aiSettingsPanel);
    });

    advancedTab.addEventListener("click", () => {
      setActiveTab(advancedTab, advancedSettingsPanel);
    });

    const dialogFooter = document.createElement("div");
    dialogFooter.style.cssText = `
        padding: 15px 20px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        background: rgba(0, 0, 0, 0.03);
    `;

    const cancelBtn = createTextButton("取消", "#e5e7eb", () => {
      dialog.style.display = "none";
    });

    const saveBtn = createTextButton(
      "保存设置",
      "rgba(0, 123, 255, 0.9)",
      () => {
        try {
          const aiRoleInput = document.getElementById("ai-role-input");
          settings.ai.role = aiRoleInput ? aiRoleInput.value : "";

          saveSettings();

          showNotification("设置已保存");
          dialog.style.display = "none";
        } catch (error) {
          showNotification("保存失败: " + error.message, "error");
          console.error("保存设置失败:", error);
        }
      }
    );

    dialogFooter.append(cancelBtn, saveBtn);

    dialogContent.append(
      tabsContainer,
      aiSettingsPanel,
      advancedSettingsPanel
    );
    dialog.append(dialogHeader, dialogContent, dialogFooter);

    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) {
        dialog.style.display = "none";
      }
    });

    return dialog;
  }

  function showSettingsDialog() {
    let dialog = document.getElementById("boss-settings-dialog");
    if (!dialog) {
      dialog = createSettingsDialog();
      document.body.appendChild(dialog);
    }

    dialog.style.display = "flex";

    setTimeout(() => {
      dialog.classList.add("active");
      setTimeout(loadSettingsIntoUI, 100);
    }, 10);
  }

  function toggleStatusOption(value) {
    if (value === "不限") {
      settings.recruiterActivityStatus =
        settings.recruiterActivityStatus.includes("不限") ? [] : ["不限"];
    } else {
      if (settings.recruiterActivityStatus.includes("不限")) {
        settings.recruiterActivityStatus = [value];
      } else {
        if (settings.recruiterActivityStatus.includes(value)) {
          settings.recruiterActivityStatus =
            settings.recruiterActivityStatus.filter((v) => v !== value);
        } else {
          settings.recruiterActivityStatus.push(value);
        }

        if (settings.recruiterActivityStatus.length === 0) {
          settings.recruiterActivityStatus = ["不限"];
        }
      }
    }

    if (state.settings) {
      state.settings.recruiterActivityStatus = settings.recruiterActivityStatus;
    }

    updateStatusOptions();
  }

  function updateStatusOptions() {
    const options = document.querySelectorAll(
      "#recruiter-status-select .select-option"
    );
    options.forEach((option) => {
      const isSelected = settings.recruiterActivityStatus.includes(
        option.dataset.value
      );
      option.className = "select-option" + (isSelected ? " selected" : "");
      option.querySelector(".check-icon").style.display = isSelected
        ? "inline"
        : "none";

      if (option.dataset.value === "不限") {
        if (isSelected) {
          options.forEach((opt) => {
            if (opt.dataset.value !== "不限") {
              opt.className = "select-option";
              opt.querySelector(".check-icon").style.display = "none";
            }
          });
        }
      } else if (settings.recruiterActivityStatus.includes("不限")) {
        option.querySelector(".check-icon").style.display = "none";
        option.className = "select-option";
      }
    });

    document.querySelector(
      "#recruiter-status-select .select-value"
    ).textContent = getStatusDisplayText();

    document.querySelector(
      "#recruiter-status-select .select-clear"
    ).style.display =
      settings.recruiterActivityStatus.length > 0 &&
        !settings.recruiterActivityStatus.includes("不限")
        ? "inline"
        : "none";

    if (state.settings) {
      state.settings.recruiterActivityStatus = settings.recruiterActivityStatus;
    }
  }

  function getStatusDisplayText() {
    if (settings.recruiterActivityStatus.includes("不限")) {
      return "不限";
    }

    if (settings.recruiterActivityStatus.length === 0) {
      return "请选择";
    }

    if (settings.recruiterActivityStatus.length <= 2) {
      return settings.recruiterActivityStatus.join("、");
    }

    return `${settings.recruiterActivityStatus[0]}、${settings.recruiterActivityStatus[1]}等${settings.recruiterActivityStatus.length}项`;
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
      autoSendImageResumeInput.checked =
        settings.useAutoSendImageResume &&
        settings.imageResumes &&
        settings.imageResumes.length > 0;
    }

    const communicationModeSelector = document.querySelector(
      "#communication-mode-selector select"
    );
    if (communicationModeSelector) {
      communicationModeSelector.value = settings.communicationMode;
    }

    if (elements.communicationIncludeInput) {
      elements.communicationIncludeInput.value =
        settings.communicationIncludeKeywords || "";
    }

    const savedStrategy = settings.ai.conversationStrategy || localStorage.getItem("conversationStrategy") || "balanced";
    const strategyRadio = document.querySelector(`.strategy-option input[value="${savedStrategy}"]`);
    if (strategyRadio) {
      strategyRadio.checked = true;
      strategyRadio.dispatchEvent(new Event("change", { bubbles: true }));
    }

    updateStatusOptions();
  }

  function createDialogHeader(title, dialogId = "boss-settings-dialog") {
    const header = document.createElement("div");
    header.style.cssText = `
        padding: 16px 20px;
        background: #4285f4;
        color: white;
        font-size: 18px;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
        border-radius: 12px 12px 0 0;
    `;

    const titleElement = document.createElement("div");
    titleElement.textContent = title;
    titleElement.style.fontWeight = "600";

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "✕";
    closeBtn.title = "关闭";
    closeBtn.style.cssText = `
        width: 28px;
        height: 28px;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
        font-size: 16px;
        font-weight: bold;
    `;

    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
      closeBtn.style.transform = "scale(1.1)";
    });

    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
      closeBtn.style.transform = "scale(1)";
    });

    closeBtn.addEventListener("click", () => {
      const dialog = document.getElementById(dialogId);
      if (dialog) {
        dialog.style.display = "none";
      }
    });

    header.append(titleElement, closeBtn);
    return header;
  }

  function showActivationDialog() {
    let dialog = document.getElementById("boss-activation-dialog");
    if (!dialog) {
      dialog = createActivationDialog();
      document.body.appendChild(dialog);
    }

    dialog.style.display = "flex";

    setTimeout(() => {
      dialog.classList.add("active");
    }, 10);
  }

  function createActivationDialog() {
    const dialog = document.createElement("div");
    dialog.id = "boss-activation-dialog";
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: clamp(360px, 90vw, 480px);
        max-height: 85vh;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        z-index: 999999;
        display: none;
        flex-direction: column;
        font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
        overflow: hidden;
        transition: all 0.3s ease;
    `;

    dialog.innerHTML = `
      <style>
        #boss-activation-dialog.active {
            animation: dialogSlideIn 0.3s ease;
        }
        @keyframes dialogSlideIn {
            from {
                opacity: 0;
                transform: translate(-50%, -45%);
            }
            to {
                opacity: 1;
                transform: translate(-50%, -50%);
            }
        }
        .ai-config-input:focus, .ai-config-select:focus, .ai-config-textarea:focus {
            border-color: #4285f4 !important;
            box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.1);
        }
        .ai-config-btn:hover {
            transform: scale(1.02);
            box-shadow: 0 6px 20px rgba(33, 150, 243, 0.3);
        }
        .ai-preset-btn {
            padding: 6px 12px;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            background: #f5f5f5;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
        }
        .ai-preset-btn:hover {
            background: #4285f4;
            color: white;
            border-color: #4285f4;
        }
        .ai-config-section {
            margin-bottom: 16px;
        }
        .ai-config-label {
            display: block;
            margin-bottom: 6px;
            color: #333;
            font-weight: 500;
            font-size: 13px;
        }
        .ai-config-input, .ai-config-select {
            width: 100%;
            padding: 10px 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 13px;
            transition: all 0.3s ease;
            background: #fafafa;
            box-sizing: border-box;
        }
        .ai-config-textarea {
            width: 100%;
            padding: 10px 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 13px;
            transition: all 0.3s ease;
            background: #fafafa;
            box-sizing: border-box;
            resize: vertical;
            min-height: 80px;
            font-family: inherit;
        }
        .ai-config-scroll {
            max-height: calc(85vh - 70px);
            overflow-y: auto;
            padding: 20px;
        }
      </style>
      
      <!-- Header -->
      <div style="padding: 16px 20px; background: #4285f4; color: white; font-size: 18px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
        <div>AI配置</div>
        <button onclick="document.getElementById('boss-activation-dialog').style.display='none'" 
                style="width: 28px; height: 28px; background: rgba(255,255,255,0.2); color: white; border-radius: 50%; border: none; cursor: pointer; font-size: 16px; font-weight: bold; transition: all 0.2s ease;">✕</button>
      </div>
      
      <!-- Content -->
      <div class="ai-config-scroll">
        <p style="color: #666; font-size: 13px; margin: 0 0 16px 0;">配置你自己的AI API，支持硅基流动、火山引擎等平台</p>
        
        <!-- 平台预设 -->
        <div class="ai-config-section">
          <label class="ai-config-label">快速选择平台：</label>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button class="ai-preset-btn" data-preset="siliconflow">硅基流动</button>
            <button class="ai-preset-btn" data-preset="volcano">火山引擎</button>
            <button class="ai-preset-btn" data-preset="openai">OpenAI</button>
            <button class="ai-preset-btn" data-preset="deepseek">DeepSeek</button>
            <button class="ai-preset-btn" data-preset="custom">自定义</button>
          </div>
          <div style="margin-top: 10px;">
            <button id="siliconflow-visit-btn" 
                    style="padding: 8px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; transition: all 0.3s ease;">
              🚀 一键访问硅基流动获取API Key
            </button>
          </div>
        </div>
        
        <!-- API Key -->
        <div class="ai-config-section">
          <label class="ai-config-label">API Key：</label>
          <input type="password" id="ai-api-key" placeholder="输入你的API Key" 
                class="ai-config-input">
        </div>
        
        <!-- API URL -->
        <div class="ai-config-section">
          <label class="ai-config-label">API URL：</label>
          <input type="text" id="ai-api-url" placeholder="https://api.example.com/v1/chat/completions" 
                class="ai-config-input">
        </div>
        
        <!-- 模型选择 -->
        <div class="ai-config-section">
          <label class="ai-config-label">模型名称：</label>
          <input type="text" id="ai-model" placeholder="如：gpt-3.5-turbo、lite、deepseek-chat" 
                class="ai-config-input">
        </div>
        
        <!-- AI角色设定 -->
        <div class="ai-config-section">
          <label class="ai-config-label">AI角色设定（系统提示词）：</label>
          <textarea id="ai-role-config" placeholder="设定AI的角色和行为方式..." 
                    class="ai-config-textarea"></textarea>
        </div>
        
        <!-- 测试按钮 -->
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button id="ai-test-btn" class="ai-config-btn"
                  style="flex: 1; padding: 12px; background: #34a853; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
            测试连接
          </button>
          <button id="ai-save-btn" class="ai-config-btn"
                  style="flex: 1; padding: 12px; background: #4285f4; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
            保存配置
          </button>
        </div>
        
        <div id="ai-config-status" style="margin-top: 12px; font-size: 12px; color: #666; min-height: 16px; text-align: center;"></div>
      </div>
    `;

    setTimeout(() => {
      // AI平台预设配置
      const aiPresets = {
        siliconflow: {
          url: "https://api.siliconflow.cn/v1/chat/completions",
          model: "deepseek-ai/DeepSeek-V2.5"
        },
        volcano: {
          url: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
          model: "doubao-lite-4k"
        },
        openai: {
          url: "https://api.openai.com/v1/chat/completions",
          model: "gpt-3.5-turbo"
        },
        deepseek: {
          url: "https://api.deepseek.com/v1/chat/completions",
          model: "deepseek-chat"
        },
        custom: {
          url: "",
          model: ""
        }
      };

      // 加载已保存的配置
      const apiKeyInput = document.getElementById("ai-api-key");
      const apiUrlInput = document.getElementById("ai-api-url");
      const modelInput = document.getElementById("ai-model");
      const roleInput = document.getElementById("ai-role-config");
      const statusDiv = document.getElementById("ai-config-status");

      if (apiKeyInput) apiKeyInput.value = localStorage.getItem("aiApiKey") || "";
      if (apiUrlInput) apiUrlInput.value = localStorage.getItem("aiApiUrl") || "";
      if (modelInput) modelInput.value = localStorage.getItem("aiModel") || "";
      if (roleInput) roleInput.value = localStorage.getItem("aiRole") || "你是求职的应届生正在面对HR，回复需满足：20字内，编造专业对口/实习经验/证书任一岗位优势；被问个人信息或岗位条件，直接配合提供合理数据；全程积极真诚无拒绝言辞。";

      // 平台预设按钮点击事件
      document.querySelectorAll(".ai-preset-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const preset = btn.dataset.preset;
          const config = aiPresets[preset];
          if (config && apiUrlInput && modelInput) {
            apiUrlInput.value = config.url;
            modelInput.value = config.model;
            if (statusDiv) statusDiv.textContent = `已选择：${btn.textContent}`;
          }
        });
      });

      // 硅基流动访问按钮
      const siliconflowVisitBtn = document.getElementById("siliconflow-visit-btn");
      if (siliconflowVisitBtn) {
        siliconflowVisitBtn.addEventListener("click", () => {
          window.open("https://cloud.siliconflow.cn/i/8Wt6MyMe", "_blank");
        });
      }

      // 测试连接按钮
      const testBtn = document.getElementById("ai-test-btn");
      if (testBtn) {
        testBtn.addEventListener("click", async () => {
          const apiKey = apiKeyInput?.value?.trim();
          const apiUrl = apiUrlInput?.value?.trim();
          const model = modelInput?.value?.trim();

          if (!apiKey || !apiUrl || !model) {
            if (statusDiv) {
              statusDiv.textContent = "请填写完整的API配置信息";
              statusDiv.style.color = "#ea4335";
            }
            return;
          }

          testBtn.disabled = true;
          testBtn.textContent = "测试中...";
          if (statusDiv) statusDiv.textContent = "正在测试API连接...";

          try {
            const result = await testAiConnection(apiKey, apiUrl, model);
            if (result.success) {
              if (statusDiv) {
                statusDiv.textContent = "✓ 连接成功！AI回复：" + result.message;
                statusDiv.style.color = "#34a853";
              }
            } else {
              if (statusDiv) {
                statusDiv.textContent = "✗ 连接失败：" + result.message;
                statusDiv.style.color = "#ea4335";
              }
            }
          } catch (error) {
            if (statusDiv) {
              statusDiv.textContent = "✗ 测试出错：" + error.message;
              statusDiv.style.color = "#ea4335";
            }
          } finally {
            testBtn.disabled = false;
            testBtn.textContent = "测试连接";
          }
        });
      }

      // 保存配置按钮
      const saveBtn = document.getElementById("ai-save-btn");
      if (saveBtn) {
        saveBtn.addEventListener("click", () => {
          const apiKey = apiKeyInput?.value?.trim();
          const apiUrl = apiUrlInput?.value?.trim();
          const model = modelInput?.value?.trim();
          const role = roleInput?.value?.trim();

          if (apiKey) localStorage.setItem("aiApiKey", apiKey);
          if (apiUrl) localStorage.setItem("aiApiUrl", apiUrl);
          if (model) localStorage.setItem("aiModel", model);
          if (role) localStorage.setItem("aiRole", role);

          // 更新状态
          state.settings.ai.apiKey = apiKey;
          state.settings.ai.apiUrl = apiUrl;
          state.settings.ai.model = model;
          state.settings.ai.role = role;

          if (statusDiv) {
            statusDiv.textContent = "✓ 配置已保存！";
            statusDiv.style.color = "#34a853";
          }

          setTimeout(() => {
            dialog.style.display = "none";
          }, 1000);
        });
      }
    }, 100);

    // 测试AI连接的辅助函数
    async function testAiConnection(apiKey, apiUrl, model) {
      return new Promise((resolve) => {
        const testMessage = "你好，请回复'连接成功'即可。";
        
        // 构建请求体，兼容不同API格式
        const requestBody = {
          model: model,
          messages: [
            { role: "user", content: testMessage }
          ],
          max_tokens: 50
        };
        
        // 只有非硅基流动API才添加system role和额外参数
        if (!apiUrl.includes("siliconflow.cn")) {
          requestBody.messages.unshift({
            role: "system",
            content: "你是一个 helpful assistant。"
          });
          requestBody.temperature = 0.7;
          requestBody.stream = false;
        }

        // 火山引擎特殊处理
        const isVolcano = apiUrl.includes("volces.com");
        const headers = {
          "Content-Type": "application/json"
        };
        
        if (isVolcano) {
          // 火山引擎使用API Key格式不同
          headers["Authorization"] = "Bearer " + apiKey;
        } else {
          headers["Authorization"] = "Bearer " + apiKey;
        }

        GM_xmlhttpRequest({
          method: "POST",
          url: apiUrl,
          headers: headers,
          data: JSON.stringify(requestBody),
          timeout: 10000,
          onload: (response) => {
            console.log("API响应:", response.status, response.responseText);
            try {
              const result = JSON.parse(response.responseText);
              
              // 检查HTTP状态码
              if (response.status !== 200) {
                resolve({
                  success: false,
                  message: `HTTP错误 ${response.status}: ${result.error?.message || result.message || "未知错误"}`
                });
                return;
              }
              
              // OpenAI格式
              if (result.choices && result.choices[0] && result.choices[0].message) {
                resolve({
                  success: true,
                  message: result.choices[0].message.content.trim()
                });
              } else if (result.choices && result.choices[0] && result.choices[0].text) {
                // 某些API使用text字段
                resolve({
                  success: true,
                  message: result.choices[0].text.trim()
                });
              } else if (result.code !== undefined && result.code !== 0) {
                // 讯飞格式错误
                resolve({
                  success: false,
                  message: result.message || "API返回错误"
                });
              } else if (result.error) {
                // 标准错误格式
                resolve({
                  success: false,
                  message: result.error.message || "API错误"
                });
              } else {
                resolve({
                  success: false,
                  message: "无法解析API响应: " + JSON.stringify(result).substring(0, 100)
                });
              }
            } catch (error) {
              resolve({
                success: false,
                message: "响应解析失败: " + error.message + "，原始响应: " + response.responseText.substring(0, 200)
              });
            }
          },
          onerror: (error) => {
            console.error("网络请求失败:", error);
            resolve({
              success: false,
              message: "网络请求失败，请检查网络连接和API地址"
            });
          },
          ontimeout: () => {
            resolve({
              success: false,
              message: "请求超时(10秒)，请检查API地址是否正确"
            });
          }
        });
      });
    }

    return dialog;
  }

  function createSettingItem(title, description, controlGetter) {
    const settingItem = document.createElement("div");
    settingItem.className = "setting-item";
    settingItem.style.cssText = `
        padding: 15px;
        border-radius: 10px;
        margin-bottom: 15px;
        background: white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        border: 1px solid rgba(0, 123, 255, 0.1);
        display: flex;
        flex-direction: column;
    `;

    const titleElement = document.createElement("h4");
    titleElement.textContent = title;
    titleElement.style.cssText = `
        margin: 0 0 5px;
        color: #333;
        font-size: 16px;
        font-weight: 500;
    `;

    const descElement = document.createElement("p");
    descElement.textContent = description;
    descElement.style.cssText = `
        margin: 0;
        color: #666;
        font-size: 13px;
        line-height: 1.4;
    `;

    const descriptionContainer = document.createElement("div");
    descriptionContainer.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
    `;

    const textContainer = document.createElement("div");
    textContainer.append(titleElement, descElement);

    descriptionContainer.append(textContainer);

    settingItem.append(descriptionContainer);

    settingItem.addEventListener("click", () => {
      const control = controlGetter();
      if (control && typeof control.focus === "function") {
        control.focus();
      }
    });

    return {
      settingItem,
      descriptionContainer,
    };
  }

  function createToggleSwitch(
    id,
    isChecked,
    onChange
  ) {
    const container = document.createElement("div");
    container.className = "toggle-container";
    container.style.cssText =
      "display: flex; justify-content: space-between; align-items: center;";

    const switchContainer = document.createElement("div");
    switchContainer.className = "toggle-switch";

    switchContainer.style.cssText = `
        position: relative;
        width: 50px;
        height: 26px;
        border-radius: 13px;
        background-color: ${isChecked ? "rgba(0, 123, 255, 0.9)" : "#e5e7eb"
      };
        cursor: pointer;
        opacity: 1;
    `;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `toggle-${id}`;
    checkbox.checked = isChecked;
    checkbox.style.display = "none";

    const slider = document.createElement("span");
    slider.className = "toggle-slider";
    slider.style.cssText = `
        position: absolute;
        top: 3px;
        left: ${isChecked ? "27px" : "3px"};
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        transition: none;
    `;

    const forceUpdateUI = (checked) => {
      checkbox.checked = checked;
      switchContainer.style.backgroundColor = checked
        ? "rgba(0, 123, 255, 0.9)"
        : "#e5e7eb";
      slider.style.left = checked ? "27px" : "3px";
    };

    checkbox.addEventListener("change", () => {
      let allowChange = true;

      if (onChange) {
        allowChange = onChange(checkbox.checked) !== false;
      }

      if (!allowChange) {
        forceUpdateUI(!checkbox.checked);
        return;
      }

      forceUpdateUI(checkbox.checked);
    });

    switchContainer.addEventListener("click", () => {
      const newState = !checkbox.checked;

      if (onChange) {
        if (onChange(newState) !== false) {
          forceUpdateUI(newState);
        }
      } else {
        forceUpdateUI(newState);
      }
    });

    switchContainer.append(checkbox, slider);
    container.append(switchContainer);

    return container;
  }

  function createTextButton(text, backgroundColor, onClick) {
    const button = document.createElement("button");
    button.textContent = text;
    button.style.cssText = `
        padding: 9px 18px;
        border-radius: 8px;
        border: none;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        background: ${backgroundColor};
        color: white;
    `;

    button.addEventListener("click", onClick);

    return button;
  }

  function addFocusBlurEffects(element) {
    element.addEventListener("focus", () => {
      element.style.borderColor = "rgba(0, 123, 255, 0.7)";
      element.style.boxShadow = "0 0 0 3px rgba(0, 123, 255, 0.2)";
    });

    element.addEventListener("blur", () => {
      element.style.borderColor = "#d1d5db";
      element.style.boxShadow = "none";
    });
  }

  function setActiveTab(tab, panel) {
    const tabs = document.querySelectorAll(".settings-tab");
    const panels = [
      document.getElementById("ai-settings-panel"),
      document.getElementById("advanced-settings-panel"),
    ];

    tabs.forEach((t) => {
      t.classList.remove("active");
      t.style.backgroundColor = "rgba(0, 0, 0, 0.05)";
      t.style.color = "#333";
    });

    panels.forEach((p) => {
      p.style.display = "none";
    });

    tab.classList.add("active");
    tab.style.backgroundColor = "rgba(0, 123, 255, 0.9)";
    tab.style.color = "white";

    panel.style.display = "block";
  }

  function showNotification(message, type = "success") {
    const notification = document.createElement("div");
    const bgColor =
      type === "success" ? "rgba(40, 167, 69, 0.9)" : "rgba(220, 53, 69, 0.9)";

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${bgColor};
        color: white;
        padding: 10px 15px;
        border-radius: 8px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        z-index: 9999999;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => (notification.style.opacity = "1"), 10);
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 2000);
  }
  const Core = {
    CONFIG,

    messageObserver: null,
    lastProcessedMessage: null,
    processingMessage: false,
    currentMonitoredHR: null,
    loopRunning: false,

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
      if (this.loopRunning) { this.log("处理循环已在运行中，跳过重复启动"); return; }
      this.loopRunning = true;
      Analytics.track("processing_start", location.pathname.includes("/chat") ? "chat" : "jobs", { mode: location.pathname.includes("/chat") ? settings.communicationMode : "auto" });

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
      this.loopRunning = false;
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
      const hasIncludeKeywords = settings.communicationIncludeKeywords && settings.communicationIncludeKeywords.trim();
      const hasRejectKeywords = settings.communicationRejectKeywords && settings.communicationRejectKeywords.trim();

      if (hasIncludeKeywords || hasRejectKeywords) {
        await this.simulateClick(latestChatLi.querySelector(".figure"));
        await this.delay(CONFIG.OPERATION_INTERVAL * 2);

        const positionName = this.getPositionName();
        const positionNameLower = positionName.toLowerCase();

        // 先检查拒绝关键词
        if (hasRejectKeywords) {
          const rejectKeywords = settings.communicationRejectKeywords
            .toLowerCase().split(/[,]/).map(kw => kw.trim()).filter(kw => kw.length > 0);
          const isReject = rejectKeywords.some(kw => positionNameLower.includes(kw));
          if (isReject) {
            this.log(`自动拒绝岗位，含拒绝关键词[${rejectKeywords.join(", ")}]`);
            return;
          }
        }

        // 再检查包含关键词
        if (hasIncludeKeywords) {
          const includeKeywords = settings.communicationIncludeKeywords
            .toLowerCase().split(/[,]/).map(kw => kw.trim()).filter(kw => kw.length > 0);
          const isMatch = includeKeywords.some(kw => positionNameLower.includes(kw));
          if (!isMatch) {
            this.log(`跳过岗位对话，不含关键词[${includeKeywords.join(", ")}]`);
            return;
          }
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

          // 立即标记为已处理，防止并发重复进入
          state.hrInteractions.processedHRs.add(hrKey);
          if (!state.hrInteractions.lastMessageTime) state.hrInteractions.lastMessageTime = {};
          state.hrInteractions.lastMessageTime[hrKey] = Date.now();

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

    isRejectedMessage(message) {
      if (!message) return false;
      return CONFIG.REJECTION_KEYWORDS.some(kw => message.includes(kw));
    },

    addToBlacklist(hrKey) {
      state.hrInteractions.rejectedHRs.add(hrKey);
      StatePersistence.saveState();
      this.log(`已加入不再回复列表: ${hrKey}`);
    },

    async shouldReplyToChat(chatItem, hrKey, lastMessage) {
      // 黑名单检查：已被拒绝的HR不再自动回复
      if (state.hrInteractions.rejectedHRs.has(hrKey)) {
        return false;
      }

      // 检查是否已经处理过这个HR（5分钟内不再处理）
      if (state.hrInteractions.processedHRs.has(hrKey)) {
        const lastProcessed = state.hrInteractions.lastMessageTime?.[hrKey] || 0;
        const now = Date.now();
        if (now - lastProcessed < 5 * 60 * 1000) {
          return false;
        }
        // 冷却过后也检查：最后一条消息是否是脚本自己发的
        const lastSent = state.hrInteractions.lastSentMsg?.[hrKey];
        if (lastSent && lastMessage && (
          lastSent.includes(lastMessage) || lastMessage.includes(lastSent) ||
          lastSent.substring(0, 10) === lastMessage.substring(0, 10)
        )) {
          return false;
        }
        // 侧边栏显示系统消息（简历/文件/交换等），说明脚本刚操作过，跳过
        const systemIndicators = ["附件简历", "简历请求", "[文件]", "[图片]", "交换手机号", "交换微信", "请求已发送"];
        if (lastSent && lastMessage && systemIndicators.some(ind => lastMessage.includes(ind))) {
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
        this.currentMonitoredHR = hrKey;
        // 获取最后一条HR消息
        const lastMessage = await this.getLastFriendMessageText();
        if (!lastMessage) {
          this.log(`${hrKey}: 未找到HR消息`);
          return;
        }

        this.log(`${hrKey} 的最后消息: ${lastMessage.slice(0, 30)}...`);

        // 拒绝关键词检测：HR说了拒绝的话，加入黑名单不再回复
        if (this.isRejectedMessage(lastMessage)) {
          this.log(`${hrKey}: 检测到拒绝关键词，加入不再回复列表`);
          this.addToBlacklist(hrKey);
          return;
        }

        // 检查是否已经回复过这条消息
        const messageKey = `${hrKey}-${this.cleanMessage(lastMessage)}`;
        if (this.lastProcessedMessage === messageKey) {
          this.log(`${hrKey}: 已回复过此消息`);
          return;
        }

        // 检查是否用户已经手动回复过（避免重复回复）
        const allChatTexts = Array.from(document.querySelectorAll(".text p span, .text span"))
          .filter(el => !el.closest(".friend-content") && !el.closest(".last-msg"))
          .map(el => el.textContent.trim())
          .filter(t => t && t.length > 1);
        // 检查侧边栏预览：如果用户从其他设备手动回复了，侧边栏会显示用户的回复
        const selectedChat = document.querySelector(".friend-content.selected, .friend-content-warp:has(.friend-content.selected)");
        if (selectedChat) {
          const sidebarPreview = selectedChat.querySelector(".last-msg-text")?.textContent?.trim() || "";
          if (sidebarPreview && sidebarPreview !== lastMessage && sidebarPreview.length > 1) {
            const isQuestion = sidebarPreview.includes("?") || sidebarPreview.includes("？") || sidebarPreview.includes("吗") || sidebarPreview.includes("呢");
            if (!isQuestion) {
              this.log(`${hrKey}: 侧边栏显示用户已回复("${sidebarPreview.substring(0,15)}...")，跳过`);
              return;
            }
          }
        }

        // 检查聊天区最后一条消息是否为用户手动回复
        if (allChatTexts.length >= 2) {
          const lastText = allChatTexts[allChatTexts.length - 1];
          const isQuestion = lastText.includes("?") || lastText.includes("？") || lastText.includes("吗") || lastText.includes("呢");
          if (!isQuestion && lastText !== lastMessage) {
            this.log(`${hrKey}: 最后一条消息非HR提问，用户可能已手动回复，跳过`);
            return;
          }
        }

        // 公司背景评估
        const companyName = await this.getCurrentHRCompany();
        const currentPosName = positionName || this.getPositionName() || "";
        const evaluation = await this.evaluateJob(companyName || "", currentPosName);

        if (evaluation && evaluation.score <= CONFIG.COMPANY_CHECK.REJECT_THRESHOLD) {
          this.log(`⚠️ ${companyName} 评估 ${evaluation.score}/10 分，不合格: ${evaluation.comment}`);
          const rejectionReply = await this.generateRejectionReply(companyName || "该公司", evaluation.score, evaluation.comment);
          if (rejectionReply) {
            const inputBox = await this.waitForElement("#chat-input");
            if (inputBox) {
              inputBox.textContent = "";
              inputBox.focus();
              document.execCommand("insertText", false, rejectionReply);
              await this.delay(500);
              const sendButton = document.querySelector(".btn-send");
              if (sendButton) await this.simulateClick(sendButton);
              this.log(`已发送拒绝回复: ${rejectionReply}`);
              return;
            }
          }
        } else if (evaluation) {
          this.log(`✅ ${companyName} 评估 ${evaluation.score}/10 分，合格: ${evaluation.comment}`);
        }

        // 更新岗位追踪状态
        const comp = companyName || "未知";
        const pos = currentPosName || "";
        if (comp !== "未知") {
          const phase = detectPhase(lastMessage || "");
          if (phase === PHASES.INTERVIEW) JobTracker.updateStatus(comp, pos, "interviewing");
          if (evaluation && evaluation.score <= CONFIG.COMPANY_CHECK.REJECT_THRESHOLD) JobTracker.updateStatus(comp, pos, "rejected");
          if (evaluation) {
            JobTracker.add({ companyName: comp, jobName: pos, matchScore: evaluation.score, matchLevel: evaluation.score >= 7 ? "高匹配" : "低匹配", matchReasons: [evaluation.comment] });
          }
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
          if (!state.hrInteractions.lastSentMsg) state.hrInteractions.lastSentMsg = {};
          state.hrInteractions.lastSentMsg[hrKey] = replyText;
          StatePersistence.saveState();
        }

        // 如果HR提到简历，发送简历
        if (lastMessage.includes("简历") || lastMessage.includes("发送")) {
          await this.delay(1000);
          const sent = await HRInteractionManager.sendResume();
          if (sent) {
            this.log(`已向 ${hrKey} 发送简历`);
            if (!state.hrInteractions.lastSentMsg) state.hrInteractions.lastSentMsg = {};
            state.hrInteractions.lastSentMsg[hrKey] = (state.hrInteractions.lastSentMsg[hrKey] || "") + "[附件简历]";
            StatePersistence.saveState();
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
      state.lastJdText = null;
      const jdText = this.extractJobDetail();
      if (jdText) state.lastJdText = jdText;
      if (jdText) {
        const customGreeting = await this.generateCustomGreeting(jdText);
        if (customGreeting) {
          state.customGreeting = customGreeting;
        }
      } else {
        this.log("📋 此岗位无 JD 内容，将使用预设固定招呼语");
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
          const jobName = currentCard.querySelector(".job-name")?.textContent?.trim() || "";
          const companyName = currentCard.querySelector(".company-name")?.textContent?.trim() || "";
          const salary = currentCard.querySelector(".salary")?.textContent?.trim() || "";
          const location = currentCard.querySelector(".job-area")?.textContent?.trim() || "";
          if (companyName && jobName) {
            JobTracker.add({ companyName, jobName, salary, location, status: "applied" });
            if (state.lastJdText) {
              JobTracker.add({ companyName, jobName, jd: state.lastJdText });
            }
            // 同步到桌面管家
            if (typeof DesktopBridge !== 'undefined') {
              const jobId = currentCard.getAttribute('data-jobid') || currentCard.querySelector('[data-jobid]')?.getAttribute('data-jobid') || '';
              DesktopBridge.collectJob({
                jobId: jobId,
                companyName: companyName,
                jobName: jobName,
                salary: salary,
                location: location,
                jd: state.lastJdText || '',
                status: 'applied',
                collectedAt: Date.now(),
                sourceUrl: window.location.href,
              });
            }
          }
          Analytics.track("job_apply", "jobs", { company: companyName, job: jobName });
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

      const hasIncludeKeywords2 = settings.communicationIncludeKeywords && settings.communicationIncludeKeywords.trim();
      const hasRejectKeywords2 = settings.communicationRejectKeywords && settings.communicationRejectKeywords.trim();

      if (hasIncludeKeywords2 || hasRejectKeywords2) {
        await this.simulateClick(latestChatLi.querySelector(".figure"));
        await this.delay(CONFIG.OPERATION_INTERVAL * 2);

        const positionName = this.getPositionName();
        const positionNameLower = positionName.toLowerCase();

        if (hasRejectKeywords2) {
          const rejectKeywords = settings.communicationRejectKeywords
            .toLowerCase().split(/[,]/).map(kw => kw.trim()).filter(kw => kw.length > 0);
          if (rejectKeywords.some(kw => positionNameLower.includes(kw))) {
            this.log(`自动拒绝岗位，含拒绝关键词[${rejectKeywords.join(", ")}]`);
            if (settings.communicationMode === "auto") await this.scrollUserList();
            return;
          }
        }

        if (hasIncludeKeywords2) {
          const includeKeywords = settings.communicationIncludeKeywords
            .toLowerCase().split(/[，,]/).map(kw => kw.trim()).filter(kw => kw.length > 0);
          if (!includeKeywords.some(kw => positionNameLower.includes(kw))) {
            this.log(`跳过岗位对话，不含关键词[${includeKeywords.join(", ")}]`);
            if (settings.communicationMode === "auto") await this.scrollUserList();
            return;
          }
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

        // 拒绝关键词检测：HR说了拒绝的话，加入黑名单不再回复
        if (this.isRejectedMessage(cleanedMessage)) {
          this.log(`${hrKey}: 检测到拒绝关键词，加入不再回复列表`);
          this.addToBlacklist(hrKey);
          this.processingMessage = false;
          return;
        }

        this.lastProcessedMessage = cleanedMessage;

        StatsManager.increment("hrReplies");

        const interviewKeywords = ["面试", "聊聊", "见一面", "面谈", "过来面试", "来公司"];
        if (interviewKeywords.some(kw => cleanedMessage.includes(kw))) {
          StatsManager.increment("interviewInvites");
          const company = await this.getCurrentHRCompany();
          const pos = this.getPositionName() || "";
          InterviewManager.add(company, pos, "待确认", "待确认", "");
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

    async _requestAiThroughDesktop(message) {
      const cleanReply = (text) => text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\n+/g, ' ').trim();
      try {
        if (typeof DesktopBridge !== 'undefined' && await DesktopBridge.isAvailable()) {
          const data = await DesktopBridge.aiProxy([{ role: "user", content: message }]);
          if (data && data.choices && data.choices[0] && data.choices[0].message) {
            return cleanReply(data.choices[0].message.content);
          }
        }
      } catch (e) {
        this.log("桌面代理失败: " + e.message + "，回退直连");
      }
      return null;
    },

    async _requestAiOnce(message) {
      // 优先尝试桌面代理
      const desktopResult = await this._requestAiThroughDesktop(message);
      if (desktopResult !== null) return desktopResult;

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
      const defaultSystemRole = "你是一个真实的求职者，正在BOSS直聘上跟HR微信式聊天。你的原则：先了解清楚公司待遇、岗位情况、团队环境，评估值不值得去，再决定是否约面试。不要一上来就答应面试。回复要求：短句口语化，像真人打字聊天，不要书面语，不要背简历，不要用\"我具备\"\"我熟练掌握\"这种表达。每次回复2-3句话，语言随意自然。";
      const systemRole = customRole || defaultSystemRole;

      // 检查是否配置了AI
      if (!authToken || !apiUrl || !model) {
        this.log("⚠️ 未配置AI API，请先点击AI配置按钮设置API Key，或启动桌面管家");
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
              const cleanReply = (text) => text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\n+/g, ' ').trim();

              if (result.choices && result.choices[0] && result.choices[0].message) {
                // OpenAI格式
                resolve(cleanReply(result.choices[0].message.content));
              } else if (result.code !== undefined && result.code !== 0) {
                // 讯飞格式错误
                throw new Error(
                  "API错误: " + result.message + "（Code: " + result.code + "）"
                );
              } else if (result.choices && result.choices[0]) {
                // 其他格式
                resolve(cleanReply(result.choices[0].message?.content || result.choices[0].text || ""));
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
          onerror: (error) => reject(new Error("API请求失败，请检查：1)网络连接 2)API Key是否正确 3)API地址是否可访问")),
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

        // 追加简历评分
        const scorePrompt = `基于上述简历分析，请输出JSON格式的结构化评分（不要markdown代码块）：
{
  "overallScore": 1-10,
  "educationScore": 1-10,
  "skillsScore": 1-10,
  "experienceScore": 1-10,
  "careerProgressionScore": 1-10,
  "resumeQualityScore": 1-10
}
只输出JSON，不要其他内容。`;
        try {
          const scoreJson = await this.requestAi(scorePrompt);
          const scores = JSON.parse(scoreJson.replace(/```json|```/g, "").trim());
          state.resumeScores = scores;
          localStorage.setItem("bossResumeScores", JSON.stringify(scores));
          this.log(`简历评分: 综合${scores.overallScore}分`);
        } catch (e) {}

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
        // 记录对话记忆
        const hrKey = this.currentMonitoredHR || "";
        if (hrKey) {
          if (!state.conversationMemory[hrKey]) state.conversationMemory[hrKey] = { messages: [], lastUpdate: Date.now() };
          const mem = state.conversationMemory[hrKey];
          mem.messages.push({ role: "hr", text: hrMessage.substring(0, 100) });
          mem.messages.push({ role: "me", text: reply.substring(0, 100) });
          if (mem.messages.length > 6) mem.messages.splice(0, 2);
          mem.lastUpdate = Date.now();
          // 清理7天未活跃的
          Object.keys(state.conversationMemory).forEach(k => {
            if (Date.now() - state.conversationMemory[k].lastUpdate > 7 * 24 * 60 * 60 * 1000) {
              delete state.conversationMemory[k];
            }
          });
        }
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
      // 优先：职位列表页右侧面板和聊天页的岗位信息
      const selectors = [
        ".job-sec-text", ".job-detail", ".detail-text", ".job-main",
        ".job_sec", "[class*='job-detail']", "[class*='job-sec']",
        ".job-detail-box", ".job-description",
        ".position-info", ".job-info", ".position-desc",
        "[class*='position-info']", "[class*='job-info']",
        ".chat-job-info", ".chat-position-info",
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 30) {
          return el.textContent.trim();
        }
      }
      // 回退：任何包含大量文本的detail/job/position面板
      const panel = document.querySelector(".job-detail-box, .job-box, [class*='detail-panel'], [class*='position-panel']");
      if (panel && panel.textContent.trim().length > 50) return panel.textContent.trim();
      return null;
    },

    async generateCustomGreeting(jdText) {
      if (!jdText || jdText.length < 20) return null;
      const resumeText = state.settings.resumeText || "";
      const resumeAnalysis = state.settings.resumeAnalysis || "";

      // 优先走桌面端生成（带缓存 + 降级支持）
      if (typeof DesktopBridge !== 'undefined') {
        try {
          const currentCard = state.jobList && state.jobList[state.currentIndex - 1];
          const jobId = currentCard ? (currentCard.getAttribute('data-jobid') || currentCard.querySelector('[data-jobid]')?.getAttribute('data-jobid') || '') : '';
          const companyName = currentCard ? (currentCard.querySelector('.company-name')?.textContent?.trim() || '') : '';
          const jobName = currentCard ? (currentCard.querySelector('.job-name')?.textContent?.trim() || '') : '';

          const result = await DesktopBridge.generateGreeting(jobId, jdText, resumeText, companyName, jobName);
          if (result && result.greeting) {
            if (result.cached) {
              this.log('📝 使用已缓存的 JD 定制招呼语');
            } else if (result.grade === 'full') {
              this.log('📝 已生成 JD 定制招呼语（基于简历）');
            } else {
              this.log('📝 已生成 JD 简化招呼语（未上传简历，建议上传以获得更精准匹配）');
            }
            return result.greeting;
          }
        } catch (e) {
          this.log('桌面端生成招呼语失败: ' + e.message + '，回退本地生成');
        }
      }

      // 本地生成（无桌面端时）
      if (!resumeText && !resumeAnalysis) {
        this.log('⚠️ 未上传简历，跳过 JD 定制招呼语（安装桌面管家可支持无简历降级生成）');
        return null;
      }

      const truncatedResume = this.truncateResumeText(resumeText, 3000);
      const truncatedJd = jdText.length > 2000 ? jdText.substring(0, 2000) : jdText;

      const prompt = `你是求职者本人，在BOSS直聘给HR发招呼语。
【硬格式】1.开头前15字必须是"熟悉XXX、XXX"（填该岗位JD要求且你简历具备的核心技能1-2个）。2.紧接着"做过XXX"说明简历里与该岗位相关的具体项目/经历。3.全文80-120字，真诚自然。
【严禁】任何注释、说明、引导语、括号备注、字数统计、"好的"、"以下是"。

我的简历：
${truncatedResume}
${resumeAnalysis ? '简历分析：' + resumeAnalysis : ''}

目标岗位JD：
${truncatedJd}

直接输出招呼语本身，不要任何多余内容。`;

      try {
        const reply = await this.requestAi(prompt);
        if (reply && reply.length > 10) {
          // 清理 AI 废话前缀
          let cleaned = reply.trim()
            .replace(/^(好的|以下是[^。，]*?)[，,。]?\s*/i, '')
            .replace(/^(招呼语|为您生成).*?[:：]\s*/i, '')
            .replace(/<[^>]+>/g, '').replace(/`/g, '').replace(/\n+/g, ' ').trim();
          if (cleaned.length > 10) {
            this.log('📝 已生成 JD 定制招呼语（本地）');
            return cleaned;
          }
        }
      } catch (e) {}
      return null;
    },

    async evaluateJob(companyName, positionName) {
      if (!state.settings.ai.enableCompanyCheck) return null;

      let jdText = state.lastJdText || "";
      if (!jdText || jdText.length < 20) {
        jdText = this.extractJobDetail() || "";
        if (jdText) state.lastJdText = jdText;
      }
      const hasJd = jdText.length > 20;

      const enableResearch = state.settings.ai.enableCompanyResearch && companyName && companyName.length > 0;

      let prompt;
      if (hasJd) {
        const truncatedJd = jdText.length > 2000 ? jdText.substring(0, 2000) : jdText;
        prompt = `请分析以下岗位，判断靠不靠谱。回答格式：分数|综合评价

公司：${companyName || "未知"}
岗位：${positionName || "未知"}
JD内容：${truncatedJd}

分析维度：
- JD是否具体明确（职责清晰 vs 空话套话）
- 薪资结构是否合理（透明固定 vs 模糊套路）
- 福利待遇（五险一金是否齐全、单双休、加班暗示）
- 任职要求是否合理（学历经验匹配度）
- 公司描述是否正规
${enableResearch ? `- 公司背景：请根据你的知识，判断"${companyName}"这家公司的规模、行业口碑、是否有负面新闻或劳动纠纷` : ""}

减分项：
- "吃苦耐劳"、"抗压能力强"暗示加班
- 薪资结构复杂（层层嵌套）
- "包吃住"但薪资偏低
- 大小周/单休
- 岗位职责空泛、大段复读
${enableResearch ? '- 公司有劳动纠纷、欠薪、裁员等负面信息' : ''}

加分项：
- 五险一金齐全、双休、弹性工作
- 薪资范围明确合理、职责具体
- 有培训晋升体系
${enableResearch ? '- 公司规模正规、行业口碑好、无负面新闻' : ''}

评分：1-6分=不推荐, 7-8分=正常, 9-10分=优质

请直接输出：分数|评价内容（30字内）`;
      } else {
        prompt = `请评估这个岗位的靠谱程度。回答格式：分数|综合评价

公司：${companyName || "未知"}
岗位：${positionName || "未知"}

${enableResearch ? `【重要】无JD详情，请根据你对"${companyName}"这家公司的了解来评估（公司规模、口碑、负面新闻、劳动纠纷等）。如果完全不了解，给7分。` : "【注意】无JD信息时默认给7分，回复"7|无JD详情，默认通过"即可。"`}

评分：1-6分=不推荐, 7-8分=正常, 9-10分=优质

请直接输出：分数|评价内容（30字内）`;

      }

      try {
        const reply = await this.requestAi(prompt);
        const match = reply.match(/^(\d+)\s*[|｜]\s*(.+)/);
        if (match) {
          return { score: parseInt(match[1]), comment: match[2].trim() };
        }
        const scoreMatch = reply.match(/\d+/);
        if (scoreMatch) {
          return { score: parseInt(scoreMatch[0]), comment: reply.trim() };
        }
      } catch (e) {}
      return { score: 7, comment: "评估失败，默认通过" };
    },

    async generateRejectionReply(companyName, score, comment) {
      const prompt = `你是一位求职者，需要礼貌地拒绝一个岗位。请生成一段简短、礼貌的拒绝回复：
公司：${companyName || "该公司"}
评估分数：${score}/10分
评估意见：${comment}

要求：
1. 30字以内，语气礼貌但不卑不亢
2. 用"个人发展方向不太匹配"等中性理由
3. 不要留下继续沟通的空间

请直接输出拒绝回复内容。`;

      const reply = await this.requestAi(prompt);
      return reply;
    },
  };
  const PHASES = {
    GREETING: 1,
    SHOWCASE: 2,
    QANDA: 3,
    SALARY: 4,
    INTERVIEW: 5,
    GENERAL: 0,
  };

  const STRATEGIES = {
    aggressive: {
      label: "激进 · 主动出击",
      description: "主动出击型：先快速问清待遇关键点（薪资、工作内容），满意后积极约面。适合急需 offer 的情况。",
      instruction: "直接问、不绕弯，觉得条件差不多就推面试，不纠结细节。",
    },
    balanced: {
      label: "平衡 · 稳扎稳打",
      description: "稳扎稳打型：先了解清楚岗位和公司情况，综合评估后再决定是否面试。适合大多数求职场景（默认）。",
      instruction: "按正常节奏聊，了解充分后再评估，条件可以就接着聊。",
    },
    conservative: {
      label: "保守 · 谨慎稳妥",
      description: "谨慎稳妥型：严格筛选岗位质量，问清楚细节再考虑面试。只投真正匹配且有信心的。",
      instruction: "多问、挑剔一点，对不合理条件直接表达疑虑，宁缺毋滥。",
    },
  };

  // 共享的求职者必问清单——所有策略都会用，区别在时机和语气
  const ASK_LIST = `【求职者必问清单】在对话中自然地穿插提问（每次最多问1-2个，不要审犯人），围绕以下方面：
1. 工作内容：具体做什么、日常流程是怎样的？
2. 新人期望：入职前3个月公司对我的期望是什么？
3. 薪资结构：底薪+绩效比例、试用期薪资、提成/奖金怎么算？
4. 团队情况：当前团队多少人、都是什么角色？
5. 岗位状态：这是新增岗位还是替补离职？前任为什么走？
6. 考核指标：岗位核心KPI或考核标准是什么？
7. 公司发展：部门/公司的下一步规划是什么？

注意：根据对话阶段选择最合适的1-2个问题自然穿插，不要全部列出来。`;

  function detectPhase(hrMessage) {
    if (!hrMessage || !hrMessage.trim()) {
      return PHASES.GREETING;
    }

    const msg = hrMessage.toLowerCase();

    const phaseRules = [
      { phase: PHASES.INTERVIEW, keywords: ["面试", "聊聊", "有空", "面谈", "过来", "时间", "方便吗", "见一面"] },
      { phase: PHASES.SALARY, keywords: ["薪资", "工资", "待遇", "月薪", "年薪", "k", "多少k", "薪酬"] },
      { phase: PHASES.QANDA, keywords: ["离职", "为什么", "住", "学历", "加班", "到岗", "入职", "学校", "专业", "之前", "上家"] },
      { phase: PHASES.SHOWCASE, keywords: ["简历", "介绍", "经验", "经历", "背景", "技能", "会什么", "做过", "能力", "作品"] },
    ];

    for (const rule of phaseRules) {
      for (const kw of rule.keywords) {
        if (msg.includes(kw)) {
          return rule.phase;
        }
      }
    }

    return PHASES.GENERAL;
  }

  function buildPrompt(phase, hrMessage, positionName, resumeText, resumeAnalysis, strategy) {
    const truncatedResume = Core.truncateResumeText(resumeText, 3000);
    const strategyInstruction = STRATEGIES[strategy] ? STRATEGIES[strategy].instruction : STRATEGIES.balanced.instruction;
    const strategyNote = `【对话策略】${strategyInstruction}\n${ASK_LIST}`;
    const hrKeyFromState = (typeof Core !== "undefined" && Core.currentMonitoredHR) || "";
    let conversationBlock = "";
    if (hrKeyFromState && state.conversationMemory && state.conversationMemory[hrKeyFromState]) {
      const mem = state.conversationMemory[hrKeyFromState];
      const summary = mem.messages.map(m => `${m.role === "hr" ? "HR" : "我"}: ${m.text}`).join("\n");
      conversationBlock = `【之前的对话】\n${summary}\n【当前】\n`;
    }
    const resumeBlock = truncatedResume ? `你的简历信息：\n${truncatedResume}\n` : "";
    const analysisBlock = resumeAnalysis ? `简历分析：\n${resumeAnalysis}\n` : "";
    const positionBlock = positionName ? `应聘岗位：${positionName}\n` : "";

    const phasePrompts = {
      [PHASES.GREETING]: `你是一个正在找工作的求职者，刚投了简历。用微信聊天的语气给HR发第一条消息。

你的简历：${truncatedResume || "无"}
${positionBlock}
${conversationBlock}
要求：
- 20-40字，短句，像真人打字
- 提一两个你简历里真正做过的、跟这个岗位有关系的点
- 语气随意一点，像跟朋友说话
- 不要"您好"开头，不要长篇大论
- 不要列举技能，不要背诵简历

${strategyNote}
直接输出打招呼内容。`,

      [PHASES.SHOWCASE]: `你是一个求职者，HR想了解你。像微信聊天一样回复，不要写作文。

你的大概情况：${truncatedResume || "无"}
${positionBlock}
${conversationBlock}
HR刚说：${hrMessage}

要求：
- 2-3句话，不够50字最好
- 挑简历里跟这岗位最沾边的一个经历/技能，用大白话说出来
- 不要说"我具备"、"我熟练掌握"这种书面语
- 适当反问HR一两个问题（显你在认真考虑这个岗位）
- 像真人聊天，不要完美语法

${strategyNote}
直接输出回复。`,

      [PHASES.QANDA]: `你是一个求职者，HR在问你问题。像跟朋友聊天一样回答。

你的情况：${truncatedResume || "无"}
${positionBlock}
${conversationBlock}
HR在问：${hrMessage}

要求：
- 别急着亮底牌，先回答HR问的，顺便反问一个你关心的（比如工作内容、团队情况）
- 实话实说，不知道就说"这个我得确认一下"
- 语言随意，像微信聊天，不要书面语
- 30字左右就够了

${strategyNote}
直接输出回复。`,

      [PHASES.SALARY]: `你是一个求职者，HR在谈薪资了。按正常求职者的方式回复。

你的大概情况：${truncatedResume || "无"}
${positionBlock}
${conversationBlock}
HR说：${hrMessage}

要求：
- 先听完HR说的，表示了解了
- 如果你觉得还行就说还行，如果低了就委婉提一下
- 可以问清楚薪资结构（底薪+绩效比例、试用期等）
- 语气自然，像跟朋友聊钱一样正常，不卑不亢
- 40字以内

${strategyNote}
直接输出回复。`,

      [PHASES.INTERVIEW]: `你是一个求职者，HR想约你面试。

HR说：${hrMessage}

要求：
- 表示感兴趣和感谢，但不要直接答应具体时间
- 说需要先看一下最近的日程安排，回头跟HR确认具体时间
- 可以顺便问面试形式（线上还是线下）、面试官是谁、大概聊多久
- 给HR一个你会主动跟进的感觉，比如"我确认好时间马上跟你说"
- 热情但不舔，像正常约见面一样
- 不用写"我非常期待这个宝贵的机会"
- 40字以内

${strategyNote}
直接输出回复。`,

      [PHASES.GENERAL]: `你是一个求职者，跟HR在微信上聊天。

你的情况：${truncatedResume || "无"}
${positionBlock}
${conversationBlock}
HR刚说：${hrMessage}

要求：
- 像真人聊天回复，简短自然
- 不要背简历，不要列技能，不要说"我具备良好的"
- 有来有往，可以反问HR了解岗位更多情况
- 40字以内

${strategyNote}
直接输出回复。`,
    };

    return phasePrompts[phase] || phasePrompts[PHASES.GENERAL];
  }

  function getConversationStrategy() {
    const strategy = (state.settings.ai && state.settings.ai.conversationStrategy)
      || localStorage.getItem("conversationStrategy")
      || "balanced";
    return STRATEGIES[strategy] ? strategy : "balanced";
  }
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
  const letter = {
    showLetterToUser: function () {
      const COLORS = {
        primary: "#4285f4",
        text: "#333",
        textLight: "#666",
        background: "#f8f9fa",
      };

      const overlay = document.createElement("div");
      overlay.id = "letter-overlay";
      overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            backdrop-filter: blur(5px);
            animation: fadeIn 0.3s ease-out;
        `;

      const envelopeContainer = document.createElement("div");
      envelopeContainer.id = "envelope-container";
      envelopeContainer.style.cssText = `
            position: relative;
            width: 90%;
            max-width: 650px;
            height: 400px;
            perspective: 1000px;
        `;

      const envelope = document.createElement("div");
      envelope.id = "envelope";
      envelope.style.cssText = `
            position: absolute;
            width: 100%;
            height: 100%;
            transform-style: preserve-3d;
            transition: transform 0.6s ease;
        `;

      const envelopeBack = document.createElement("div");
      envelopeBack.id = "envelope-back";
      envelopeBack.style.cssText = `
            position: absolute;
            width: 100%;
            height: 100%;
            background: ${COLORS.background};
            border-radius: 10px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.2);
            backface-visibility: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 30px;
            cursor: pointer;
            transition: all 0.3s;
        `;
      envelopeBack.innerHTML = `
            <div style="font-size:clamp(1.5rem, 3vw, 1.8rem);font-weight:600;color:${COLORS.primary};margin-bottom:10px;">
                <i class="fa fa-briefcase mr-2"></i>小胡版AI-boss海投助手
            </div>
            <div style="font-size:clamp(1rem, 2vw, 1.1rem);color:${COLORS.textLight};text-align:center;">
                点击开启高效求职之旅
            </div>
            <div style="position:absolute;bottom:20px;font-size:0.85rem;color:#999;">
                © 2026 小胡版AI-boss海投助手 | 基于Yangshengzhou开源项目 | AGPL-3.0-or-later
            </div>
        `;

      envelopeBack.addEventListener("click", () => {
        envelope.style.transform = "rotateY(180deg)";
        setTimeout(() => {
          const content = document.getElementById("letter-content");
          if (content) {
            content.style.display = "block";
            content.style.animation = "fadeInUp 0.5s ease-out forwards";
          }
        }, 300);
      });

      const envelopeFront = document.createElement("div");
      envelopeFront.id = "envelope-front";
      envelopeFront.style.cssText = `
            position: absolute;
            width: 100%;
            height: 100%;
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.2);
            transform: rotateY(180deg);
            backface-visibility: hidden;
            display: flex;
            flex-direction: column;
        `;

      const titleBar = document.createElement("div");
      titleBar.style.cssText = `
            padding: 20px 30px;
            background: #4285f4;
            color: white;
            font-size: clamp(1.2rem, 2.5vw, 1.4rem);
            font-weight: 600;
            border-radius: 10px 10px 0 0;
            display: flex;
            align-items: center;
        `;
      titleBar.innerHTML = `<i class="fa fa-briefcase mr-2"></i>致AI-Boss海投助手用户：`;

      const letterContent = document.createElement("div");
      letterContent.id = "letter-content";
      letterContent.style.cssText = `
            flex: 1;
            padding: 25px 30px;
            overflow-y: auto;
            font-size: clamp(0.95rem, 2vw, 1.05rem);
            line-height: 1.8;
            color: ${COLORS.text};

            background-blend-mode: overlay;
            background-color: rgba(255,255,255,0.95);
            display: none;
        `;
      letterContent.innerHTML = `
            <div style="margin-bottom:20px;">
                <p>你好，未来的成功人士：</p>
                <p class="mt-2">&emsp;&emsp;展信如晤。</p>
                <p class="mt-3">
                    &emsp;&emsp;首先，特别感谢<strong>Yangshengzhou</strong>开发了这款优秀的开源求职工具，
                    为无数求职者提供了便利。本项目基于原作者的开源代码，遵循AGPL-3.0-or-later协议进行二次开发。
                </p>
                <p class="mt-3">
                    &emsp;&emsp;我是<strong>小胡</strong>，在原作者的基础上，我进一步完善和优化了功能，
                    让这个工具更加强大和易用：
                </p>
                <ul class="mt-3 ml-6 list-disc" style="text-indent:0;">
                    <li><strong>&emsp;&emsp;智能岗位筛选</strong>，精准投递不盲目</li>
                    <li><strong>&emsp;&emsp;自动批量沟通</strong>，一键打招呼省时省力</li>
                    <li><strong>&emsp;&emsp;AI智能回复</strong>，24小时在线不错过任何机会</li>
                    <li><strong>&emsp;&emsp;简历自动发送</strong>，支持多份简历图片</li>
                    <li><strong>&emsp;&emsp;自定义AI配置</strong>，支持硅基流动、火山引擎等平台</li>
                    <li><strong>&emsp;&emsp;个性化沟通策略</strong>，大幅提升面试邀约率</li>
                    <li><strong>&emsp;&emsp;自动城市切换</strong>，扩大求职范围</li>
                </ul>
                <p class="mt-3">
                    &emsp;&emsp;工具只是辅助，你的能力才是核心竞争力。
                    愿它成为你求职路上的得力助手，助你斩获Offer！
                </p>
                <p class="mt-2">
                    &emsp;&emsp;冀以尘雾之微补益山海，荧烛末光增辉日月。
                </p>
                <p class="mt-3" style="font-size:0.85rem;color:#999;">
                    &emsp;&emsp;开源地址：https://github.com/DYxiaochen/AI-BossJob | AGPL-3.0-or-later
                </p>
            </div>
            <div style="text-align:right;color:${COLORS.textLight};text-indent:0;">
                小胡<br>
                2025年4月
            </div>
        `;

      const buttonArea = document.createElement("div");
      buttonArea.style.cssText = `
            padding: 15px 30px;
            display: flex;
            justify-content: center;
            border-top: 1px solid #eee;
            background: ${COLORS.background};
            border-radius: 0 0 10px 10px;
        `;

      const startButton = document.createElement("button");
      startButton.style.cssText = `
            background: #4285f4;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 30px;
            font-size: clamp(1rem, 2vw, 1.1rem);
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 6px 16px rgba(66, 133, 244, 0.3);
            outline: none;
            display: flex;
            align-items: center;
        `;
      startButton.innerHTML = `<i class="fa fa-briefcase mr-2"></i>开始使用`;

      startButton.addEventListener("click", () => {
        const hasVisitedGreetSet = localStorage.getItem(STORAGE.VISITED_GREET_SET);

        if (!hasVisitedGreetSet) {
          localStorage.setItem(STORAGE.VISITED_GREET_SET, "true");
          window.open(
            "https://www.zhipin.com/web/geek/notify-set?type=greetSet",
            "_blank"
          );
        }

        envelopeContainer.style.animation = "scaleOut 0.3s ease-in forwards";
        overlay.style.animation = "fadeOut 0.3s ease-in forwards";
        setTimeout(() => {
          if (overlay.parentNode === document.body) {
            document.body.removeChild(overlay);
          }
        }, 300);
      });

      buttonArea.appendChild(startButton);
      envelopeFront.appendChild(titleBar);
      envelopeFront.appendChild(letterContent);
      envelopeFront.appendChild(buttonArea);
      envelope.appendChild(envelopeBack);
      envelope.appendChild(envelopeFront);
      envelopeContainer.appendChild(envelope);
      overlay.appendChild(envelopeContainer);
      document.body.appendChild(overlay);

      const style = document.createElement("style");
      style.textContent = `
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes fadeOut { from { opacity: 1 } to { opacity: 0 } }
            @keyframes scaleOut { from { transform: scale(1); opacity: 1 } to { transform: scale(.9); opacity: 0 } }
            @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }

            #envelope-back:hover { transform: scale(1.02); box-shadow: 0 20px 40px rgba(0,0,0,0.25); }
            #envelope-front button:hover { transform: scale(1.05); box-shadow: 0 8px 20px rgba(66, 133, 244, 0.4); }
            #envelope-front button:active { transform: scale(0.98); }
            
            @media (max-width: 480px) {
                #envelope-container { height: 350px; }
                #letter-content { font-size: 0.9rem; padding: 15px; }
            }
        `;
      document.head.appendChild(style);
    },
  };

  const guide = {
    steps: [
      {
        target: "div.city-label.active",
        content:
          '海投前，先在BOSS<span class="highlight">筛选出岗位</span>！\n\n助手会先滚动收集界面上显示的岗位，\n随后依次进行沟通~',

        arrowPosition: "bottom",
        defaultPosition: {
          left: "50%",
          top: "20%",
          transform: "translateX(-50%)",
        },
      },
      {
        target: 'a[ka="header-jobs"]',
        content:
          '<span class="highlight">职位页操作流程</span>：\n\n1. 扫描职位卡片\n2. 点击"立即沟通"（需开启"自动打招呼"）\n3. 留在当前页，继续沟通下一个职位\n\n全程无需手动干预，高效投递！',

        arrowPosition: "bottom",
        defaultPosition: { left: "25%", top: "80px" },
      },
      {
        target: 'a[ka="header-message"]',
        content:
          '<span class="highlight">海投建议</span>！\n\n• HR与您沟通，HR需要付费给平台\n因此您尽可能先自我介绍以提高效率 \n\n• HR查看附件简历，HR也要付费给平台\n所以尽量先发送`图片简历`给HR',

        arrowPosition: "left",
        defaultPosition: { right: "150px", top: "100px" },
      },
      {
        target: "div.logo",
        content:
          '<span class="highlight">您需要打开两个浏览器窗口</span>：\n\n左侧窗口自动打招呼发起沟通\n右侧发送自我介绍和图片简历\n\n您只需专注于挑选offer！',

        arrowPosition: "right",
        defaultPosition: { left: "200px", top: "20px" },
      },
      {
        target: "div.logo",
        content:
          '<span class="highlight">特别注意</span>：\n\n1. <span class="warning">BOSS直聘每日打招呼上限为150次</span>\n2. 聊天页仅处理最上方的最新对话\n3. 打招呼后对方会显示在聊天页\n4. <span class="warning">投递操作过于频繁有封号风险!</span>',

        arrowPosition: "bottom",
        defaultPosition: { left: "50px", top: "80px" },
      },
    ],
    currentStep: 0,
    guideElement: null,
    overlay: null,
    highlightElements: [],

    showGuideToUser() {
      this.overlay = document.createElement("div");
      this.overlay.id = "guide-overlay";
      this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(2px);
            z-index: 99997;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
      document.body.appendChild(this.overlay);

      this.guideElement = document.createElement("div");
      this.guideElement.id = "guide-tooltip";
      this.guideElement.style.cssText = `
            position: fixed;
            z-index: 99999;
            width: 320px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            overflow: hidden;
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 0.3s ease, transform 0.3s ease;
        `;
      document.body.appendChild(this.guideElement);

      setTimeout(() => {
        this.overlay.style.opacity = "1";

        setTimeout(() => {
          this.showStep(0);
        }, 300);
      }, 100);
    },

    showStep(stepIndex) {
      const step = this.steps[stepIndex];
      if (!step) return;

      this.clearHighlights();
      const target = document.querySelector(step.target);

      if (target) {
        const rect = target.getBoundingClientRect();
        const highlight = document.createElement("div");
        highlight.className = "guide-highlight";
        highlight.style.cssText = `
                position: fixed;
                top: ${rect.top}px;
                left: ${rect.left}px;
                width: ${rect.width}px;
                height: ${rect.height}px;
                background: ${step.highlightColor || "#4285f4"};
                opacity: 0.2;
                border-radius: 4px;
                z-index: 99998;
                box-shadow: 0 0 0 4px ${step.highlightColor || "#4285f4"};
                animation: guide-pulse 2s infinite;
            `;
        document.body.appendChild(highlight);
        this.highlightElements.push(highlight);

        this.setGuidePositionFromTarget(step, rect);
      } else {
        console.warn("引导目标元素未找到，使用默认位置:", step.target);

        this.setGuidePositionFromDefault(step);
      }

      let buttonsHtml = "";

      if (stepIndex === this.steps.length - 1) {
        buttonsHtml = `
                <div class="guide-buttons" style="display: flex; justify-content: center; padding: 16px; border-top: 1px solid #f0f0f0; background: #f9fafb;">
                    <button id="guide-finish-btn" style="padding: 8px 32px; background: ${step.highlightColor || "#4285f4"
          }; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s ease; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);">
                        完成
                    </button>
                </div>
            `;
      } else {
        buttonsHtml = `
                <div class="guide-buttons" style="display: flex; justify-content: flex-end; padding: 16px; border-top: 1px solid #f0f0f0; background: #f9fafb;">
                    <button id="guide-skip-btn" style="padding: 8px 16px; background: white; color: #4b5563; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s ease;">跳过</button>
                    <button id="guide-next-btn" style="padding: 8px 16px; background: ${step.highlightColor || "#4285f4"
          }; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; margin-left: 8px; transition: all 0.2s ease; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);">下一步</button>
                </div>
            `;
      }

      this.guideElement.innerHTML = `
            <div class="guide-header" style="padding: 16px; background: ${step.highlightColor || "#4285f4"
        }; color: white;">
                <div class="guide-title" style="font-size: 16px; font-weight: 600;">AI-Boss海投助手引导</div>
                <div class="guide-step" style="font-size: 12px; opacity: 0.8; margin-top: 2px;">步骤 ${stepIndex + 1
        }/${this.steps.length}</div>
            </div>
            <div class="guide-content" style="padding: 20px; font-size: 14px; line-height: 1.6;">
                <div style="white-space: pre-wrap; font-family: inherit; margin: 0;">${step.content
        }</div>
            </div>
            ${buttonsHtml}
        `;

      if (stepIndex === this.steps.length - 1) {
        document
          .getElementById("guide-finish-btn")
          .addEventListener("click", () => this.endGuide(true));
      } else {
        document
          .getElementById("guide-next-btn")
          .addEventListener("click", () => this.nextStep());
        document
          .getElementById("guide-skip-btn")
          .addEventListener("click", () => this.endGuide());
      }

      if (stepIndex === this.steps.length - 1) {
        const finishBtn = document.getElementById("guide-finish-btn");
        finishBtn.addEventListener("mouseenter", () => {
          finishBtn.style.background = this.darkenColor(
            step.highlightColor || "#4285f4",
            15
          );
          finishBtn.style.boxShadow =
            "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
        });
        finishBtn.addEventListener("mouseleave", () => {
          finishBtn.style.background = step.highlightColor || "#4285f4";
          finishBtn.style.boxShadow =
            "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)";
        });
      } else {
        const nextBtn = document.getElementById("guide-next-btn");
        const skipBtn = document.getElementById("guide-skip-btn");

        nextBtn.addEventListener("mouseenter", () => {
          nextBtn.style.background = this.darkenColor(
            step.highlightColor || "#4285f4",
            15
          );
          nextBtn.style.boxShadow =
            "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
        });
        nextBtn.addEventListener("mouseleave", () => {
          nextBtn.style.background = step.highlightColor || "#4285f4";
          nextBtn.style.boxShadow =
            "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)";
        });

        skipBtn.addEventListener("mouseenter", () => {
          skipBtn.style.background = "#f3f4f6";
        });
        skipBtn.addEventListener("mouseleave", () => {
          skipBtn.style.background = "white";
        });
      }

      this.guideElement.style.opacity = "1";
      this.guideElement.style.transform = "translateY(0)";
    },

    setGuidePositionFromTarget(step, rect) {
      let left, top;
      const guideWidth = 320;
      const guideHeight = 240;

      switch (step.arrowPosition) {
        case "top":
          left = rect.left + rect.width / 2 - guideWidth / 2;
          top = rect.top - guideHeight - 20;
          break;
        case "bottom":
          left = rect.left + rect.width / 2 - guideWidth / 2;
          top = rect.bottom + 20;
          break;
        case "left":
          left = rect.left - guideWidth - 20;
          top = rect.top + rect.height / 2 - guideHeight / 2;
          break;
        case "right":
          left = rect.right + 20;
          top = rect.top + rect.height / 2 - guideHeight / 2;
          break;
        default:
          left = rect.right + 20;
          top = rect.top;
      }

      left = Math.max(10, Math.min(left, window.innerWidth - guideWidth - 10));
      top = Math.max(10, Math.min(top, window.innerHeight - guideHeight - 10));

      this.guideElement.style.left = `${left}px`;
      this.guideElement.style.top = `${top}px`;
      this.guideElement.style.transform = "translateY(0)";
    },

    setGuidePositionFromDefault(step) {
      const position = step.defaultPosition || {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };

      Object.assign(this.guideElement.style, {
        left: position.left,
        top: position.top,
        right: position.right || "auto",
        bottom: position.bottom || "auto",
        transform: position.transform || "none",
      });
    },

    nextStep() {
      const currentStep = this.steps[this.currentStep];
      if (currentStep) {
        const target = document.querySelector(currentStep.target);
        if (target) {
          target.removeEventListener("click", this.nextStep);
        }
      }

      this.currentStep++;
      if (this.currentStep < this.steps.length) {
        this.guideElement.style.opacity = "0";
        this.guideElement.style.transform = "translateY(10px)";

        setTimeout(() => {
          this.showStep(this.currentStep);
        }, 300);
      }
    },

    clearHighlights() {
      this.highlightElements.forEach((el) => el.remove());
      this.highlightElements = [];
    },

    endGuide(isCompleted = false) {
      this.clearHighlights();

      this.guideElement.style.opacity = "0";
      this.guideElement.style.transform = "translateY(10px)";
      this.overlay.style.opacity = "0";

      setTimeout(() => {
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
        }
        if (this.guideElement && this.guideElement.parentNode) {
          this.guideElement.parentNode.removeChild(this.guideElement);
        }

        if (isCompleted && this.chatUrl) {
          window.open(this.chatUrl, "_blank");
        }
      }, 300);

      document.dispatchEvent(new Event("guideEnd"));
    },

    darkenColor(color, percent) {
      let R = parseInt(color.substring(1, 3), 16);
      let G = parseInt(color.substring(3, 5), 16);
      let B = parseInt(color.substring(5, 7), 16);

      R = parseInt((R * (100 - percent)) / 100);
      G = parseInt((G * (100 - percent)) / 100);
      B = parseInt((B * (100 - percent)) / 100);

      R = R < 255 ? R : 255;
      G = G < 255 ? G : 255;
      B = B < 255 ? B : 255;

      R = Math.round(R);
      G = Math.round(G);
      B = Math.round(B);

      const RR =
        R.toString(16).length === 1 ? "0" + R.toString(16) : R.toString(16);
      const GG =
        G.toString(16).length === 1 ? "0" + G.toString(16) : G.toString(16);
      const BB =
        B.toString(16).length === 1 ? "0" + B.toString(16) : B.toString(16);

      return `#${RR}${GG}${BB}`;
    },
  };

  const style = document.createElement("style");
  style.textContent = `
    @keyframes guide-pulse {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.4); }
        70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(66, 133, 244, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(66, 133, 244, 0); }
    }
    
    .guide-content .highlight {
        font-weight: 700;
        color: #1a73e8;
    }
    
    .guide-content .warning {
        font-weight: 700;
        color: #d93025;
    }
`;
  document.head.appendChild(style);

  function getToday() {
    return new Date().toISOString().split("T")[0];
  }
  /**
   * DesktopBridge — Boss海投小助手桥接层
   * 将 AI 请求、岗位数据、埋点事件转发到本地桌面应用
   */
  const DesktopBridge = {
    _available: false,
    _lastCheck: 0,
    _baseUrl: CONFIG.DESKTOP_APP.BASE_URL,
    _token: null,

    async _getToken() {
      if (this._token) return this._token;
      try {
        const resp = await fetch(this._baseUrl + '/api/local-token', { signal: AbortSignal.timeout(2000) });
        if (resp.ok) {
          const data = await resp.json();
          this._token = data.token || '';
          return this._token;
        }
      } catch (e) {}
      return '';
    },

    async _authHeaders() {
      const token = await this._getToken();
      return token
        ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
        : { 'Content-Type': 'application/json' };
    },

    async isAvailable() {
      const now = Date.now();
      if (now - this._lastCheck < CONFIG.DESKTOP_APP.CHECK_INTERVAL) {
        return this._available;
      }
      this._lastCheck = now;
      try {
        const resp = await fetch(this._baseUrl + '/api/health', { signal: AbortSignal.timeout(2000) });
        this._available = resp.ok;
        if (this._available && !this._wasAvailable) {
          typeof Core !== 'undefined' && Core.log('🔗 Boss海投小助手已连接');
        }
        this._wasAvailable = this._available;
      } catch (e) {
        this._available = false;
      }
      return this._available;
    },

    async aiProxy(messages, options = {}) {
      const body = { messages: messages, temperature: options.temperature, max_tokens: options.max_tokens };
      if (options.model) body.model = options.model;
      const resp = await fetch(this._baseUrl + '/api/ai/proxy', {
        method: 'POST', headers: await this._authHeaders(), body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000),
      });
      const result = await resp.json();
      if (!result.success) throw new Error(result.error || '桌面 AI 代理返回错误');
      return result.data;
    },

    async collectJob(jobData) {
      if (!await this.isAvailable()) return;
      try {
        fetch(this._baseUrl + '/api/jobs/collect', {
          method: 'POST', headers: await this._authHeaders(), body: JSON.stringify(jobData),
          signal: AbortSignal.timeout(5000),
        }).catch(() => {});
      } catch (e) {}
    },

    async trackEvent(eventType, metadata = {}) {
      if (!await this.isAvailable()) return;
      try {
        fetch(this._baseUrl + '/api/analytics/event', {
          method: 'POST', headers: await this._authHeaders(),
          body: JSON.stringify([{
            event_type: eventType, category: 'script', page: location.pathname,
            metadata: metadata, session_id: 'boss-js-script', client_ts: Date.now(),
          }]),
          signal: AbortSignal.timeout(5000),
        }).catch(() => {});
      } catch (e) {}
    },

    async generateGreeting(jobId, jdText, resumeText, companyName, jobName) {
      if (!await this.isAvailable()) return null;
      try {
        const resp = await fetch(this._baseUrl + '/api/ai/generate-greeting', {
          method: 'POST', headers: await this._authHeaders(),
          body: JSON.stringify({ job_id: jobId||'', jd_text: jdText||'', resume_text: resumeText||'', company_name: companyName||'', job_name: jobName||'' }),
          signal: AbortSignal.timeout(35000),
        });
        const result = await resp.json();
        if (result.success && result.data && result.data.greeting) {
          return { greeting: result.data.greeting, cached: result.data.cached, grade: result.data.grade };
        }
      } catch (e) {}
      return null;
    },
  };
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
      UI.updateInterviewDisplay();
      UI.updateDashboard();
      Analytics.track("script_init", location.pathname.includes("/chat") ? "chat" : "jobs", {});
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
