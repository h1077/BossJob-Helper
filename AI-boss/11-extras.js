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
                    &emsp;&emsp;开源地址：https://github.com/h1077/BossJob-Helper | AGPL-3.0-or-later
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

