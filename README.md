# Boss Helper

BOSS 直聘 AI 海投助手 — Chrome 扩展（前端投递引擎）+ 桌面应用（后端数据中心），双端配合实现智能求职闭环。

[![License](https://img.shields.io/badge/License-AGPL--3.0-orange)](./LICENSE)
[![Manifest](https://img.shields.io/badge/Manifest-V3-blue)](./extension/manifest.json)
[![Python](https://img.shields.io/badge/Python-≥3.10-3776AB?logo=python)](https://python.org)

---

## 目录

- [快速开始](#快速开始)
- [extension — Chrome 扩展](#extension--chrome-扩展)
- [desktop-app — 桌面应用](#desktop-app--桌面应用)
- [双端协作](#双端协作)
- [AI 接口配置](#ai-接口配置)
- [项目结构](#项目结构)
- [常见问题](#常见问题)
- [免责声明](#免责声明)

---

## 快速开始

| 组件           | 用途        | 一句话说明                                                   |
| -------------- | ----------- | ------------------------------------------------------------ |
| `extension/`   | Chrome 扩展 | BOSS 直聘侧边栏控制器，自动搜索、AI 筛选、审核确认、跨页面投递 |
| `desktop-app/` | 桌面应用    | 本地仪表盘 + AI 安全代理 + 数据持久化 + Agent API            |

**推荐同时使用两者**：扩展负责页面操作，桌面应用负责 AI 代理和数据管理。

### 安装扩展

1. 打开 `chrome://extensions`，`edge://extensions/`  右上角开启**开发者模式**
2. 点「加载已解压缩的扩展程序」→ 选择 `extension/` 文件夹
3. 点工具栏 🧩 → 固定 `Boss海投助手` 图标
<img width="1200" height="550" alt="01" src="https://github.com/user-attachments/assets/0b7d537c-b8ca-4872-8ec9-427821d0a017"  />



### 启动桌面应用



双击Boss_helper.exe运行，浏览器自动打开 `http://localhost:5001` 仪表盘。

<img width="935" height="550" alt="02" src="https://github.com/user-attachments/assets/51482c1a-641c-480e-a617-f7e5c3ecf4bc"  />


### 三步跑通

1. 点扩展图标 → 侧边栏填写：岗位关键词 + 城市 + AI API Key
2. 点「开始收集 + 投递」→ 自动搜索 → AI 筛选 → 审核勾选 → 自动投递
3. 桌面端仪表盘实时查看投递统计、导出数据

<img width="300" height="500" alt="03" src="https://github.com/user-attachments/assets/f5141f10-5fc7-4bf4-b0e4-e84046312962"  />


---

## extension — Chrome 扩展

Chrome Manifest V3 扩展，Service Worker 编排跨页面投递流程。**2028 行 JS，零框架零依赖。**

### 功能详解

#### 1. 多维度搜索

| 筛选项      | 说明                     | 示例                   |
| ----------- | ------------------------ | ---------------------- |
| 岗位关键词  | 空格/逗号分隔，OR 匹配   | `售前顾问 Python开发`  |
| 城市        | 多城市空格分隔，逐一搜索 | `深圳 北京 杭州`       |
| 薪资范围    | 点选 BOSS 薪资区间       | 10-20K / 20-50K        |
| 福利筛选    | 逗号分隔，AND 匹配       | `双休,五险一金,不加班` |
| HR 活跃状态 | 多选：在线/今日/3日/本周 | `在线, 刚刚活跃`       |
| 排除猎头    | 开关控制                 | ✅ 开启后自动跳过       |
| 公司黑名单  | 一行一个公司名           | 模糊匹配跳过           |

> **🖼️ [图 4]** 搜索配置面板

#### 2. AI 智能筛选 + 审核确认

```
收集岗位 → AI 简历匹配评分 → 排除不匹配 → 审核列表 → 你勾选 → 投递选中
```

- **简历匹配度预筛**：提取简历关键词，对每个岗位打分（标题 2 分 / 描述 1 分），低于阈值自动跳过
- **公司背景评估**：AI 分析 JD 靠谱度（1-10 分），低分自动拒绝
- **HR 职级排序**：同一公司多 HR 按职级评分（经理 100 > HRBP 90 > 专员 30），优先发给职级最高的
- **法人/老板识别**：自动标记 HR 就是老板的「直招」岗位，显示 👔 标签
- **审核确认机制**：筛选后列出所有匹配岗位（附匹配分+公司+薪资+HR），你勾选确认后才开始投递

<img width="300" height="650" alt="04" src="https://github.com/user-attachments/assets/328603d6-7ec3-4aaf-b8e4-2451efeabfad"  />


#### 3. 千岗千面 AI 招呼语

每个岗位单独调用 AI，交叉引用简历 + 简历分析 + JD + 自定义提示词生成个性化招呼语。

| 特性     | 说明                                                       |
| -------- | ---------------------------------------------------------- |
| 交叉引用 | 同时读取简历文字、简历 6 维分析、岗位 JD、用户自定义提示词 |
| 格式规范 | 「您好，熟悉XXX、XXX，做过XXX…」80-120 字                  |
| 策略注入 | 激进/均衡/保守三种对话策略影响语气                         |
| 24h 缓存 | 同一岗位不重复消耗 Token                                   |
| 降级链   | AI 失败 → 招呼语模板 → 硬编码默认语                        |

<img width="265" height="500" alt="05" src="https://github.com/user-attachments/assets/2affd914-2805-4147-8419-f71f86abe8de"  />


#### 4. JD 深度分析

审核列表中每个岗位旁有 [📊 分析] 按钮，点击后 AI 输出 8 字段结构化报告：

- 匹配评分（0-100）+ 投递建议（投递/谨慎/跳过）
- 关键技能列表 + 技能缺口
- 投递建议 + 匹配理由 + 风险提示
- 建议追问的问题列表

<img width="275" height="200" alt="06" src="https://github.com/user-attachments/assets/395a281a-9082-4532-81f0-25ef7ba3d08e"  />


#### 5. 智能调度 + 安全风控

| 机制         | 说明                                                   |
| ------------ | ------------------------------------------------------ |
| 工作日投递   | 周末自动暂停，周一恢复                                 |
| 午休避让     | 12:00-14:00 自动暂停                                   |
| 自适应间隔   | 每 3 个岗位自动休息 30 秒                              |
| 智能延迟     | 正常 3-5 秒随机，失败后指数退避（6s→12s→24s→48s→120s） |
| 风控检测     | 检测验证码/限频/封禁关键词，命中立即跳大延迟           |
| 连续异常保护 | 连续 6 次失败自动暂停，防止封号                        |
| 每日上限     | 可配置，达上限自动停止                                 |

#### 6. 自动发简历 + AI 回复

- 自动发送附件简历和图片简历（多张，按岗位关键词匹配）
- 聊天页 `MutationObserver` 实时监听 HR 新消息，AI 自动生成回复
- 自动交换联系方式（微信/电话）

<img width="265" height="450" alt="07" src="https://github.com/user-attachments/assets/23534340-1e9a-4fa6-8ce7-3580f53c4b42"  />


#### 7. 求职仪表盘 + 周报

| 组件        | 说明                                                  |
| ----------- | ----------------------------------------------------- |
| 统计卡片    | 总岗位 / 高匹配(≥7分) / 已投递 / 面试中 / 已拒绝      |
| 投递漏斗    | 今日投递 → HR 回复 → 面试邀约，三色进度条 + 转化率    |
| 面试追踪    | 手动添加面试（公司/岗位/时间），列表管理              |
| 周报        | 一键生成：本周投递数、回复率、面试邀约率、转化率      |
| JD 需求分析 | AI 从已收集岗位中提取高频技能 + 最值钱方向 + 补充建议 |

> **🖼️ [图 9]** 仪表盘 + 漏斗

#### 8. 多份简历 + 6 维评分

| 功能       | 说明                                                         |
| ---------- | ------------------------------------------------------------ |
| 多简历管理 | 上传文件时命名（如"Python开发""售前顾问"），下拉切换         |
| 6 维评分   | 桌面端 AI 分析：学历(15)+技能(25)+经验(30)+成长(15)+软技能(10)+质量(5) |
| 分析注入   | 评分结果自动注入招呼语生成和 JD 分析中                       |

> **🖼️ [图 10]** 简历管理 + 6 维评分

#### 9. 桌面桥接

扩展通过 `localhost:5001` 与桌面应用通信：

| 桥接功能       | 说明                                               |
| -------------- | -------------------------------------------------- |
| AI 安全代理    | API Key 只在桌面端，扩展不暴露密钥                 |
| 岗位同步       | 投递成功自动同步到桌面 SQLite 数据库               |
| 报表导出       | 一键导出 CSV / Excel                               |
| Agent 远程控制 | 每 10 秒轮询命令队列，支持 Claude/GPT 远程启停投递 |
| 启动同步       | 扩展启动时拉回桌面端已存岗位和简历                 |

---

## desktop-app — 桌面应用

本地 Flask 服务器（`127.0.0.1:5001`），提供仪表盘、数据持久化、AI 安全代理和 Agent API。

### 启动方式

**方式一：源码运行**

```bash
cd desktop-app
pip install -r requirements.txt
python app.py
```

**方式二：点击 .exe文件启动**
使用 点击.exe 后缀文件双击运行，自动打开浏览器。

### 功能详解

#### 1. 仪表盘与统计

实时展示：今日投递数 / 回复率 / 面试邀约 / 14 天趋势柱状图 / Pipeline 分布。

<img width="950" height="475" alt="08" src="https://github.com/user-attachments/assets/cff0a561-3f9b-48c3-a6ec-d7f9da04c092"  />


#### 2. 岗位追踪 & 导出

| 功能     | 说明                                       |
| -------- | ------------------------------------------ |
| 岗位列表 | 分页表格，支持按公司/岗位/状态搜索筛选     |
| 状态管理 | 已投递 / 面试中 / 感兴趣 / 已拒绝          |
| 数据导出 | CSV / Excel (XLSX) / JSON 三种格式         |
| 自动同步 | 扩展投递后自动 POST 到 `/api/jobs/collect` |

#### 3. AI 安全代理

| 特性       | 说明                                                      |
| ---------- | --------------------------------------------------------- |
| 多供应商   | DeepSeek / OpenAI / 硅基流动 / 火山引擎 / 自定义          |
| 密钥加密   | API Key 使用 Fernet 加密存储于本地 SQLite（机器指纹绑定） |
| Token 代理 | 扩展 AI 请求通过 `/api/ai/proxy` 转发，Key 不暴露到浏览器 |
| 速率限制   | 端点级 IP 滑动窗口限流                                    |

#### 4. JD 深度分析

端点 `POST /api/ai/analyze-jd`，结合简历和 JD 输出 8 字段结构化报告（匹配评分、关键技能、技能缺口、建议追问等），24h 缓存。

#### 5. AI 模拟面试

- **6 阶段面试流程**：开场破冰 → 技术深挖 → 项目经验 → 综合素质 → 反问阶段 → 结束报告
- **简历感知**：AI 扮演目标公司 HR，根据你的简历和岗位 JD 提问
- **逐题评分**：4 维度打分（技术准确度/完整度/实践经验/清晰度）
- **评估报告**：总分 + 优势 + 弱项 + 改进建议
- **会话历史**：支持回看过往面试记录

<img width="950" height="400" alt="09" src="https://github.com/user-attachments/assets/4c8d9f68-d735-4bfe-a68d-3700ac2c2cc4"  />


#### 6. Agent API

7 个 REST 端点，供 AI Agent（Claude / GPT / Cursor）直接调用：

```
GET  /api/agent/status        # 当前状态
GET  /api/agent/stats         # 投递漏斗
GET  /api/agent/jobs          # 岗位列表
POST /api/agent/command       # 发送指令（start_apply / stop_apply）
GET  /api/agent/command       # 扩展轮询指令
POST /api/agent/command/ack   # 确认指令完成
POST /api/agent/analyze       # AI 岗位分析
```

所有响应统一 JSON 信封：`{"ok": true/false, "data": {...}, "error": null}`

#### 7. 简历 6 维评分

端点 `POST /api/ai/analyze`，AI 分析简历输出：学历背景(15) / 技术技能(25) / 工作经验(30) / 职业成长(15) / 软技能(10) / 简历质量(5)，总分 100。

#### 8. 数据安全

| 措施      | 说明                                                     |
| --------- | -------------------------------------------------------- |
| 本地运行  | 127.0.0.1 监听，不暴露到公网                             |
| 密钥加密  | Fernet + 机器指纹（COMPUTERNAME+USERNAME），换机不可解密 |
| 速率限制  | 防止本地恶意调用                                         |
| CORS 限制 | 仅允许 localhost 和 zhipin.com 来源                      |

---

## 双端协作

```
┌─────────────────────────┐     HTTP      ┌──────────────────────────┐
│   extension              │ ←──────────→ │   desktop-app             │
│   (Chrome 扩展, 前端)     │  localhost    │   (Flask, 后端)           │
│                          │     :5001     │                          │
│ ① 投递引擎               │ ──collect──→ │ ② 岗位数据库 (SQLite)     │
│ ③ 简历分析 →             │ ──analyze──→ │   6维评分 (学历/技能/...)  │
│ ④ 招呼语生成 →           │ ──proxy────→ │   AI代理 (密钥安全)        │
│ ⑤ JD分析 →               │ ──analyze-jd→│   8字段结构化报告           │
│ ⑥ 数据导出 ←             │ ←──export─── │   CSV / Excel / JSON      │
│ ⑦ 面试模拟 ←             │ ←──open───── │   6阶段AI面试              │
│ ⑧ Agent命令 ←            │ ←──command── │   远程控制 (启/停投递)     │
└─────────────────────────┘              └──────────────────────────┘
```

| 职责                   |   扩展   |  桌面应用  |
| ---------------------- | :------: | :--------: |
| DOM 操作 / 点击 / 发送 |    ✅     |     —      |
| 页面抓取 / 翻页        |    ✅     |     —      |
| AI 调用（密钥安全）    |    —     |     ✅      |
| 数据持久化（SQLite）   |    —     |     ✅      |
| 数据分析 / 聚合        |    —     |     ✅      |
| 数据导出（CSV/Excel）  |    —     |     ✅      |
| 仪表盘 UI              |  侧边栏  | 网页仪表盘 |
| 接受 AI Agent 控制     | 轮询执行 | ✅ 命令队列 |

---

## AI 接口配置

### 推荐供应商

| 供应商                 |  新用户额度   | 获取地址                                                 |
| ---------------------- | :-----------: | -------------------------------------------------------- |
| 硅基流动 (SiliconFlow) | 2000 万 Token | [siliconflow.cn](https://siliconflow.cn)                 |
| DeepSeek 官方          | 1000 万 Token | [platform.deepseek.com](https://platform.deepseek.com)   |
| 火山引擎 (豆包)        |  50 万 Token  | [console.volcengine.com](https://console.volcengine.com) |
| OpenAI 官方            |     付费      | [platform.openai.com](https://platform.openai.com)       |

### 配置方式

**扩展侧边栏**：② AI 配置区填写 API Key / URL / Model，支持预设按钮一键填充。

**桌面端**：仪表盘 → AI 设置页，密钥加密存储。

**桌面桥接开启后**：扩展通过桌面端代理调用 AI，不需要在扩展中配置 Key。

---

## 项目结构

```
boss-helper/
│
├── extension/                     # Chrome 扩展（前端投递引擎）
│   ├── manifest.json              #   Manifest V3
│   ├── icons/                     #   扩展图标
│   └── src/
│       ├── background.js          #   Service Worker 编排引擎 (697行)
│       ├── content-search.js      #   搜索页注入 (153行)
│       ├── content-chat.js        #   聊天页注入 (220行)
│       ├── selectors.js           #   共享选择器+城市编码+配置 (56行)
│       ├── sidepanel.html         #   侧边栏 UI 布局
│       ├── sidepanel.js           #   侧边栏交互逻辑 (902行)
│       └── sidepanel.css          #   侧边栏样式
│
├── desktop-app/                   # 桌面应用（后端数据中心）
│   ├── app.py                     #   Flask 入口
│   ├── config.py                  #   配置
│   ├── models.py                  #   SQLAlchemy 模型
│   ├── requirements.txt           #   Python 依赖
│   ├── routes/
│   │   ├── ai.py                  #   AI 代理 / JD分析 / 面试 / 简历评分
│   │   ├── agent.py               #   Agent API (7端点)
│   │   ├── jobs.py                #   岗位追踪 & 导出
│   │   ├── resumes.py             #   简历管理
│   │   └── analytics.py           #   统计
│   ├── utils/
│   │   ├── auth.py                #   认证
│   │   ├── crypto.py              #   加密 (Fernet)
│   │   └── rate_limit.py          #   速率限制
│   ├── static/                    #   仪表盘前端
│   │   ├── index.html
│   │   ├── css/
│   │   └── js/
│   ├── data/                      #   运行时数据 (自动创建)
│   └── build/                     #   PyInstaller 构建
│
├── README.md                      # 本文件
└── LICENSE                        # AGPL-3.0
```

---

## 常见问题

### Q: 扩展安装后不显示侧边栏？

1. 点工具栏 🧩 图标 → 找到「Boss海投助手」→ 点击即可打开侧边栏
2. 确保已打开 `zhipin.com` 页面

### Q: 点击「开始收集」没有反应？

检查侧边栏 ↓

1. 岗位关键词是否已填写
2. AI API Key 是否已配置（或在扩展中配置，或启动桌面端开启桥接）
3. 查看日志区的提示

### Q: 投递越来越慢甚至停了？

这是**智能风控**在工作：连续失败后自动指数退避，成功后逐渐恢复。如果连续 6 次失败会暂停，需手动恢复。关闭「智能调度」开关可停用。

### Q: 桌面端连接不上？

1. 确认 `python app.py` 已启动，日志显示 `Running on http://127.0.0.1:5001`
2. 扩展侧边栏 AI 配置区查看「桌面桥接」状态
3. 检查 5001 端口是否被占用

### Q: 为什么有些岗位被跳过了？

日志会明确标注跳过原因：

1. HR 超过 14 天未活跃
2. 已投递过该公司（模糊去重）
3. 公司黑名单命中
4. 简历匹配分低于阈值（默认 3 分）
5. 公司评估分 ≤ 6 分自动拒绝
6. 福利不匹配
7. 猎头岗位（开启排除后）

### Q: 数据存储在哪？

- 扩展：Chrome `chrome.storage.local`（浏览器级）
- 桌面端：`desktop-app/data/boss_desktop.db`（SQLite，跨会话持久）

### Q: 如何卸载？

`chrome://extensions` → 移除「Boss海投助手」。删除 `boss-helper/` 文件夹。

---

## 免责声明

1. **仅供学习交流**：本项目仅用于学习和研究自动化技术。
2. **使用风险自负**：使用后果（包括账号限制、封禁）由使用者自行承担。
3. **遵守平台规则**：请遵守 BOSS 直聘使用条款，合理控制投递频率。
4. **AI 内容责任**：AI 生成内容不代表开发者立场。
5. **开源协议**：AGPL-3.0，衍生项目必须同样开源。

---

> **让重复的操作交给插件，让你专心准备面试。**

<p align="center">
  <img src="https://img.shields.io/badge/License-AGPL--3.0-orange" alt="License">
  <img src="https://img.shields.io/badge/Manifest-V3-blue" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Python-≥3.10-3776AB?logo=python" alt="Python">
</p>



  ## 技术栈 & 致谢

  | 项目 
  |------|
  | [JobCopilot](https://github.com/huluobo2237-pixel/JobCopilot)) 

  在此之上构建了 BossJob-Helper 的双端架构。
