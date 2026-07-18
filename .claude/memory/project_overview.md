---
name: ai-bossjob-overview
description: AI-BossJob 海投助手项目概况 — BOSS直聘自动化投递浏览器脚本
metadata:
  type: project
---

# AI-BossJob 海投助手

BOSS 直聘自动化海投浏览器脚本（Tampermonkey/ScriptCat），v2.0.0.0。

**核心功能**：
- 本地简历上传（PDF/Word/TXT）+ AI 智能解析生成打招呼语
- 多模型 AI 智能回复（硅基流动、DeepSeek、火山引擎、OpenAI）
- 自动批量投递 + 多城市轮询
- HR 活跃度过滤 + 猎头过滤 + 防重复投递
- 自动发送附件/图片简历

**Why**: 用户找工作痛点项目，通过自动化提升投递效率和回复率。

**How to apply**: 所有改动围绕 `Boss_helper.js` 单文件模块化脚本，涉及 AI API 对接、DOM 操作、localStorage 管理。
