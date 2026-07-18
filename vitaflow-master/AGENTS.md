# AGENTS.md

本文件约束在 VitaFlow 仓库中工作的代码代理。除非用户明确说明，以下规则适用于整个仓库。

## 项目认知

- VitaFlow 是前后端分离的智能简历平台。
- 后端位于 `backend/`，使用 FastAPI、SQLAlchemy、Alembic、MySQL、Redis、LangChain/LangGraph、Jinja2、Playwright/WeasyPrint、python-docx。
- 前端位于 `frontend/`，使用 Vue 3、TypeScript、Vite、Vue Router、Pinia、Tailwind CSS。
- 后端接口统一挂载在 `/api` 下，响应结构应保持 `{ code, message, data }`。
- 简历预览和 PDF 导出共用后端 HTML 渲染服务，改模板、样式、预览或导出逻辑时要同时考虑浏览器预览、PDF、Word 的一致性。

## 协作原则

- 修改前先阅读相关代码和 README，不凭印象改动。
- 保持改动范围小而准确，不做与任务无关的重构、格式化或依赖升级。
- 工作区可能已有用户改动。不要回滚、覆盖或清理未由自己产生的变更。
- 不提交 `.env`、密钥、用户简历、上传文件、导出文件、日志或本地缓存。
- 新增配置必须同步更新对应的 `.env.example` 和文档说明。
- 新增或修改接口时，前后端 API 类型、调用路径、错误提示和鉴权逻辑要同步。

## 后端约束

- API 路由放在 `backend/app/api/`，业务逻辑优先放在 `backend/app/services/`，不要把复杂业务堆在路由函数里。
- 数据模型放在 `backend/app/models/`，请求/响应结构放在 `backend/app/schemas/`。
- 需要变更数据库结构时，必须新增 Alembic migration，放在 `backend/alembic/versions/`；不要直接改旧 migration。
- 项目约定 MySQL 表不使用物理外键，关联关系通过业务字段维护。
- Redis 用于验证码、限频、缓存或锁时，key 必须有清晰前缀和合理 TTL。
- Markdown、富文本、AI 输出或用户输入进入 HTML 前必须经过既有清理链路，避免 XSS。
- AI 能力应通过现有 `services/ai/` 封装接入；不要在路由或前端硬编码模型调用细节。
- 文件上传、头像、公告图片和 AI 对话图片必须走统一存储服务，不要散落本地文件访问逻辑。
- PDF 渲染涉及 Chromium、WeasyPrint、字体、资源 URL 和分页时，要优先复用现有 `preview_service` / 导出服务。
- 后端启动、配置和日志行为应与 `backend/README.md` 保持一致。

## 前端约束

- 页面放在 `frontend/src/views/`，路由放在 `frontend/src/router/`，接口封装放在 `frontend/src/api/`，共享状态放在 `frontend/src/stores/`。
- 编辑器相关组件放在 `frontend/src/components/editor/`，预览相关组件放在 `frontend/src/components/preview/`，AI 相关组件放在 `frontend/src/components/ai/`。
- 使用现有 Vue 3 Composition API、TypeScript、Pinia 和 Tailwind 风格，不引入新的 UI 框架。
- API 调用应通过现有 Axios/request 封装，保持 token、错误处理和统一响应处理一致。
- 用户可见文本应保持中文语境自然、简洁；错误提示要能指导用户下一步操作。
- 编辑器、预览、模板库和管理后台要兼顾移动端与桌面端，避免固定宽度导致溢出。
- 修改简历数据结构时，同步检查类型定义、默认数据、表单组件、预览模板、导出服务和 AI diff/apply 逻辑。
- 修改路由鉴权或管理员页面时，同步检查前端守卫和后端权限校验。

## 组件封装与拆分

- `views/` 中的页面组件负责路由参数、页面级数据获取、权限判断和业务流程编排，不应长期堆积大段可独立维护的表单、列表、弹窗或展示区域。
- 组件应围绕单一、清晰的业务职责拆分。一个区域具有独立状态、重复出现、包含复杂交互，或能够被单独命名和测试时，应优先提取为组件；不要只按代码行数机械拆分。
- 仅在当前页面使用的组件可放在对应业务目录附近；跨页面复用或属于稳定业务能力的组件再提升到 `frontend/src/components/` 下的对应领域目录，避免过早创建“万能组件”。
- 基础展示组件保持轻量，通过明确的 `props` 接收数据，通过 `emits` 反馈用户操作。子组件不得直接修改父组件传入的对象或数组，复杂编辑使用本地副本或显式更新事件。
- `props`、`emits`、插槽参数和模板引用必须提供清晰的 TypeScript 类型。避免使用无语义的 `data`、`item`、`value` 作为复杂业务对象接口，也不要用 `any` 绕过组件边界。
- 页面级或跨组件共享状态放在 Pinia；仅被单个组件树使用的临时交互状态保留在最近的共同父组件中，不要把所有状态都提升为全局状态。
- 可复用的有状态逻辑、监听组合、异步流程和浏览器能力封装到 `frontend/src/composables/`。composable 应以 `useXxx` 命名，并保持输入、返回值和副作用清晰。
- API 请求优先由页面、store 或业务 composable 发起。纯展示组件和通用表单控件不直接依赖具体 API，避免视图渲染与后端调用紧耦合。
- 重复模板只有在结构、行为和变化方向一致时才抽象；仅视觉相似但业务语义不同的区域可以保持独立，避免通过大量布尔 `props` 制造难以维护的分支组件。
- 拆分组件时保持单向数据流，并同步迁移相关类型、样式、测试和事件处理。不要留下重复实现、失效样式或父子组件同时维护同一份状态。
- 弹窗、抽屉、表格、分页、上传和富文本等复杂交互应优先复用仓库现有组件与模式；新增公共组件前先搜索是否已有相同能力。
- 修改组件边界后，至少验证加载中、空数据、接口失败、禁用状态和移动端布局，确认拆分没有改变原有交互和权限行为。

## 数据与安全

- 不要在代码中硬编码真实 API Key、SMTP 密码、数据库密码、OSS/MinIO 密钥或 JWT 密钥。
- 生产环境相关说明应提醒关闭 `APP_DEBUG`，并使用强随机 `JWT_SECRET_KEY`。
- 管理员能力必须依赖后端权限校验；前端隐藏入口不能作为安全边界。
- 用户上传文件、公开分享、导出文件下载和文件代理接口都要考虑鉴权、路径穿越和对象名校验。
- AI 生成内容可能不可信，进入富文本、HTML 预览或导出前必须复用清理和转义机制。

## 常用命令

后端：

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
uvicorn app.main:app --reload
```

前端：

```bash
cd frontend
npm run dev
npm run build
npm run preview
```

依赖安装：

```bash
cd backend
pip install -r requirements.txt
python -m playwright install chromium
```

```bash
cd frontend
npm install
```

## 验证要求

- 前端改动至少运行 `npm run build`，除非环境缺依赖或用户明确要求跳过。
- 后端改动至少做一次导入级或启动级检查；涉及数据库时运行 migration 检查。
- 涉及预览、模板、PDF 或 Word 导出时，除了构建检查，还要人工或脚本验证预览/导出结果没有空白、分页错位或资源缺失。
- 涉及认证、权限、管理员后台、分享链接或文件访问时，必须检查未登录、普通用户、管理员三个路径的行为。
- 若验证无法执行，要在最终回复中说明原因和未覆盖的风险。

## 文档维护

- 根目录 `README.md` 是项目总入口；后端细节写入 `backend/README.md`，前端细节写入 `frontend/README.md`。
- 新增环境变量、启动步骤、外部服务、定时任务、导出依赖或管理后台能力时，需要同步文档。
- 文档示例使用占位值，不写真实凭据。

## Git 与产物

- 不要自动提交、推送或创建分支，除非用户明确要求。
- 不要删除用户未要求删除的文件。
- 不要提交 `frontend/dist/`、`backend/storage/`、上传文件、导出文件、日志、虚拟环境、`node_modules/` 或本地浏览器缓存。
- 如果需要清理生成物，先确认这些文件确实由本次任务生成。

## 代码风格

- Python 代码保持类型清晰、函数职责单一，复杂流程放到 service 层。
- TypeScript 代码避免 `any` 扩散；确需使用时，限制在接口边界或兼容旧数据的位置。
- 注释只解释不明显的业务规则、迁移原因或安全边界，不写重复代码含义的注释。
- 优先复用现有工具函数、类型、组件和服务，不新增平行实现。
