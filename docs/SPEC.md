# Apex Admin Web — 通用后台管理系统模板规格说明

> 版本：v1.6 · 日期：2026-08-17 · 状态：已确认（§20 技术闸门已于 2026-08-15 验证通过）
>
> 本文档是实现候选基线。§20 技术闸门通过并记录结果后，状态才能改为「已确认」，届时本文档作为实现的唯一需求依据。技术闸门通过前，只允许完成基础工程和验证性 PoC，不进入全部业务页面开发。
>
> 所有标注「已定」的条目来自访谈结论；标注「默认」的条目为访谈未覆盖、按行业惯例选定的默认值。如需变更，必须先修改本文档及修订记录，不允许实现与文档长期分叉。
>
> v1.6 修订记录（2026-08-17）：移除界面设置中的「字体族」与「字号」配置项——字体族固定为系统字体栈、基准字号固定 16px；settings 切片相应移除 `fontSize`/`fontFamily` 字段，持久化 schema 版本升至 2，v1 旧数据迁移时识别并丢弃这两个字段（其余设置照常恢复）；设置抽屉分组调整为「主题、布局、界面元素」。
>
> v1.5 修订记录（2026-08-17）：新增视觉现代化专项子规格 `docs/SPEC_UI.md`（v1.0），壳层与视觉呈现以子规格为准，功能行为不变。
>
> v1.3 修订记录：① 目录改为 Feature-Based，共置同一业务功能的页面、组件、Hook、样式、测试、API、类型与常量；② 页面和组件强制使用同名文件夹与同名实现文件，禁止 `index.tsx`；③ 类型改为就近管理，取消无边界的全局类型桶；④ 固定 `@/*` 路径别名并禁止两层及以上父级相对导入；⑤ 建立全局、功能、组件三级常量归属规则；⑥ 增加结构检查脚本、CI 门禁和对应验收项。
>
> v1.2 修订记录：① 页签缓存改为 React 19.2 `<Activity>` + 独立 location 快照 + 纯渲染路由，Data Router 仅负责 URL/守卫；② 增加 redux-persist 恢复闸门，消除初始 loader 竞态；③ demo 会话来源随 token 持久化；④ 补齐核心实体、接口、错误码及 admin/viewer 权限矩阵；⑤ 明确 401/403、取消、重放、登出状态机；⑥ 补齐 `/`、路由 `handle`、权限继承、同源回跳规则；⑦ 增加 Node/pnpm 基线、SPA 部署重写、Playwright E2E 和可量化验收标准。
>
> v1.1 修订记录：i18n 改为中文文案即 key；基线升级 antd v6 / react-router v8；路由改为全量注册 + 守卫校验；补充开放重定向防护、环境变量和 token 单一数据源。

---

## 1. 项目概述

一个**通用后台管理系统前端模板**，开箱包含：明暗主题、界面设置面板、导航与多级菜单、多语言、Data Router、RBAC 权限、全局状态、axios 封装、多页签以及页面状态保活。

模板不绑定特定后端：通过静态路由 + 权限码完成前端 UX 过滤，后端始终承担最终鉴权。项目内置可在构建时关闭并从产物剔除的演示模式。

设计原则：

- **约定大于配置**：路由定义、权限码、i18n、API 错误码均有统一约定。
- **单一来源**：路由匹配、菜单、面包屑、页签标题和纯渲染路由均由同一静态路由定义派生。
- **时序显式**：持久化恢复、认证、刷新 token、权限更新和路由渲染必须按本文状态机执行。
- **分层清晰**：页面入口、业务 UI、请求服务、类型和常量分别归入顶层目录；各层使用一致的业务域路径保持对应关系，`features`只承载业务组件与业务 Hook。
- **模板即文档**：示例页面直接演示核心能力和边界处理。
- **可裁剪**：演示模式、示例页面和图表可独立移除。

---

## 2. 技术栈与版本基线

| 类别 | 选型 | 约束 |
| --- | --- | --- |
| 运行时 | Node.js `>=22.22.0` | 由 `package.json#engines` 声明；CI 与本地一致 |
| 包管理 | pnpm `11.21.0` | `packageManager` 固定版本；CI 使用 frozen lockfile |
| 框架 | React 19.2 + TypeScript ~6.0 | React 19.2 的 `<Activity>`用于页面保活 |
| 构建 | Vite 8 + @vitejs/plugin-react | 已有基线 |
| UI | antd v6 | CSS Variables 默认模式 + theme algorithm；不使用 v5 patch |
| 静态反馈 | `App.useApp()` | message/Modal/notification 禁止静态调用，接线见 §7.2 |
| 路由 | react-router v8 | Data Router；不安装 `react-router-dom` |
| 状态 | @reduxjs/toolkit + react-redux + redux-persist | 字段级白名单；恢复闸门见 §4.3 |
| HTTP | axios | 封装见 §7 |
| 国际化 | react-i18next + i18next | 中文文案即 key；命名空间按路由加载 |
| 图标 | lucide-react | 业务菜单/按钮统一使用；antd 内部图标除外 |
| 样式 | CSS Modules + antd token | 禁止 Tailwind/Less；色值规则见 §10.2 |
| 图表 | ECharts | `echarts/core` 按需注册 |
| 日期 | dayjs | 作为直接依赖安装；不依赖 antd 的传递依赖 |
| 页签拖拽 | dnd-kit（core + sortable） | 支持键盘拖拽替代操作 |
| 单元测试 | Vitest + Testing Library + jsdom + @vitest/coverage-v8 | 核心模块覆盖率阈值见 §16 |
| E2E | Playwright | Chromium 自动化；Firefox/WebKit 冒烟 |
| Lint | oxlint + `tsc -b --noEmit` | 不引入 ESLint/Prettier，不自动改写代码 |
| 提交钩子 | Husky + lint-staged | 只检查，不执行格式化或 `--fix` |

首次安装依赖后必须提交 `pnpm-lock.yaml`。规格中的 major/minor 是兼容边界，实际可复现版本以 lock 文件为准；升级依赖必须单独提交并重新执行全部测试。

参考实现边界：

- React `<Activity>`：<https://react.dev/reference/react/Activity>
- React Router `useRoutes(routes, locationArg)`：<https://reactrouter.com/api/hooks/useRoutes>

---

## 3. 目录、模块与命名规范

### 3.1 分层式业务目录参考结构（已定）

```
public/
src/
├── main.tsx                              # 入口：创建 store/persistor、挂载 App
├── App/
│   └── App.tsx                           # Provider 组合与主题/i18n 接线
├── assets/                               # 跨业务域共享的静态资产
│   ├── images/
│   └── icons/
├── components/                           # 跨业务域共享的 React 组件
│   ├── Auth/
│   │   ├── Auth.tsx
│   │   └── Auth.test.tsx
│   ├── FeedbackBridge/
│   │   ├── FeedbackBridge.tsx
│   │   └── FeedbackBridge.test.tsx
│   ├── GlobalProgress/GlobalProgress.tsx
│   ├── PageLoading/PageLoading.tsx
│   ├── RouterErrorBoundary/RouterErrorBoundary.tsx
│   └── RequestScopeProvider/RequestScopeProvider.tsx
├── features/                             # 只允许业务组件与业务 Hook
│   ├── auth/
│   │   ├── components/
│   │   │   └── LoginForm/
│   │   │       ├── LoginForm.tsx
│   │   │       └── LoginForm.test.tsx
│   │   └── hooks/
│   │       └── useLogin.ts
│   ├── dashboard/
│   │   ├── components/
│   │   │   └── OverviewCard/
│   │   │       ├── OverviewCard.tsx
│   │   │       ├── OverviewCard.module.css
│   │   │       └── OverviewCard.test.tsx
│   │   └── hooks/
│   │       └── useDashboard.ts
│   ├── profile/
│   │   └── components/
│   │       └── ProfileForm/ProfileForm.tsx
│   ├── system/
│   │   └── user/
│   │   │   ├── components/
│   │   │   │   └── UserForm/
│   │   │   │       ├── UserForm.tsx
│   │   │   │       ├── UserForm.types.ts
│   │   │   │       └── UserForm.test.tsx
│   │   │   └── hooks/
│   │   │       ├── useUserList.ts
│   │   │       └── useUserList.test.ts
│   └── demo/
│       └── components/
│           └── DemoBadge/DemoBadge.tsx
├── pages/                                # 所有页面入口；按业务域分组
│   ├── auth/
│   │   └── Login/
│   │       ├── Login.tsx
│   │       ├── Login.module.css
│   │       └── Login.test.tsx
│   ├── dashboard/
│   │   └── Dashboard/Dashboard.tsx
│   ├── profile/
│   │   └── Profile/Profile.tsx
│   ├── system/
│   │   ├── user/User/User.tsx
│   │   ├── role/Role/Role.tsx
│   │   └── menu/Menu/Menu.tsx
│   ├── demo/
│   │   └── NestedDemo/NestedDemo.tsx
│   └── error/
│       ├── Forbidden/Forbidden.tsx
│       ├── NotFound/NotFound.tsx
│       └── ServerError/ServerError.tsx
├── services/                             # 应用服务、HTTP 基础设施、业务请求与请求/响应 DTO
│   ├── request/
│   │   ├── request.ts
│   │   └── request.types.ts              # envelope、ApiError、请求扩展配置
│   ├── feedback/uiFeedback.ts
│   ├── auth/
│   │   ├── auth.service.ts
│   │   └── auth.service.types.ts
│   ├── dashboard/
│   │   ├── dashboard.service.ts
│   │   └── dashboard.service.types.ts
│   ├── profile/
│   │   ├── profile.service.ts
│   │   └── profile.service.types.ts
│   └── system/
│       ├── user/
│       │   ├── user.service.ts
│       │   └── user.service.types.ts
│       ├── role/
│       │   ├── role.service.ts
│       │   └── role.service.types.ts
│       └── menu/
│           ├── menu.service.ts
│           └── menu.service.types.ts
├── demo/                                 # adapter、假数据和 demo 常量；可整体剔除
│   ├── adapters/
│   │   ├── demo.adapter.ts
│   │   └── demo.adapter.test.ts
│   ├── fixtures/
│   └── demo.constants.ts                 # demo 账号与权限矩阵，仅 demo 动态入口引用
├── hooks/                                # 跨业务域共享且无单一业务所有者的 Hook
│   ├── useAuth.ts
│   ├── useECharts.ts
│   ├── useFullscreen.ts
│   ├── usePageActive.ts
│   └── usePageRequest.ts
├── types/                                # 跨页面、组件和 service 的业务域类型；禁止全局 barrel
│   ├── auth/auth.types.ts
│   ├── dashboard/dashboard.types.ts
│   └── system/
│       ├── user/user.types.ts
│       ├── role/role.types.ts
│       └── menu/menu.types.ts
├── constants/                            # 应用级与跨层业务常量，按关注点/业务域拆分
│   ├── app.constants.ts
│   ├── permission.constants.ts           # 仅权限码，不含 demo 账号数据
│   ├── request.constants.ts
│   ├── route.constants.ts
│   ├── storage.constants.ts
│   ├── auth/auth.constants.ts
│   ├── dashboard/dashboard.constants.ts
│   ├── profile/profile.constants.ts
│   └── system/
│       ├── user/user.constants.ts
│       ├── role/role.constants.ts
│       └── menu/menu.constants.ts
├── config/
│   └── theme.ts                          # 允许定义色值的集中主题配置
├── i18n/
│   ├── i18n.ts                           # i18next 初始化，不以 index.ts 隐藏运行时代码
│   └── locales/en-US/*.ts
├── layouts/
│   ├── BasicLayout/
│   │   ├── BasicLayout.tsx
│   │   └── components/
│   │       ├── SideMenu/SideMenu.tsx
│   │       ├── TopMenu/TopMenu.tsx
│   │       ├── Header/Header.tsx
│   │       ├── TabsBar/TabsBar.tsx
│   │       ├── Breadcrumb/Breadcrumb.tsx
│   │       ├── SettingDrawer/SettingDrawer.tsx
│   │       ├── PageCacheHost/PageCacheHost.tsx
│   │       ├── CachedRouteView/CachedRouteView.tsx
│   │       └── PageErrorBoundary/PageErrorBoundary.tsx
│   └── BlankLayout/BlankLayout.tsx
├── router/
│   ├── definitions.tsx                  # AppRouteDefinition[] 唯一来源
│   ├── projections.tsx                  # 生成 accessRoutes/renderRoutes/menu
│   ├── router.tsx                       # createBrowserRouter；禁止以 index.tsx 承载实现
│   ├── router.types.ts
│   ├── guard.ts
│   ├── bootstrap.ts
│   └── redirect.ts
├── store/
│   ├── store.ts
│   └── slices/                          # 应用级 user/settings/tabs/pageCache/app
├── utils/                               # 仅无业务语义的纯工具
├── styles/globals.css
├── test/setup.ts                        # 全局测试初始化；业务测试不得集中到这里
└── vite-env.d.ts                        # 严格环境变量类型
scripts/
└── check-structure.mjs                  # 目录、命名、导入方向与深层相对路径门禁
e2e/                                     # Playwright 跨业务场景
```

本规格采用“顶层分层 + 同业务域对齐”，不是把所有实现共置到 feature 的传统 Feature-Based 结构。`auth`、`dashboard`、`profile`、`system/user`等业务域必须在 `features/`、`pages/`、`services/`、`types/`和 `constants/`中使用一致的路径片段；不存在对应内容时不创建空目录。

`src/features/`是业务 UI 复用层，不是业务功能的总根目录。每个叶子 feature 目录只允许出现 `components/`和 `hooks/`；`system/`这类中间分组目录只允许继续包含子业务域。禁止在 feature 根部或其任意层级新增 `pages/`、`api/`、`services/`、`store/`、独立类型文件、独立常量文件及其他业务实现。

### 3.2 分层边界与提升规则（已定）

| 内容 | 唯一默认归属 | 约束 |
| --- | --- | --- |
| 页面入口 | `src/pages/<domain>/<Page>/<Page>.tsx` | 页面目录可共置同名前缀的样式、测试、页面私有类型和常量；业务子组件放入对应 feature |
| 单业务域组件/Hook | `src/features/<domain>/components/`、`src/features/<domain>/hooks/` | feature 只管理这两类实现及其紧邻的测试、样式、类型和常量 |
| 跨业务域共享组件/Hook | `src/components/`、`src/hooks/` | 必须无单一业务所有者，不得反向依赖页面或 feature |
| 应用服务、HTTP 基础设施、业务请求、DTO | `src/services/` | 业务请求按同一业务域路径拆分；禁止在 feature 或页面目录定义 API adapter |
| 跨层业务实体/模型 | `src/types/<domain>/` | 必须有明确业务所有者，不创建无边界 barrel |
| 应用级/跨层业务常量 | `src/constants/` | 按关注点或业务域拆分；demo 数据除外 |
| demo adapter、假数据、账号矩阵 | `src/demo/` | 只能由 demo 动态入口引用，并可在 off 构建中整体剔除 |

- 页面文件负责路由入口与业务组件编排，不在 `src/pages/`内建立通用组件库。只被一个页面使用但具有独立 React 组件身份的子组件，仍放入对应 `src/features/<domain>/components/<Name>/`；页面文件夹只共置页面自身的辅助文件。
- 一个业务组件或 Hook 首次只服务单一业务域时放在该域的 feature 内；被两个或以上业务域直接复用时，必须在同一次变更中提升到 `src/components/`或 `src/hooks/`，补齐独立测试，并移除对原业务域内部状态和 service 的耦合。
- 固定依赖方向为：`router → layouts/pages`、`layouts/pages → features/components/hooks/services/store/types/constants`、`features → components/hooks/services/store/types/constants`、`业务 service → services/request、store、types、constants`。箭头右侧不得反向导入箭头左侧；service 不得导入 React 页面、组件或业务 Hook。
- `src/components/`和 `src/hooks/`不得导入 `src/pages/`或 `src/features/`，也不得直接依赖单一业务域 service。`FeedbackBridge`注册 `src/services/feedback/uiFeedback.ts`是基础设施接线，不属于业务域依赖。
- 不同业务域的 feature 不得穿透导入彼此的组件或 Hook；确需复用时按上一条提升到共享层。跨层共享数据结构引用所有者在 `src/types/<domain>/`中的权威定义，禁止复制接口，也不得把业务实现塞进 `utils/`规避边界。
- 页面/组件私有资产与其实现同目录；跨页面、跨组件复用的静态资产提升到 `src/assets/`。`src/utils/`只接收无业务语义的纯工具，不能成为业务杂物桶。
- `src/test/`只保存全局 setup、自定义 renderer 和跨业务测试工具；其他单元测试必须与被测文件同目录，命名为 `*.test.ts`或 `*.test.tsx`。

### 3.3 页面与组件文件夹规则（已定）

- 所有页面和 React 组件都必须由独立文件夹包裹，文件夹名、实现文件名和导出的组件名保持一致，例如 `src/pages/system/user/User/User.tsx`、`src/features/system/user/components/UserForm/UserForm.tsx`。
- 禁止用 `index.tsx`承载页面或组件实现，项目内不得出现 `index.tsx`。即使一个目录当前只有一个实现文件，也必须使用同名文件，不能只创建 `User/index.tsx`。
- `index.ts`只允许作为确有多个稳定公共导出时的纯 barrel，不能包含运行时代码，也不能成为唯一文件；默认直接从具名文件导入，以降低循环依赖和跳转歧义。
- 页面/组件专属样式、测试、类型和常量使用同一前缀并放在该文件夹内，例如 `User.module.css`、`User.test.tsx`、`User.types.ts`和 `User.constants.ts`。
- 页面入口只能位于 `src/pages/`；业务 React 组件只能位于对应 `src/features/<domain>/components/`或跨业务域共享的 `src/components/`。`layouts/`和 `App/`是应用外壳组件的明确例外，但仍必须遵循同名文件夹规则。
- `main.tsx`、路由定义、配置、纯函数和 Hook 不属于页面/组件命名规则；若 Hook 自身拆出多个强相关文件，可使用 `useXxx/`文件夹并保持同名。`App`是 React 组件，必须遵循 `App/App.tsx`。

### 3.4 Types 就近管理（已定）

- 只被一个页面或组件使用的 Props、状态和内部模型，写在实现文件内或同目录 `<Name>.types.ts`；不允许为单一消费者创建全局类型。
- HTTP 请求/响应 DTO 放在对应 `src/services/<domain>/<name>.service.types.ts`；同一业务域中被页面、组件和 service 跨层共享的实体或 ViewModel 放在 `src/types/<domain>/<domain>.types.ts`。
- 与业务领域无关的基础设施类型放在基础设施旁，例如 `src/services/request/request.types.ts`和 `src/router/router.types.ts`。`src/types/`必须按业务域分目录，禁止创建笼统的 `src/types/index.ts`。
- 每个类型只能有一个权威定义。调用端使用 `import type`引用，不复制“长得一样”的接口；服务端 DTO 与页面 ViewModel 语义不同时必须显式转换并分别命名。
- 类型文件必须按业务语义命名，禁止 `types.ts`、`common.ts`、`model.ts`这类无法表达所有权的类型桶。`src/features/<domain>/`根部不得出现类型文件；组件或 Hook 的私有类型只能与该实现紧邻共置。

### 3.5 路径别名与导入规则（已定）

- 唯一路径别名固定为 `@/*` → `src/*`。TypeScript `compilerOptions.paths`、Vite `resolve.alias`、Vitest 和编辑器解析必须指向同一绝对目录；任一环境无法解析都视为配置失败。
- `tsconfig.app.json`固定设置 `baseUrl: "."`与 `paths: { "@/*": ["src/*"] }`；Vite 的 alias key 使用 `@`，目标通过 `fileURLToPath(new URL('./src', import.meta.url))`解析，禁止依赖当前工作目录。Vitest 复用 Vite 配置，不另写一份可能漂移的 alias。
- 同一文件夹内使用 `./`相对导入；仅允许一次 `../`访问直接父级的共置文件。出现 `../../`或更深父级导入即检查失败，必须改用 `@/`绝对别名。
- 项目源码的根级绝对导入必须以 `@/`开头，禁止 `src/...`、`features/...`等伪绝对路径，也禁止新增 `@components`、`@features`等第二套别名；第三方包名不受此条影响。
- 跨顶层目录、业务域内跨子目录以及路由 lazy import 均使用 `@/`；禁止通过 barrel 或路径拼接隐藏跨层、跨业务域的越界依赖。
- 文件名和路径大小写必须与磁盘完全一致，CI 在大小写敏感环境再次检查，避免 Windows 本地通过而 Linux 构建失败。

### 3.6 Constants 常量管理（已定）

- 有业务或配置语义的魔法数字和字符串不得散落在实现中。请求超时、缓存容量、分页默认值、Storage key、路由 ID/路径、权限码、错误码、状态值、日期格式、正则、长度限制和 API endpoint 等必须使用具名常量。
- 应用级稳定常量按关注点放在 `src/constants/*.constants.ts`；同一业务域跨页面、组件和 service 使用的常量放在 `src/constants/<domain>/<domain>.constants.ts`。权限码统一在 `src/constants/permission.constants.ts`，但 demo 账号和权限矩阵只能放在可剔除的 `src/demo/demo.constants.ts`。只供一个页面/组件使用的常量放在同目录 `<Name>.constants.ts`或实现文件顶部。
- `src/features/<domain>/`根部不得放常量；组件/Hook 私有常量可以与实现紧邻共置。API endpoint、sortBy 白名单和跨层字段限制属于业务域常量，不得在页面、feature 和 service 各复制一份。
- 常量必须遵循最小可见范围，不能为了“统一”把所有值堆入一个 `constants.ts`。跨层移动常量时同步移动测试并更新唯一所有者。
- 基础常量使用 `UPPER_SNAKE_CASE`；成组枚举值使用 `as const`对象并从其值推导联合类型，避免另写一份可能漂移的字符串联合。
- 用户可见静态文案仍按 §12 通过 i18n 管理，不复制到 constants；主题色、间距和断点优先使用 antd token/CSS 自定义属性；测试 fixture、协议规定的空字符串以及无业务语义的 `0`、`1`可直接使用，但一旦参与业务判断必须命名。
- 代码评审必须拒绝无名称、无法说明来源的字面量；新增常量时在名称或相邻多行简体中文注释中解释单位、边界和用途，尤其是毫秒、容量和版本号。

应用级常量所有权固定如下，禁止在多个文件重复定义：

| 文件 | 唯一负责内容 |
| --- | --- |
| `src/constants/app.constants.ts` | 页签缓存容量、全局进度延迟和应用级容量/时间边界 |
| `src/constants/request.constants.ts` | 请求超时、稳定错误码、请求协议默认值 |
| `src/constants/route.constants.ts` | 路由 ID、路径和稳定回退地址 |
| `src/constants/storage.constants.ts` | Storage key、前缀和持久化 schema 版本 |
| `src/constants/permission.constants.ts` | 正式权限码；不得包含账号、假数据或 demo 权限矩阵 |

---

## 4. 路由体系

### 4.1 单一路由定义与三投影（已定）

`router/definitions.tsx` 中的 `AppRouteDefinition[]` 是唯一来源，每个节点必须有稳定且全局唯一的 `id`。它生成三份只读投影：

1. **accessRoutes**：全量注册给 `createBrowserRouter`。负责 URL 匹配、认证 loader、权限 loader、重定向和路由级错误；业务叶子节点只返回空锚点，不能直接渲染业务页。
2. **renderRoutes**：不包含 loader/action，仅包含目录结构和 `React.lazy` 页面组件。`CachedRouteView` 使用 `useRoutes(renderRoutes, locationSnapshot)`渲染，从而让每个缓存页签获得自己的 `useLocation/useParams/useSearchParams`上下文。
3. **menuRoutes**：按权限和 `hideInMenu`过滤，供侧边菜单、顶部菜单和快捷入口使用。

三份投影和其中的 lazy component 都在模块初始化时只生成一次并保持引用稳定；不能在 `PageCacheHost`每次渲染时重建。列表中的每个页签由独立 `CachedRouteView`组件调用一次 `useRoutes`，禁止在循环体内直接调用 hook。

`BasicLayout`在受保护根路由内只挂载一次。它根据 Data Router 当前 location/matches 更新 tabs，再由持久存在的 `PageCacheHost`渲染所有缓存页。禁止缓存 `<Outlet/>`返回值。

Data Router loader 只做认证、权限和重定向，不承载业务页面数据。业务页统一通过 §7 service 层获取数据。`renderRoutes`不参与 Data Router 数据 API，因此页面禁止使用 `useLoaderData`、`useRouteLoaderData`、`useFetcher`、route action 和 `useRevalidator`；oxlint 通过受限导入规则检查这些命名导入。

### 4.2 路由定义与 meta

```ts
/**
 * 路由定义同时驱动访问路由、纯渲染路由、菜单和面包屑。
 * 业务页面只能通过 loadPage 延迟加载，不能在定义中直接创建页面实例。
 */
interface AppRouteDefinition {
  id: string
  path?: string
  index?: boolean
  loadPage?: () => Promise<{ default: React.ComponentType }>
  meta: RouteMeta
  children?: AppRouteDefinition[]
}

/**
 * meta 会原样映射到 Data Router 的 handle.meta。
 * 菜单、面包屑和页签只能从 handle.meta 或原始定义读取，不维护副本。
 */
interface RouteMeta {
  title: string
  icon?: LucideIcon
  permCode?: string
  hideInMenu?: boolean
  hideInTabs?: boolean
  affixTab?: boolean
  noCache?: boolean
  breadcrumb?: boolean
  tabKeyMode?: 'fullPath' | 'pathname'
  i18nNamespaces?: string[]
}
```

约定：

- `meta`投影为 `handle: { meta }`，面包屑使用 Data Router 的 `useMatches()`读取。
- 目录节点允许无 `loadPage`，只参与匹配、菜单和面包屑。
- 叶子页面必须有 `loadPage`，由 `React.lazy` + `<Suspense fallback={<PageLoading />}>`加载。
- `loadPage`必须通过 `@/pages/system/user/User/User`这类具名实现路径导入，禁止从 `features`加载页面、导入页面目录或依赖 `index.ts/index.tsx`解析；路由 ID、路径和回退地址引用 `src/constants/route.constants.ts`。
- `breadcrumb`默认 true；`hideInTabs`用于登录、错误页和不应生成页签的辅助路由。
- `/`是受保护 index route，固定 `replace`重定向到 `/dashboard`。
- 受保护根路由内的 `*`渲染 404；未登录访问任意受保护 URL 先跳登录，登录成功后回原地址并显示 404。
- `/403`和 `/500`需要登录但不要求 permCode，防止错误页自身形成权限循环。
- `/404`既有可直达的显式路由，受保护根路由的 `*`也渲染同一组件；登录、403、404、500 固定设置 `hideInMenu/hideInTabs/noCache`，错误页 `breadcrumb: false`。
- Dashboard 固定 `affixTab: true`，且是唯一默认 affix。所有可登录的正常账号都必须使 `hasAuth('dashboard:view')`为 true（admin 角色按通配处理）；不满足时前端按 `AUTH_FORBIDDEN`清理会话并返回登录页，避免首页和“关闭全部”没有合法落点。
- 页面渲染错误由每个缓存实例外层 `PageErrorBoundary`显示 500 内容；guard/loader 错误由 Data Router 配置的 `RouterErrorBoundary`处理。

### 4.3 启动闸门与认证守卫（已定）

启动顺序固定如下：

1. 创建 store 与 persistor，并同时创建只会完成一次的 `rehydratedPromise`。
2. `createBrowserRouter`可以在 React 树外创建，但所有 auth/permission loader 第一行必须 `await rehydratedPromise`。
3. 持久化恢复完成后，loader 才读取 token 和 `sessionSource`。
4. 有 token 时，通过 `profileSingleFlight`在每次整页启动首次受保护导航中拉取一次 `/auth/profile`；用户信息、角色和权限码不从上次会话直接复用。
5. profile 成功后校验当前匹配链全部权限，再允许渲染。

Data Router 默认可能并行执行父子 loader，因此每个受保护 loader 都必须调用同一个 `ensureProfile()`，不能假设父 loader 已先完成。`ensureProfile()`内部等待 rehydration 并复用 `profileSingleFlight`，一次启动最多发出一个 profile 请求。

守卫规则：

- 无 accessToken → 使用 `URLSearchParams#set`把当前 `pathname + search + hash`编码一次，再 `redirect('/login?...')`；禁止手工字符串拼接和重复 `encodeURIComponent`。
- 有 token → 必须完成本次启动的 profile；失败按 §6 状态机处理。
- 匹配链中任一 `permCode`不满足 → `redirect('/403')`。
- `/login` loader 发现 token 时先执行 `ensureProfile()`；认证有效才跳合法 redirect 或 `/dashboard`，token 无效并完成清理后继续显示登录页。
- `/auth/profile`网络失败且当前不是 demo 会话 → 路由错误页提供「重试」和「退出登录」，不能把网络故障误判为未登录。
- 持久化数据解析或迁移失败 → 清理认证字段，保留可解析的界面设置，跳登录并显示一次恢复失败提示。

登录回跳值按以下顺序验证：

1. 通过 `URLSearchParams#get`取得已解码一次的值，不再调用 `decodeURIComponent`；拒绝控制字符和 `\\`。
2. 必须以单个 `/`开头，拒绝 `//`。
3. 使用 `new URL(value, window.location.origin)`规范化。
4. 规范化后的 `origin`必须严格等于当前 `origin`。
5. 只返回 `pathname + search + hash`，验证失败统一回 `/dashboard`。

禁止直接把未经上述函数处理的 redirect 传给 `navigate`、`redirect`或 `<a href>`。

### 4.4 权限继承与菜单过滤

- 路由没有 `permCode`表示所有已登录用户可访问，不表示公开路由。
- 一个叶子页面需要同时满足从受保护根到叶子的全部 `permCode`，即祖先与叶子权限为 AND。
- admin 角色拥有通配权限 `*`，`hasAuth('*')`和任意权限均返回 true。
- 目录菜单只有在自身权限满足且至少有一个可见子节点时保留。
- `hideInMenu: true`隐藏该节点及其菜单子树，但不改变 URL 可访问性和权限校验；详情页应单独设为隐藏叶子节点，不把可见菜单放在隐藏目录下。
- 菜单过滤和守卫必须调用同一个 `hasPermissionChain`函数，并对该函数做单元测试。

### 4.5 页签 key 与 location 快照

- 默认 `tabKeyMode: 'fullPath'`：key 为规范化 `pathname + search`，不含 hash。
- search 使用 `URLSearchParams.sort()`按参数名稳定排序；同名重复参数保持原顺序。
- hash 变化不创建新页签，只更新当前页签的 location 快照。
- `tabKeyMode: 'pathname'`用于查询参数只表示筛选条件、不希望产生多个页签的页面。
- 每个页签保存不可变的 location 快照；导航到同 key 时替换该页签快照并激活，不创建第二个缓存实例。
- location 快照只保存可序列化的 `pathname/search/hash/key`，`state`固定为 null；模板业务导航禁止依赖 `location.state`传递数据，应使用 URL 参数或业务 store。
- 页面通过其独立纯渲染路由上下文读取 location，不直接读取全局 tabs store 推断参数。

---

## 5. 权限体系（RBAC）

### 5.1 模型与权限码

```
User ──n:n── Role ──n:n── Permission(权限码)
```

- 权限码格式：`<模块>:<资源>:<动作>`，例如 `system:user:create`。
- 超级管理员角色标识固定为 `admin`，前端视作拥有 `*`；后端仍逐接口鉴权。
- 所有正式权限码在 `src/constants/permission.constants.ts`定义，页面禁止出现权限魔法字符串；演示账号与权限矩阵按 §3.6 留在可剔除的 `src/demo/`。
- `/auth/profile`返回 `permissionVersion`。它只用于判断权限快照是否变化，不替代权限码校验。

模板必须定义并使用以下权限码：

```
dashboard:view
system:user:list
system:user:create
system:user:update
system:user:delete
system:user:assign-role
system:role:list
system:role:create
system:role:update
system:role:delete
system:role:assign-permission
system:menu:list
system:menu:create
system:menu:update
system:menu:delete
demo:nested:view
```

### 5.2 页面与按钮权限

```tsx
/**
 * 页面只引用集中定义的权限常量，默认无权限时不渲染子节点。
 * 如业务确需展示禁用态，必须显式传入 mode="disabled"。
 */
<Auth code={PERMISSIONS.SYSTEM_USER_CREATE}>
  <Button>{t('新增用户')}</Button>
</Auth>
```

- 页面级：Data Router guard + menuRoutes 过滤。
- 按钮级：`<Auth>`和 `useAuth().hasAuth()`使用同一判定函数。
- `<Auth>`默认 `mode="hidden"`；`disabled`模式必须由具体需求显式指定。
- 前端权限仅改善 UX；README 必须醒目标明后端是最终安全边界。

### 5.3 演示账号权限矩阵（验收固定）

| 能力 | admin | viewer |
| --- | --- | --- |
| Dashboard | ✅ | ✅ |
| 用户列表/查询 | ✅ | ✅ |
| 新增、编辑、删除用户 | ✅ | ❌，按钮隐藏 |
| 分配用户角色 | ✅ | ❌，按钮隐藏 |
| 角色管理 | ✅ | ❌，菜单隐藏且直达 403 |
| 菜单管理 | ✅ | ❌，菜单隐藏且直达 403 |
| 多级菜单演示 | ✅ | ✅ |
| 个人中心查看/编辑 | ✅ | ✅ |

viewer 的最小权限码固定为：

```
dashboard:view
system:user:list
demo:nested:view
```

个人中心仅要求登录，不分配额外 permCode。

上述账号名、权限集合和矩阵的实现只能存在于 `src/demo/demo.constants.ts`及其同目录测试中，并由 demo 动态入口引用；正式权限常量文件不得导出任何演示账号数据。

### 5.4 会话内权限变更

- 只有后端返回 HTTP 403 且 `errorCode === 'AUTH_PERMISSION_CHANGED'`时，才触发 `profileRefreshSingleFlight`。
- 普通资源拒绝时返回 `AUTH_FORBIDDEN`，前端只提示无权操作，不刷新 profile。
- `/auth/profile`自身永不触发权限刷新，防止递归。
- 刷新完成后比较 `permissionVersion`，重算菜单；销毁并关闭不再可访问的普通页签及缓存。
- 当前页失权时立即 `replace('/403')`；不能等到下次激活。
- 多个并发权限变更响应共享一个 Promise，30 秒内相同版本不重复提示。

---

## 6. 认证与 Token

### 6.1 存储与启动

- 双 token、`sessionSource`和 `sessionEpoch`位于 user slice，是认证信息的单一数据源。
- redux-persist 只持久化 `accessToken`、`refreshToken`、`sessionSource`；用户资料、roles、permCodes、permissionVersion 每次整页启动重新拉取。
- token 默认落 localStorage。README 必须说明 XSS 风险、CSP 建议及 httpOnly Cookie 替代方案。
- `sessionSource`取值 `real | demo`，在任何请求 adapter 选择之前完成恢复。
- `sessionEpoch`每次登录、登出和切换账号时递增，用于阻止旧异步任务回写新会话；它本身不要求跨刷新延续。

### 6.2 登录、刷新和登出状态机

- 登录：`POST /auth/login` → 保存 token/source、递增 epoch → `GET /auth/profile` → 生成菜单 → 合法 redirect 或 `/dashboard`。
- accessToken 失效的唯一触发条件：HTTP 401 且 `errorCode === 'AUTH_ACCESS_EXPIRED'`。
- login、refresh、logout 请求固定 `skipAuthRefresh: true`，不能触发刷新流程。
- refresh 使用不安装业务响应拦截器的专用 axios 实例，避免刷新请求再次进入自己；它仍复用 baseURL、timeout 和 sessionSource adapter 选择。
- 每个业务请求最多自动重放一次，以内部 `_authRetried`标识防循环。
- 并发 401 共享一个 refresh Promise；refresh 成功后原子替换旋转后的双 token。
- 等待期间若原请求 signal 已 abort，或当前 `sessionEpoch`与请求创建时不同，该请求直接以取消错误结束，不得重放。
- refresh 返回 `AUTH_REFRESH_EXPIRED`、网络失败或协议错误：只执行一次会话清理，销毁 tabs/pageCache，跳登录并带合法当前地址。
- 任意接口返回 HTTP 403 + `AUTH_ACCOUNT_DISABLED`时不刷新 profile，直接执行一次会话清理并跳登录。
- `/auth/profile`返回 `AUTH_FORBIDDEN`，或成功数据使 `hasAuth('dashboard:view')`为 false 时，视为会话不满足模板基本访问条件，清理会话并返回登录页；其他业务接口的 `AUTH_FORBIDDEN`只提示，不清会话。
- 登出时先递增 epoch、阻止新业务请求并保存待提交的 refreshToken；`POST /auth/logout`使用 `skipAuthRefresh`，无论成功、失败或超时都在 `finally`本地清理。settings 保留。
- refresh Promise 完成后必须再次核对 epoch；账号已经切换时丢弃结果。

### 6.3 核心认证接口

```
POST /auth/login
  body: { username, password }
  data: { accessToken, refreshToken, user: User }

POST /auth/refresh
  body: { refreshToken }
  data: { accessToken, refreshToken }

POST /auth/logout
  body: { refreshToken }
  data: null

GET /auth/profile
  data: ProfileData

PUT /auth/profile
  body: { displayName, email, phone? }
  data: User

PUT /auth/password
  body: { oldPassword, newPassword }
  data: null
```

---

## 7. Axios 封装（`services/request/request.ts`）

### 7.1 响应协议

除文件流外，所有接口使用 JSON envelope：

```ts
/**
 * errorCode 是跨前后端稳定的机器可读标识。
 * 新增错误码必须同步更新接口契约、i18n 映射、demo adapter 和测试。
 */
type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_ACCOUNT_DISABLED'
  | 'AUTH_ACCESS_EXPIRED'
  | 'AUTH_REFRESH_EXPIRED'
  | 'AUTH_PERMISSION_CHANGED'
  | 'AUTH_FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_CONFLICT'
  | 'INTERNAL_ERROR'

/**
 * 成功 envelope 固定使用字面量 0，data 必须存在。
 * requestId 可同时由响应头返回，前端优先使用 envelope 中的值。
 */
interface ApiSuccess<T> {
  code: 0
  message: string
  data: T
  requestId?: string
}

/**
 * 失败 envelope 的 data 固定为 null，errorCode 必须存在。
 * message 只用于诊断和未知错误兜底，程序分支只能依赖 errorCode。
 */
interface ApiFailure {
  code: number
  message: string
  data: null
  errorCode: ApiErrorCode
  requestId?: string
  details?: unknown
}

/**
 * HTTP 状态和业务 code 不互相替代，调用端先判断 HTTP 再解析该联合类型。
 * 文件下载成功响应不使用此 envelope，下载失败仍返回 ApiFailure JSON。
 */
type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure

/**
 * 业务层统一捕获该错误，不直接依赖 AxiosError 的内部结构。
 * canceled 为 true 时禁止弹出全局错误提示。
 */
interface ApiError extends Error {
  httpStatus?: number
  code?: number
  errorCode?: ApiErrorCode
  requestId?: string
  details?: unknown
  canceled: boolean
}
```

成功条件固定为 HTTP 2xx 且 `code === 0`，不再兼容 envelope `code === 200`。删除、登出等无返回值接口仍返回 `data: null`，不用 204。

业务 service 模块中的每个导出函数必须显式声明入参和 `Promise<T>`返回类型，并通过封装的 `request<T>()`完成类型解包；不能把 AxiosInstance 全局伪装成已解包类型。

### 7.2 App.useApp 反馈桥

- Provider 顺序固定为：Redux Provider → PersistGate → ConfigProvider → antd App → `FeedbackBridge` → RouterProvider。
- `FeedbackBridge`是 antd App 的子组件，调用 `App.useApp()`并把 message/modal/notification 实例注册到 `uiFeedback`模块。
- axios 拦截器只能调用 `uiFeedback`，不能直接调用 hook 或 antd 静态方法。
- RouterProvider 的首次 loader 可能早于 FeedbackBridge 注册，因此 guard/profile 初始化请求固定 `silent: true`；错误由路由错误页展示。
- `uiFeedback`未就绪时只记录错误，不排队补弹，避免初始化完成后出现过期提示。

### 7.3 请求扩展配置

```ts
/**
 * scopeId 标识请求属于哪个页签；页面隐藏、关闭或路由离开时统一取消该 scope。
 * 内部字段以下划线开头，只能由请求封装写入。
 */
interface RequestOptions {
  silent?: boolean
  scopeId?: string | 'global'
  skipGlobalLoading?: boolean
  skipAuthRefresh?: boolean
  dedupe?: 'cancel-previous' | 'none'
  _authRetried?: boolean
  _sessionEpoch?: number
}
```

`services/request/request.types.ts`通过 TypeScript module augmentation 把这些字段合并到 AxiosRequestConfig；业务模块不能用类型断言绕过配置类型。

### 7.4 请求生命周期

1. **自动解包**：成功返回 `data`；协议不合法转换为 `ApiError`。
2. **认证头**：请求发送前从 store 读取当下 accessToken，并写入 `Authorization: Bearer <token>`；token 不进入 URL、日志或去重 key。login/refresh 可显式关闭认证头。
3. **统一提示**：已知 `errorCode`映射为前端 i18n 文案；未知错误显示「请求失败，请稍后重试」和 requestId，不直接把后端 message 当作已翻译文案。
4. **401 刷新重放**：严格执行 §6.2。
5. **重复 GET 取消**：默认取消前一个。key 包含 method、规范化 baseURL/url、稳定序列化 params、responseType、Accept 头、scopeId 和 sessionEpoch；不同页签、身份或响应类型不得碰撞。稳定序列化递归排序对象 key、保持数组及同名查询参数的原顺序，并拒绝函数/循环引用。写操作默认不去重。
6. **页面请求作用域**：`usePageRequest()`自动附加页签 scopeId；页签 Activity 隐藏、页签关闭和缓存淘汰都会 abort 该 scope。全局 profile/权限刷新使用 `scopeId: 'global'`。
7. **Data Router 请求**：loader 必须透传其 `request.signal`，不进入页面 scope。
8. **全局进度**：请求管理模块内部用逻辑 requestId 的 Set 去重，Redux 只保存当前 `loadingCount`数字；同一请求经历 401 等待与重放期间只计一次，最终成功/失败/取消时删除并同步集合大小，归零后按 `GLOBAL_PROGRESS_HIDE_DELAY_MS = 200`延迟收起。refresh 请求自身不重复计数。
9. **取消语义**：所有 abort 统一转换为 `ApiError { canceled: true }`，不弹错误；调用端仍必须在 `finally`结束局部 loading。

明确不做普通网络错误自动重试；唯一自动重放是一次认证刷新后的原请求重放。

实例配置：`baseURL = import.meta.env.VITE_API_BASE_URL`，`timeout = REQUEST_TIMEOUT_MS`；`REQUEST_TIMEOUT_MS`在 `request.constants.ts`中固定为 `15_000`毫秒。

---

## 8. 全局状态管理

### 8.1 切片划分

| 切片 | 内容 | 持久化 |
| --- | --- | --- |
| `user`（应用级 `store/slices/user.slice.ts`） | 双 token、sessionSource、sessionEpoch、用户信息、角色、permCodes、permissionVersion | 仅双 token + sessionSource |
| `settings`（应用级） | 主题选择、主题色、布局、面包屑、语言 | ✅ |
| `tabs`（应用级） | 页签 key、location 快照、title、affix、排序 | ❌ |
| `pageCache`（应用级） | 缓存 key、revision、LRU 顺序 | ❌ |
| `app`（应用级） | loadingCount、侧栏折叠、全屏状态、初始化状态 | 仅 sidebarCollapsed |

Fullscreen 是浏览器瞬时状态，明确属于 app slice，不属于 settings，也不持久化。

### 8.2 redux-persist

- 使用 slice 级嵌套 persist 或 `createTransform`完成字段级白名单，禁止把完整 user/app slice 直接加入根白名单。
- 初始 `version: 1`并提供 `migrate`映射；结构变化必须升版本并测试旧数据迁移。
- serializableCheck 只忽略 redux-persist 官方 action，不关闭整个检查器。
- key 前缀常量 `STORAGE_KEY_PREFIX`统一为 `apex_`。
- `rehydratedPromise`由 persistor bootstrap 回调完成，auth loader 必须等待它。
- JSON 损坏、迁移抛错或 storage 不可用时进入可预测降级：清认证、用默认设置继续启动，并记录一次诊断。

### 8.3 主题启动镜像

为避免异步恢复前出现反色闪烁，settings 每次变化时同步写入最小只读镜像；其 Storage key 由 `THEME_BOOT_STORAGE_KEY = 'apex_boot_theme'`统一定义。Redux 仍是运行时单一数据源，镜像只供 `index.html`启动脚本读取 `mode/resolvedMode`并提前设置 `data-theme`、`color-scheme`和初始背景；Provider 启动后立即以 Redux 设置校正镜像。

---

## 9. 多页签与页面保活

### 9.1 Activity 缓存架构（已定）

- `PageCacheHost`为每个可缓存页签保持一个稳定 key 的 `<Activity mode="visible|hidden">`。
- Activity 内是 `CachedRouteView`，它以该页签 location 快照调用 `useRoutes(renderRoutes, snapshot)`。
- 隐藏页保存 React state 和 DOM 状态；React 会清理其 Effects，重新显示时恢复 state 并重新创建 Effects。
- `noCache: true`页面只渲染当前实例，离开即卸载，不进入 Activity/LRU。
- 每个缓存实例有独立 `PageErrorBoundary`、Suspense 和页面请求 scope。
- 禁止缓存 Data Router `<Outlet/>`、当前 route element 或 `useOutlet()`结果。

缓存容量由 `PAGE_CACHE_MAX_ENTRIES = 10`统一定义，即最多 **10 个非 affix 实例**：

- affix 缓存不计入 10，但项目默认只能配置一个 affix Dashboard；新增 affix 必须评估内存。
- 新增第 11 个普通缓存时，淘汰最久未激活且非当前页的实例；页签仍保留，再激活时重新挂载。
- 当前激活页永不被淘汰；关闭页签立即移除其 Activity、取消请求并释放缓存。

### 9.2 隐藏页面副作用与 DOM 规则

- 所有 Effect 必须返回完整清理函数；Activity 隐藏时会执行清理，显示时重新建立。
- `usePageActive()`用于视频、音频、iframe、ECharts、焦点、Portal 等 DOM 型副作用，并提供重新激活通知。
- antd 下拉层优先通过 `getPopupContainer`挂到当前页面容器；无法局部挂载的 Modal/notification 在页面隐藏前必须关闭。
- 每个 Activity 页面拥有独立滚动容器，滚动发生在该容器而不是共享内容外壳，才能自然保留 `scrollTop`。
- ECharts 在隐藏时暂停 resize 监听，重新激活后必须调用 `resize()`；主题变化时只标记重建，激活页立即重建，隐藏页在下次激活重建。
- StrictMode 在开发与测试环境保持开启，用于暴露不完整的 Effect 清理。

### 9.3 页签交互

- 右键菜单：刷新当前、关闭其他、关闭右侧、关闭全部；批量关闭永不影响 affix。
- 刷新当前：递增缓存 `revision`，取消该 scope 请求并用新 React key 重建；业务数据随组件重新挂载重新请求。
- 固定页签排在最前且不可关闭。普通页签不能拖入固定区，固定页签不能拖出固定区。
- dnd-kit 同时提供键盘拖拽；无法拖拽时可用右键菜单完成关闭操作。
- 关闭当前页：优先激活右侧最近页签；没有右侧则激活左侧最近页签；都没有则 `/dashboard`。
- 关闭全部：只保留 affix Dashboard 并激活它。
- 浏览器刷新后重建为「Dashboard + 当前可生成页签的页面」；当前即 Dashboard 时只保留一个。错误页和 `hideInTabs`页面不加入。
- 溢出时横向滚动 + 左右箭头，激活页自动进入可视区。
- tabs 不跨会话持久化。

---

## 10. 主题与界面设置

### 10.1 设置项

| 设置项 | 取值 | 实现 |
| --- | --- | --- |
| 主题模式 | 亮 / 暗 / 跟随系统；默认跟随系统 | antd algorithm + `prefers-color-scheme` |
| 主题色 | 至少 6 个预设 + 自定义取色器 | ConfigProvider `colorPrimary` |
| 布局 | 侧边 / 顶部 | BasicLayout 热切换 |
| 面包屑 | 开 / 关 | 条件渲染 |
| 全屏 | 瞬时开关 | Fullscreen API；状态在 app slice |

字体不提供设置项：字体族固定为系统字体栈，基准字号固定 16px（根 rem 基准 html font-size 与 antd fontSize 同值）。

### 10.2 实现规则

- settings 变化实时组装 ConfigProvider theme，无「应用」按钮。
- 自定义组件的颜色只能来自 `theme.useToken()`或 `var(--ant-*)`。
- 颜色字面量只允许出现在 `config/theme.ts`预设、自定义取色结果持久化以及必要的测试夹具；其他 CSS/TSX 出现十六进制、rgb、hsl 色值视为违规。
- 设置 Drawer 分组：主题、布局、界面元素。
- 跟随系统时监听 media query；用户选亮/暗后停止跟随，重新选“跟随系统”才恢复监听结果。
- `index.html`启动镜像必须确保刷新时不出现相反主题底色；允许显示同主题的轻量初始化壳。
- Fullscreen API 不可用或被权限策略拒绝时保持原状态并提示，不写入 settings。

---

## 11. 布局、导航与可访问性

### 11.1 布局

- 侧边布局：Logo + 垂直菜单，可折叠；右侧 Header + TabsBar + 页面缓存区。
- 顶部布局：Logo + 水平菜单 + 用户区；二级以下使用下拉子菜单。
- 两种布局使用同一 menuRoutes，可无刷新切换。
- 内容区通栏，不提供定宽开关。
- 视口 `<768px`时侧边菜单改为 Drawer；顶部布局折叠为菜单按钮，Header 次要操作收入更多菜单。

### 11.2 导航

- 菜单支持任意层级，当前 Data Router match 决定选中项与祖先展开链。
- 面包屑通过 `useMatches()`读取 `handle.meta`；无页面组件的目录不可点击。
- Header 包含：折叠/菜单按钮、面包屑、全局进度、全屏、语言、主题快捷切换、用户菜单和设置入口。

### 11.3 可访问性

- 键盘可到达菜单、页签、Drawer、右键菜单的等价触发按钮和所有表单操作。
- 当前页签使用正确 `aria-selected`，关闭按钮有包含页签名的可访问名称。
- 焦点在页签关闭后移动到新激活页签；页面切换后焦点进入页面主标题或主容器。
- 文字和交互控件达到 WCAG 2.1 AA 对比度；自定义主题色需校验可读性。
- 尊重 `prefers-reduced-motion`，关闭非必要过渡动画。

---

## 12. 多语言

- 语言固定为 zh-CN（默认）/ en-US。首次按规范化后的 `navigator.language`选择；持久化设置优先。`zh-*`映射 zh-CN，其他未支持语言回 zh-CN。
- key 即中文文案：`keySeparator: false`、`nsSeparator: false`。zh-CN 不维护资源文件，缺失 key 返回 key 本身。
- “无硬编码文案”的验收定义为：所有用户可见的静态文案必须通过 `t()`或 `<Trans>`；中文 key 出现在调用参数中是允许且预期的。
- `common`和 `menu`为基础命名空间；路由通过 `meta.i18nNamespaces`声明额外命名空间。
- 首次进入英文页面前，预加载 common、menu 和目标路由命名空间；加载完成后一次性显示页面。
- 切换语言前，先加载 common、menu 与所有已打开页签声明命名空间的并集，再调用 `changeLanguage`，避免缓存页签出现半中文半英文。
- 以后进入未加载模块时先显示 PageLoading，加载完成后渲染；这一定义才称为“按模块加载”。
- 同一中文短语的语境差异使用固定 context 名，如 `button/title/status`；资源 key 为 `<中文 key>_<context>`。
- 复数使用 `_one/_other`；插值变量名保持语义稳定；富文本使用 `<Trans>`。
- 切换语言同时切换 antd locale、dayjs locale、`document.documentElement.lang`和当前页面 `document.title`。
- 已知 API `errorCode`由前端本地化；未知后端 message 不承诺已翻译。用户数据、用户名和自定义菜单数据不翻译。

---

## 13. 演示模式

### 13.1 构建模式

`VITE_DEMO_MODE`不是布尔值，固定为：

- `off`：不允许 demo；构建时不得包含 demo chunk、账号和假数据。
- `force`：所有受支持请求直接走 demo adapter。
- `fallback`：先请求真实登录；仅网络级失败时提示并切换 demo，再重放一次登录。业务错误不切换。

开发环境默认 `fallback`，生产示例部署可用 `force`，真实生产默认 `off`。

### 13.2 会话与 adapter

- demo 提供 `admin`、`viewer`两个账号，密码任意；权限严格符合 §5.3。
- 登录 API 服务负责 fallback：真实 adapter 网络失败后 dispatch `sessionSource = demo`，再以 demo adapter 重试一次。普通响应拦截器不得隐式切 adapter。
- `sessionSource`随双 token 持久化。刷新页面后，首个 profile 请求之前已恢复来源，因此 demo 会话继续走 demo adapter。
- demo refresh endpoint 支持 token 过期和旋转，以便验证 401 single-flight；可通过测试专用控制器令 access/refresh token 失效。
- CRUD 修改内存数据并同步版本化 localStorage 快照；加载时校验 schemaVersion，损坏或旧版本无法迁移时恢复种子数据并提示。
- 登出清 token、sessionSource 和 demo 数据运行态；settings 保留。是否清 CRUD 快照由登出确认框明确选择，默认保留以便继续演示。
- 页面 Header 显示常驻「演示模式」Badge。

### 13.3 可剔除

- `VITE_DEMO_MODE=off`必须通过静态条件和动态 import 使 Rollup 完全移除 demo 模块。
- README 另提供源码移除步骤：删除 `src/demo/`、`src/pages/demo/`和 `src/features/demo/`，再删除 adapter 注册入口、demo 环境变量类型与演示路由定义。
- CI 增加 off 构建检查：产物不包含约定哨兵字符串 `APEX_DEMO_SENTINEL`和 demo 账号数据。

---

## 14. 示例页面与接口契约

### 14.1 核心实体

```ts
/**
 * 所有实体 ID 都是非空字符串，时间统一使用带时区的 ISO 8601 字符串。
 * 前端不得假设 ID 可转换为安全整数。
 */
interface User {
  id: string
  username: string
  displayName: string
  email: string
  phone?: string
  status: 'enabled' | 'disabled'
  roleIds: string[]
  createdAt: string
  updatedAt: string
}

/**
 * code 是后端稳定角色标识；builtIn 角色禁止删除和修改 code。
 * permCodes 返回完整权限码集合，不返回半选节点状态。
 */
interface Role {
  id: string
  code: string
  name: string
  description?: string
  status: 'enabled' | 'disabled'
  builtIn: boolean
  permCodes: string[]
  createdAt: string
  updatedAt: string
}

/**
 * 菜单管理页面演示后端菜单数据维护，不动态改变前端静态路由。
 * page 类型可用 routeId 对应静态定义；button 类型只展示权限资源关系。
 */
interface MenuItem {
  id: string
  parentId: string | null
  type: 'directory' | 'page' | 'button'
  name: string
  routeId?: string
  path?: string
  permCode?: string
  sort: number
  visible: boolean
  status: 'enabled' | 'disabled'
  children?: MenuItem[]
}

/**
 * 分页从 1 开始，默认 size 为 10，最大 100。
 * total 是应用过滤条件后的总数，不是当前页条数。
 */
interface PageResult<T> {
  list: T[]
  total: number
  page: number
  size: number
}

/**
 * profile 使用角色 code 判定 admin，避免把完整角色管理字段耦合到认证接口。
 * permissionVersion 每次权限集合变化时都必须变化。
 */
interface ProfileData {
  user: User
  roleCodes: string[]
  permCodes: string[]
  permissionVersion: string
}

/**
 * 权限树节点 key 全局唯一；只有叶子节点必须提供 permCode。
 * checked 状态由 Role.permCodes 推导，不由接口重复返回。
 */
interface PermissionNode {
  key: string
  title: string
  permCode?: string
  children?: PermissionNode[]
}

/**
 * 图表序列按日期升序，date 使用 YYYY-MM-DD。
 * 所有计数都是非负整数，percent 使用 0 到 100 的数值。
 */
interface DashboardOverview {
  stats: {
    userCount: number
    enabledUserCount: number
    roleCount: number
    todayLoginCount: number
  }
  loginTrend: Array<{ date: string; count: number }>
  userGrowth: Array<{ date: string; count: number }>
  roleDistribution: Array<{ roleName: string; count: number; percent: number }>
}
```

### 14.2 页面

| 页面 | 路由 | 页面权限 | 要点 |
| --- | --- | --- | --- |
| 登录 | `/login` | 公开 | 表单、合法回跳、demo 提示 |
| Dashboard | `/dashboard` | `dashboard:view` | affix、统计卡和三类图表 |
| 用户管理 | `/system/user` | `system:user:list` | 查询、分页、Drawer CRUD、角色分配 |
| 角色管理 | `/system/role` | `system:role:list` | CRUD、权限树 |
| 菜单管理 | `/system/menu` | `system:menu:list` | 树表；明确不改变前端静态路由 |
| 多级菜单 | `/demo/nested/level1/level2/level3` | `demo:nested:view` | 三级导航、面包屑、缓存验证 |
| 个人中心 | `/profile` | 仅登录 | 资料编辑、修改密码 |
| 异常页 | `/403` `/404` `/500` | 仅登录、无 permCode | 守卫/未匹配/错误边界 |

### 14.3 业务接口

分页查询参数统一为：`page=1&size=10&keyword=&sortBy=&sortOrder=asc|desc`。用户列表的 sortBy 白名单为 `username/displayName/status/createdAt`，角色列表为 `code/name/status/createdAt`；未传 sortBy 时统一按 `createdAt desc`。keyword 去除首尾空白后，对用户名/显示名或角色 code/name 做不区分大小写的包含匹配。非法 page、size、sortBy、sortOrder 返回 VALIDATION_FAILED。菜单树不分页，兄弟节点按 `sort asc`、`id asc`稳定排序。

实现时，共享分页默认值/上限由 `src/constants/request.constants.ts`统一定义；各资源的 sortBy 白名单、字段限制和 API endpoint 放在对应 `src/constants/<domain>/<domain>.constants.ts`，页面、feature 组件/Hook、真实 service 和 demo adapter 不得重复写这些字面量。

```
GET    /users                         → PageResult<User>
POST   /users                         → User
PUT    /users/:id                     → User
DELETE /users/:id                     → null
PUT    /users/:id/roles               → User

GET    /roles                         → PageResult<Role>
POST   /roles                         → Role
PUT    /roles/:id                     → Role
DELETE /roles/:id                     → null
PUT    /roles/:id/permissions         → Role

GET    /permissions/tree              → PermissionNode[]
GET    /menus/tree                    → MenuItem[]
POST   /menus                         → MenuItem
PUT    /menus/:id                     → MenuItem
DELETE /menus/:id                     → null

GET    /dashboard/overview            → DashboardOverview
```

上表路径是后端接口契约，不代表允许在调用点内联字符串；`src/constants/<domain>/<domain>.constants.ts`中的 endpoint 是前端唯一实现来源，真实 service 与 `src/demo/adapters/`直接引用。请求/响应 DTO 的权威定义位于 `src/services/<domain>/<name>.service.types.ts`，demo adapter 使用 `import type`引用；`src/demo/`不得导入 `src/pages/`或 `src/features/`中的 UI 实现。

写入契约：

- 创建用户：`{ username, password, displayName, email, phone?, status, roleIds }`。
- 编辑用户：`{ displayName, email, phone?, status }`，不含 username、password、roleIds；密码和角色分别走独立接口。
- 用户名全局唯一且创建后不可修改；email 格式校验；密码最少 8 位且同时含字母和数字。
- 创建角色：`{ code, name, description?, status }`；编辑角色：`{ name, description?, status }`。code 全局唯一且创建后不可修改。
- 分配权限：`{ permCodes: string[] }`；后端验证所有权限码存在。
- 创建/编辑菜单：`{ parentId, type, name, routeId?, path?, permCode?, sort, visible, status }`；directory 不得设置 routeId，page 必须设置可识别的 routeId，button 必须设置 permCode。
- 菜单删除存在子节点时返回 RESOURCE_CONFLICT；角色被用户引用或 builtIn 时禁止删除。
- 用户删除自己、删除最后一个 admin、禁用当前账号均返回 RESOURCE_CONFLICT。

### 14.4 HTTP 与稳定错误码

| HTTP | errorCode | 语义 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 入参错误，details 含字段错误 |
| 401 | `AUTH_INVALID_CREDENTIALS` | 用户名或密码错误，不触发 token 刷新 |
| 401 | `AUTH_ACCESS_EXPIRED` | 仅 accessToken 可刷新失效 |
| 401 | `AUTH_REFRESH_EXPIRED` | refreshToken 失效 |
| 403 | `AUTH_ACCOUNT_DISABLED` | 账号被禁用，清理本地会话 |
| 403 | `AUTH_PERMISSION_CHANGED` | 权限快照变化，需刷新 profile |
| 403 | `AUTH_FORBIDDEN` | 权限未变化的普通拒绝 |
| 404 | `RESOURCE_NOT_FOUND` | 资源不存在 |
| 409 | `RESOURCE_CONFLICT` | 唯一性、引用或状态冲突 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

`VALIDATION_FAILED.details`固定为 `{ fields: Array<{ field: string; message: string }> }`。前端只把已知 field 映射到表单项；未知字段显示页面级错误。

HTTP 401/403 之外即使 envelope 误带同名 errorCode，也不得触发认证状态机。demo adapter 必须使用相同 HTTP/errorCode/envelope 契约。

---

## 15. 图表

- 只从 `echarts/core`导入并注册使用到的 Chart、Component 和 Renderer，禁止 `import * as echarts`。
- `useECharts(ref, option, { active })`负责 init/dispose、ResizeObserver、防抖 resize 和 Activity 恢复。
- 图表颜色读取 antd token；主题切换时激活图表立即重建，隐藏图表标记后延迟到激活重建。
- 容器从 `display:none`恢复后必须在下一 animation frame 调用 resize。
- Dashboard 数据统一来自 `/dashboard/overview`，demo/真实接口形状一致。

---

## 16. 工程化、测试与部署

### 16.1 环境变量

| 变量 | 暴露客户端 | 取值/用途 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 是 | 开发默认 `/api` |
| `VITE_DEMO_MODE` | 是 | `off | force | fallback` |
| `PROXY_TARGET` | 否 | 仅 Vite dev server 代理目标 |

- 提供 `.env.development`、`.env.production`、`.env.example`，不提交 `.env.*.local`。
- Vite config 使用 `loadEnv(mode, process.cwd(), '')`读取 `PROXY_TARGET`，不能改名为 `VITE_PROXY_TARGET`。
- `vite-env.d.ts`启用严格 ImportMetaEnv，所有枚举值在启动时校验；非法值使 dev/build 失败。
- `/api`代理到 PROXY_TARGET，`changeOrigin: true`。

### 16.2 scripts 与提交检查

```
dev         vite
build       tsc -b && vite build
preview     vite preview
check:structure  node scripts/check-structure.mjs
lint        oxlint
typecheck   tsc -b --noEmit
test        vitest run --coverage
test:e2e    playwright test
check       pnpm check:structure && pnpm lint && pnpm typecheck && pnpm test && pnpm build
prepare     husky
```

- `check-structure.mjs`必须扫描源码导入语句和真实文件路径，并在以下任一情况返回非零退出码：存在 `index.tsx`；页面/组件缺少同名文件夹或同名实现文件；路由 `loadPage`目标不在 `src/pages/`；页面入口出现在 `src/features/`；叶子 feature 包含 `components/`、`hooks/`以外的直属目录或文件；feature 任意层级出现 `pages/`、`api/`、`services/`或 `*.service.*`；feature React 组件逃逸到 `components/<Name>/<Name>.tsx`之外；业务请求实现或 DTO 出现在 `src/services/`之外；存在 `../../`及更深父级导入；内部根级导入未使用唯一的 `@/`别名；`src/components/`或 `src/hooks/`反向导入 `src/pages/`或 `src/features/`；service 导入 React UI；不同业务域的 feature 互相穿透导入；导入路径大小写与磁盘不一致。
- 边界例外必须通过精确到文件的 allowlist 记录所有者、原因和清理条件；allowlist 不得使用目录通配符，也不得豁免“feature 只含组件/Hook”“页面只在 pages”“业务请求只在 services”三条硬约束。该脚本自身需有 fixture 测试，每类规则至少包含一个应通过和一个应失败样例。
- lint-staged 对暂存的 TS/TSX 文件运行 `oxlint`，并运行全量 `pnpm check:structure`；两者都不使用 `--fix`，不改写用户代码。
- `tsc -b --noEmit`是全项目引用构建检查，由 pre-commit 或 pre-push 执行，不伪装为“仅检查暂存文件”。
- commit message 使用简体中文。
- CI 固定执行 `pnpm install --frozen-lockfile`、`pnpm check`、`pnpm test:e2e`。

### 16.3 测试

Vitest 覆盖：

- 路由三投影、权限继承、菜单过滤、redirect 同源校验。
- rehydrated/profile single-flight。
- 401 刷新、epoch 防陈旧写回、403 权限刷新、防递归。
- GET key、页面 scope abort、逻辑 loading 计数。
- persist transform/migrate、i18n namespace 预加载、工具函数。
- 顶层分层边界、feature 内容白名单、页面/组件命名、深层相对导入、依赖方向和大小写路径检查 fixture。

`router/`、`services/`、`store/`、`utils/`以及各 feature 的 `hooks/`语句/分支/函数/行覆盖率均不低于 80%。业务组件和页面的关键交互按 §14 与 §19.1 编写同目录测试，不以移动文件规避覆盖率统计。

Playwright 覆盖：登录与回跳、admin/viewer 差异、CRUD、布局切换、语言、主题刷新、多页签缓存/LRU、并发 401、refresh 失效、路由切换取消、错误页和恶意 redirect。

### 16.4 构建与部署

- `base: '/'`，`outDir: dist`；本规格不支持子路径部署。
- manualChunks 拆分 echarts、antd 等大依赖，但以构建分析结果为准，不要求形成循环 chunk。
- 浏览器目标：最近两个稳定版 Chrome/Edge/Firefox，Safari 16.4+；Playwright Chromium 全量，Firefox/WebKit 关键冒烟。
- 每次模板发布在 README 记录实际通过测试的浏览器版本，不能只记录“最近两个版本”的滚动策略。
- 使用 `createBrowserRouter`的生产静态服务器必须把除真实静态资源和 `/api`外的未知 GET 路径重写到 `/index.html`。
- README 提供 Nginx、Apache/通用静态托管的 SPA fallback 示例；没有 fallback 的部署不算验收通过。

---

## 17. 边界情况清单

1. persist 未恢复前 loader 等待，不得先跳登录。
2. 每次整页启动有 token 都重新拉 profile，不复用旧权限快照。
3. profile 网络失败显示可重试错误，不误清 token；401 按状态机处理。
4. 并发 401 只刷新一次；每个请求最多重放一次。
5. refresh 期间登出/切账号，旧结果因 epoch 不匹配被丢弃。
6. 普通 403 不刷新 profile；AUTH_PERMISSION_CHANGED 才刷新且防递归。
7. 权限收窄后立即关闭失权页签，当前页 replace 到 403。
8. demo fallback 后刷新仍保持 demo adapter；off 构建无 demo 代码。
9. 同路由不同 query 的页签分别读取自己的 location/search 和组件状态。
10. hash 变化复用当前页签；search 规范化后决定是否复用。
11. Activity 隐藏会清理 Effect；视频、iframe、Portal 等 DOM 副作用显式暂停/关闭。
12. 页面 scope 隐藏、关闭、淘汰时 abort；全局 profile 不被误杀。
13. LRU 只统计普通缓存，当前页和 affix 不淘汰。
14. 关闭当前页按右、左、Dashboard 的固定顺序跳转。
15. 主题跟随系统实时变化；手动亮/暗不再跟随。
16. 刷新页面不出现相反主题底色。
17. 语言资源加载完成后一次性切换，缺译回退中文。
18. Fullscreen 不可用时提示并保持状态一致。
19. 路由渲染/lazy 错误进入页面 500；事件回调和异步任务错误由调用端捕获，不宣称 ErrorBoundary 能捕获全部错误。
20. 登出后浏览器后退仍由守卫拦截。
21. `https://evil.example`、`//evil.example`、`/\\evil.example`和控制字符 redirect 全部回 Dashboard。
22. localStorage 损坏或迁移失败能继续启动并清理不安全认证数据。
23. 直接刷新深层路由由生产 SPA fallback 返回应用，再由前端匹配。
24. 快速查询/分页时前请求被取消且不覆盖后请求结果。
25. loading 计数经历取消、401、重放后不为负、不永久悬挂。

---

## 18. 非目标（Out of Scope）

- 混合布局、内容定宽开关。
- 页签跨会话持久化。
- Data Router loader/action 承载业务页面数据。
- 普通网络错误自动重试。
- 数据级行/字段权限。
- MSW、vite-plugin-mock。
- Tailwind、Less。
- 原生移动端专项设计。
- 微前端、SSR、服务端组件。
- WebSocket 通知中心。
- 子路径部署和离线 PWA。

---

## 19. 验收标准

### 19.1 功能验收

- [ ] 将 `VITE_DEMO_MODE`设为 `force`后执行 `pnpm dev`，可使用 admin/viewer 任意密码登录；权限差异严格符合 §5.3。
- [ ] 登录 → 合法回跳 → 菜单过滤 → 用户 CRUD/角色分配 → 登出完整走通。
- [ ] `/`固定 replace 到 `/dashboard`；刷新深层路由不先闪到登录页。
- [ ] viewer 可进入用户列表但看不到新增、编辑、删除、分配角色；直达角色/菜单路由进入 403。
- [ ] 亮/暗/跟随系统切换实时生效；刷新时不出现相反主题底色。
- [ ] 所有设置实时生效并按 §8 白名单持久化；Fullscreen 不持久化。
- [ ] 侧边/顶部布局热切换；三级菜单、面包屑和页签选中链一致。
- [ ] `/system/user?id=1`与 `?id=2`可同时打开，分别保持表单状态，并分别读取正确 search params。
- [ ] Activity 隐藏页 Effect 被清理、显示后恢复；视频/Portal/ECharts 不残留异常行为。
- [ ] 普通缓存第 11 个触发 LRU；页签仍在，再激活时状态重置；affix 和当前页不淘汰。
- [ ] 右键四项、固定页签、键盘/鼠标拖拽、确定的关闭后激活顺序均可用。
- [ ] 刷新浏览器后页签为 Dashboard + 当前可生成页签，且无重复 Dashboard。
- [ ] 中英切换前加载所有已打开页签命名空间；全站静态文案经过 i18n，antd/dayjs/html lang/title 同步。
- [ ] access 过期的并发请求只刷新一次并成功重放；refresh 失效只跳登录一次。
- [ ] refresh 期间切换账号不会把旧 token 写回。
- [ ] 普通 403 不刷新 profile；权限变更 403 只刷新一次并立即清失权页签。
- [ ] 重复 GET、页面隐藏和路由切换正确取消请求；全局进度条最终归零。
- [ ] `/403`、不存在路径 404、直接 `/500`和注入渲染错误均有正确结果。
- [ ] 三类恶意外站 redirect 和 `/\\evil.example`均不能离开当前 origin。

### 19.2 工程验收

- [ ] `pnpm check:structure`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm test:e2e`全部通过。
- [ ] 所有页面和组件均为 `<Name>/<Name>.tsx`；源码不存在 `index.tsx`，不存在只有 barrel 而没有具名实现文件的页面/组件目录。
- [ ] `src/features/`的每个叶子业务域只包含 `components/`和 `hooks/`，不存在页面、`api/`、`services/`、service 文件或根部散落的类型/常量/业务实现；组件/Hook 的同目录辅助文件除外。
- [ ] 所有页面入口位于 `src/pages/`，所有 HTTP 基础设施、业务请求和 DTO 位于 `src/services/`；`pages/features/services/types/constants`使用一致的业务域路径。
- [ ] 跨两个以上业务域复用的组件/Hook 已分别提升到 `src/components/`和 `src/hooks/`，共享层不反向依赖 `src/pages/`或 `src/features/`，service 不导入 React UI。
- [ ] 源码不存在 `../../`及更深父级导入；`@/*`在 TypeScript、Vite、Vitest、编辑器和 CI 中解析一致，路径大小写完全匹配。
- [ ] Props/DTO/领域类型均按 §3.4 就近且只有一个权威定义；不存在无所有者的全局类型桶或复制接口。
- [ ] 魔法数字和字符串已按 §3.6 收敛到最小作用域的具名常量；不存在单体全局 `constants.ts`杂物桶。
- [ ] 核心目录覆盖率达到 §16.3 阈值。
- [ ] package.json 声明 engines 与 packageManager，CI 使用 frozen lockfile。
- [ ] Husky/lint-staged 对暂存 TS/TSX 执行 oxlint，并执行全量结构检查；所有钩子只读检查，不主动格式化或修改代码。
- [ ] `VITE_DEMO_MODE=off`构建产物不含 `APEX_DEMO_SENTINEL`、demo 账号或 demo chunk。
- [ ] 按 README 的生产服务器配置直接刷新 `/system/user`仍返回应用并正确路由。
- [ ] Chromium 全量 E2E、Firefox/WebKit 关键冒烟通过。
- [ ] README 包含后端最终鉴权、token XSS 风险、Activity 页面约束、环境变量、demo 模式及 SPA fallback 说明。

---

## 20. 实现前技术闸门

以下验证必须在全面开发前以最小 PoC 完成，并把命令、测试文件和结果追加到本节；全部通过后方可把文档状态改为「已确认」。

1. **独立路由上下文**：用两个 query 页签证明 `CachedRouteView + useRoutes(locationArg)`中的 `useLocation/useSearchParams/useParams`互不串值。
2. **Activity 生命周期**：证明输入状态和滚动位置恢复，Effect 隐藏时清理、显示时重建，关闭/LRU 后真正卸载。
3. **Portal 与 ECharts**：证明下拉层/Modal 不残留，隐藏图表恢复后尺寸正确。
4. **认证启动竞态**：构造延迟 rehydration，证明 loader 等待且不会错误跳登录；并发 profile 只发一次。
5. **demo 刷新**：fallback 登录进入 demo 后整页刷新，证明 profile/CRUD 继续走 demo adapter。

技术闸门结果记录：

- 状态：已确认（2026-08-15，五项闸门全部通过）
- 验证提交：c20b34e（五项闸门 PoC 测试落盘与全量验证，含 src/test/setup.ts 全局接线）；文档回写为独立 docs 提交
- 执行命令：`pnpm exec vitest run src/router src/layouts src/demo`（五个闸门测试文件全部通过，14 个用例，退出码 0）；`pnpm check`（check:structure / oxlint / tsc / 43 个测试 / vite build 全绿，退出码 0）
- 结果摘要：五项闸门 PoC 集中归档于 `src/router/gates/`（闸门验证的是 §4/§9 路由与缓存架构整体，且该目录不受组件同名文件夹约束；全部文件自包含最小 harness——内联最小路由定义、假 persist、假 adapter、stub resize 契约，不引用 src/ 内任何实现，不提前实现业务页面）。逐项结论：

| 闸门 | 测试文件（`src/router/gates/`） | 结论 |
| --- | --- | --- |
| ① 独立路由上下文 | `gate-01-isolated-route-context.test.tsx` | 通过。CachedRouteView + useRoutes(renderRoutes, locationArg) 下，双 query 页签的 useLocation/useSearchParams/useParams 各读各自快照互不串值；外层 Data Router 导航与单页签快照更新均不影响其他缓存实例，不产生重复实例 |
| ② Activity 生命周期 | `gate-02-activity-lifecycle.test.tsx` | 通过。React 19.2 `<Activity>` 隐藏保留受控/非受控输入与滚动容器 scrollTop（DOM 以 display:none 保留），Effect 隐藏清理、显示重建；关闭页签与 LRU 淘汰后 DOM 真正移除，再激活为全新挂载 |
| ③ Portal 与 ECharts | `gate-03-portal-echarts.test.tsx` | 通过。antd 下拉经 getPopupContainer 挂页面容器，随页面隐藏无 body 残留、重显无重复副本；Modal 由宿主隐藏前关闭，隐藏期间无可见残留、重显保持关闭且页面状态保留（实测 Activity 隐藏会移除 body 级 Modal 门户 DOM，重显时以关闭态重挂载，“隐藏前关闭”仍为必需契约）；图表实例跨隐藏/显示保留，隐藏暂停、重激活后在下一 animation frame 以当前容器尺寸 resize（stub 契约断言） |
| ④ 认证启动竞态 | `gate-04-auth-bootstrap-race.test.tsx` | 通过。延迟 rehydration 下父子 loader 并发启动并挂起等待，不误跳登录；token 随恢复出现后 loader 继续等待 profile，profile 完成前不渲染受保护页；并发受保护 loader 经 single-flight 只发一次 profile 请求；无 token 时才跳登录且不发 profile |
| ⑤ demo 刷新延续 | `gate-05-demo-refresh-continuity.test.ts` | 通过。fallback 登录仅在真实 adapter 网络级失败后切 demo 并重放一次，sessionSource 随双 token 持久化；整页刷新后新会话先恢复来源，profile/CRUD 继续走 demo adapter（真实 adapter 刷新后零调用）；真实登录成功不切换 |

环境备注：jsdom 不提供 ResizeObserver，已在 `src/test/setup.ts` 提供无操作最小桩；vitest 未开启 globals，Testing Library 自动清理在 setup 中显式接线。ECharts 断言按闸门约定使用 stub resize 契约实现（真实 useECharts 由后续任务实现并用 SVG renderer 复核）。
