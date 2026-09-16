# 合同：路由、稳定会话宿主与对象页签（T007 交付）

> 消费方：T010（查询 scope）、T011（写入/传输任务层挂载）、T013（草稿/离开）、T015（失效编排）、T017（用户菜单/图片）、T089（全屏返回）、T030/T070（对象详情接入）、T018（授权页接线）。
> 规格依据：SPEC §8—9、§1.2、P41/P42、A04/A06/A09/A16。隔离验证见 `evidence/T007/`。

## 1. 路由元数据（definitions.tsx 唯一来源）

| meta 字段 | 语义 |
| --- | --- |
| `menuCode` | 菜单权限码（旧 PERM 语义，值见 `src/constants/permission.constants.ts`）。菜单过滤、直访鉴权、权限树注入三处共用。两处源遗漏修正：载具类型=`carrier:view`、数据库备份=`system:database-backup:view` |
| `rootOnly` | 特权专属（源 isRootUser：root/administrator）：非 root 菜单隐藏、直访落 P41（对齐源 access.ts ROOT_ONLY） |
| `deferred` | 本轮暂缓模块（over-look / map-nest-modify / record-playback）：保留菜单与权限码，直访/菜单命中显示统一暂缓提示（`src/pages/deferred/DeferredPage`），不加载业务模块 |
| `objectParam` | 对象页签身份参数（order-info=`orderTaskKey`、vehicle-info=`vehicleKey`）；页签 key=pathname+规范 search，兼容旧裸 query，其余参数不参与身份 |
| `public` | 仅登录页：不进会话宿主、无守卫 |
| `hideInTabs+noCache` | 会话内视图切换（全屏/暂缓/404/无权限/软件授权）：不生成页签、不留缓存、隐藏外壳 |

## 2. 守卫（guard.ts）

- 两道启动门：`await persistRehydrated` → `await awaitSessionRestored()`（auth.service 提供的恢复完成门）。**消费方新增守卫/loader 必须同样等待两道门**，否则硬刷新会在恢复完成前误判登录态。
- 顺序：认证（无 identity → 登录页带 redirect）→ `rootOnly`（非 root → /no-permission）→ `menuCode`（祖先填充后判定；暂缓模块同规则，通过后由 DeferredPage 呈现）。
- `createFirstAccessibleLoader()`：受保护根 index 默认入口 = `resolveFirstAccessiblePath(identity)`。
- 登录态判定一律用 falsy（`!auth.identity`），不得 `=== null`（redux-persist 迁移历史曾产生 undefined）。

## 3. 首个有权入口与安全返回（firstAccessible.ts）

- `resolveAccessibleEntry(input)` / `resolveFirstAccessiblePath(input)`：按 definitions 顺序遍历菜单叶子（= 旧 MENU_ROUTE_ORDER 语义），跳过暂缓与 rootOnly（非 root）；无入口落 `/no-permission`，仅持暂缓权限时带 `?scope=deferred-only`（P41 双文案依据，常量 `DEFERRED_ONLY_SCOPE`）。
- 消费方：根 index loader、LoginForm 无回跳兜底、NotFound/ServerError/RouterErrorBoundary/DeferredPage 的返回入口。**不要用静态 FALLBACK_PATH**（`src/constants/route.constants.ts` 已清空）。
- 全屏监控页的专用返回规则（来源记录、排除自身与别名）归 T089 在此基础上实现，不能直接复用本解析。

## 4. 稳定会话宿主（src/layouts/SessionHost）

- 路由装配：`createBrowserRouter([{ element: <SessionHost/>, children: accessRoutes }])`。宿主在**全部受保护路由之上**：全屏/暂缓/404/无权限/软件授权都是同一登录会话内的视图切换，不销毁页签缓存宿主。
- 视图模式：公开路由直接 `<Outlet/>`；`hideInTabs` 叶子（overlay）→ 外壳加 `shellBare`（顶栏/Dock 经插槽隐藏、工作区满幅）+ PageCacheHost `overlayActive`（全部页签 Activity 转入 hidden：DOM/state 保留、Effects 卸载＝查询暂停）；其余叶子按页签同步（tabSynced/激活导航/会话失效跳转/document.title 已随宿主迁移）。
- **T011 挂载点**：SessionHost 内 `<PageCacheHost/>` 之后的注释位（与页签宿主同层级、布局之上），写入/传输任务层挂在此处保证切页签/切布局回执不断。
- 原 `BasicLayout.tsx/.module.css` 已删除；Header/DockMenu/TabsBar/PageCacheHost 等组件仍在 `src/layouts/BasicLayout/components/` 原路径，SessionHost 直接复用。

## 5. 菜单（DockMenu/projections）

- `buildMenuRoutes()`：结构树（含 `menuCode/rootOnly/deferred`），模块级一次生成。
- `filterMenuByPermission(nodes, hasMenu, isRoot)`：渲染期按身份过滤（叶子须持码；rootOnly 非 root 隐藏；空分组整组隐藏）。DockMenu 每次渲染以 `useAuth()` 执行；新增菜单消费方一律复用，不得自建第二份权限过滤。

## 6. 对象页签（objectTab.ts）

- `resolveObjectKey(search, paramName)`：规范参数优先，兼容旧裸 query（无 `=` 单段＝对象 ID）；缺失/非法返回 null。
- `buildObjectTabKey(pathname, search, paramName)`：页签 key=pathname+`?param=encodeURIComponent(key)`；null 时退化为 pathname（稳定复用同一错误页签，页面显示明确错误、不发业务查询）。
- 页签标题后缀（` · <对象ID>`）由 TabsBar 按同一函数渲染；同对象重复打开聚焦已有页签。

## 7. 已验证限制与移交发现

- 全屏监控页进入/别名 replace 的实操作证据未采集（机制同 overlay 已验证）；A16 矩阵归 T089/T093/T106。
- 验证期间两次伪象（rootOnly 未生效、对象页签翻倍）为浏览器缓存 Vite 旧模块 / IAB 裸 query 重写，重启 dev server 后消失；后续卡遇到"改动不生效"先排除缓存再查代码。
- redux-persist 迁移路径曾产生 `identity: undefined`（store.ts migrate 已修为 null）；T015 接失效编排时注意保持 null 哨兵语义。
- T005 合同中"缓存快照已由 redux-persist 还原进 store"的注释与实测存在出入（rehydrate 合并结果在隔离环境曾为 null）；restoreSession 的 detail 核查与 `awaitSessionRestored` 门保证守卫结论正确，T090 真实环境复验时留意缓存快照渲染路径。
