# AI 求职对话助手 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Boss_helper.js 中新增阶段感知的 AI 对话策略系统，覆盖打招呼→面试邀约全流程

**Architecture:** 在 Core 对象中新增 `ConversationStrategy` 模块（PhaseDetector + PromptBuilder + StrategyManager），替换现有的 `generatePersonalizedReply()`，在设置面板中新增策略选择器 UI

**Tech Stack:** 纯 JavaScript (Tampermonkey userscript)，无新增依赖，单文件改动

---

### Task 1: 新增 conversationStrategy 配置项到 state 和 settings

**Files:**
- Modify: `Boss_helper.js:203` (state.settings.ai 之后)

- [ ] **Step 1: 在 state.settings 中新增 conversationStrategy 默认值**

在 `state.settings.ai` 块的最后（第 203 行 `useCustomApi` 之后）插入：

```javascript
conversationStrategy: localStorage.getItem("conversationStrategy") || "balanced",
```

完整上下文：
```javascript
ai: {
  role:
    localStorage.getItem("aiRole") ||
    "你是求职的应届生正在面对HR，回复需满足：20字内，编造专业对口/实习经验/证书任一岗位优势；被问个人信息或岗位条件，直接配合提供合理数据；全程积极真诚无拒绝言辞。",
  apiKey: localStorage.getItem("aiApiKey") || "",
  apiUrl: localStorage.getItem("aiApiUrl") || "https://spark-api-open.xf-yun.com/v1/chat/completions",
  model: localStorage.getItem("aiModel") || "lite",
  useCustomApi: localStorage.getItem("useCustomApi") === "true",
  conversationStrategy: localStorage.getItem("conversationStrategy") || "balanced",
},
```

- [ ] **Step 2: 在 saveSettings() 中新增策略保存逻辑**

在 `saveSettings()` 函数末尾（第 2002 行 `excludeHeadhunters` 保存之后，第 2004 行 `if (state.settings)` 之前）插入：

```javascript
if (settings.ai && settings.ai.conversationStrategy) {
  localStorage.setItem("conversationStrategy", settings.ai.conversationStrategy);
}
if (state.settings && state.settings.ai) {
  state.settings.ai.conversationStrategy = settings.ai.conversationStrategy;
}
```

- [ ] **Step 3: Commit**

```bash
git add Boss_helper.js
git commit -m "feat: add conversationStrategy config to state and settings persistence"
```

---

### Task 2: 构建 Core.ConversationStrategy 模块

**Files:**
- Modify: `Boss_helper.js:5498` (在 `generatePersonalizedReply` 之后插入新模块)

- [ ] **Step 1: 定义 PHASES 常量**

在 `generatePersonalizedReply` 方法的闭合 `},` 之后（约第 5498 行）插入：

```javascript
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
```

- [ ] **Step 2: 实现 PhaseDetector**

在 PHASES 和 STRATEGIES 常量之后继续插入：

```javascript
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
```

- [ ] **Step 3: 实现 buildPrompt()**

在 `detectPhase` 之后继续插入：

```javascript
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
```

- [ ] **Step 4: 实现 getConversationStrategy() 辅助函数**

在 `buildPrompt` 之后继续插入：

```javascript
  function getConversationStrategy() {
    const strategy = (state.settings.ai && state.settings.ai.conversationStrategy)
      || localStorage.getItem("conversationStrategy")
      || "balanced";
    return STRATEGIES[strategy] ? strategy : "balanced";
  }
```

- [ ] **Step 5: Commit**

```bash
git add Boss_helper.js
git commit -m "feat: add ConversationStrategy module with PhaseDetector, PromptBuilder, and strategy configs"
```

---

### Task 3: 修改 Core.generatePersonalizedReply() 使用新策略系统

**Files:**
- Modify: `Boss_helper.js:5455-5498`

- [ ] **Step 1: 替换 generatePersonalizedReply**

将现有的 `generatePersonalizedReply` 方法（第 5455-5498 行）替换为：

```javascript
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
        return reply;
      } catch (error) {
        this.log(`生成个性化回复失败: ${error.message}`);
        return await this.requestAi(hrMessage);
      }
    },
```

- [ ] **Step 2: Commit**

```bash
git add Boss_helper.js
git commit -m "feat: integrate phase-aware prompt building into generatePersonalizedReply"
```

---

### Task 4: 修改 Core.aiReply() 传递岗位名称

**Files:**
- Modify: `Boss_helper.js:4973-4977` (aiReply 中的 positionName 获取和使用)

- [ ] **Step 1: 确认 aiReply 已使用新的 generatePersonalizedReply**

`Core.aiReply()` 第 4973-4977 行已经在调用 `this.generatePersonalizedReply(lastMessage, positionName)`，无需额外改动。但需确认 `getConversationStrategy`、`detectPhase`、`buildPrompt` 函数在 `Core` 对象作用域内可访问——它们定义在同一个 IIFE 中，自然可访问。

无需改动。

- [ ] **Step 2: Commit**

```bash
git add Boss_helper.js
git commit -m "feat: verify aiReply integration with new strategy system"
```

---

### Task 5: 修改 HRInteractionManager._handleFirstInteraction() 使用 Phase 1 策略

**Files:**
- Modify: `Boss_helper.js:659-673`

- [ ] **Step 1: 在打招呼时记录对话阶段**

保持 `_handleFirstInteraction` 现有逻辑不变——它调用 `sendGreetings()` 发送用户预设的自我介绍，之后调用 `_handleResumeSending()`。这符合 Phase 1 的行为（打招呼破冰）。

在发送完打招呼后，日志中增加策略信息。在第 660 行日志处修改：

将：
```javascript
Core.log(`首次沟通: ${hrKey}`);
```

改为：
```javascript
const strategyLabel = STRATEGIES[getConversationStrategy()] ? STRATEGIES[getConversationStrategy()].label : "平衡";
Core.log(`首次沟通(对话策略:${strategyLabel}): ${hrKey}`);
```

- [ ] **Step 2: Commit**

```bash
git add Boss_helper.js
git commit -m "feat: add strategy label to first interaction logging"
```

---

### Task 6: 新增策略选择器 UI 到设置面板

**Files:**
- Modify: `Boss_helper.js:2204` (在 `aiSettingsPanel.append(roleSetting)` 之后插入策略选择器 UI)

- [ ] **Step 1: 在 createSettingsDialog() 中新增策略选择器**

在 `aiSettingsPanel.append(roleSetting);`（第 2204 行）之后插入：

```javascript
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
```

- [ ] **Step 2: 确保 STRATEGIES 常量在 createSettingsDialog 作用域内可访问**

`STRATEGIES` 定义在 `Core` 对象外部的 IIFE 作用域中，`createSettingsDialog()` 也在同一 IIFE 中，因此可以直接引用。无需额外处理。

- [ ] **Step 3: Commit**

```bash
git add Boss_helper.js
git commit -m "feat: add strategy selector UI with radio cards to settings dialog"
```

---

### Task 7: 更新 saveSettings() 和 loadSettingsIntoUI() 支持策略持久化

**Files:**
- Modify: `Boss_helper.js:2002` (saveSettings 新增策略保存)
- Modify: `Boss_helper.js:3338` (loadSettingsIntoUI 新增策略回显)

- [ ] **Step 1: 更新 saveSettings()**

在 `saveSettings()` 函数中（第 2002 行 `excludeHeadhunters` 保存之后）插入：

```javascript
localStorage.setItem(
  "conversationStrategy",
  settings.ai.conversationStrategy || "balanced"
);
```

注意：此处在 Task 1 Step 2 中已经插入了类似代码，如果已插入则跳过此步骤。

- [ ] **Step 2: 更新 loadSettingsIntoUI()**

在 `loadSettingsIntoUI()` 函数末尾（第 3383 行 `updateStatusOptions();` 之前）插入：

```javascript
const savedStrategy = settings.ai.conversationStrategy || localStorage.getItem("conversationStrategy") || "balanced";
const strategyRadio = document.querySelector(`.strategy-option input[value="${savedStrategy}"]`);
if (strategyRadio) {
  strategyRadio.checked = true;
  strategyRadio.dispatchEvent(new Event("change", { bubbles: true }));
}
```

- [ ] **Step 3: Commit**

```bash
git add Boss_helper.js
git commit -m "feat: add strategy persistence in saveSettings and loadSettingsIntoUI"
```

---

### Task 8: 端到端验证

**Files:**
- Modify: `Boss_helper.js` (如果需要修复)

- [ ] **Step 1: 验证语法正确性**

```bash
node --check Boss_helper.js
```

期望：无语法错误。

- [ ] **Step 2: 验证函数引用完整性**

在浏览器 Console 中加载脚本后检查：
```javascript
// 验证 STRATEGIES 对象可访问
console.log(STRATEGIES);

// 验证 detectPhase 函数
console.log(detectPhase("发个简历看看"));   // 期望: 2 (SHOWCASE)
console.log(detectPhase("期望薪资多少"));   // 期望: 4 (SALARY)
console.log(detectPhase("方便面试吗"));     // 期望: 5 (INTERVIEW)
console.log(detectPhase(""));              // 期望: 1 (GREETING)

// 验证 buildPrompt 函数
const prompt = buildPrompt(PHASES.GENERAL, "你好", "前端开发", "3年经验...", "", "balanced");
console.log(prompt.includes("【对话策略】")); // 期望: true

// 验证策略选择器 UI
document.querySelectorAll(".strategy-option").length; // 期望: 3
```

- [ ] **Step 3: 按照验证清单进行手动回归测试**

完成编码后，按以下清单逐项验证：
- [ ] BOSS直聘职位列表页面正常加载，悬浮面板出现
- [ ] 设置对话框打开，"聊天设置"标签中显示策略选择器（3个选项）
- [ ] 默认选中"平衡·稳扎稳打"
- [ ] 切换到"激进"后关闭设置，再次打开设置确认选择保留
- [ ] 聊天页面中，AI 自动回复功能正常工作
- [ ] 日志中显示"对话阶段: XXX (策略名)"
- [ ] 海投功能（批量打招呼、自动发简历）仍正常工作

- [ ] **Step 4: Commit**

```bash
git add Boss_helper.js
git commit -m "chore: complete verification of AI conversation strategy feature"
```

---

## 完成标准

- [ ] `conversationStrategy` 配置项持久化（localStorage 存取正常）
- [ ] 5个对话阶段 + 通用阶段的关键词检测正常工作
- [ ] 每种策略（激进/平衡/保守）的 prompt 模板注入正确的语气指令
- [ ] 策略选择器 UI 渲染正确，切换流畅
- [ ] `generatePersonalizedReply()` 使用新的阶段感知 prompt
- [ ] 现有海投和自动回复功能无回归
