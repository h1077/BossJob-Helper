# BossJob-Helper

BOSS 直聘 AI 海投助手 — 浏览器脚本 + 桌面应用，双端配合实现智能求职自动化。

[![GitHub](https://img.shields.io/badge/GitHub-h1077%2FBossJob--Helper-blue)](https://github.com/h1077/BossJob-Helper)
[![License](https://img.shields.io/badge/License-AGPL--3.0-orange)](./LICENSE)
[![Version](https://img.shields.io/badge/Version-3.0.0-green)]()

---

## 目录

- [快速开始](#快速开始)
- [Boss_helper.js — 浏览器脚本](#boss_helperjs--浏览器脚本)
- [Boss_helper.exe — 桌面应用](#boss_helperexe--桌面应用)
- [双端协作](#双端协作)
- [AI Agent 集成](#ai-agent-集成)
- [AI 接口配置](#ai-接口配置)
- [项目结构](#项目结构)
- [常见问题](#常见问题)
- [免责声明](#免责声明)

---

## 快速开始

| 组件              | 用途       | 一句话说明                                               |
| ----------------- | ---------- | -------------------------------------------------------- |
| `Boss_helper.js`  | 浏览器脚本 | BOSS 直聘页面注入控制面板，自动打招呼、AI 回复、翻页投递 |
| `Boss_helper.exe` | 桌面应用   | 本地仪表盘 + Agent API，数据持久化、岗位分析、导出报告   |

**推荐同时使用两者**：脚本负责页面操作，桌面应用负责数据管理和 AI Agent 集成。

---

## Boss_helper.js — 浏览器脚本

在 BOSS 直聘页面注入智能控制面板，自动化海投全流程。**零依赖，导入即用。**

### 安装步骤

**第一步：安装脚本管理器**

| 浏览器         | 推荐工具                 | 链接                                                         |
| -------------- | ------------------------ | ------------------------------------------------------------ |
| Chrome / Edge  | Tampermonkey             | [Chrome 商店](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| Chrome / Edge  | ScriptCat                | [Chrome 商店](https://chromewebstore.google.com/detail/scriptcat/ndcooeabafpmejflghodcmfiepppeich) |
| Firefox        | Tampermonkey             | [Firefox 附加组件](https://addons.mozilla.org/firefox/addon/tampermonkey/) |
| Android (Kiwi) | ScriptCat / Tampermonkey | Kiwi 浏览器 + 扩展商店                                       |

**第二步：导入脚本**

1. 打开脚本管理器的管理面板
2. 点击「新建脚本」或「导入」
3. 将 `Boss_helper.js` 的全部内容粘贴进去，保存
4. 确保脚本已启用（开关为 ON）

![image-20260626234420535](C:\Users\hu\AppData\Roaming\Typora\typora-user-images\image-20260626234420535.png)

> **🖼️ [图 1]** 脚本导入示意图

**第三步：配置 AI API**

1. 打开 [BOSS 直聘职位页](https://www.zhipin.com/web/geek/job)
2. 页面右侧出现 **AI-Boss 控制面板**
3. 点击 🔵 AI 配置按钮，填入 API 信息

![image-20260626234452618](C:\Users\hu\AppData\Roaming\Typora\typora-user-images\image-20260626234452618.png)

> ![image-20260626234530756](C:\Users\hu\AppData\Roaming\Typora\typora-user-images\image-20260626234530756.png)

**第四步：设置筛选 → 启动**

1. 控制面板输入筛选条件：职位名 / 工作地 / 福利关键词
2. 点击「启动海投」
3. 脚本自动翻页、逐个沟通，AI 为每个岗位生成定制招呼语

<!-- 📸 图片占位：海投运行中截图 -->

> **🖼️ [图 3]** 海投运行界面（含福利筛选 + 翻页进度）

---

### 功能详解

#### 1. 千岗千面 AI 招呼语

每个岗位单独调用 AI，结合你的简历和 JD 生成个性化招呼语。

| 特性          | 说明                                                  |
| ------------- | ----------------------------------------------------- |
| 简历感知      | 有简历时，AI 结合真实经历 + JD 生成                   |
| 无简历降级    | 没有简历也能从 JD 反向提取关键词生成                  |
| 三级 Fallback | AI 失败 → 模板替换 → 硬编码兜底，保证永远有招呼语可发 |
| 24h 缓存      | 已生成的招呼语按 jobId 缓存，不重复消耗 Token         |
| 输出清理      | 统一去除 AI 废话前缀、代码块、HTML 标签               |

<!-- 📸 图片占位：招呼语生成效果对比 -->

> **🖼️ [图 4]** AI 招呼语 vs 固定语对比

#### 2. 精确筛选系统

控制面板支持三维筛选：

| 筛选项     | 说明             | 示例                       |
| ---------- | ---------------- | -------------------------- |
| 职位名包含 | 逗号分隔多关键词 | `前端, React, TypeScript`  |
| 工作地包含 | 支持多城市轮转   | `杭州, 滨江, 西湖`         |
| 福利包含   | 按福利标签过滤   | `双休, 五险一金, 弹性工作` |

![image-20260627000837182](C:\Users\hu\AppData\Roaming\Typora\typora-user-images\image-20260627000837182.png)

> **🖼️ [图 5]** 三维筛选输入

#### 3. 翻页扫描 + 智能跳过

| 特性           | 说明                                                    |
| -------------- | ------------------------------------------------------- |
| 翻页扫描       | 处理完当前页后自动翻页继续，默认最多 5 页               |
| HR 活跃度过滤  | 自动跳过超过 14 天未活跃的 HR（可配置），节省配额       |
| 公司去重       | 模糊匹配公司名（去后缀/去城市前缀），避免同公司重复投递 |
| 招聘者状态筛选 | 多选：在线 / 刚刚活跃 / 3 日内活跃 / 本周活跃           |
| 猎头过滤       | 可开启排除猎头岗位                                      |
| 每日上限       | 默认 100 条，达上限自动停止（可配 0 禁用）              |

#### 4. AI 智能聊天回复

实时监听 HR 消息，AI 自动分析并生成回复，支持 **6 阶段对话策略**：

```
开场破冰 → 技术深挖 → 项目经验 → 综合素质 → 反问阶段 → 面试邀约
```

| 功能     | 说明                              |
| -------- | --------------------------------- |
| 自动回复 | 可开关，AI 生成后自动发送         |
| 阶段感知 | 根据对话进展调整回复策略          |
| 对话记忆 | 保留最近 6 条上下文，7 天自动清理 |
| 拒绝识别 | 命中拒绝关键词自动加入黑名单      |
| 简历发送 | 自动发送文本 / 图片简历           |

<!-- 📸 图片占位：聊天回复界面截图 -->

> **🖼️ [图 6]** AI 智能聊天回复

#### 5. 公司评估 + 岗位匹配分析

| 功能         | 说明                                                         | 触发方式                     |
| ------------ | ------------------------------------------------------------ | ---------------------------- |
| 快速评估     | `分数\|短评`，判断岗位靠不靠谱                               | 投递循环中自动运行           |
| 深度匹配分析 | 6 维结构化报告：匹配度% / 匹配技能 / 技能差距 / 决策建议 / 风险点 / 建议提问 | 按需调用 `analyzeJobMatch()` |
| 自动拒绝     | 评估 ≤ 6 分自动跳过，发送礼貌拒绝回复                        | 自动                         |
| 24h 缓存     | 评估结果按「公司+岗位」缓存，同岗位不重复消耗 Token          | 自动                         |

<!-- 📸 图片占位：岗位匹配分析报告截图 -->

> **🖼️ [图 7]** 岗位匹配分析 6 维报告

#### 6. AI 模拟面试

选择真实岗位，AI 扮演 HR 进行 6 阶段模拟面试 + 自动出评估报告。

![image-20260627000633038](C:\Users\hu\AppData\Roaming\Typora\typora-user-images\image-20260627000633038.png)

> **🖼️ [图 8]** AI 模拟面试 & 评估报告

#### 7. 简历评分

6 维度打分（教育背景 / 技术技能 / 项目经验 / 职业发展 / 软技能 / 简历质量），AI 优化严格遵守"不编造"原则。

#### 8. 投递看板 + 漏斗

控制面板内嵌实时仪表盘：

| 组件     | 说明                                                |
| -------- | --------------------------------------------------- |
| 统计卡片 | 总岗位 / 高匹配 / 已投递 / 面试中 / 已拒绝          |
| 投递漏斗 | 今日投递 → HR 回复 → 面试邀约，三色进度条 + 转化率% |
| 周报     | 一键生成文字周报                                    |

![image-20260627000700418](C:\Users\hu\AppData\Roaming\Typora\typora-user-images\image-20260627000700418.png)

> **🖼️ [图 9]** 投递看板 + 漏斗

#### 9. 安全风控

| 机制       | 说明                                                       |
| ---------- | ---------------------------------------------------------- |
| 随机间隔   | 操作间隔 3-8 秒随机化                                      |
| 渐进式退避 | 连续失败 3 次后间隔自动倍增至 6x（最长 60s），成功逐步恢复 |
| 每日上限   | 达上限自动停，防封号                                       |
| 翻页延迟   | 翻页间隔 8 秒，模拟真人浏览                                |

---

## Boss_helper.exe — 桌面应用

本地运行的 Flask 桌面应用，提供仪表盘、数据持久化、**AI Agent API**。

### 安装与启动

**方式一：直接运行 .exe（推荐）**

1. 下载 `Boss_helper.exe`
2. 双击启动
3. 浏览器自动打开 `http://localhost:5001`
4. 系统托盘常驻，右键退出

![image-20260627000727133](C:\Users\hu\AppData\Roaming\Typora\typora-user-images\image-20260627000727133.png)

> **🖼️ [图 10]** 桌面应用仪表盘首页

**方式二：源码运行**

```bash
cd boss-desktop-app
pip install -r requirements.txt
python app.py
```

### 桌面应用功能详解

#### 1. 仪表盘与统计

实时展示：今日投递 / 回复率 / 面试邀约 / 投递漏斗 / Pipeline 分布。

#### 2. 岗位追踪 & 导出

自动收集脚本端投递的每个岗位，一键导出 **CSV / Excel / JSON**。

#### 3. AI 代理

| 特性       | 说明                                                        |
| ---------- | ----------------------------------------------------------- |
| 多供应商   | DeepSeek / OpenAI / 硅基流动 / 火山引擎                     |
| 密钥安全   | API Key 加密存储于本地 SQLite                               |
| Token 代理 | 脚本 AI 请求通过 `DesktopBridge` 转发，Key 不暴露在浏览器端 |

#### 4. Agent API（新增）

桌面应用暴露 **7 个 REST 端点**，供 AI Agent（Claude / GPT / Cursor）直接调用：

```
GET  /api/agent/status        # 当前状态
GET  /api/agent/stats         # 投递漏斗数据
GET  /api/agent/jobs          # 岗位列表
POST /api/agent/command       # 发送指令（start_apply / stop_apply）
GET  /api/agent/command       # JS 脚本轮询指令
POST /api/agent/command/ack   # 确认指令完成
POST /api/agent/analyze       # AI 岗位匹配分析
```

所有响应统一 JSON 信封：`{"ok": true/false, "data": {...}, "error": null}`

---

## 双端协作

```
┌─────────────────────────┐     ┌──────────────────────────┐
│   Boss_helper.js        │     │   Boss_helper.exe        │
│   (浏览器 Tampermonkey)  │────▶│   (本地 localhost:5001)   │
│                         │     │                          │
│   · 页面 DOM 操作        │     │   · SQLite 数据持久化      │
│   · 打招呼 / 聊天        │     │   · AI API 代理            │
│   · 翻页扫描             │     │   · 仪表盘 & 统计          │
│   · Pipeline 看板        │     │   · CSV/Excel 导出         │
│   · 投递漏斗             │     │   · Agent API (7端点)      │
│   · localStorage 缓存    │     │   · 本地加密存储           │
│   · DesktopBridge ───────┼────▶│   · 指令队列 → JS 轮询    │
└─────────────────────────┘     └──────────────────────────┘
```

| 职责                   |  脚本 (JS)   |    桌面应用 (exe)    |
| ---------------------- | :----------: | :------------------: |
| 批量打招呼 / 页面操作  |     ✅ 主     |  辅助（Agent 指令）  |
| 实时聊天监听 + AI 回复 |     ✅ 主     |          ❌           |
| 图片简历发送           |    ✅ 独有    |          ❌           |
| 翻页扫描投递           |     ✅ 主     |          ❌           |
| 福利筛选               |     ✅ 主     |          ❌           |
| Pipeline 看板 + 漏斗   |     ✅ 主     |         辅助         |
| 公司去重 / HR 过滤     |      ✅       |          ❌           |
| JD 深度分析 + 匹配报告 |     ✅ 主     | ✅ 辅助（Agent 端点） |
| 数据导出 (CSV/Excel)   |      ❌       |         ✅ 主         |
| AI Key 加密存储        |      ❌       |         ✅ 主         |
| Agent API              |      ❌       |        ✅ 独有        |
| 数据持久化             | localStorage |        SQLite        |

---

## AI Agent 集成

Boss_helper.exe 启动后，AI Agent 可通过 HTTP 直接操控海投：

```bash
# 查状态
curl http://localhost:5001/api/agent/status

# 查今日统计
curl http://localhost:5001/api/agent/stats

# 发指令开始投递
curl -X POST http://localhost:5001/api/agent/command \
  -H "Content-Type: application/json" \
  -d '{"action":"start_apply"}'

# AI 分析岗位
curl -X POST http://localhost:5001/api/agent/analyze \
  -H "Content-Type: application/json" \
  -d '{"company_name":"XX科技","position_name":"前端","jd_text":"..."}'
```

**数据流**：Agent → HTTP POST → Boss_helper.exe（指令队列）→ JS 脚本轮询 → 执行 → ACK。

---

## AI 接口配置

### 推荐供应商

| 供应商                 |  新用户额度   |     兼容性      | 获取地址                                                 |
| ---------------------- | :-----------: | :-------------: | -------------------------------------------------------- |
| 硅基流动 (SiliconFlow) | 2000 万 Token | DeepSeek / Qwen | [siliconflow.cn](https://siliconflow.cn)                 |
| DeepSeek 官方          | 1000 万 Token |   DeepSeek-V3   | [platform.deepseek.com](https://platform.deepseek.com)   |
| 火山引擎 (豆包)        |  50 万 Token  | DeepSeek / 豆包 | [console.volcengine.com](https://console.volcengine.com) |
| OpenAI 官方            |     付费      |     GPT-4o      | [platform.openai.com](https://platform.openai.com)       |

### 配置格式

| 字段    | 示例值                                           |
| ------- | ------------------------------------------------ |
| API URL | `https://api.siliconflow.cn/v1/chat/completions` |
| API Key | `sk-xxxxxxxxxxxxxxxxxxxxxxxx`                    |
| Model   | `deepseek-ai/DeepSeek-V3`                        |

脚本端在控制面板 AI 配置弹窗填写；桌面端在 `http://localhost:5001` 设置页填写。

---

## 项目结构

```
BossJob-Helper/
│
├── Boss_helper.js                 # 浏览器脚本（9145 行，导入 Tampermonkey/ScriptCat）
├── Boss_helper.exe                # 桌面应用可执行文件（PyInstaller 打包）
│
├── AI-boss/                       # 脚本源码（模块化开发）
│   ├── 00-header.js               #   UserScript 头部元信息
│   ├── 01-config.js               #   全局配置 & 常量（含所有阈值）
│   ├── 02-state.js                #   全局状态管理
│   ├── 03-utils.js                #   工具函数 + CompanyDedup 公司去重
│   ├── 04-storage.js              #   localStorage 封装 + AICache 缓存层
│   ├── 05-hr-interaction.js       #   HR 交互 + 招呼语发送（含 fallback）
│   ├── 06-ui-core.js              #   控制面板 UI（含漏斗图）
│   ├── 07-settings.js             #   设置面板
│   ├── 08-core.js                 #   核心逻辑（海投/翻页/退避/匹配分析）
│   ├── 09-conversation.js         #   6 阶段对话策略
│   ├── 10-process.js              #   流程控制（启停/参数读取）
│   ├── 11-extras.js               #   附加功能（简历评分、模拟面试、周报）
│   ├── 12-footer.js               #   初始化入口 & 收尾
│   ├── 13-desktop-bridge.js       #   桌面应用桥接 + Agent 指令轮询
│   └── build.js                   #   构建脚本（node build.js）
│
├── boss-desktop-app/              # 桌面应用（Flask + SQLite）
│   ├── app.py                     #   应用入口
│   ├── config.py                  #   配置文件
│   ├── models.py                  #   数据库模型
│   ├── requirements.txt           #   Python 依赖
│   ├── routes/                    #   API 路由
│   │   ├── ai.py                  #     AI 代理 & 对话
│   │   ├── agent.py               #     Agent API（7 端点）★新增
│   │   ├── jobs.py                #     岗位追踪 & 导出
│   │   ├── resumes.py             #     简历管理
│   │   └── analytics.py           #     统计接口
│   ├── utils/                     #   工具模块
│   │   ├── auth.py                #     JWT 认证
│   │   ├── crypto.py              #     加密工具
│   │   └── rate_limit.py          #     速率限制
│   ├── static/                    #   前端静态文件
│   │   ├── index.html             #     仪表盘页面
│   │   ├── css/                   #     样式
│   │   └── js/                    #     前端逻辑
│   ├── data/                      #   运行时数据（自动创建）
│   └── build/                     #   构建输出 & spec
│
├── README.md                      # 本文件
└── LICENSE                        # AGPL-3.0
```

---

## 常见问题

### Q: 脚本导入后不显示控制面板？

1. 确保已打开 `https://www.zhipin.com/web/*` 下的页面
2. 检查脚本管理器是否已启用该脚本
3. 打开浏览器控制台 (F12) 查看是否有红色报错
4. ScriptCat 用户注意：脚本已兼容 `document.readyState` 检查

### Q: 海投提示"未配置 AI API"？

点击控制面板顶部的 AI 配置按钮填入 API 信息。或启动桌面应用，脚本自动通过本地代理调用 AI。

### Q: 启动后翻了几页就停了？

检查：① 每日投递上限是否已达（默认 100）② 当前轮次是否已达到最大翻页数（默认 5 页）③ 翻页按钮是否不存在（已是最后一页）。

### Q: 为什么有些岗位被跳过了？

脚本跳过岗位有 5 种原因，日志会明确标注：

1. HR 超过 14 天未活跃
2. 已投递过该公司（模糊匹配）
3. 福利不匹配
4. 招聘者状态不匹配
5. 公司评估 ≤ 6 分自动拒绝

### Q: 操作越来越慢？

这是**渐进式退避**机制：连续 3 次操作失败后，间隔自动增加到 6 倍。成功几次后会恢复正常。2 分钟无失败也会自动重置。

### Q: 桌面应用启动后浏览器没打开？

手动访问 `http://localhost:5001`。如无法访问，检查 5001 端口是否被占用。

### Q: 能用 Claude / GPT 控制脚本吗？

可以。启动 Boss_helper.exe 后，Agent 通过 HTTP 调用 `/api/agent/*` 端点即可。详见 [AI Agent 集成](#ai-agent-集成)。

### Q: 如何卸载？

删除 `Boss_helper.exe` 和 `boss-desktop-app/` 文件夹即可。浏览器端在脚本管理器中删除脚本。

---

## 免责声明

1. **仅供学习交流**：本项目仅用于学习和研究自动化技术。
2. **使用风险自负**：使用后果（包括账号限制、封禁）由使用者自行承担。
3. **遵守平台规则**：请遵守 BOSS 直聘使用条款，合理控制投递频率。
4. **AI 内容责任**：AI 生成内容不代表开发者立场。
5. **开源协议**：AGPL-3.0，衍生项目必须同样开源。

---

> **不是帮你投简历，是帮你省出时间准备面试。**  
> **让机械操作归脚本，让你专心准备面试。**

<p align="center">
  <a href="https://github.com/h1077/BossJob-Helper">
    <img src="https://img.shields.io/badge/GitHub-View%20on%20GitHub-blue?logo=github" alt="GitHub">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-AGPL--3.0-orange" alt="License">
  </a>
  <img src="https://img.shields.io/badge/Version-3.0.0-green" alt="Version">
</p>

