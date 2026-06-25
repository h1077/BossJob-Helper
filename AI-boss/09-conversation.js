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

