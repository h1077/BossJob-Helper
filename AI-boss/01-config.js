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

    HR_INACTIVE_DAYS: 14,

    MAX_SCAN_PAGES: 5,
    PAGE_SCAN_DELAY: 8000,

    DAILY_APPLY_LIMIT: 100,

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

