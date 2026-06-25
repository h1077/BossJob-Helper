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

