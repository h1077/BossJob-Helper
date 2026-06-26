# BossJob-Helper

BOSS 直聘 AI 海投助手 — 浏览器脚本 + 桌面应用，双端配合实现智能求职自动化。

[![GitHub](https://img.shields.io/badge/GitHub-h1077%2FBossJob--Helper-blue)](https://github.com/h1077/BossJob-Helper)
[![License](https://img.shields.io/badge/License-AGPL--3.0-orange)](./LICENSE)
[![Version](https://img.shields.io/badge/Version-2.1.0-green)]()

---

## 目录

- [快速开始](#快速开始)
- [功能概览](#功能概览)
- [Boss_helper.js — 浏览器脚本](#boss_helperjs--浏览器脚本)
  - [安装步骤](#安装步骤)
  - [功能详解](#功能详解)
- [Boss海投小助手.exe — 桌面应用](#boss海投小助手exe--桌面应用)
  - [安装与启动](#安装与启动)
  - [功能详解](#桌面应用功能详解)
- [双端协作](#双端协作)
- [AI 接口配置](#ai-接口配置)
- [项目结构](#项目结构)
- [常见问题](#常见问题)
- [免责声明](#免责声明)

---

## 快速开始

| 组件 | 用途 | 一句话说明 |
|------|------|-----------|
| `Boss_helper.js` | 浏览器脚本 | 在 BOSS 直聘页面注入控制面板，自动打招呼、AI 回复、管理投递 |
| `Boss海投小助手.exe` | 桌面应用 | 本地仪表盘，数据持久化、JD 分析、导出报告 |

**推荐同时使用两者**：脚本负责页面操作，桌面应用负责数据管理，通过本地 API 协作。

---

## Boss_helper.js — 浏览器脚本

在 BOSS 直聘页面注入智能控制面板，自动化海投流程。

### 安装步骤

**第一步：安装脚本管理器**

| 浏览器 | 推荐工具 | 链接 |
|--------|---------|------|
| Chrome / Edge | Tampermonkey | [Chrome 商店](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| Chrome / Edge | ScriptCat | [Chrome 商店](https://chromewebstore.google.com/detail/scriptcat/ndcooeabafpmejflghodcmfiepppeich) |
| Firefox | Tampermonkey | [Firefox 附加组件](https://addons.mozilla.org/firefox/addon/tampermonkey/) |
| Android (Kiwi) | ScriptCat / Tampermonkey | Kiwi 浏览器 + 扩展商店 |

**第二步：导入脚本**

1. 打开脚本管理器的管理面板
2. 点击「新建脚本」或「导入」
3. 将 `Boss_helper.js` 的全部内容粘贴进去，保存
4. 确保脚本已启用（开关为 ON）

<!-- 📸 图片占位：脚本管理器导入界面截图 -->
> **🖼️ [图 1]** 脚本导入示意图

**第三步：配置 AI API**

1. 打开 [BOSS 直聘职位页](https://www.zhipin.com/web/geek/job)
2. 页面右侧会出现 **AI-Boss 控制面板**
3. 点击 🔵 AI 配置按钮，填入你的 API 信息

<!-- 📸 图片占位：AI 配置弹窗截图 -->
> **🖼️ [图 2]** AI API 配置界面

**第四步：开投**

1. 在 BOSS 直聘搜索职位、设置筛选条件
2. 点击控制面板的「启动海投」按钮
3. 脚本自动逐个沟通，每个岗位 AI 生成定制招呼语

<!-- 📸 图片占位：海投运行中截图 -->
> **🖼️ [图 3]** 海投运行界面

---

### 功能详解

#### 1. 千岗千面 AI 招呼语

每个岗位单独调用 AI 生成招呼语，精准匹配 JD 要求，不再是千篇一律的"您好，我对这个岗位很感兴趣"。

| 特性 | 说明 |
|------|------|
| 简历感知 | 有简历时，AI 结合真实经历+JD 生成招呼语 |
| 无简历降级 | 没有简历也能根据 JD 反向生成合理人设 |
| Token 优化 | 已生成的招呼语自动缓存，不重复消耗 |
| 多模板 | 支持多套自我介绍模板，随机切换 |

<!-- 📸 图片占位：招呼语生成效果对比（固定语 vs AI定制语） -->
> **🖼️ [图 4]** AI 招呼语 vs 固定语对比

#### 2. AI 智能聊天回复

实时监听 HR 消息，AI 自动分析并生成回复，支持 6 阶段对话策略：

```
开场破冰 → 技术深挖 → 项目经验 → 综合素质 → 反问阶段 → 面试邀约
```

| 功能 | 说明 |
|------|------|
| 自动回复 | 检测到新消息自动生成回复，可开关 |
| 阶段感知 | 根据对话进展调整回复策略 |
| 公司评估 | 自动评估公司靠谱程度，不合格的自动拒绝 |
| 关键词过滤 | 可设置拒绝关键词，命中自动放弃 |
| 简历发送 | 自动发送文本简历/图片简历 |

<!-- 📸 图片占位：聊天回复界面截图 -->
> **🖼️ [图 5]** AI 智能聊天回复

#### 3. AI 模拟面试

选择一个真实岗位，AI 扮演 HR 进行模拟面试。

| 阶段 | 内容 |
|------|------|
| 开场 | 自我介绍、求职动机 |
| 技术深挖 | 根据 JD 技术栈提问 |
| 项目经验 | 深挖简历项目细节 |
| 综合素质 | 团队协作、解决问题能力 |
| 反问 | 你向 HR 提问 |
| 评估报告 | 综合打分 + 优势 + 待改进 + 建议 |

<!-- 📸 图片占位：模拟面试界面 + 评估报告截图 -->
> **🖼️ [图 6]** AI 模拟面试 & 评估报告

#### 4. 简历评分 & 优化

| 维度 | 满分 | 说明 |
|------|:----:|------|
| 教育背景 | 15 | 学历、专业匹配度 |
| 技术技能 | 25 | 技能广度与深度 |
| 项目经验 | 30 | 项目复杂度与成果 |
| 职业发展 | 15 | 成长路径合理性 |
| 软技能 | 10 | 沟通、领导力 |
| 简历质量 | 5 | 排版、表达清晰度 |

AI 优化严格遵守"不编造"原则——只优化表达方式，不添加你未做过的事。

<!-- 📸 图片占位：简历评分报告截图 -->
> **🖼️ [图 7]** 简历六维评分

#### 5. Pipeline 投递看板

跟踪每一份投递的状态流转：

```
已投递 → HR 已读 → 已回复 → 已约面试 → 已发 Offer → 已入职
                              ↘ 不合适 / 已拒绝
```

| 功能 | 说明 |
|------|------|
| 看板视图 | 按阶段分列展示，拖拽式管理 |
| 投递流水 | 表格视图，支持筛选排序 |
| 每日统计 | 今日投递数、回复率、邀约率 |
| 跟进提醒 | 超时未回复的自动提醒 |

<!-- 📸 图片占位：Pipeline 看板截图 -->
> **🖼️ [图 8]** Pipeline 投递看板

#### 6. 其他特性

- **批量筛选**：按职位名、工作地、薪资等条件筛选岗位
- **防检测**：随机操作间隔，模拟真人行为
- **数据缓存**：已处理的 HR 自动跳过，不重复投递
- **图片简历**：支持发送图片格式简历（防引流检测）

---

## Boss海投小助手.exe — 桌面应用

本地运行的 Flask 桌面应用，提供仪表盘、数据持久化、高级分析功能。

### 安装与启动

**环境要求**

| 依赖 | 版本 |
|------|------|
| Python | ≥ 3.10 |
| 操作系统 | Windows 10/11 |

**方式一：直接运行 .exe（推荐）**

1. 下载 `Boss海投小助手.exe`
2. 双击启动
3. 浏览器自动打开 `http://localhost:5001`
4. 托盘图标常驻，右键可退出

<!-- 📸 图片占位：桌面应用启动界面截图 -->
> **🖼️ [图 9]** 桌面应用仪表盘首页

**方式二：源码运行**

```bash
cd boss-desktop-app
pip install -r requirements.txt
python app.py
```

### 桌面应用功能详解

#### 1. 仪表盘（Dashboard）

实时展示求职数据概览：

| 指标 | 说明 |
|------|------|
| 今日投递 | 今天投递的总岗位数 |
| 回复率 | HR 回复数 / 投递数 |
| 面试邀约 | 发出的面试邀请数 |
| Pipeline 分布 | 各阶段岗位数量柱状图 |

<!-- 📸 图片占位：仪表盘数据概览截图 -->
> **🖼️ [图 10]** 仪表盘数据概览

#### 2. 岗位追踪 & 导出

- 自动收集脚本端投递的每个岗位
- 支持按公司、状态、时间筛选
- 一键导出 **CSV / Excel / JSON** 格式
- 岗位 JD 完整保存，支持离线查看

<!-- 📸 图片占位：岗位列表 & 导出截图 -->
> **🖼️ [图 11]** 岗位追踪 & 数据导出

#### 3. AI 代理

桌面应用作为 AI API 的统一代理：

| 特性 | 说明 |
|------|------|
| 多供应商 | DeepSeek / OpenAI / 硅基流动 / 火山引擎 |
| 密钥安全 | API Key 加密存储在本地的 SQLite 数据库 |
| 速率限制 | 可配置每分钟最大请求数 |
| Token 统计 | 每日 AI 调用次数和 Token 消耗统计 |

脚本端的 AI 请求通过 `DesktopBridge` 转发到桌面应用，API Key 不暴露在浏览器端。

<!-- 📸 图片占位：AI 配置管理界面截图 -->
> **🖼️ [图 12]** AI 供应商配置

#### 4. 简历管理

- 上传多份简历，针对不同岗位切换
- Markdown 格式编辑预览
- AI 简历评分和优化建议

---

## 双端协作

```
┌─────────────────────────┐     ┌──────────────────────────┐
│   Boss_helper.js        │     │   Boss海投小助手.exe       │
│   (浏览器 Tampermonkey)  │────▶│   (本地 localhost:5001)    │
│                         │     │                          │
│   · 页面 DOM 操作        │     │   · SQLite 数据持久化      │
│   · 打招呼 / 聊天        │     │   · AI API 代理            │
│   · Pipeline 看板        │     │   · 仪表盘 & 统计          │
│   · localStorage 缓存    │     │   · CSV/Excel 导出         │
│   · 桌面应用桥接 ────────┼────▶│   · 本地加密存储           │
└─────────────────────────┘     └──────────────────────────┘
```

| 职责 | 脚本 (JS) | 桌面应用 (exe) |
|------|:--:|:--:|
| 批量打招呼 / 页面操作 | ✅ 主 | 辅助 |
| 实时聊天监听 + AI 回复 | ✅ 主 | ❌ |
| 图片简历发送 | ✅ 独有 | ❌ |
| Pipeline 看板 | ✅ 主 | 辅助 |
| 福利筛选搜索 | ❌ | ✅ 主 |
| JD 深度分析 | ❌ | ✅ 主 |
| 数据导出 (CSV/Excel) | ❌ | ✅ 主 |
| 数据持久化 | localStorage | SQLite |
| AI Key 加密存储 | ❌ | ✅ 主 |

**协作流程：**

1. 启动 `Boss海投小助手.exe`（后台运行即可）
2. 浏览器打开 BOSS 直聘，脚本自动检测桌面应用
3. 脚本中的 AI 请求 → 转发到桌面应用 → 桌面应用调用 AI API → 返回结果
4. 投递数据从脚本推送至桌面应用数据库
5. 在桌面应用仪表盘查看统计、导出报告

脚本和桌面应用**不共享状态**，各司其职，数据通过本地 API 单向同步（脚本 → 桌面应用）。

---

## AI 接口配置

### 推荐供应商

| 供应商 | 新用户额度 | 兼容性 | 获取地址 |
|--------|:--------:|:------:|---------|
| 硅基流动 (SiliconFlow) | 2000 万 Token | DeepSeek / Qwen | [siliconflow.cn](https://siliconflow.cn) |
| DeepSeek 官方 | 1000 万 Token | DeepSeek-V3 | [platform.deepseek.com](https://platform.deepseek.com) |
| 火山引擎 (豆包) | 50 万 Token | DeepSeek / 豆包 | [console.volcengine.com](https://console.volcengine.com) |
| OpenAI 官方 | 付费 | GPT-4o | [platform.openai.com](https://platform.openai.com) |

### 配置格式

**脚本端直接配置：**

| 字段 | 示例值 |
|------|--------|
| API URL | `https://api.siliconflow.cn/v1/chat/completions` |
| API Key | `sk-xxxxxxxxxxxxxxxxxxxxxxxx` |
| Model | `deepseek-ai/DeepSeek-V3` |

**桌面应用端配置：**

在桌面应用仪表盘的「AI 配置」页面填写，格式同上。API Key 加密存储在本地数据库。

---

## 项目结构

```
BossJob-Helper/
│
├── Boss_helper.js                 # 浏览器脚本（主版本，导入 Tampermonkey/ScriptCat）
│
├── AI-boss/                       # 脚本源码（模块化开发）
│   ├── 00-header.js               #   UserScript 头部元信息
│   ├── 01-config.js               #   全局配置 & 常量
│   ├── 02-state.js                #   状态管理
│   ├── 03-utils.js                #   工具函数
│   ├── 04-storage.js              #   localStorage 封装
│   ├── 05-hr-interaction.js       #   HR 交互处理
│   ├── 06-ui-core.js              #   控制面板 UI
│   ├── 07-settings.js             #   设置面板
│   ├── 08-core.js                 #   核心海投逻辑
│   ├── 09-conversation.js         #   对话策略
│   ├── 10-process.js              #   招聘者状态处理
│   ├── 11-extras.js               #   附加功能（简历评分、模拟面试等）
│   ├── 12-footer.js               #   初始化入口 & 收尾逻辑
│   ├── 13-desktop-bridge.js       #   桌面应用桥接层
│   └── build.js                   #   构建脚本（node build.js）
│
├── boss-desktop-app/              # 桌面应用（Flask + SQLite）
│   ├── app.py                     #   应用入口
│   ├── config.py                  #   配置文件
│   ├── models.py                  #   数据库模型
│   ├── requirements.txt           #   Python 依赖
│   ├── routes/                    #   API 路由
│   │   ├── ai.py                  #     AI 代理 & 对话
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
│   └── Boss海投小助手.exe          #   PyInstaller 打包的可执行文件
│
├── boss-agent-cli-1.11.0/        # CLI 工具（进阶用户）
├── boss-hr-agent-toolkit-0.2.0/  # HR 工具集
├── archives/                      # 历史版本存档
├── docs/                          # 文档
├── LICENSE                        # AGPL-3.0
└── README.md                      # 本文件
```

---

## 常见问题

### Q: 脚本导入后不显示控制面板？

1. 确保已打开 `https://www.zhipin.com/web/*` 下的页面（不是首页）
2. 检查脚本管理器是否已启用该脚本
3. 打开浏览器控制台 (F12) 查看是否有红色报错
4. 确认 `@require` 依赖（如有）能正常加载

### Q: 海投提示"未配置 AI API"？

点击控制面板顶部的 AI 配置按钮（🔵），填入你的 API URL、Key 和 Model 名称。或者启动桌面应用，脚本会自动通过本地代理调用 AI。

### Q: 桌面应用启动后浏览器没有自动打开？

手动访问 `http://localhost:5001`。如果无法访问，检查：
- 端口 5001 是否被其他程序占用
- 防火墙是否阻止了 Python/Flask
- 以管理员身份运行试试

### Q: 脚本和桌面应用数据不同步？

设计如此。脚本端使用 `localStorage`，桌面应用使用 `SQLite`。数据流向是**单向**的（脚本 → 桌面应用），用于数据备份和导出。日常使用看脚本端面板即可。

### Q: 一天能投多少个？

BOSS 直聘每日打招呼上限约 **150 次**。脚本内置了间隔控制和日限统计，请合理使用，避免被平台限制。

### Q: AI 回复会出问题吗？

- AI 生成内容仅供参考，建议在自动发送前手动检查
- 可在设置中关闭「自动回复」，改为手动确认模式
- 如遇到不合适的内容，可以调整 AI 角色设定

### Q: 如何卸载桌面应用？

桌面应用为绿色便携版，无注册表写入。删除 `boss-desktop-app` 文件夹即可完全卸载。

---

## 免责声明

1. **仅供学习交流**：本项目仅用于学习和研究自动化技术，禁止用于任何商业用途。
2. **使用风险自负**：使用本工具产生的任何后果（包括但不限于账号限制、封禁）由使用者自行承担。
3. **遵守平台规则**：请遵守 BOSS 直聘平台的使用条款，合理控制投递频率。
4. **AI 内容责任**：AI 生成内容不代表开发者立场，使用者需自行甄别。
5. **开源协议**：本项目基于 AGPL-3.0 协议开源，衍生项目必须同样开源。

---

> **不是帮你投简历，是帮你省出时间准备面试。**  
> **让机械操作归脚本，让面试准备归你。**

<p align="center">
  <a href="https://github.com/h1077/BossJob-Helper">
    <img src="https://img.shields.io/badge/GitHub-View%20on%20GitHub-blue?logo=github" alt="GitHub">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-AGPL--3.0-orange" alt="License">
  </a>
</p>
