# Apex Admin Web

通用后台管理系统前端模板：多语言、多页签、页面保活，布局复刻 macOS 风格设计稿（顶部状态栏 / 标签栏 / 核心内容 / 底部 Dock）。

视觉与交互基线：以现有布局（macOS 外壳：顶栏 / 页签 / 内容 / Dock）、实际组件与全局设计令牌为准——令牌定义于 `src/styles/globals.css`，antd 侧经 `src/constants/designTokens.ts` 桥接。（原引用的 `docs/macos_ui_ux_design_guide_v3.md` 不存在，迁移期间不伪称该文档存在，详见 docs/migration/gaps.md G16。）

## 技术栈

React 19.2（`<Activity>` 保活）· TypeScript 6 · Vite 8 · antd 6 · react-router 8（Data Router）· Redux Toolkit + redux-persist · axios · react-i18next · lucide-react · dnd-kit · dayjs · CSS Modules

## 快速开始

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

调度系统后端经 dev 同源代理转发：默认目标 `http://10.11.2.67:8888`（OpenAPI 联调环境），前端统一请求 `/fms/v1/...` 相对路径，代理对 `/fms` 前缀原样转发、不改写路径；可用 `APEX_DEV_PROXY_TARGET` 覆盖目标，生产由同源反向代理转发 `/fms`。

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
- `src/layouts/BasicLayout` — 外壳：悬浮玻璃顶栏、标签栏、页面缓存宿主、底部 Dock
- `src/pages` — 页面入口（登录 / 个人中心 / 系统管理 / 错误页）
- `src/features` — 业务组件与业务 Hook
- `src/services` — axios 基础设施、按域拆分的业务请求与 DTO
- `src/i18n` — key 即中文文案；en-US 按命名空间懒加载
