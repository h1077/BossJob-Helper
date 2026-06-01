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
      description: "主动出击型：AI 会积极展示优势、适度包装经验、主动推进面试邀约，适合急需拿到 offer 的情况",
      instruction: "主动推进对话、适度包装优势、对不确定的问题给出自信回答、主动引导到面试环节、给出有竞争力的薪资期望。",
    },
    balanced: {
      label: "平衡 · 稳扎稳打",
      description: "稳扎稳打型：AI 会如实展示能力、有技巧地回答问题、适时推动面试，适合大多数求职场景（默认）",
      instruction: "基于简历真实信息、积极但有分寸、不回避问题但也不过度承诺、适时推动面试、给出合理薪资范围并表示可协商。",
    },
    conservative: {
      label: "保守 · 谨慎稳妥",
      description: "谨慎稳妥型：AI 会严格基于真实信息、不夸大不承诺、以真诚换取信任，适合对岗位匹配度有信心的场景",
      instruction: "严格基于简历、对不确定的问题诚实回答'需要确认一下'、不主动推动但保持友好、尊重公司的薪资体系、以真诚换取信任。",
    },
  };

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
    const strategyNote = `【对话策略】${strategyInstruction}`;
    const resumeBlock = truncatedResume ? `你的简历信息：\n${truncatedResume}\n` : "";
    const analysisBlock = resumeAnalysis ? `简历分析：\n${resumeAnalysis}\n` : "";
    const positionBlock = positionName ? `应聘岗位：${positionName}\n` : "";

    const phasePrompts = {
      [PHASES.GREETING]: `你是求职者，刚向HR投递了简历。请生成一条简洁的首次打招呼消息。
要求：30-50字，展示核心优势，表达对岗位的兴趣，语气友好不卑不亢。
${resumeBlock}${analysisBlock}${positionBlock}
${strategyNote}
请直接给出打招呼内容，不要加任何前缀。`,

      [PHASES.SHOWCASE]: `你是求职者，HR要求你介绍自己或查看简历。
请基于简历信息，用3-4句话展示：最匹配该岗位的技能、最亮眼的项目/工作经历、与岗位的契合点。
${resumeBlock}${analysisBlock}${positionBlock}
HR的消息："${hrMessage}"
${strategyNote}
要求：回复控制在60字以内，口语化，不要暴露你是AI。
请直接给出回复内容，不要加任何前缀。`,

      [PHASES.QANDA]: `你是求职者，HR在询问一些具体问题。请根据简历信息诚实回答。
如果是关于离职原因：正面表达职业规划。如果是住址/到岗时间：表示便利/尽快。
${resumeBlock}${positionBlock}
HR的消息："${hrMessage}"
${strategyNote}
要求：回复控制在50字以内，像真人聊天，不要暴露你是AI。
请直接给出回复内容，不要加任何前缀。`,

      [PHASES.SALARY]: `你是求职者，HR在谈论薪资待遇。
${resumeBlock}${positionBlock}
HR的消息："${hrMessage}"
${strategyNote}
要求：回复控制在40字以内，专业且礼貌。
请直接给出回复内容，不要加任何前缀。`,

      [PHASES.INTERVIEW]: `你是求职者，HR发出了面试邀约或面试意向。请积极确认，表示对面试机会的重视。
同时确认：具体时间、面试形式（线上/线下）、需要准备什么材料。
HR的消息："${hrMessage}"
${strategyNote}
要求：回复控制在50字以内，热情但不过度。
请直接给出回复内容，不要加任何前缀。`,

      [PHASES.GENERAL]: `你是求职者，正在与HR沟通。请根据以下信息回复HR的消息：
${resumeBlock}${analysisBlock}${positionBlock}
HR的消息："${hrMessage}"
${strategyNote}
要求：回复控制在50字以内，自然口语化，不要暴露你是AI。
请直接给出回复内容，不要加任何前缀。`,
    };

    return phasePrompts[phase] || phasePrompts[PHASES.GENERAL];
  }

  function getConversationStrategy() {
    const strategy = (state.settings.ai && state.settings.ai.conversationStrategy)
      || localStorage.getItem("conversationStrategy")
      || "balanced";
    return STRATEGIES[strategy] ? strategy : "balanced";
  }

