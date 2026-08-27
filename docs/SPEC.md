# Apex Admin Web — 通用后台管理系统模板规格说明

> 标注「已定」的条目来自访谈结论；标注「默认」的条目为访谈未覆盖、按行业惯例选定的默认值。如需变更，必须先修改本文档，不允许实现与文档长期分叉。

---

## 1. 项目概述

一个**通用后台管理系统前端模板**，开箱包含：多语言、Data Router、多页签以及页面状态保活。

设计原则：

- **约定大于配置**：路由定义、i18n 均有统一约定。
- **单一来源**：路由匹配、菜单、面包屑、页签标题和纯渲染路由均由同一静态路由定义派生。
- **分层清晰**：页面入口、业务 UI、请求服务、类型和常量分别归入顶层目录；各层使用一致的业务域路径保持对应关系，`features`只承载业务组件与业务 Hook。

---

## 2. 技术栈与版本基线

| 类别 | 选型 | 约束 |
| --- | --- | --- |
| 运行时 | Node.js `>=22.22.0` | 由 `package.json#engines` 声明；CI 与本地一致 |
| 包管理 | pnpm `11.21.0` | `packageManager` 固定版本；CI 使用 frozen lockfile |
| 框架 | React 19.2 + TypeScript ~6.0 | React 19.2 的 `<Activity>`用于页面保活 |
| 构建 | Vite 8 + @vitejs/plugin-react | 已有基线 |
| UI | antd v6 | CSS Variables 默认模式 + theme algorithm；不使用 v5 patch |
| 静态反馈 | `App.useApp()` | message/Modal/notification 禁止静态调用 |
| 路由 | react-router v8 | Data Router；不安装 `react-router-dom` |
| 状态 | @reduxjs/toolkit + react-redux + redux-persist | 字段级白名单 |
| HTTP | axios | — |
| 国际化 | react-i18next + i18next | 中文文案即 key；命名空间按路由加载 |
| 图标 | lucide-react | 业务菜单/按钮统一使用；antd 内部图标除外 |
| 样式 | CSS Modules + antd token | 禁止 Tailwind/Less |
| 日期 | dayjs | 作为直接依赖安装；不依赖 antd 的传递依赖 |
| 页签拖拽 | dnd-kit（core + sortable） | 支持键盘拖拽替代操作 |
| Lint | oxlint + `tsc -b --noEmit` | 不引入 ESLint/Prettier，不自动改写代码 |
| 提交钩子 | Husky + lint-staged | 只检查，不执行格式化或 `--fix` |

首次安装依赖后必须提交 `pnpm-lock.yaml`。规格中的 major/minor 是兼容边界，实际可复现版本以 lock 文件为准；升级依赖必须单独提交并重新执行全部检查。

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
│   └── App.tsx                           # Provider 组合与 i18n 接线
├── assets/                               # 跨业务域共享的静态资产
│   ├── images/
│   └── icons/
├── components/                           # 跨业务域共享的 React 组件
│   ├── FeedbackBridge/
│   │   └── FeedbackBridge.tsx
│   ├── GlobalProgress/GlobalProgress.tsx
│   ├── PageLoading/PageLoading.tsx
│   ├── RouterErrorBoundary/RouterErrorBoundary.tsx
│   └── RequestScopeProvider/RequestScopeProvider.tsx
├── features/                             # 只允许业务组件与业务 Hook
│   ├── auth/
│   │   ├── components/
│   │   │   └── LoginForm/
│   │   │       └── LoginForm.tsx
│   │   └── hooks/
│   │       └── useLogin.ts
│   ├── dashboard/
│   │   ├── components/
│   │   │   └── OverviewCard/
│   │   │       ├── OverviewCard.tsx
│   │   │       └── OverviewCard.module.css
│   │   └── hooks/
│   │       └── useDashboard.ts
│   ├── profile/
│   │   └── components/
│   │       └── ProfileForm/ProfileForm.tsx
│   └── system/
│       └── user/
│           ├── components/
│           │   └── UserForm/
│           │       ├── UserForm.tsx
│           │       └── UserForm.types.ts
│           └── hooks/
│               └── useUserList.ts
├── pages/                                # 所有页面入口；按业务域分组
│   ├── auth/
│   │   └── Login/
│   │       ├── Login.tsx
│   │       └── Login.module.css
│   ├── dashboard/
│   │   └── Dashboard/Dashboard.tsx
│   ├── profile/
│   │   └── Profile/Profile.tsx
│   ├── system/
│   │   ├── user/User/User.tsx
│   │   ├── role/Role/Role.tsx
│   │   └── menu/Menu/Menu.tsx
│   └── error/
│       ├── Forbidden/Forbidden.tsx
│       ├── NotFound/NotFound.tsx
│       └── ServerError/ServerError.tsx
├── services/                             # 应用服务、HTTP 基础设施、业务请求与请求/响应 DTO
│   ├── request/
│   │   ├── request.ts
│   │   ├── request.types.ts              # 请求基础设施类型
│   │   └── request.constants.ts          # 超时、稳定错误码与请求协议默认值
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
├── hooks/                                # 跨业务域共享且无单一业务所有者的 Hook
│   ├── useAuth.ts
│   ├── usePageActive.ts
│   └── usePageRequest.ts
├── types/                                # 跨页面、组件和 service 的业务域类型；禁止全局 barrel
│   ├── auth/auth.types.ts
│   ├── dashboard/dashboard.types.ts
│   └── system/
│       ├── user/user.types.ts
│       ├── role/role.types.ts
│       └── menu/menu.types.ts
├── constants/                            # 仅收跨层共享的全局常量；其余常量就近放置（§3.6）
│   ├── route.constants.ts                # 稳定回退地址（路由 id/path 唯一来源在 router/definitions.tsx）
│   └── auth/auth.constants.ts            # 登录回跳参数与用户名边界（登录/用户管理共用）
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
│   └── slices/                          # 应用级 tabs/pageCache
├── utils/                               # 仅无业务语义的纯工具
├── styles/globals.css
└── vite-env.d.ts                        # 严格环境变量类型
scripts/
└── check-structure.mjs                  # 目录、命名、导入方向与深层相对路径门禁
```

本规格采用“顶层分层 + 同业务域对齐”，不是把所有实现共置到 feature 的传统 Feature-Based 结构。`auth`、`dashboard`、`profile`、`system/user`等业务域必须在 `features/`、`pages/`、`services/`、`types/`和 `constants/`中使用一致的路径片段；不存在对应内容时不创建空目录。

`src/features/`是业务 UI 复用层，不是业务功能的总根目录。每个叶子 feature 目录只允许出现 `components/`和 `hooks/`；`system/`这类中间分组目录只允许继续包含子业务域。禁止在 feature 根部或其任意层级新增 `pages/`、`api/`、`services/`、`store/`、独立类型文件、独立常量文件及其他业务实现。

### 3.2 分层边界与提升规则（已定）

| 内容 | 唯一默认归属 | 约束 |
| --- | --- | --- |
| 页面入口 | `src/pages/<domain>/<Page>/<Page>.tsx` | 页面目录可共置同名前缀的样式、页面私有类型和常量；业务子组件放入对应 feature |
| 单业务域组件/Hook | `src/features/<domain>/components/`、`src/features/<domain>/hooks/` | feature 只管理这两类实现及其紧邻的样式、类型和常量 |
| 跨业务域共享组件/Hook | `src/components/`、`src/hooks/` | 必须无单一业务所有者，不得反向依赖页面或 feature |
| 应用服务、HTTP 基础设施、业务请求、DTO | `src/services/` | 业务请求按同一业务域路径拆分；禁止在 feature 或页面目录定义 API adapter |
| 跨层业务实体/模型 | `src/types/<domain>/` | 必须有明确业务所有者，不创建无边界 barrel |
| 跨层共享全局常量 | `src/constants/` | 只收多业务域共用的契约，按关注点或业务域拆分；其余常量就近放置（§3.6） |

- 页面文件负责路由入口与业务组件编排，不在 `src/pages/`内建立通用组件库。只被一个页面使用但具有独立 React 组件身份的子组件，仍放入对应 `src/features/<domain>/components/<Name>/`；页面文件夹只共置页面自身的辅助文件。
- 一个业务组件或 Hook 首次只服务单一业务域时放在该域的 feature 内；被两个或以上业务域直接复用时，必须在同一次变更中提升到 `src/components/`或 `src/hooks/`，并移除对原业务域内部状态和 service 的耦合。
- 固定依赖方向为：`router → layouts/pages`、`layouts/pages → features/components/hooks/services/store/types/constants`、`features → components/hooks/services/store/types/constants`、`业务 service → services/request、store、types、constants`。箭头右侧不得反向导入箭头左侧；service 不得导入 React 页面、组件或业务 Hook。
- `src/components/`和 `src/hooks/`不得导入 `src/pages/`或 `src/features/`，也不得直接依赖单一业务域 service。`FeedbackBridge`注册 `src/services/feedback/uiFeedback.ts`是基础设施接线，不属于业务域依赖。
- 不同业务域的 feature 不得穿透导入彼此的组件或 Hook；确需复用时按上一条提升到共享层。跨层共享数据结构引用所有者在 `src/types/<domain>/`中的权威定义，禁止复制接口，也不得把业务实现塞进 `utils/`规避边界。
- 页面/组件私有资产与其实现同目录；跨页面、跨组件复用的静态资产提升到 `src/assets/`。`src/utils/`只接收无业务语义的纯工具，不能成为业务杂物桶。

### 3.3 页面与组件文件夹规则（已定）

- 所有页面和 React 组件都必须由独立文件夹包裹，文件夹名、实现文件名和导出的组件名保持一致，例如 `src/pages/system/user/User/User.tsx`、`src/features/system/user/components/UserForm/UserForm.tsx`。
- 禁止用 `index.tsx`承载页面或组件实现，项目内不得出现 `index.tsx`。即使一个目录当前只有一个实现文件，也必须使用同名文件，不能只创建 `User/index.tsx`。
- `index.ts`只允许作为确有多个稳定公共导出时的纯 barrel，不能包含运行时代码，也不能成为唯一文件；默认直接从具名文件导入，以降低循环依赖和跳转歧义。
- 页面/组件专属样式、类型和常量使用同一前缀并放在该文件夹内，例如 `User.module.css`、`User.types.ts`和 `User.constants.ts`。
- 页面入口只能位于 `src/pages/`；业务 React 组件只能位于对应 `src/features/<domain>/components/`或跨业务域共享的 `src/components/`。`layouts/`和 `App/`是应用外壳组件的明确例外，但仍必须遵循同名文件夹规则。
- `main.tsx`、路由定义、配置、纯函数和 Hook 不属于页面/组件命名规则；若 Hook 自身拆出多个强相关文件，可使用 `useXxx/`文件夹并保持同名。`App`是 React 组件，必须遵循 `App/App.tsx`。

### 3.4 Types 就近管理（已定）

- 只被一个页面或组件使用的 Props、状态和内部模型，写在实现文件内或同目录 `<Name>.types.ts`；不允许为单一消费者创建全局类型。
- HTTP 请求/响应 DTO 放在对应 `src/services/<domain>/<name>.service.types.ts`；同一业务域中被页面、组件和 service 跨层共享的实体或 ViewModel 放在 `src/types/<domain>/<domain>.types.ts`。
- 与业务领域无关的基础设施类型放在基础设施旁，例如 `src/services/request/request.types.ts`和 `src/router/router.types.ts`。`src/types/`必须按业务域分目录，禁止创建笼统的 `src/types/index.ts`。
- 每个类型只能有一个权威定义。调用端使用 `import type`引用，不复制“长得一样”的接口；服务端 DTO 与页面 ViewModel 语义不同时必须显式转换并分别命名。
- 类型文件必须按业务语义命名，禁止 `types.ts`、`common.ts`、`model.ts`这类无法表达所有权的类型桶。`src/features/<domain>/`根部不得出现类型文件；组件或 Hook 的私有类型只能与该实现紧邻共置。

### 3.5 路径别名与导入规则（已定）

- 唯一路径别名固定为 `@/*` → `src/*`。TypeScript `compilerOptions.paths`、Vite `resolve.alias` 和编辑器解析必须指向同一绝对目录；任一环境无法解析都视为配置失败。
- `tsconfig.app.json`固定设置 `paths: { "@/*": ["./src/*"] }`（相对 tsconfig 所在目录解析；TS 6.0 起 `baseUrl` 已弃用，不再设置）；Vite 的 alias key 使用 `@`，目标通过 `fileURLToPath(new URL('./src', import.meta.url))`解析，禁止依赖当前工作目录。
- 同一文件夹内使用 `./`相对导入；仅允许一次 `../`访问直接父级的共置文件。出现 `../../`或更深父级导入即检查失败，必须改用 `@/`绝对别名。
- 项目源码的根级绝对导入必须以 `@/`开头，禁止 `src/...`、`features/...`等伪绝对路径，也禁止新增 `@components`、`@features`等第二套别名；第三方包名不受此条影响。
- 跨顶层目录、业务域内跨子目录以及路由 lazy import 均使用 `@/`；禁止通过 barrel 或路径拼接隐藏跨层、跨业务域的越界依赖。
- 文件名和路径大小写必须与磁盘完全一致，CI 在大小写敏感环境再次检查，避免 Windows 本地通过而 Linux 构建失败。

### 3.6 Constants 常量管理（已定）

- 有业务或配置语义的魔法数字和字符串不得散落在实现中。请求超时、缓存容量、分页默认值、Storage key、路由 ID/路径、错误码、状态值、日期格式、正则、长度限制和 API endpoint 等必须使用具名常量。
- `src/constants/`只收被多个业务域跨层共享的全局常量（路由回退地址、认证边界契约等），按关注点或业务域拆分。其余常量一律放到离调用最近的地方：单一消费者写在实现文件顶部，同目录多文件共享放同目录 `<Name>.constants.ts`，请求协议常量（超时、错误码、endpoint、分页默认值）放 `src/services/`对应目录，存储 key 与持久化版本放对应基础设施（store、i18n）旁。
- `src/features/<domain>/`根部不得放常量；组件/Hook 私有常量与实现紧邻共置。跨层共享的边界值（如用户名长度）放 `src/constants/<domain>/`，不得在多个 feature 各复制一份。
- 常量必须遵循最小可见范围，不能为了“统一”把所有值堆入一个 `constants.ts`。跨层移动常量时更新唯一所有者。
- 基础常量使用 `UPPER_SNAKE_CASE`；成组枚举值使用 `as const`对象并从其值推导联合类型，避免另写一份可能漂移的字符串联合。
- 用户可见静态文案仍按 §6 通过 i18n 管理，不复制到 constants；主题色、间距和断点优先使用 antd token/CSS 自定义属性；协议规定的空字符串以及无业务语义的 `0`、`1`可直接使用，但一旦参与业务判断必须命名。
- 代码评审必须拒绝无名称、无法说明来源的字面量；新增常量时在名称或相邻多行简体中文注释中解释单位、边界和用途，尤其是毫秒、容量和版本号。

跨层共享常量与协议常量的所有权固定如下，禁止在多个文件重复定义：

| 文件 | 唯一负责内容 |
| --- | --- |
| `src/constants/route.constants.ts` | 错误页与登录的稳定回退地址 `FALLBACK_PATH` |
| `src/constants/auth/auth.constants.ts` | 登录回跳参数名、用户名长度边界 |
| `src/services/request/request.constants.ts` | 请求超时、稳定错误码、API 基础路径、分页默认页大小 |

---

## 4. 路由体系

### 4.1 单一路由定义与三投影（已定）

`router/definitions.tsx` 中的 `AppRouteDefinition[]` 是唯一来源，每个节点必须有稳定且全局唯一的 `id`。它生成三份只读投影：

1. **accessRoutes**：全量注册给 `createBrowserRouter`。负责 URL 匹配、认证 loader、重定向和路由级错误；业务叶子节点只返回空锚点，不能直接渲染业务页。
2. **renderRoutes**：不包含 loader/action，仅包含目录结构和 `React.lazy` 页面组件。`CachedRouteView` 使用 `useRoutes(renderRoutes, locationSnapshot)`渲染，从而让每个缓存页签获得自己的 `useLocation/useParams/useSearchParams`上下文。
3. **menuRoutes**：按 `hideInMenu`过滤，供侧边菜单、顶部菜单和快捷入口使用。

三份投影和其中的 lazy component 都在模块初始化时只生成一次并保持引用稳定；不能在 `PageCacheHost`每次渲染时重建。列表中的每个页签由独立 `CachedRouteView`组件调用一次 `useRoutes`，禁止在循环体内直接调用 hook。

`BasicLayout`在受保护根路由内只挂载一次。它根据 Data Router 当前 location/matches 更新 tabs，再由持久存在的 `PageCacheHost`渲染所有缓存页。禁止缓存 `<Outlet/>`返回值。

Data Router loader 只做认证校验和重定向，不承载业务页面数据。业务页统一通过 service 层获取数据。`renderRoutes`不参与 Data Router 数据 API，因此页面禁止使用 `useLoaderData`、`useRouteLoaderData`、`useFetcher`、route action 和 `useRevalidator`；oxlint 通过受限导入规则检查这些命名导入。

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
  children?: readonly AppRouteDefinition[]
}

/**
 * meta 会原样映射到 Data Router 的 handle.meta。
 * 菜单、面包屑和页签只能从 handle.meta 或原始定义读取，不维护副本。
 */
interface RouteMeta {
  title: string
  icon?: LucideIcon
  hideInMenu?: boolean
  hideInTabs?: boolean
  affixTab?: boolean
  noCache?: boolean
  breadcrumb?: boolean
  tabKeyMode?: 'fullPath' | 'pathname'
  i18nNamespaces?: readonly string[]
}
```

约定：

- `meta`投影为 `handle: { meta }`，面包屑使用 Data Router 的 `useMatches()`读取。
- 目录节点允许无 `loadPage`，只参与匹配、菜单和面包屑。
- 叶子页面必须有 `loadPage`，由 `React.lazy` + `<Suspense fallback={<PageLoading />}>`加载。
- `loadPage`必须通过 `@/pages/system/user/User/User`这类具名实现路径导入，禁止从 `features`加载页面、导入页面目录或依赖 `index.ts/index.tsx`解析；路由 id 与 path 的唯一来源是 definitions.tsx 树节点：顶层节点用绝对路径（以 `/` 开头），子节点用相对段，新增页面只需在树中加一个节点。`ROUTE_IDS`、`ROUTE_PATHS`（均按 id 索引）与 `RouteId` 联合类型由树在模块初始化时推导并校验 id 全局唯一，禁止手写路由表副本；`src/constants/route.constants.ts` 仅保留 components/features 等不可依赖 router 层的模块使用的 `FALLBACK_PATH`。
- `breadcrumb`默认 true；`hideInTabs`用于登录、错误页和不应生成页签的辅助路由。
- `/`是受保护 index route，固定 `replace`重定向到 `/dashboard`。
- 受保护根路由内的 `*`渲染 404。
- `/500`需要登录。
- `/404`既有可直达的显式路由，受保护根路由的 `*`也渲染同一组件；登录、404、500 固定设置 `hideInMenu/hideInTabs/noCache`，错误页 `breadcrumb: false`。
- Dashboard 固定 `affixTab: true`，且是唯一默认 affix。
- 页面渲染错误由每个缓存实例外层 `PageErrorBoundary`显示 500 内容；guard/loader 错误由 Data Router 配置的 `RouterErrorBoundary`处理。

### 4.3 菜单过滤

- 目录菜单只有在至少有一个可见子节点时保留。
- `hideInMenu: true`隐藏该节点及其菜单子树，但不改变 URL 可访问性；详情页应单独设为隐藏叶子节点，不把可见菜单放在隐藏目录下。

### 4.4 页签 key 与 location 快照

- 默认 `tabKeyMode: 'fullPath'`：key 为规范化 `pathname + search`，不含 hash。
- search 使用 `URLSearchParams.sort()`按参数名稳定排序；同名重复参数保持原顺序。
- hash 变化不创建新页签，只更新当前页签的 location 快照。
- `tabKeyMode: 'pathname'`用于查询参数只表示筛选条件、不希望产生多个页签的页面。
- 每个页签保存不可变的 location 快照；导航到同 key 时替换该页签快照并激活，不创建第二个缓存实例。
- location 快照只保存可序列化的 `pathname/search/hash/key`，`state`固定为 null；模板业务导航禁止依赖 `location.state`传递数据，应使用 URL 参数或业务 store。
- 页面通过其独立纯渲染路由上下文读取 location，不直接读取全局 tabs store 推断参数。

---

## 5. 多页签与页面保活

### 5.1 Activity 缓存架构（已定）

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

### 5.2 隐藏页面副作用与 DOM 规则

- 所有 Effect 必须返回完整清理函数；Activity 隐藏时会执行清理，显示时重新建立。
- `usePageActive()`用于视频、音频、iframe、焦点、Portal 等 DOM 型副作用，并提供重新激活通知。
- antd 下拉层优先通过 `getPopupContainer`挂到当前页面容器；无法局部挂载的 Modal/notification 在页面隐藏前必须关闭。
- 每个 Activity 页面拥有独立滚动容器，滚动发生在该容器而不是共享内容外壳，才能自然保留 `scrollTop`。
- StrictMode 在开发环境保持开启，用于暴露不完整的 Effect 清理。

### 5.3 页签交互

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

## 6. 多语言

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
