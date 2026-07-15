# BossJob-Helper V1.1.5 更新日志

**日期**: 2026-07-15 | **基于**: V1.1.4

---

## 🚀 预生成招呼语增强（background.js）

### 问题
V1.1.4 引入的批量预生成在 JD 为空时将 `jobLabels`（通常只有"3-5年、本科"两个值）当作岗位描述传给 AI，信息量严重不足，招呼语质量下降。

### 修复
- **`_buildJobDescFromFields()`** — 新增辅助函数，用岗位的 7 个字段拼接结构化描述：岗位名称、公司、公司行业、薪资范围、工作地点、经验要求、学历要求、岗位要求技能
- **`skills` 优先** — 预生成时优先使用 BOSS API 返回的 `skills` 字段（如"售前技术支持经验、系统集成、智慧城市信息化项目、招投标经验"），比 `jobLabels` 精准一个数量级
- **降级招呼语同步** — `buildFallbackGreeting()` 同样用 `skills` 优先提取关键词

### 效果
预生成招呼语从"仅知岗位名和2个标签"变成"知道公司干什么的、要求什么技能、几年经验"，AI 能写出针对性内容。

---

## 🧠 关键词提取 JSON 感知（background.js）

### 问题
`extractKeywords()` 只做纯文本切词（按行→按逗号/空格→取2-15字token），对桌面端 `/api/ai/analyze` 返回的六维度 JSON 格式完全无效，得到 `{`、`"strengths"` 等垃圾 token。

### 修复
- **JSON 解析优先** — `extractKeywords()` 先尝试 `JSON.parse`，成功则从 `strengths` 数组、`pre_match_analysis`、`icebreaker_suggestion`、各维度 `analysis` 字段中提取关键词
- **降级兼容** — 非 JSON 文本回退到原有切词逻辑（提取为 `extractTokensFromText()`）
- **醒目提示** — `useResumeMatch=false` 时新增黄色 warn："简历匹配已关闭（useResumeMatch=false），关键词提取已跳过。开启后可提高投递精准度"

### 效果
开启 `useResumeMatch` + 有 AI 分析结果时，能正确提取出 `Python`、`Flask`、`AWS`、`Claude` 等技能关键词用于岗位匹配评分。

---

## 💰 薪资范围过滤（background.js + content-search.js）

### 问题
用户设置薪资范围 10-20K，但系统仍然投递 25-50K 的岗位。原因是两层漏洞：
1. `scrapeViaApi()` 调用 BOSS API 时没有传递 `salary` 参数（搜索页 URL 有但 API 调用没有）
2. JS 端筛选循环完全没有任何薪资过滤逻辑

### 修复

**API 层**（content-search.js）：
- `scrapeViaApi()` 从页面 URL 读取 `salary` 参数透传给 BOSS API

**JS 筛选层**（background.js）：
- 新增 `SALARY_RANGE_MAP`：BOSS 编码 402-407 → `{min, max}` 对照表
- 新增 `parseSalaryRange(str)`：解析 BOSS 薪资字符串（支持 10-20K / 25K·14薪 / 200-400元/天 / 3K以下 / 50K以上）
- 新增 `isSalaryInRange(jobSalary, userCode)`：交集判断，岗位薪资范围与用户设定有重叠即通过
- 筛选循环插入薪资过滤（福利之后、HR不活跃之前）
- 筛选统计新增 `❌薪资: N`

### 效果
双重保障：BOSS API 尽量在源头过滤 + JS 端兜底确保不入库。

---

## 📡 BOSS API 字段补全（content-search.js）

### 背景
通过 Chrome DevTools Protocol (CDP) 抓包分析 BOSS `/wapi/zpgeek/search/joblist.json` 返回结构，发现之前遗漏了多个重要字段。

### 新增字段

| 新增字段 | API 字段 | 示例值 | 用途 |
|---------|---------|--------|------|
| `skills` | `item.skills` | `["售前技术支持经验", "系统集成", ...]` | 预生成招呼语、简历匹配 |
| `experience` | `item.jobExperience` | `"3-5年"` | 预生成上下文、筛选 |
| `education` | `item.jobDegree` | `"本科"` | 预生成上下文、筛选 |
| `companyIndustry` | `item.brandIndustry` | `"大数据"` | 预生成上下文 |

### 同步更新
- DOM 降级 `parseCard()` 同步新增字段默认值，保持与 API 返回结构一致
- 桌面端同步 `jobs/collect` 增加 `skills` 字段

---

## 🔧 CDP 工具脚本（scripts/cdp-intercept.js）

新增 Chrome DevTools Protocol 拦截器，可连接 `--remote-debugging-port=9222` 的 Chrome 实例，通过 `Runtime.evaluate` 在 BOSS 搜索页中直接执行 `fetch()` 获取 API 原始返回数据，用于分析字段结构和验证 API 行为。

### 使用方式
```bash
# 1. 启动带远程调试的 Chrome
powershell -Command "Start-Process chrome.exe -ArgumentList '--remote-debugging-port=9222', '--user-data-dir=C:\Temp\chrome-debug', 'https://www.zhipin.com/web/geek/jobs?query=...'"

# 2. 运行拦截器
node scripts/cdp-intercept.js
```

---

## 📋 修改文件清单

| 文件 | 改动 |
|------|------|
| `origin-verson/boss-extension/src/content-search.js` | `scrapeViaApi()`: salary 参数透传 + skills/experience/education/companyIndustry 字段补全；`parseCard()`: 新增字段默认值 |
| `origin-verson/boss-extension/src/background.js` | `_buildJobDescFromFields()`: skills 优先 + 7 字段上下文；`extractKeywords()`: JSON 感知重写；薪资过滤全套函数；筛选循环插入薪资过滤；useResumeMatch 关闭警告 |
| `scripts/cdp-intercept.js` | 新增 CDP 拦截器脚本 |
