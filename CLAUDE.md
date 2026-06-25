# AI-BossJob 海投助手

## 项目概述

BOSS 直聘自动化海投浏览器脚本（Tampermonkey/ScriptCat），v2.1.0。
三个版本：
- `Boss_helper.js` — 原始版本（保持不变）
- `Boss_helper_pc.js` — 桌面端增强版（+pipeline/digest 看板）
- `Boss_helper_Android.js` — 移动端精简版（FAB+底部弹窗，适配手机浏览器）
匹配域名：`https://www.zhipin.com/web/*`

## JS 脚本 vs CLI 分工（方案 C）

| 职责 | JS 脚本 | boss-agent-cli |
|------|:--:|:--:|
| 批量打招呼 / 页面操作 | ✅ 主 | 辅助 |
| 实时聊天监听 + AI 回复 | ✅ 主 | ❌ |
| 图片简历发送 | ✅ 独有 | ❌ |
| Pipeline 看板 / 跟进 | ✅ 主 | 辅助 |
| 福利筛选搜索 | ❌ | ✅ 主 |
| JD 深度分析 / 模拟面试 | 待实现 | ✅ 主 |
| 增量监控 (watch) | ❌ | ✅ 主 |
| 多格式导出 (CSV/JSON) | 待实现 | ✅ 主 |
| 数据持久化 | localStorage | SQLite |

## 技术注意

- 纯前端脚本，无后端依赖（AI API 除外）
- 数据存储在 localStorage，注意容量限制和自动截断降级
- 简历解析使用原生 FileReader + 正则匹配
- 加密依赖 crypto-js（CDN 引入）
- 图片简历发送功能需注意防引流检测
- **JS 脚本和 CLI 不共享状态**，同时使用会导致数据分裂，按分工各司其职

## 项目记忆

`.claude/memory/` 目录维护了本项目的持久记忆。每次会话必须：
1. 会话开始时读取 `memory/MEMORY.md` 了解项目背景
2. 会话结束前检查是否有新的项目信息需要记录，如有则更新 `memory/` 目录下的对应文件
3. 重要的决策、问题定位、用户偏好都应写入记忆
