# VitaFlow Frontend

Vue3 + TypeScript + Vite 前端，提供首页、登录注册、简历列表、模板页和三栏式简历编辑器。

## 启动

```bash
npm install
cp .env.example .env
npm run dev
```

## 说明

- Axios 在 `src/api/request.ts` 中统一封装，自动携带 token。
- Pinia 管理用户、简历和编辑器状态。
- 编辑器使用 VueUse 防抖自动保存，并提供简历诊断、JD 优化和中英文整份翻译。
- 右侧 A4 预览通过后端 `preview-html` 接口获取 HTML，PDF 导出前会立即保存当前简历。
