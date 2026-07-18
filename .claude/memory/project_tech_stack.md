---
name: ai-bossjob-tech-stack
description: AI-BossJob 技术架构 — 单文件浏览器脚本，无外部服务器依赖
metadata:
  type: reference
---

# 技术架构

- **运行环境**: Tampermonkey / ScriptCat 脚本管理器
- **浏览器支持**: Chrome, Edge, Firefox, 360 极速浏览器 X
- **核心文件**: `Boss_helper.js`（单文件模块化设计）
- **加密库**: crypto-js（CDN 引入）
- **数据存储**: StorageManager + localStorage（自动截断降级）
- **文件解析**: 原生 FileReader + 正则匹配（纯前端，无后端）
- **AI 接口**: 硅基流动、DeepSeek、火山引擎、OpenAI 多平台兼容
- **匹配域名**: `https://www.zhipin.com/web/*`
