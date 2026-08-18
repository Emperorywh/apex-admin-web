# Apex Admin Web — 通用后台管理系统模板

基于 React 19.2 + TypeScript + Vite 8 + antd v6 的后台管理系统前端模板，开箱包含：明暗主题、界面设置面板、
多级菜单导航、中英多语言、Data Router、RBAC 权限、全局状态、axios 封装、多页签与页面保活。
完整需求与实现约定见 [docs/SPEC.md](docs/SPEC.md)（唯一需求依据）。

> ## ⚠️ 安全边界：后端是最终鉴权方
>
> 本模板的一切前端权限能力——路由守卫、菜单过滤、按钮级 `<Auth>` 隐藏——**只用于改善用户体验，不是安全边界**。
> 前端权限码、角色与 token 都可能被篡改或绕过；**后端必须对每一个接口逐请求鉴权**，任何未被后端授权的请求都必须被拒绝。
> `admin` 角色在前端按 `*` 通配渲染全部菜单与按钮，这只是 UX 便利，不改变后端鉴权职责（规格 §5.2）。

## 目录

- [快速开始](#快速开始)
- [常用命令](#常用命令)
- [安全边界与 Token 存储](#安全边界与-token-存储)
- [环境变量](#环境变量)
- [页面保活（Activity）对业务页面的约束](#页面保活activity对业务页面的约束)
- [质量保障](#质量保障)
- [构建与部署](#构建与部署)
- [浏览器兼容性](#浏览器兼容性)
- [目录结构概览](#目录结构概览)

## 快速开始

环境要求（与 `package.json#engines`/`packageManager` 一致，CI 使用相同版本）：

| 工具 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | `>=22.22.0`（本地实测 22.23.1） | 由 `engines` 声明 |
| pnpm | `11.21.0` | `packageManager` 固定版本；建议 `corepack enable` 后由 Corepack 自动匹配 |

```bash
# 1. 安装依赖（首次安装后已提交 pnpm-lock.yaml；CI 固定 --frozen-lockfile）
pnpm install

# 2. 启动开发服务器（默认 http://localhost:5173，/api 代理到 PROXY_TARGET）
pnpm dev

# 3. 登录：需要真实后端按规格 §6.3/§14.3 契约提供认证与业务接口；
#    PROXY_TARGET 指向后端地址（默认 http://localhost:8080）
```

生产构建与本地预览：

```bash
pnpm build          # tsc -b && vite build，产物输出到 dist/
pnpm preview        # vite preview 托管 dist/，自带 SPA fallback，可直接刷新深层路由验证部署行为
```

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 启动 Vite 开发服务器（HMR） |
| `pnpm build` | `tsc -b && vite build` 生产构建 |
| `pnpm preview` | 预览 `dist/` 生产产物 |
| `pnpm check:structure` | 目录/命名/导入方向/深层相对路径/大小写结构门禁 |
| `pnpm lint` | oxlint |
| `pnpm typecheck` | `tsc -b --noEmit` 全项目引用构建类型检查 |
| `pnpm check` | `check:structure && lint && typecheck && build` 完整质量链 |

提交钩子（Husky + lint-staged，均为只读检查，不执行格式化或 `--fix`）：pre-commit 对暂存 TS/TSX 运行
oxlint 并执行全量 `pnpm check:structure`；pre-push 执行 `pnpm typecheck`。提交信息使用简体中文。

## 安全边界与 Token 存储

**再次强调：前端权限过滤不是安全边界，后端必须对每个接口逐请求鉴权**（见页首声明与规格 §5.2）。

### token 存 localStorage 的 XSS 风险

本模板的 accessToken/refreshToken 默认持久化在 **localStorage**（redux-persist，key 前缀 `apex_`，规格 §6.1）。
这是一次显式取舍：localStorage 让「刷新后保持登录」实现简单且跨标签页可用，但代价是——

- **任何成功的 XSS 攻击都可以直接读取双 token**，进而在 token 有效期内完全冒充用户；
- localStorage 无法像 Cookie 一样设置 HttpOnly 标记，脚本可读性不可关闭。

使用本模板接入真实生产时，请至少做到：

1. **配置严格的 CSP**（Content-Security-Policy）：收紧 `script-src`（理想情况 `script-src 'self'`，禁用
   `unsafe-inline`/`unsafe-eval`）、限制 `connect-src` 为已知后端域名、禁止不可信来源的 `object-src`/`frame-src`；
2. 对所有用户输入做输出转义（React 默认转义 JSX 插值，警惕 `dangerouslySetInnerHTML`）；
3. 保持依赖可复现（lockfile）并定期审计供应链；
4. accessToken 保持短有效期 + 刷新旋转（后端契约已按此设计，规格 §6.2）。

### 更稳妥的替代方案：httpOnly Cookie

若威胁模型不允许 token 被脚本读取，建议改造为后端在 `Set-Cookie` 中签发 `HttpOnly; Secure; SameSite=Strict`
的 token Cookie，前端改动集中在：

- 移除 user slice 中双 token 的持久化白名单（规格 §8.1），登录态改为「有 Cookie 即有会话」；
- 请求层不再手写 `Authorization` 头，改为依赖 Cookie（`withCredentials`）；
- **必须同时补齐 CSRF 防护**（如 `SameSite=Strict` + 自定义头双重校验或 token 同步模式）——这是从
  localStorage 迁移到 Cookie 时新引入的风险面，不能省略。

本模板默认维持 localStorage 方案；上述替代属于接入方的架构决策，规格不承诺开箱支持。

## 环境变量

完整定义见规格 §16.1；全模式生效的 `.env` 与模板 `.env.example` 已入库，`.env.*.local` 不提交（本地覆盖用，优先级最高）。

| 变量 | 暴露给客户端 | 取值 / 用途 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 是 | axios 实例 `baseURL`；开发默认 `/api`（走 dev server 代理），生产默认 `/api`（同源网关）或完整 `http(s)://` 地址 |
| `PROXY_TARGET` | 否 | 仅 Vite dev server 使用：`/api` 以 `changeOrigin: true` 代理到该地址；不以 `VITE_` 前缀暴露 |

- `vite.config.ts` 在配置加载阶段（dev 与 build 均生效）校验：`VITE_API_BASE_URL`
  不以 `/` 或 `http(s)://` 开头时直接失败；
- `src/vite-env.d.ts` 启用严格 `ImportMetaEnv` 类型，新增变量必须同步更新类型与校验；
- Vite 读取 `PROXY_TARGET` 使用 `loadEnv(mode, process.cwd(), '')`，变量名不可改为 `VITE_PROXY_TARGET`。

> 演示模式（`VITE_DEMO_MODE`、demo adapter、演示账号等）已随规格 v1.12 移除，本模板现在直连真实后端。

## 页面保活（Activity）对业务页面的约束

多页签缓存基于 React 19.2 `<Activity mode="visible|hidden">`（规格 §9）：隐藏页签的 React state 与 DOM 被保留，
但 **React 会清理其全部 Effect，重新显示时再重建**。因此写业务页面时必须遵守：

- **每个 `useEffect` 必须返回完整清理函数**——订阅、定时器、resize 监听、请求句柄都要在清理中释放；
  未清理的副作用会在页面隐藏期间继续运行（开发环境已开启 StrictMode 帮助暴露此类问题）；
- **DOM 型副作用必须在隐藏时暂停**：视频/音频、iframe、焦点管理、Portal 浮层、ECharts 等，统一通过
  `usePageActive()` / `usePageActiveChange()` 感知激活状态（`src/hooks/`），隐藏即暂停、激活即恢复；
  ECharts 由 `useECharts` 内建该行为（隐藏暂停 resize、主题变化延迟到激活后重建）；
- antd 下拉层优先 `getPopupContainer` 挂到当前页面容器；无法局部挂载的 Modal/notification 在页面隐藏前必须关闭；
- 每个缓存页面拥有独立滚动容器，`scrollTop` 由该容器自然保留；
- 页面请求随页签作用域（`usePageRequest`）自动取消：页签隐藏、关闭、LRU 淘汰都会 abort 该 scope，
  全局 profile/权限刷新不受影响（规格 §7.4）。

## 质量保障

- 本模板**不内置单元测试与 E2E 测试体系**（规格 §16.3，v1.9 移除）。质量保障依赖 `pnpm check` 四道静态门禁：
  结构检查（`check:structure`）、oxlint、`tsc -b --noEmit` 全项目引用类型检查、`vite build` 生产构建，
  由 CI 强制执行；
- 接入方可按业务需要自建测试体系；自建时路径别名等配置须与规格 §3.5 保持一致。

## 构建与部署

- `base: '/'`，产物目录 `dist/`；**不支持子路径部署**（规格 §16.4）；
- 本模板使用 `createBrowserRouter`（HTML5 History 路由），静态托管时**必须配置 SPA fallback**：
  除真实静态资源与后端网关（`/api`）外的未知 GET 路径都要重写到 `/index.html`，否则直接刷新
  `/system/user` 等深层路由会得到 404。**没有 fallback 的部署不算验收通过**（规格 §16.4）。

### Nginx

```nginx
server {
  listen 80;
  server_name example.com;
  root /var/www/apex-admin-web;   # dist/ 产物
  index index.html;

  # 带内容 hash 的构建产物：长缓存
  location /assets/ {
    try_files $uri =404;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # 后端网关：反代到真实服务，不参与 SPA 重写
  location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # SPA fallback：其余 GET 路径命中不到文件时一律重写到 /index.html
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### Apache

```apache
<VirtualHost *:80>
  ServerName example.com
  DocumentRoot /var/www/apex-admin-web   # dist/ 产物

  # 后端网关（可选）：/api 交由后端服务处理，不参与重写
  ProxyPass        /api/ http://127.0.0.1:8080/
  ProxyPassReverse /api/ http://127.0.0.1:8080/

  <Directory /var/www/apex-admin-web>
    AllowOverride All
    Require all granted
    RewriteEngine On
    RewriteBase /
    # 真实存在的文件/目录直接返回（含 index.html 与 /assets/ 静态资源）
    RewriteCond %{REQUEST_FILENAME} -f [OR]
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule ^ - [L]
    # 其余全部路径重写到 index.html（SPA fallback）
    RewriteRule ^ index.html [L]
  </Directory>
</VirtualHost>
```

（`ProxyPass` 需启用 `mod_proxy`/`mod_proxy_http`，重写需启用 `mod_rewrite`。）

### 通用静态托管

任何「找不到文件就回退 index.html」的机制都满足要求，例如：

```bash
# Vite 生态常用：--single 开启 SPA fallback
npx serve --single dist
```

```
# Caddyfile
example.com {
  root * /var/www/apex-admin-web
  try_files {path} /index.html
  file_server
}
```

本地等价验证：`pnpm build && pnpm preview` 后直接访问/刷新 `http://localhost:4173/system/user`，
应返回应用并路由到用户管理页（`vite preview` 自带 SPA fallback）。

## 浏览器兼容性

目标策略（规格 §16.4）：最近两个稳定版 Chrome / Edge / Firefox，Safari 16.4+。
Edge 与 Chrome 同为 Chromium 内核，按「最近两个稳定版 Chromium 内核」策略执行。

## 目录结构概览

```
src/
├── App/            # 应用外壳：Provider 组合与主题/i18n 接线
├── components/     # 跨业务域共享组件（Auth、FeedbackBridge、GlobalProgress 等）
├── config/         # 集中主题配置（唯一允许的色值集中地）
├── constants/      # 应用级与业务域常量（含权限码、路由 ID、Storage key）
├── features/       # 业务组件与业务 Hook（只允许 components/ 与 hooks/）
├── hooks/          # 跨业务域共享 Hook（useAuth、useECharts、usePageActive 等）
├── i18n/           # i18next 初始化与 en-US 资源（中文文案即 key）
├── layouts/        # BasicLayout 外壳（导航、页签、设置抽屉、页面缓存区）
├── pages/          # 所有页面入口，按业务域分组
├── router/         # 路由定义唯一来源、三投影、守卫、重定向校验
├── services/       # HTTP 基础设施（request/feedback）与业务请求及 DTO
├── store/          # Redux 切片（user/settings/tabs/pageCache/app）与持久化
├── styles/         # 全局样式
├── types/          # 跨层业务域实体类型
└── utils/          # 无业务语义的纯工具
scripts/            # check-structure 结构门禁
```

分层边界、命名规则、常量与类型所有权等完整约定见 [docs/SPEC.md](docs/SPEC.md) §3。
