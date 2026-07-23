# BossJob-Helper V1.1.6 更新日志

**日期**: 2026-07-23 | **基于**: V1.1.5

---

## 🔐 桌面桥接安全加固（desktop-bridge.js + manifest.json）

### 问题
V1.1.5 中桌面桥接存在多项安全隐患：manifest 缺少 `localhost` 权限导致桥接全线断裂、API 请求无认证机制、凭证明文暴露在浏览器端。

### 修复

**新增 `desktop-bridge.js` 认证传输层**：
- `/api/local-token` 获取本地令牌，所有请求统一携带 `Authorization: Bearer <token>` 头
- 统一 JSON 信封解析 `{success, data, error}`，`assertApiSuccess()` 自动校验
- `DesktopBridge.proxy()` 安全转发 AI 请求到桌面端，Key 不暴露在浏览器端
- 请求超时控制：认证 2s、普通请求 15s

**Manifest 权限修复**：
- 补充 `"host_permissions": ["http://localhost:5001/*"]`（此前缺失导致跨域请求被 Chrome 拦截）
- `content-chat.js` 注入链加入 `feedback-events.js`
- 版本号升至 `1.1.5`

**Agent API 认证**：
- 所有 7 个 `/api/agent/*` 端点加装 `@login_required` 装饰器
- 命令队列按 `user_id` 隔离，防止多用户场景下的指令串扰

---

## 📬 反馈事件中心（feedback-events.js + routes/feedback.py）

### 背景
投递后用户需要手动去 BOSS 聊天页逐个检查 HR 是否回复、是面试邀请还是拒绝。缺少结构化的"投递 → 反馈 → 状态变更"闭环。

### 实现

**浏览器端自动检测（feedback-events.js）**：
- `classify()` — 智能分类 HR 消息为 6 种类型：

| 类型 | 触发特征 |
|------|---------|
| `interview_invite` | "邀请面试"、"约个时间沟通" |
| `rejection` | "不合适"、"很遗憾"、"暂不考虑" |
| `written_test` | "笔试"、"测评"、"在线考试" |
| `offer` | "录用通知"、"正式聘用" |
| `hr_reply` | 普通 HR 回复 |
| `unknown` | 无法分类或空消息 |

- `isFeedbackCandidate()` — 过滤 BOSS 系统卡片（"竞争者 PK"等非人工消息）
- `eventKey()` — FNV-1a 哈希生成唯一去重键，同一条消息不会重复入库

**聊天页 MutationObserver（content-chat.js）**：
- `setupFeedbackObserver()` — 监听 `.item-friend` 新增节点，实时触发反馈检测
- `feedbackContext()` — 从 DOM 提取来源岗位、公司名、HR 名等上下文
- `SCAN_VISIBLE_FEEDBACK` — 手动刷新时全量扫描当前页可见消息

**桌面端 REST API（routes/feedback.py，183 行新文件）**：
- `POST /api/feedback-events` — 创建反馈事件，自动去重
- `GET /api/feedback-events?review_status=pending_review` — 按审核状态列出待处理事件
- `GET /api/feedback-events/<id>/candidates` — 智能匹配候选岗位（公司名/岗位名/HR名加权评分排序，Top 5）
- `POST /api/feedback-events/<id>/associate` — 手动关联到已有岗位
- `POST /api/feedback-events/<id>/review` — 确认/忽略，确认时自动更新岗位 Pipeline 状态

**状态映射表**：
| 反馈类型 | → 自动设置岗位状态 |
|---------|------------------|
| `interview_invite` | `pending_interview` |
| `written_test` | `pending_exam` |
| `rejection` | `rejected` |
| `offer` | 需用户手动选择 `offer_accepted` / `offer_rejected` |

**数据库（models.py）**：
- 新增 `JobFeedbackEvent` 表：`event_key`（去重）、`event_type`（分类）、`summary`、`company_name`、`job_name`、`hr_name`、`review_status`、`reviewed_at`、`review_note`
- 唯一约束 `(user_id, event_key)` 防止重复入库

---

## 🔄 离线队列与自动同步（background.js）

### 问题
桌面端未运行时，浏览器端检测到的反馈事件会丢失。

### 修复
- `saveFeedbackEvent()` — 优先实时 POST 桌面端；失败则入队 `chrome.storage.local` 的 `pendingFeedbackEvents` 队列（上限 100 条）
- `syncPendingFeedbackEvents()` — 桌面端重连时自动批量同步，逐条重试，失败保留在队列
- `chrome.runtime.onStartup` — 启动时自动触发同步
- 侧边栏「刷新反馈」按钮 — 手动触发扫描 + 同步

---

## 🖥️ 侧边栏增强（sidepanel.js + sidepanel.html）

- **桌面桥接连接检测** — 每次打开侧边栏自动检测 `localhost:5001` 是否可达，获取 token
- **反馈刷新按钮** — 一键扫描当前聊天页所有可见 HR 消息，批量提取反馈事件
- **同步状态显示** — 实时显示待同步反馈数量
- **启动时同步** — 侧边栏加载时从桌面端拉取岗位追踪数据

---

## 🧪 测试覆盖（tests/）

| 文件 | 覆盖 |
|------|------|
| `desktop-bridge.test.js` | `extractProxyText()`、`assertApiSuccess()`、`escapeHtml()` |
| `feedback-events.test.js` | `normalizeSummary()`、`classify()`（6 种类型）、`isFeedbackCandidate()`、`eventKey()` 去重 |

---

## 📋 修改文件清单

| 文件 | 改动 |
|------|------|
| `origin-verson/boss-extension/manifest.json` | 版本号 1.1.6；新增 `http://localhost:5001/*` host_permission；content-chat 注入链加 feedback-events.js |
| `origin-verson/boss-extension/src/desktop-bridge.js` | **新增** — 认证传输层（getToken / request / proxy） |
| `origin-verson/boss-extension/src/feedback-events.js` | **新增** — 反馈检测、分类、去重、可见消息扫描 |
| `origin-verson/boss-extension/src/content-chat.js` | 新增 `setupFeedbackObserver()`、`feedbackContext()`、`createFeedbackEvent()`、`reportFeedback()`；`SCAN_VISIBLE_FEEDBACK` 消息响应 |
| `origin-verson/boss-extension/src/background.js` | 引入 desktop-bridge / feedback-events；新增 `saveFeedbackEvent()`、`syncPendingFeedbackEvents()`；消息入口新增 CHAT_FEEDBACK_EVENT / SYNC_PENDING_FEEDBACK / GET_PENDING_FEEDBACK_COUNT |
| `origin-verson/boss-extension/src/sidepanel.html` | 新增反馈刷新按钮 |
| `origin-verson/boss-extension/src/sidepanel.js` | 新增 `checkDesktopBridge()`、`refreshFeedbackSyncStatus()`、`startAgentPolling()`、反馈刷新按钮逻辑 |
| `origin-verson/boss-desktop-app/routes/feedback.py` | **新增** — 反馈事件 CRUD + 候选匹配 + 审核确认 |
| `origin-verson/boss-desktop-app/routes/agent.py` | 所有端点为 `request.current_user` 加装 `@login_required` |
| `origin-verson/boss-desktop-app/models.py` | 新增 `JobFeedbackEvent` 表 |
| `origin-verson/boss-extension/tests/desktop-bridge.test.js` | **新增** — 桥接层单元测试 |
| `origin-verson/boss-extension/tests/feedback-events.test.js` | **新增** — 反馈事件单元测试 |
