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
    },

    customGreeting: null,

    comments: {
      currentCompanyName: "",
      commentsList: [],
      isLoading: false,
      isCommentMode: false,
    },
  };

  const elements = {
    panel: null,
    controlBtn: null,
    log: null,
    includeInput: null,
    locationInput: null,
    miniIcon: null,
  };

