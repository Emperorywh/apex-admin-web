# Apex Admin Web

通用后台管理系统前端模板：多语言、多页签、页面保活，布局复刻 macOS 风格设计稿（顶部状态栏 / 标签栏 / 核心内容 / 底部 Dock）。

规格说明见 [docs/SPEC.md](docs/SPEC.md)，视觉基准见 [docs/apple-admin-light-pixel-perfect.html](docs/apple-admin-light-pixel-perfect.html)。

## 技术栈

React 19.2（`<Activity>` 保活）· TypeScript 6 · Vite 8 · antd 6 · react-router 8（Data Router）· Redux Toolkit + redux-persist · axios · react-i18next · lucide-react · dnd-kit · dayjs · CSS Modules

## 快速开始

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

后端（`C:\code\apex-admin`，FastAPI）默认代理到 `http://localhost:8000`，可用 `APEX_DEV_PROXY_TARGET` 覆盖。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | `tsc -b` + 生产构建 |
| `pnpm lint` | oxlint（含 Data Router 受限导入规则） |
| `pnpm typecheck` | TypeScript 全量检查 |
| `pnpm check:structure` | 目录/命名/导入方向/深层相对路径门禁 |
| `pnpm check` | 以上全部 |

提交钩子（Husky + lint-staged）只做检查，不执行格式化。

## 目录速览

- `src/router` — 路由定义唯一来源与三投影（access / render / menu）
- `src/layouts/BasicLayout` — 外壳：顶栏、标签栏、面包屑、页面缓存宿主、底部 Dock
- `src/pages` — 页面入口（登录 / 个人中心 / 系统管理 / 错误页）
- `src/features` — 业务组件与业务 Hook
- `src/services` — axios 基础设施、按域拆分的业务请求与 DTO
- `src/i18n` — key 即中文文案；en-US 按命名空间懒加载
