(function (root) {
  const PHASES = Object.freeze({
    GENERAL: 0,
    GREETING: 1,
    SHOWCASE: 2,
    QANDA: 3,
    SALARY: 4,
    INTERVIEW: 5,
  });

  const STRATEGIES = Object.freeze({
    aggressive: Object.freeze({
      label: '激进 · 主动出击',
      instruction: '主动出击：快速问清待遇关键点，满意后积极约面。',
    }),
    balanced: Object.freeze({
      label: '平衡 · 稳扎稳打',
      instruction: '有来有往：自然聊天，问清楚细节后再表态。',
    }),
    conservative: Object.freeze({
      label: '保守 · 谨慎稳妥',
      instruction: '宁缺毋滥：严格筛选，多问挑剔，对不合理条件表达疑虑。',
    }),
  });

  function normalizeText(value, maxLength) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return maxLength ? text.slice(0, maxLength) : text;
  }

  function normalizeStrategy(strategy) {
    return STRATEGIES[strategy] ? strategy : 'balanced';
  }

  function detectPhase(hrMessage) {
    const text = normalizeText(hrMessage);
    if (!text) return PHASES.GREETING;
    if (/面试|聊聊|有空|面谈|过来|时间|方便吗|见一面/i.test(text)) return PHASES.INTERVIEW;
    if (/薪资|工资|待遇|月薪|年薪|薪酬|多少\s*[kK]|\d+\s*[kK]/i.test(text)) return PHASES.SALARY;
    if (/离职|为什么|住|学历|加班|到岗|入职|学校|专业|之前|上家/i.test(text)) return PHASES.QANDA;
    if (/简历|介绍|经验|经历|背景|技能|会什么|做过|能力|作品/i.test(text)) return PHASES.SHOWCASE;
    return PHASES.GENERAL;
  }

  function buildPrompt(phase, hrMessage, positionName, resumeText, resumeAnalysis, strategy) {
    const effectiveStrategy = normalizeStrategy(strategy);
    const strategyInstruction = STRATEGIES[effectiveStrategy].instruction;
    const position = normalizeText(positionName, 120) || '目标岗位';
    const message = normalizeText(hrMessage, 500);
    const resume = normalizeText(resumeText, 1800) || '未提供简历内容';
    const analysis = normalizeText(resumeAnalysis, 600);
    const context = [
      `【目标岗位】${position}`,
      `【我的简历】${resume}`,
      analysis ? `【简历分析】${analysis}` : '',
      message ? `【HR消息】${message}` : '',
    ].filter(Boolean).join('\n\n');

    let requirement;
    switch (phase) {
      case PHASES.GREETING:
        requirement = '请生成首次打招呼消息。控制在30-50字，先展示核心优势，再表达对岗位的兴趣。';
        break;
      case PHASES.SHOWCASE:
        requirement = 'HR希望了解简历或经历。请用3-4句自然口语化的话，突出最匹配的技能、经历和岗位契合点。';
        break;
      case PHASES.QANDA:
        requirement = 'HR在追问具体问题。请严格根据简历真实信息回答；离职原因保持正面，住址和到岗时间只在已知时明确说明。';
        break;
      case PHASES.SALARY:
        requirement = 'HR在讨论薪资。请结合策略自然回应，必要时询问薪资结构和岗位细节；不得编造具体经历或已确认的薪资。';
        break;
      case PHASES.INTERVIEW:
        requirement = 'HR在邀请面试。请积极确认机会，并自然确认时间、形式（线上或线下）和需要准备的材料。';
        break;
      default:
        requirement = '请根据HR消息和简历真实信息给出自然回复，保持有来有往。';
    }

    return {
      system: [
        '你是求职者本人，回复会被原样发送给BOSS直聘上的HR。',
        '回复要简短、口语化、真诚，不暴露AI身份，不使用夸张承诺或编造经历。',
        `【对话策略】${strategyInstruction}`,
        `【本轮要求】${requirement}`,
        '直接输出可发送的回复正文，不加标题、解释、引号或emoji。',
      ].join('\n'),
      user: `${context}\n\n请生成回复：`,
    };
  }

  const api = { PHASES, STRATEGIES, detectPhase, buildPrompt };
  root.ConversationStrategy = api;
  if (typeof module !== 'undefined') module.exports = api;
}(globalThis));
