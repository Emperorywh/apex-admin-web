# 按钮级权限接入 — 规格说明

| 项 | 值 |
| --- | --- |
| 文档版本 | v1.1 |
| 日期 | 2026-06-30 |
| 状态 | 评审后修订，待实施 |
| 分支 | v2_dev |
| 关联接口 | 登录成功接口（返回 `data.permissions` 平铺权限码） |
| 前置文档 | [SPEC_menu_permission.md](./SPEC_menu_permission.md)（菜单级权限，已完成） |

---

## 1. 背景与目标

[SPEC_menu_permission.md](./SPEC_menu_permission.md) 已完成**菜单级权限**与**按钮权限基础设施**（`src/hooks/useAccess.ts`），但其 §1 明确「各业务页面按钮的实际接入留后续」——`useAccess` 至今**未在任何业务页面被调用**（全仓 grep `useAccess|hasPerm` 仅命中定义文件与文档）。

此外，`useAccess` 现读的 `initialState.permissions` 是由 `permissionsTree`（树）**前端本地扁平化 + 祖先填充**而来；而登录接口 `data.permissions` 本身已是**平铺权限码数组**，且**已包含全部祖先分组码**（`vehicle:manage` / `map:manage` / `auth:manage` …，见 `src/hooks/acces.json`），是一份可直接用于按钮判定的权威数据，当前被闲置。

> ⚠️ **决策已定（评审 v1.1）**：现状 `initialState.permissions`（树扁平化）已收集全部 BUTTON 码，`useAccess` 对按钮判定功能本就正确，并非「坏掉/不准」。本 SPEC 切换到 `data.permissions`（B1）的收益为**架构解耦**——按钮判定不再依赖为菜单服务的「祖先填充」逻辑，二者职责分离（B2/B3）。**评审确认维持双源不兜底（B3）**：按钮纯以 `data.permissions` 平铺源为准，不与树做运行时交叉兜底。两源（平铺 vs 树）同源由后端保证，是本方案对后端的**硬依赖前提**（见 §13.1）；前端以 dev 期三向一致性告警（§10）作为早期预警，不引入运行时兜底。

**目标**：
1. 将按钮权限数据源切到后端 `data.permissions` 平铺数组（菜单级维持树不动）；
2. 定稿 `useAccess` 终版签名（联合类型约束 + root 短路）；
3. 建立 `PERM_BUTTON` 全量按钮码常量与 `PermButtonCode` 联合类型；
4. 给出按场景的接入规范（独立按钮 / 表格操作列 / 内联控件 / Dropdown / 批量操作 / Canvas 右键菜单 / 弹窗）；
5. 首批接入 **vehicle / map / order-mission** 三大模块的业务页面。

**不在本次范围**：
- ❌ 菜单级数据源切换（仍走 `permissionsTree` 树，见 §4.4）；
- ❌ `auth`（用户/角色管理）及三方设备、系统管理、数据统计、调度中心等页面（后续批次，见 §14）；
- ❌ 后端细粒度按钮码补齐（见 Gap G1/G2）。

---

## 2. 现状分析

### 2.1 `useAccess` 现状（`src/hooks/useAccess.ts`）

```ts
export const useAccess = () => {
  const { initialState } = useModel("@@initialState");
  const username = initialState?.username;
  const isRoot = username === "root";
  const hasPerm = (code: string): boolean => {
    if (isRoot) return true;
    return !!initialState?.permissions?.has(code);   // ← 读的是「树扁平化」集合
  };
  return { hasPerm };
};
```

- 已实现 root 短路 + Set 查询骨架，但 `hasPerm` 参数是无类型 `string`，且查询的 `permissions` 来自树。
- **未被任何页面调用**。

### 2.2 数据流现状（`src/app.tsx` → `getInitialState`）

```
localStorage.accessInfo.permissionsTree（树）
  → flattenPermissionCodes     （收集 MENU+BUTTON 全部 code）
  → expandWithAncestors        （祖先填充，服务菜单级）
  → initialState.permissions   （Set，同时被 access.ts 菜单判定 与 useAccess 按钮判定复用）
```

- `data.permissions`（平铺数组）**未存储、未消费**。

### 2.3 首批页面真实代码结构（已核对）

| 页面 | 文件 | 关键权限点 |
| --- | --- | --- |
| 车辆列表 | `src/pages/VehicleDeploy/VehicleDisplay/index.tsx` | 工具栏「一键操作」Dropdown(`shuttleActions`)、「新增车辆」；操作列「编辑/操作 Dropdown(`vehicleActions`)/删除 Popconfirm」；内联「调度状态 Switch」 |
| 车辆分组 | `src/pages/VehicleDeploy/VehicleGroup/index.tsx` | 新增/编辑/删除分组 |
| 载具类型 | `src/pages/VehicleDeploy/VehicleType/index.tsx` | 新增/编辑/删除载具类型 |
| 地图编辑 | `src/pages/MapThrough/MapNestModify/NestGraph/ContextMenu/index.tsx` | Canvas 右键菜单（`menuItems` 常量驱动，前端 `key` 如 `delete`/`addReverseEdge`） |
| 地图列表/关联/点边组合 | `src/pages/MapThrough/...` | 增删改、上传、版本发布/下载 |
| 任务管理/调度监控/工艺 | `src/pages/OrderRecord`、`Overlook`、`MissionCluster/...` | 创建/检测/操作/复制/重发等 |

> 车辆列表代码核对发现三点（影响接入策略，详见 §7 与 Gap）：
> 1. 「一键操作」调 `allVehicleOperate`（对**全部**车辆操作），**并非基于选中行**的批量——首批不存在「选中态×权限」联动场景。
> 2. `vehicleActions`/`shuttleActions` 的子项（暂停/恢复/充电…）后端**无细粒度码**，仅有 `vehicle-list:operate` / `vehicle-list:batch-operate` 粗粒度码。
> 3. 「调度状态」是表格内 `<Switch>` 控件（对应 `vehicle-list:enable`），隐藏会让该列空，需单独决策（§7.3）。

---

## 3. 决策汇总（访谈结论）

| # | 决策点 | 结论 |
| --- | --- | --- |
| B1 | 按钮数据源 | 改用后端 `data.permissions` 平铺数组，前端不再本地扁平化按钮码 |
| B2 | 菜单数据源 | **维持现状**（`permissionsTree` 树 + 祖先填充），不切换 → 双源并存 |
| B3 | 双源一致性 | 按钮纯以 `data.permissions` 为准，不与树做交叉兜底 |
| B4 | dev 一致性告警 | dev 环境 warn 三个方向：后端有前端无（漂移）/ 前端死码 / 两源不一致（§10，评审 v1.1 扩展） |
| B5 | 接入范围 | 先接核心页分批；首批 = vehicle / map / order-mission |
| B6 | auth 页面 | 未选首批，归后续（§14，建议尽早，权限模块自身最敏感） |
| B7 | 无权限表现 | **按控件语义分**（§7 总原则）：动作触发型（按钮/菜单项/Dropdown 入口/Icon 操作）条件渲染 `&&` 隐藏；状态展示型（Switch 等承载信息的内联控件）`disabled`。不再一刀切「统一隐藏」 |
| B8 | 操作列 | 单项隐藏，**保留空操作列**（不隐藏整列） |
| B9 | 批量操作 | 无权限直接隐藏（权限优先于选中态/全量态） |
| B10 | useAccess API | 仅保留 `hasPerm`，不提供 `hasAnyPerm`/`hasAllPerm`/`filterPerms`，调用方自行组合 |
| B11 | 按钮码常量 | `PERM_BUTTON` 全量常量化（100+ 码） |
| B12 | 类型约束 | `hasPerm(code: PermButtonCode)` 联合类型约束，编译期拦截拼写错误 |
| B13 | 超管短路 | 保留 `username === "root"` 短路（沿用 D5/D14）。**前置约束：后端须保证 `root` 为系统唯一固定超管账号**（不可改名/禁用/出现非 root 用户名的超管）。该判断现存三处（`access.ts:29`、`permission.ts:84`、`useAccess`），已抽 `isRootUser` 工具集中（B17）。若后端无法保证 root 唯一，须改用 level/roles 标识并同步三处 |
| B14 | Canvas 右键菜单 | 组件内 `useAccess` 闭包下发，不在命令式层调 hook |
| B15 | 权限时效 | 下次登录生效（沿用 D11） |
| B16 | 存储 | `data.permissions` 平铺数组随 `accessInfo` 入 localStorage，**存储字段名 `flatPermissions`**（§4.2，B19） |
| B17 | 超管判断集中 | 三处 `username === "root"`（`access.ts:29`、`permission.ts:84`、`useAccess`）抽 `isRootUser(username)` 工具函数集中（§11），未来改超管标识只改一处 |
| B18 | 类型断言规范 | **禁止 `as PermButtonCode` 断言**；新按钮码必须先追加到 `PERM_BUTTON` 常量再使用，`hasPerm` 仅接受 `PermButtonCode`。保证编译期拼写检查（B12）生效 + §10 死码告警全覆盖 |
| B19 | 存储字段命名 | `AccessInfo.permissions: string[]` 改名 `flatPermissions`，消除与 `InitialState.permissions: Set<string>`（菜单码集合，树派生）的同名异义陷阱（§4.2） |

### 3.1 关键 Gap（须评审定夺）

| # | Gap | 影响 | 处置 |
| --- | --- | --- | --- |
| G1 | MapNestModify 右键菜单细粒度操作（删除/添加反向路径/批量删除/创建节点/等距插入/对齐/独占组/交管组）后端**无对应按钮码**，仅有 `map-edit:update`；**且编辑器属性面板/工具栏(ActionLayer)/节点拖拽等其余写入口本批次不控权** | 无法对单个右键项细粒度控权；「只读」实为「右键菜单隐藏」，**非编辑器全局只读**（详见 §7.6） | 暂以 `map-edit:update` 总码控制**右键菜单**（有=右键菜单全开，无=右键菜单整体不渲染）；编辑器其余写入口本批次不控权，留待后端补 `map-edit:*` 细粒度码后逐入口接入（§14） |
| G2 | 车辆列表 `vehicleActions`/`shuttleActions` Dropdown 子操作后端无细粒度码，仅 `vehicle-list:operate`/`batch-operate` | Dropdown 子项无法逐项控权 | Dropdown 整体由粗粒度码控制；隐藏入口即隐藏全部子项 |
| G3 | 后端用户/角色管理码为 `auth:user:*`/`auth:role:*`，前端 `PERM`/`ROOT_ONLY_CODES` 用 `system:user:view`/`system:role:view`；**且后端权限管理顶级为 `auth:manage`，前端 `PERM.ACCESS_MANAGE` 用 `access:manage`**（`src/constants/permission.ts:33`） | code 对不上。**但当前非 root 看不到用户/角色菜单的根本原因是 `ROOT_ONLY_CODES` 强制拦截**（`src/access.ts:38-41`，`SYSTEM_USER_VIEW`/`SYSTEM_ROLE_VIEW` 一律置 false），与 code 是否对齐无关；code 错位的真正影响仅在「将来若放开权限管理给非 root 角色」时才显现 | 属菜单级既有问题（[SPEC_menu_permission](./SPEC_menu_permission.md) 范畴），本 SPEC 仅提醒；按钮侧首批不涉及（auth 在后续批次） |
| G4 | 表格内联 `Switch`（启停）隐藏会让列空 | 状态展示型控件隐藏会丢信息 | §7.3：`Switch` 用 `disabled`（状态展示型分支，§7 总原则）；隐藏整列作未采纳备选 |

---

## 4. 数据架构（双源并存）

### 4.1 数据流

```
登录成功
  │  login API 返回 data.permissions（平铺）+ data.permissionsTree（树）
  ▼
Login/index.tsx
  │  setAccessInfo({ username, token, permissionsTree, flatPermissions })  ← 新增 flatPermissions 字段 (B16/B19)
  │  refresh() → 触发 getInitialState 重算
  ▼
getInitialState (app.tsx)  ← 双源分算
  │  树源：flattenPermissionCodes(tree)【只收 MENU 码】→ expandWithAncestors → initialState.permissions      （菜单用，access.ts 读）
  │  平铺源：new Set(localInfo.flatPermissions)                       → initialState.buttonPermissions （按钮用，useAccess 读）
  ▼
useAccess（按钮判定）：查 buttonPermissions；root 短路
access.ts（菜单判定）：查 permissions（不变）
```

> **两源职责严格分离**（B2/B3）：`permissions` 只服务菜单（access.ts、`getFirstAccessiblePath`），`buttonPermissions` 只服务按钮（useAccess）。互不污染、互不做兜底。

### 4.2 `AccessInfo` 扩展（`src/types/Login/index.d.ts`）

```ts
export interface AccessInfo {
  username?: string;
  token?: string;
  /** 后端权限树（菜单级数据源，原样存储） */
  permissionsTree?: PermissionNode[];
  /**
   * 后端登录返回的平铺权限码数组（按钮级数据源）
   * 来自 data.permissions，含 MENU + BUTTON + 祖先分组码全集
   *
   * 命名说明（B19）：刻意取名 flatPermissions 而非 permissions，
   * 以与 InitialState.permissions: Set<string>（菜单码集合，树派生）区分，
   * 二者同名异义、无派生关系，曾致维护者误读。
   */
  flatPermissions?: string[];
}
```

> `permissions` 是 `string[]`（可序列化），随 `accessInfo` 整体入 localStorage。`Set` 仍在 `getInitialState` 内现算（`Set` 不可序列化），不进存储。

> ✅ **命名歧义已解决（评审 v1.1，B19）**：本字段定名 `flatPermissions`（而非 `permissions`），与 `InitialState.permissions: Set<string>`（菜单码集合，树派生）显式区分——二者无派生关系，原名同名异义易致维护者误把本字段当成 `InitialState.permissions` 的原料。注意区分：**后端返回字段仍为 `data.permissions`**（§4.5 映射 `flatPermissions: res.data.permissions`），仅前端存储字段改名。

> ℹ️ **localStorage 双源存储冗余（评审 v1.1，已论证可接受）**：`permissionsTree`（树）与 `flatPermissions`（平铺）确有重叠——后者是前者派生子集。但二者职责不同：树承载菜单**结构**（层级/图标/排序/path，access.ts 与菜单渲染依赖），平铺承载按钮**判定**（纯 code 集合，useAccess 依赖）。权限码 < 200 条、序列化 < 10KB，远低于 localStorage 上限。完全去冗余（只存一源、前端派生另一源）会引入派生耦合、违背 B2/B3 两源分离原则，**故保留双存、接受冗余**。

### 4.3 `InitialState` 扩展（`src/types/typing.d.ts`）

```ts
declare namespace GlobalTypes {
  interface InitialState {
    // ...原有字段
    /** 菜单权限码集合（树扁平化 + 祖先填充，服务 access.ts 菜单判定） */
    permissions?: Set<string>;
    /**
     * 按钮权限码集合（来自 data.permissions 平铺数组，服务 useAccess 按钮判定）
     * 与 permissions 分离：按钮判定纯以此为准 (B3)
     */
    buttonPermissions?: Set<string>;
  }
}
```

### 4.4 `getInitialState` 改造（`src/app.tsx`）

```ts
// 平铺权限码 → 按钮权限集合（B1）：直接 new Set，不做祖先填充
// 按钮判定与菜单判定解耦，互不影响；读 flatPermissions（B19）
const buttonPermissions = new Set<string>(localInfo?.flatPermissions ?? []);

// 菜单权限集合（维持现状 B2）：树扁平化 + 祖先填充，仅供 access.ts 消费
// 注：flattenPermissionCodes 已收缩为「只收 MENU 码」（按钮源已切走，菜单集合无需 BUTTON 码，职责更清）
const rawCodes = flattenPermissionCodes(localInfo?.permissionsTree);
const permissions = expandWithAncestors(rawCodes);

return {
  // ...原有字段
  permissionsTree: localInfo?.permissionsTree,
  permissions,           // 菜单用（不变，仅含 MENU 码 + 菜单祖先码）
  buttonPermissions,     // 按钮用（新增）
};
```

> 未登录分支（`!username || !token`）提前 return 时，不返回 `buttonPermissions`，`useAccess` 的 `hasPerm` 自然返回 false（root 短路也因无 username 不生效）——全按钮隐藏，符合预期。

### 4.5 登录存储改造（`Login/index.tsx`）

```ts
setAccessInfo({
  username: values.username,
  token: "Bearer " + res?.data?.token,
  permissionsTree: res?.data?.permissionsTree ?? [],
  flatPermissions: res?.data?.permissions ?? [],   // ← 新增 (B16/B19)；后端字段 data.permissions → 前端存储字段 flatPermissions
});
```

> 登出沿用 [SPEC_menu_permission §6.9](./SPEC_menu_permission.md)：`setAccessInfo` 是 ahooks `useLocalStorageState`，**整体替换语义**——`setAccessInfo({ username: "", token: "" })` 会清除 `permissionsTree` 与 `flatPermissions`；token 过期 `removeItem("accessInfo")` 同理。**已核查的其他登出/重启入口**（`ActionsRender` 登出、`UnAccess` 无权限跳转、`VersionControl` 重启/回滚）同样走整体替换、不传 `flatPermissions`，故自动清除、**无需改动**。

---

## 5. `useAccess` Hook 终版（`src/hooks/useAccess.ts`）

```ts
/**
 * @description 按钮级权限判定 Hook（基于 initialState.buttonPermissions）
 *
 * 数据源：后端登录返回的 data.permissions 平铺数组（B1），与菜单级 permissions 集合分离（B2/B3）。
 * - root 用户：短路全权限（B13，沿用 D5/D14）
 * - 普通用户：严格查 buttonPermissions 集合
 *
 * 用法：
 *   const { hasPerm } = useAccess();
 *   {hasPerm(PERM_BUTTON.VEHICLE_LIST_ADD) && <Button>新增车辆</Button>}
 *   <Button onClick={...} hidden={!hasPerm(PERM_BUTTON.VEHICLE_LIST_DELETE)}>...</Button>  // 动作触发型：隐藏（状态展示型如 Switch 用 disabled，见 §7/§7.3）
 */
import { useModel } from "@umijs/max";
import type { PermButtonCode } from "@/constants/permission";

export const useAccess = () => {
  const { initialState } = useModel("@@initialState");
  const isRoot = initialState?.username === "root";

  /**
   * 判断当前用户是否拥有指定按钮权限码
   * @param code 按钮权限码，受 PermButtonCode 联合类型约束（B12），防拼写错误
   * @returns root 短路返回 true；其余按 buttonPermissions 集合判定
   *
   * 规范（B18）：禁止用 `as PermButtonCode` 绕过类型检查。
   *   后端新增按钮码时，必须先追加到 PERM_BUTTON 常量（§6）再引用，
   *   以保证编译期拼写检查生效、且 §10 死码告警能覆盖该码。
   */
  const hasPerm = (code: PermButtonCode): boolean => {
    if (isRoot) return true;
    return !!initialState?.buttonPermissions?.has(code);
  };

  return { hasPerm };
};
```

> **为何不提供批量工具**（B10）：`hasAnyPerm`/`filterPerms` 等会让 API 面膨胀且用法发散；操作列单项隐藏直接 `actions.filter(a => hasPerm(a.code))` 即可（见 §7.2）。保持单一职责、零心智负担。

> **`PermButtonCode` 与新码（B18）**：联合类型约束「前端已收录」的码。**禁止用 `as PermButtonCode` 断言绕过**——后端新增按钮码时，必须先追加到 `PERM_BUTTON` 常量（§6）再引用。这样既保留编译期拼写检查（B12），又使 §10 死码告警能覆盖全部码（`as` 断言的码不在常量里，死码告警本无法覆盖）。

---

## 6. `PERM_BUTTON` 全量常量（`src/constants/permission.ts`）

### 6.1 文件组织与命名规范

在现有 `src/constants/permission.ts`（已含菜单级 `PERM`、`MENU_TREE`）**同文件内**新增 `PERM_BUTTON`，集中维护全部按钮码：

- 命名：`<模块前缀大写>_<动作大写>`，值与后端 `data.permissions` 中 `type: BUTTON` 的 code **逐字一致**。
- 模块前缀取 code 第一段（`vehicle-list` → `VEHICLE_LIST`，`map-version` → `MAP_VERSION`，注意 `map-list` 与 `map-version` 是两个前缀）。
- 多段动作用大写（`batch-operate` → `BATCH_OPERATE`，`upload-dispatcher-map` → `UPLOAD_DISPATCHER_MAP`）。

```ts
/**
 * 按钮权限码常量（全量）
 * 与后端 data.permissions / permissionsTree 中 type=BUTTON 的 code 一一对应
 * useAccess.hasPerm 参数受其派生的 PermButtonCode 联合类型约束 (B11/B12)
 *
 * 维护说明：后端新增按钮时须同步追加此处（dev 一致性告警 §10 会提示）；
 *           前缀命名取 code 第一段，多词用下划线分隔大写。
 */
export const PERM_BUTTON = {
  // 调度监控
  OVERVIEW_MAP_CHECK: "overview:map-check",
  OVERVIEW_ORDER_RECORD_CREATE: "overview:order-record-create",
  OVERVIEW_VEHICLE_OPERATE: "overview:vehicle-operate",
  OVERVIEW_ORDER_RECORD_CHECK: "overview:order-record-check",
  OVERVIEW_ORDER_RECORD_OPERATE: "overview:order-record-operate",
  // 任务管理
  ORDER_RECORD_CREATE: "order-record:create",
  ORDER_RECORD_CHECK: "order-record:check",
  ORDER_RECORD_OPERATE: "order-record:operate",
  // 车辆分组
  VEHICLE_GROUP_ADD: "vehicle-group:add",
  VEHICLE_GROUP_UPDATE: "vehicle-group:update",
  VEHICLE_GROUP_DELETE: "vehicle-group:delete",
  // 车辆列表
  VEHICLE_LIST_ADD: "vehicle-list:add",
  VEHICLE_LIST_UPDATE: "vehicle-list:update",
  VEHICLE_LIST_DELETE: "vehicle-list:delete",
  VEHICLE_LIST_OPERATE: "vehicle-list:operate",
  VEHICLE_LIST_ENABLE: "vehicle-list:enable",
  VEHICLE_LIST_BATCH_OPERATE: "vehicle-list:batch-operate",
  // 载具类型
  CARRIER_ADD: "carrier:add",
  CARRIER_UPDATE: "carrier:update",
  CARRIER_DELETE: "carrier:delete",
  // 地图列表
  MAP_LIST_ADD: "map-list:add",
  MAP_LIST_UPLOAD_DISPATCHER_MAP: "map-list:upload-dispatcher-map",
  MAP_LIST_UPLOAD_VEHICLE_MAP: "map-list:upload-vehicle-map",
  MAP_LIST_UPDATE: "map-list:update",
  MAP_LIST_DELETE: "map-list:delete",
  MAP_LIST_VERSION: "map-list:version",
  // 地图版本（注意前缀为 map-version，独立于 map-list）
  MAP_VERSION_UPDATE: "map-version:update",
  MAP_VERSION_PUBLISH: "map-version:publish",
  MAP_VERSION_DOWNLOAD: "map-version:download",
  // 地图编辑
  MAP_EDIT_UPDATE: "map-edit:update",
  // 地图关联
  CROSS_MAP_ADD: "cross-map:add",
  CROSS_MAP_UPDATE: "cross-map:update",
  CROSS_MAP_DELETE: "cross-map:delete",
  // 多地图点边组合
  POINT_EDGE_COMBINATION_ADD: "point-edge-combination:add",
  POINT_EDGE_COMBINATION_UPDATE: "point-edge-combination:update",
  POINT_EDGE_COMBINATION_DELETE: "point-edge-combination:delete",
  // 调度中心
  DISPATCH_HUB_SAVE: "dispatch-hub:save",
  DISPATCH_HUB_RESET: "dispatch-hub:reset",
  // 三方设备（电梯/自动门/充电桩/交通灯/风淋门，各 add/update/delete/operate）
  DEVICE_ELEVATOR_ADD: "device:elevator:add",
  DEVICE_ELEVATOR_UPDATE: "device:elevator:update",
  DEVICE_ELEVATOR_DELETE: "device:elevator:delete",
  DEVICE_ELEVATOR_OPERATE: "device:elevator:operate",
  DEVICE_AUTO_DOOR_ADD: "device:auto-door:add",
  DEVICE_AUTO_DOOR_UPDATE: "device:auto-door:update",
  DEVICE_AUTO_DOOR_DELETE: "device:auto-door:delete",
  DEVICE_AUTO_DOOR_OPERATE: "device:auto-door:operate",
  DEVICE_CHARGE_PILE_ADD: "device:charge-pile:add",
  DEVICE_CHARGE_PILE_UPDATE: "device:charge-pile:update",
  DEVICE_CHARGE_PILE_DELETE: "device:charge-pile:delete",
  DEVICE_CHARGE_PILE_OPERATE: "device:charge-pile:operate",
  DEVICE_TRAFFIC_LIGHT_ADD: "device:traffic-light:add",
  DEVICE_TRAFFIC_LIGHT_UPDATE: "device:traffic-light:update",
  DEVICE_TRAFFIC_LIGHT_DELETE: "device:traffic-light:delete",
  DEVICE_TRAFFIC_LIGHT_OPERATE: "device:traffic-light:operate",
  DEVICE_AIR_SHOWER_DOOR_ADD: "device:air-shower-door:add",
  DEVICE_AIR_SHOWER_DOOR_UPDATE: "device:air-shower-door:update",
  DEVICE_AIR_SHOWER_DOOR_DELETE: "device:air-shower-door:delete",
  DEVICE_AIR_SHOWER_DOOR_OPERATE: "device:air-shower-door:operate",
  // 三方交管
  TRAFFIC_TRIPARTITE_ADD: "traffic:tripartite:add",
  TRAFFIC_TRIPARTITE_UPDATE: "traffic:tripartite:update",
  TRAFFIC_TRIPARTITE_DELETE: "traffic:tripartite:delete",
  TRAFFIC_TRIPARTITE_CHECK: "traffic:tripartite:check",
  // 任务工艺
  MISSION_FLOW_ADD: "mission-flow:add",
  MISSION_FLOW_UPDATE: "mission-flow:update",
  MISSION_FLOW_DELETE: "mission-flow:delete",
  MISSION_FLOW_COPY: "mission-flow:copy",
  // 工艺管理
  MISSION_TEMPLATE_CREATE: "mission-template:create",
  MISSION_TEMPLATE_RESEND: "mission-template:resend",
  MISSION_TEMPLATE_OPERATE: "mission-template:operate",
  MISSION_TEMPLATE_SUB_OPERATE: "mission-template:sub-operate",
  // 避障模板
  OBSTACLE_AVOIDANCE_ADD: "obstacle-avoidance:add",
  OBSTACLE_AVOIDANCE_UPDATE: "obstacle-avoidance:update",
  OBSTACLE_AVOIDANCE_DELETE: "obstacle-avoidance:delete",
  // 车辆动作
  ACTION_VEHICLE_ADD: "action:vehicle:add",
  ACTION_VEHICLE_UPDATE: "action:vehicle:update",
  ACTION_VEHICLE_DELETE: "action:vehicle:delete",
  // 动作分组
  ACTION_GROUP_ADD: "action-group:add",
  ACTION_GROUP_UPDATE: "action-group:update",
  ACTION_GROUP_DELETE: "action-group:delete",
  // 版本管理
  SYSTEM_VERSION_RESTART: "system:version:restart",
  SYSTEM_VERSION_UPLOAD: "system:version:upload",
  SYSTEM_VERSION_ROLLBACK: "system:version:rollback",
  SYSTEM_VERSION_DOWNLOAD: "system:version:download",
  SYSTEM_VERSION_DELETE: "system:version:delete",
  // 系统日志
  SYSTEM_LOG_DOWNLOAD: "system:log:download",
  // 系统设置
  SYSTEM_SETTING_UPLOAD_NAVBAR: "system:setting:upload-navbar",
  SYSTEM_SETTING_UPLOAD_LOGIN_BG: "system:setting:upload-login-bg",
  SYSTEM_SETTING_UPLOAD_TAB_ICON: "system:setting:upload-tab-icon",
  // 软件信息
  SYSTEM_SOFTWARE_ACTIVATE: "system:software:activate",
  // 数据库备份
  SYSTEM_DATABASE_BACKUP_DOWNLOAD: "system:database-backup:download",
  // 用户管理（后端为 auth:user:*，注意与菜单级 system:user:view 的前缀差异 G3）
  AUTH_USER_ADD: "auth:user:add",
  AUTH_USER_RESET_PASSWORD: "auth:user:resetPassword",
  AUTH_USER_ASSIGN_ROLE: "auth:user:assign-role",
  AUTH_USER_DELETE: "auth:user:delete",
  // 角色管理（后端为 auth:role:*）
  AUTH_ROLE_ADD: "auth:role:add",
  AUTH_ROLE_UPDATE: "auth:role:update",
  AUTH_ROLE_ASSIGN_PERMISSION: "auth:role:assign-permission",
  AUTH_ROLE_DELETE: "auth:role:delete",
} as const;

/** 按钮权限码字面量联合类型（hasPerm 参数约束用，B12） */
export type PermButtonCode = (typeof PERM_BUTTON)[keyof typeof PERM_BUTTON];
```

> **全集来源**：上述清单已对照 `src/hooks/acces.json` 的 `data.permissions` 与 `permissionsTree`（`type: BUTTON` 节点）逐项核对。后端新增按钮时，dev 一致性告警（§10）会提示补录。

---

## 7. 接入规范（按场景）

> 总原则（B7，评审 v1.1 修订）：**按控件语义分**——
> - **动作触发型**（Button、菜单项、Dropdown 入口、Icon 操作等）：无权限**条件渲染隐藏**（`hasPerm(PERM_BUTTON.XXX) &&` 短路，或容器层 filter 数组）；
> - **状态展示型**（Switch、状态 Tag 等承载信息的内联控件）：无权限**`disabled`**（隐藏会让信息列空荡，见 §7.3）。
>
> 不再一刀切「统一隐藏」，Switch 不再是「例外」而是该原则的状态展示型分支。**不封装权限组件**，纯 hook + 函数判断。

### 7.1 独立按钮 / 工具栏

```tsx
const { hasPerm } = useAccess();

<Space>
  {/* 一键操作 Dropdown（粗粒度码，B9/G2）：无权限隐藏整个入口 */}
  {hasPerm(PERM_BUTTON.VEHICLE_LIST_BATCH_OPERATE) && (
    <Dropdown menu={{ items: shuttleActions?.map(...), onClick: onShuttleClick }}>
      <Button type="primary" danger>{t("一键操作")}</Button>
    </Dropdown>
  )}
  {/* 新增车辆：无权限隐藏 */}
  {hasPerm(PERM_BUTTON.VEHICLE_LIST_ADD) && (
    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddVehicle}>
      {t("新增车辆")}
    </Button>
  )}
</Space>
```

### 7.2 表格操作列（单项隐藏，保留空列 B8）

操作列 `render` 内逐项短路；**不**因全空而隐藏整列（B8）。某行所有操作无权限时，该行操作列渲染为空 `Space`，列保留：

```tsx
const { hasPerm } = useAccess();

{
  title: t("操作"),
  key: "action",
  fixed: "right",
  width: 330,
  render: (_, record) => (
    <Space>
      {/* 详情：通常不限权（view 行为），若需控权可挂 vehicle-list:view 类码 */}
      <Button type="link" onClick={() => handleOpenDrawer(record)}>{t("详情")}</Button>
      {hasPerm(PERM_BUTTON.VEHICLE_LIST_UPDATE) && (
        <Button type="primary" onClick={() => handleEditVehicle(record)}>{t("编辑")}</Button>
      )}
      {/* 操作 Dropdown（粗粒度码 G2）：无权限隐藏入口，子项不再细分 */}
      {hasPerm(PERM_BUTTON.VEHICLE_LIST_OPERATE) && (
        <Dropdown menu={{ items: vehicleActions?.map(...), onClick: (e) => onVehicleShuttleClick(e, record) }}>
          <Button type="primary">{t("操作")}</Button>
        </Dropdown>
      )}
      {hasPerm(PERM_BUTTON.VEHICLE_LIST_DELETE) && (
        <Popconfirm ...>
          <Button danger>{t("删除")}</Button>
        </Popconfirm>
      )}
    </Space>
  ),
}
```

> **为何保留空列**（B8 权衡）：隐藏整列需在组件层根据「当前用户在本页是否有任一操作权限」动态过滤 `columns`，逻辑分散且每页都要加；保留空列实现最简、零额外协调。代价是某用户对某行全无权限时会出现空白操作单元格——可接受。若后续产品要求隐藏整列，再抽 `filterActions` 辅助函数统一处理（届时可推翻 B8）。

### 7.3 表格内联控件（Switch 启停，状态展示型 → disabled）

车辆列表「调度状态」是表格内 `<Switch>`（`vehicle-list:enable`），承载「启用/停用」状态信息。`Switch` 隐藏会让该列只剩表头、数据行空荡。按 §7 总原则，**状态展示型控件用 `disabled`**（不再是「统一隐藏」的例外，而是原则的状态展示型分支）：

```tsx
const { hasPerm } = useAccess();
const canEnable = hasPerm(PERM_BUTTON.VEHICLE_LIST_ENABLE);

{
  title: t("调度状态"),
  dataIndex: "dispatchState",
  render: (value, record) => (
    <Switch
      value={value === "ENABLE"}
      disabled={!canEnable}            // ← 内联控件例外：无权限禁用而非隐藏 (G4)
      onChange={() => onDispatchStateChange(record)}
    />
  ),
}
```

> 评审结论（v1.1）：采用 `disabled`（状态展示型分支）。隐藏整列（`columns` 动态过滤）作为未采纳的备选，不再悬置。

### 7.4 Dropdown 子操作（粗粒度码，Gap G2）

`vehicleActions`（行级操作：暂停/恢复/充电…）、`shuttleActions`（一键操作）的**子项后端无细粒度码**。控权只到 Dropdown 入口层（`vehicle-list:operate` / `vehicle-list:batch-operate`）：入口隐藏即全部子项不可见；入口可见则全部子项可用。**不在子项层加 `hasPerm`**（无码可挂）。

> 若需对子项（如「充电」「取消订单」）独立控权，须后端补充细粒度码（§14）。

### 7.5 批量操作 / 全量操作（B9）

车辆列表「一键操作」实为 `allVehicleOperate`（对全部车辆），非选中态批量（§2.3）。无论何种形态，**权限是前置门槛**：

- 无权限 → 入口隐藏（`&&` 短路），不论选中态/全量态；
- 有权限 → 再按业务态（选中行数等）决定 `disabled`。

```tsx
const canBatch = hasPerm(PERM_BUTTON.VEHICLE_LIST_BATCH_OPERATE);
{canBatch && (
  <Button disabled={selectedRowKeys.length === 0} onClick={onBatch}>
    {t("批量操作")}
  </Button>
)}
```

> 首批页面暂无「选中态批量」场景；规范预留，未来新增选中态批量时按此两层判断。

### 7.6 Canvas 右键菜单（B14 / Gap G1）

MapNestModify 右键菜单是 React 组件（`ContextMenu/index.tsx`，`memo`），菜单项由 `menuItems` 常量（`@/constants/mapThrough`）按 `enable` 字段过滤驱动，前端 `key`（`delete`/`addReverseEdge`/`batchDelete`…）**与后端权限码无映射关系**。

**接入方式（B14 闭包下发）**：在 `ContextMenu` 组件内调 `useAccess`，在 `menuItems.filter` 处叠加权限过滤：

```tsx
// src/pages/MapThrough/MapNestModify/NestGraph/ContextMenu/index.tsx
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";

export default memo((props: ContextMneuProps) => {
  const { t } = useI18n();
  const { hasPerm } = useAccess();   // ← 组件内调用，闭包下发

  // ⚠️ canEdit 必须在 useMemo 之外预先计算，并加入依赖数组：
  //    useAccess 每次渲染返回新闭包，若把 hasPerm 调用放进 useMemo 内、
  //    又不在依赖里声明，会触发 react-hooks/exhaustive-deps（项目内为 error），
  //    且权限变更时 useMemo 不会重算。
  //    权限「下次登录生效」(B15)，会话期间稳定，故 canEdit 是稳定布尔值，入依赖无性能顾虑。
  const canEdit = hasPerm(PERM_BUTTON.MAP_EDIT_UPDATE);  // 右键菜单唯一可用码 (G1)

  const { items } = useMemo(() => {
    const items = menuItems.filter(item => {
      if (!canEdit) return false;          // 无编辑权限：右键菜单整体不渲染
      // ...原有 enable 过滤逻辑不变
    });
    // ...原有 children 构造、disabled 逻辑不变
  }, [selectShapes, event?.target?.getType(), exclusiveGroups, trafficGroups, canEdit]);
  // ...
});
```

**关键约束（G1）**：后端在 `map-edit` 下仅有一个按钮码 `map-edit:update`，右键菜单的全部细粒度操作（删除节点/添加反向路径/批量删除/创建节点/等距插入/两点对齐/独占组/交管组）**无独立码**。因此：
- 有 `map-edit:update` → 右键菜单全功能可用；
- 无 `map-edit:update` → 右键菜单整体不出现。

> ✅ **范围已定（评审 v1.1）：仅「右键菜单隐藏」，非编辑器全局只读**。MapNestModify 编辑器除右键菜单外，仍有**属性面板、工具栏（ActionLayer 增删节点/边）、节点拖拽**等写操作入口。**本批次仅对「右键菜单」接入 `map-edit:update`，明确不覆盖其余写入口**——无 `map-edit:update` 的用户仍可经属性面板/工具栏改地图（前端控权在此处不覆盖，最终靠后端接口鉴权兜底，§9）。全文措辞统一为「右键菜单隐藏」，**不再使用「只读模式」**以免高估覆盖范围。若未来产品要求全局只读，需在所有写入口统一挂 `map-edit:update` 或等后端补 `map-edit:*` 细粒度码（§14）。

> **不**为右键项编造「前端专属权限码」——按钮权限必须锚定后端 `data.permissions`，否则脱离数据源、无法被角色分配体系控制。细粒度控权需后端在 `map-edit:view` 下补 `map-edit:node-delete`/`map-edit:reverse-add` 等子码（§14）。

> Overlook（调度监控）的按钮/操作**有对应码**（`overview:order-record-create`/`overview:vehicle-operate` 等），可逐项正常接入，无此 Gap。

### 7.7 弹窗 / 抽屉内按钮

弹窗内提交/操作按钮同样用 `hasPerm` 短路隐藏。触发弹窗的入口按钮（如「新增车辆」）已控权时，弹窗内的「保存/提交」通常不需重复控权（入口不可见则弹窗打不开）。但**从多处入口触发的公共弹窗**（如「分配角色」可从行操作和详情两处进入），弹窗内提交按钮仍应挂权限码（`auth:user:assign-role`），防止某入口漏控权。

---

## 8. 首批页面接入清单（vehicle / map / order-mission）

> 以下为首批页面权限点 ↔ 按钮码映射，供逐页改造参照。每处均按 §7 对应场景接入。

> ⚠️ **实施前需实地核对**：本表权限点基于代码结构推断，**已实地核对的仅有车辆列表（`VehicleDisplay`）与右键菜单（`ContextMenu`），二者均与描述吻合**。**地图版本弹窗内按钮**（`map-version:publish`/`download` 等，挂在版本管理 Modal 内）与 **Overlook（Canvas overlay 工具栏/右键菜单，接入方式与普通页不同）** 在阶段 3/4 动手前须再核对一次按钮真实位置与 DOM 结构，确认场景归类无误。

### 8.1 vehicle 模块

| 页面 | 权限点 | 按钮码 | 场景 |
| --- | --- | --- | --- |
| 车辆分组 (`VehicleGroup`) | 新增分组 | `vehicle-group:add` | §7.1 |
| | 编辑分组 | `vehicle-group:update` | §7.2 |
| | 删除分组 | `vehicle-group:delete` | §7.2 |
| 车辆列表 (`VehicleDisplay`) | 新增车辆 | `vehicle-list:add` | §7.1 |
| | **详情（只读，不控权）** | —（view 行为；后端有 `vehicle-list:view` 但本批次不挂） | §7.2 注 |
| | 编辑车辆 | `vehicle-list:update` | §7.2 |
| | 操作 Dropdown（行级） | `vehicle-list:operate` | §7.2/§7.4 |
| | 删除车辆 | `vehicle-list:delete` | §7.2 |
| | 调度状态 Switch | `vehicle-list:enable` | §7.3（disabled 例外） |
| | 一键操作 Dropdown | `vehicle-list:batch-operate` | §7.1/§7.5 |
| 载具类型 (`VehicleType`) | 新增/编辑/删除载具类型 | `carrier:add`/`update`/`delete` | §7.1/§7.2 |

### 8.2 map 模块

| 页面 | 权限点 | 按钮码 | 场景 |
| --- | --- | --- | --- |
| 地图列表 (`MapList`) | 创建/编辑/删除地图 | `map-list:add`/`update`/`delete` | §7.1/§7.2 |
| | 导入调度/车载地图 | `map-list:upload-dispatcher-map`/`upload-vehicle-map` | §7.1 |
| | 版本管理入口 | `map-list:version` | §7.1 |
| | 编辑/发布/下载版本 | `map-version:update`/`publish`/`download` | §7.2（版本弹窗内） |
| 地图编辑 (`MapNestModify`) | 右键菜单整体 | `map-edit:update` | §7.6（G1，右键菜单隐藏，仅覆盖右键菜单） |
| 地图关联 (`CrossMaps`) | 新增/编辑/删除关联 | `cross-map:add`/`update`/`delete` | §7.1/§7.2 |
| 点边组合 (`PointEdgeCombination`) | 新增/编辑/删除 | `point-edge-combination:add`/`update`/`delete` | §7.1/§7.2 |

### 8.3 order / mission 模块

| 页面 | 权限点 | 按钮码 | 场景 |
| --- | --- | --- | --- |
| 调度监控 (`Overlook`) | 创建任务 | `overview:order-record-create` | §7.1 |
| | 车辆操作（Tooltip overlay Icon：暂停/继续/停车检测/充电检测） | `overview:vehicle-operate` | §7.4 / §7.6（overlay 范式） |
| | 订单检测/操作（OrderList 操作列 Dropdown） | `overview:order-record-check`/`operate` | §7.2 |
| | 路径校验（GraphMenu VerifyConnectModal） | `overview:map-check` | §7.1 |
| 任务管理 (`OrderRecord`) | 创建/检测/操作 | `order-record:create`/`check`/`operate` | §7.1/§7.2 |
| 任务工艺 (`MissionCreate`) | 新增/编辑/删除/复制 | `mission-flow:add`/`update`/`delete`/`copy` | §7.1/§7.2 |
| 工艺管理 (`MissionFlow`) | 创建/重发/操作/子工艺操作 | `mission-template:create`/`resend`/`operate`/`sub-operate` | §7.1/§7.2 |
| 避障模板 (`ObstacleAvoidance`) | 新增/编辑/删除 | `obstacle-avoidance:add`/`update`/`delete` | §7.1/§7.2 |
| 车辆动作 (`AgvAction`) | 新增/编辑/删除 | `action:vehicle:add`/`update`/`delete` | §7.1/§7.2 |
| 动作分组 (`AgvActionGroup`) | 新增/编辑/删除 | `action-group:add`/`update`/`delete` | §7.1/§7.2 |

> ⚠️ **Overlook 接入范式（评审 v1.1 补充，B14）**：Overlook 操作散落在两类位置，**统一用「组件内 `useAccess` 闭包」**（与 §7.6 MapNestModify 右键菜单同范式，无需特殊封装）：
> 1. **底部 PanelTabs 的 Antd 表格**——`OrderList` 操作列 Dropdown「操作」、`VehicleList` 调度状态 Switch，按 §7.1/§7.2/§7.3 接入；
> 2. **Canvas Tooltip overlay 的纯 Icon**——`ForceGraph/Tooltip`（暂停/继续/停车检测/充电检测，`handleShuttleClick`）、`TooltipExtra/TrafficContent`（交管 Popover 内按钮）、`GraphMenu`（路径校验 `VerifyConnectModal`），用 `hasPerm(PERM_BUTTON.XXX) &&` 短路或 filter 数组接入。
>
> ⚠️ **跨页面权限码有意分离（评审 v1.1 确认）**：Overlook 车辆操作用 `overview:vehicle-operate`，车辆列表同类操作（暂停/充电）用 `vehicle-list:operate`——**有意分离**，因「监控场景操作权限」与「车辆管理场景操作权限」独立授权。两码职责不同，**非 bug**；实施时勿试图统一。可能出现「监控页能操作、车辆列表不能」的跨页差异，属设计预期。

---

## 9. 边界与降级策略

| 场景 | 策略 |
| --- | --- |
| root 用户 | `username === "root"` 短路全权限（B13），所有按钮可见 |
| 普通用户 `data.permissions` 为空 | 严格按集合判定 → 全按钮隐藏；菜单侧另按树判定（可能仍有只读菜单） |
| `data.permissions` 未存储（旧 `accessInfo` 无此字段） | `buttonPermissions` 为空 Set → 全按钮隐藏；重新登录写入后恢复 |
| 用户无某按钮码 | 该按钮条件渲染隐藏（B7）；Switch 内联控件 disabled（§7.3） |
| 操作列某行全无权限 | 该行操作列空 `Space`，列保留（B8） |
| Dropdown 子项无细粒度码 | 入口层粗粒度码控权，子项全有或全无（G2） |
| Canvas 右键菜单无细粒度码 | `map-edit:update` 总码控权，无权限=右键菜单隐藏（G1，仅覆盖右键菜单，非全局只读） |
| 后端新增按钮码但 `PERM_BUTTON` 未收录 | dev warn 提示补录（§10）；生产 `hasPerm` 仍按集合真实判定，新码可见（B4） |
| 后端 `data.permissions` 与 `permissionsTree` 不一致 | 按钮纯以平铺为准，不做交叉兜底（B3）；菜单以树为准 |
| 切换用户/重新登录 | 重新写入 `permissions`，`getInitialState` 重算 `buttonPermissions` Set，按钮刷新 |
| token 过期 / 登出 | `accessInfo` 整体清除，`permissions` 一并消失（B15，沿用现状） |
| localStorage 被篡改 | 前端权限仅控可见性，**非安全边界**；后端接口仍按真实权限鉴权 |

> ⚠️ **安全提示**：前端按钮隐藏只是体验层过滤，真正安全边界在后端接口校验。敏感操作务必后端鉴权，不能只靠前端隐藏按钮。

---

## 10. 工程兜底：dev 三向一致性告警（B4，评审 v1.1 扩展）

在 `getInitialState` 中，dev 环境做**三个方向**的一致性校验。因 B3 不做运行时兜底、两源同源靠后端保证，dev 期告警是**唯一早期预警**：

```ts
// src/app.tsx · getInitialState 内（仅 dev 生效）
if (process.env.NODE_ENV === "development") {
  const flatArr = localInfo?.flatPermissions ?? [];
  const flatSet = new Set(flatArr);
  const knownButton = new Set<string>(Object.values(PERM_BUTTON));
  const menuCodes = new Set<string>(Object.values(PERM)); // 菜单码（PERM）

  // ① 后端有、前端 PERM_BUTTON 未收录（漂移）：提示补录常量
  const missingInFront = flatArr.filter(
    (code) => !knownButton.has(code) && !menuCodes.has(code) // 排除菜单码与祖先分组码
  );

  // ② 前端死码：PERM_BUTTON 收录、但后端 data.permissions 已无（后端删码/改名）
  const deadCodes = [...knownButton].filter((code) => !flatSet.has(code));

  // ③ 两源不一致：data.permissions（平铺）vs permissionsTree（树）对同一码结论不同
  //    —— 半残态根因（菜单可见但按钮缺码）。用全集版 flattenPermissionCodes（含 BUTTON）
  const treeAll = flattenPermissionCodes(localInfo?.permissionsTree, true); // includeButtons=true
  const flatOnly = flatArr.filter((code) => !treeAll.has(code));        // 平铺有、树无
  const treeOnly = [...treeAll].filter((code) => !flatSet.has(code));   // 树有、平铺无

  if (missingInFront.length || deadCodes.length || flatOnly.length || treeOnly.length) {
    console.warn(
      `[permission] dev 一致性告警：\n` +
      (missingInFront.length ? `  ① 后端有前端未收录：${missingInFront.join(", ")}\n` : "") +
      (deadCodes.length ? `  ② 前端死码（后端已删/改名）：${deadCodes.join(", ")}\n` : "") +
      (flatOnly.length || treeOnly.length
        ? `  ③ 两源不一致（平铺 vs 树）——半残态风险：平铺独有[${flatOnly.join(", ")}] / 树独有[${treeOnly.join(", ")}]\n`
        : "")
    );
  }
}
```

> **三向校验说明**：
> - ① 漂移：后端新增按钮码但前端 `PERM_BUTTON` 未收录 → 提示补录（保障 IDE 补全/拼写检查）。
> - ② 死码：前端 `PERM_BUTTON` 收录但后端已删除/改名 → 僵尸常量，提示清理。**B18 禁止 as 断言**保证所有码都在常量里，此校验方能全覆盖。
> - ③ 两源不一致：`data.permissions`（平铺）与 `permissionsTree`（树）对同一码结论不同 → 半残态（菜单可见但按钮全隐）的根因，提示后端修数据。比对用「全集」`flattenPermissionCodes(tree, true)`（含 BUTTON），与 §4.4 菜单侧收缩版（默认 `includeButtons=false`）区分。
>
> 生产环境不校验、不拦截：`hasPerm` 始终按 `buttonPermissions` 真实集合判定，后端新码天然生效（B4）。告警仅 dev 期驱动数据/常量同步。

---

## 11. 改动文件清单

| 文件 | 改动类型 | 说明 |
| --- | --- | --- |
| `src/types/Login/index.d.ts` | 修改 | `AccessInfo` 新增 `flatPermissions?: string[]`（§4.2，B19 命名） |
| `src/types/typing.d.ts` | 修改 | `InitialState` 新增 `buttonPermissions?: Set<string>`（§4.3） |
| `src/utils/permission.ts` | 修改 | `flattenPermissionCodes` 收缩为只收 MENU 码（菜单侧默认 `includeButtons=false`）；**新增 `isRootUser(username)` 工具**集中三处超管判断（B17） |
| `src/app.tsx` | 修改 | `getInitialState` 新增 `buttonPermissions` 计算 + dev 三向告警（§4.4/§10） |
| `src/access.ts` | 修改 | `username === "root"` 改用 `isRootUser(username)`（B17，仅换判断调用，菜单级判定逻辑不变） |
| `src/pages/Login/index.tsx` | 修改 | `setAccessInfo` 写入 `flatPermissions`（§4.5） |
| `src/constants/permission.ts` | 修改 | 新增 `PERM_BUTTON` 全量常量 + `PermButtonCode` 类型（§6） |
| `src/hooks/useAccess.ts` | 修改 | 改读 `buttonPermissions`；`hasPerm` 仅接受 `PermButtonCode`、禁 as 断言（§5，B18）；超管判断改用 `isRootUser`（B17） |
| `src/pages/VehicleDeploy/**` | 修改 | 车辆分组/列表/载具类型 接入（§8.1） |
| `src/pages/MapThrough/MapNestModify/NestGraph/ContextMenu/index.tsx` | 修改 | 右键菜单接入 `map-edit:update`（§7.6，仅右键菜单隐藏） |
| `src/pages/MapThrough/MapList/**`、`CrossMaps`、`PointEdgeCombination` | 修改 | 地图模块接入（§8.2） |
| `src/pages/Overlook/**`（PanelTabs、ForceGraph/Tooltip、GraphMenu 等） | 修改 | Overlook 接入（§8.3，组件内 useAccess 闭包，覆盖 PanelTabs 表格 + Canvas overlay） |
| `src/pages/OrderRecord`、`MissionCluster/**` | 修改 | 任务/工艺模块接入（§8.3） |

> 不改动：菜单级判定逻辑（`access.ts` 维持现状 B2，仅 `username==='root'` 换 `isRootUser` 调用）、登出逻辑（沿用现状，`ActionsRender`/`UnAccess`/`VersionControl` 登出点因整体替换语义自动清除 `flatPermissions`，无需改）。

---

## 12. 实施步骤（建议分阶段）

### 阶段 1：基础设施（不影响现有功能）
1. 扩展 `AccessInfo` / `InitialState` 类型（§4.2/§4.3）
2. `Login` 登录写入 `permissions`（§4.5）
3. `getInitialState` 新增 `buttonPermissions` + dev 告警（§4.4/§10）
4. 新增 `PERM_BUTTON` + `PermButtonCode`（§6）
5. 改造 `useAccess` 终版（§5）

### 阶段 2：首批接入（vehicle）
6. 车辆列表：工具栏 / 操作列 / Switch / Dropdown（§8.1，最复杂，先做）
7. 车辆分组、载具类型

### 阶段 3：首批接入（map）
8. MapNestModify 右键菜单（§7.6，G1 右键菜单隐藏，仅覆盖右键菜单）
9. 地图列表（含版本弹窗）、关联、点边组合

### 阶段 4：首批接入（order/mission）
10. 调度监控、任务管理、任务工艺、工艺管理、避障模板、动作管理

### 阶段 5：验证
11. 用 root 账号验证全按钮可见（短路生效）
12. 用受限角色账号验证：首批页面按钮按权限隐藏、Switch disabled、右键菜单整体不渲染
13. 验证 dev 三向一致性告警（手动改 `data.permissions`：加未收录码验 ①漂移、删一码验 ②死码、改树与平铺不一致验 ③两源，看 console.warn）
14. 验证切换用户/重新登录后按钮集合刷新

> 每阶段可独立验证。**Git 操作由用户决定**（CLAUDE.md 规定不主动操作 git）。

---

## 13. 风险与注意事项

1. **双源一致性风险**（B2/B3，**对后端硬依赖**）：按钮用平铺、菜单用树，两源由后端分别维护。若后端只更新其一，可能出现「菜单可见但按钮全隐」（半残态）或反之。**前端不做运行时交叉兜底**，两源同源完全依赖后端保证（均由角色权限派生）——这是本方案对后端的硬依赖前提。dev 期由 §10 ③ 两源一致性告警提供早期预警；生产环境若两源不同步，前端无自愈，须后端保障。

2. **`map-edit:update` 粒度过粗**（G1）：地图编辑器右键菜单的全部操作被一个码笼统控制，无法做到「能编辑节点但不能删」。属后端权限粒度问题，需后端补子码（§14）。**本批次明确仅控右键菜单（§7.6），属性面板/工具栏/拖拽等写入口不控权**——无 `map-edit:update` 的用户仍可经这些入口改地图，靠后端接口鉴权兜底（§9）。全文已统一为「右键菜单隐藏」，勿误解为全局只读。

3. **Dropdown 子操作无细粒度码**（G2）：车辆「操作」「一键操作」的子项（暂停/充电等）无法独立控权。同上，需后端补码。

4. **`auth:*` 与 `system:*` / `access:*` 前缀错位**（G3）：后端用户/角色管理用 `auth:user:*`/`auth:role:*`、顶级用 `auth:manage`，前端 `PERM`/`ROOT_ONLY_CODES` 用 `system:user:view`/`system:role:view`、`PERM.ACCESS_MANAGE` 用 `access:manage`。**非 root 看不到权限管理菜单实为 `ROOT_ONLY_CODES` 拦截所致，非 code 错位**；code 错位影响仅在「放开权限管理给非 root」时才显现。本 SPEC 按钮侧用后端的 `auth:*`（§6），菜单级问题留 [SPEC_menu_permission](./SPEC_menu_permission.md) 修。

5. **`Switch` disabled 已原则化**（G4/§7.3，评审 v1.1）：内联控件用 disabled 而非隐藏，已纳入 §7「按控件语义分」总原则的状态展示型分支，不再是「例外/缺口」。

6. **保留空操作列的视觉问题**（B8）：某用户对某行全无权限时，操作列留白。若产品不可接受，需改为「全空隐藏整列」（推翻 B8，加 `filterActions` 辅助）。

7. **权限仅控可见性，非安全边界**：后端必须独立鉴权（§9）。

8. **`PermButtonCode` 与新码**（B12/B18，评审 v1.1）：联合类型约束已收录码；**禁止 `as PermButtonCode` 断言绕过**——后端新增按钮码必须先追加到 `PERM_BUTTON` 常量再引用，以保证编译期拼写检查生效、且 §10 死码告警全覆盖。

9. **首屏闪烁**：`getInitialState` 异步，完成前 `buttonPermissions` 为空 → 按钮先隐藏；umi 会等 `getInitialState` 完成才渲染路由，页面组件挂载时集合已就绪，故实际无闪烁。root 用户同理（短路依赖 `username`，已就绪）。

---

## 14. 后续工作（不在本次范围）

- [x] **`auth` 用户/角色管理页接入**（B6，2026-06-30 已接入）：`auth:user:*`/`auth:role:*` 按钮码已收录 `PERM_BUTTON`，并已在 `src/pages/AccessManagement` 完成接入。接入点：
  - 用户管理（`UserManagement/index.tsx`）：工具栏「新增用户」`auth:user:add`（§7.1）；操作列「重置密码」`auth:user:resetPassword`、「分配角色」`auth:user:assign-role`、「删除」`auth:user:delete`（§7.2 单项隐藏，叠加原有 `!isRoot` 判断）。
  - 角色管理（`RoleManagement/index.tsx`）：工具栏「新增角色」`auth:role:add`（§7.1）；操作列「编辑」`auth:role:update`、「分配权限」`auth:role:assign-permission`、「删除」`auth:role:delete`（§7.2 单项隐藏）。
  - 弹窗（`UserModal`/`RoleModal`/`RoleAssignModal`/`PermissionModal`）内提交按钮**不重复控权**——入口已控权，且均为单一入口触发（§7.7）。
  - ⚠️ 用户管理「状态」Switch（启用/禁用用户）**本次未接入**：后端 `auth:user` 权限树仅有 add/resetPassword/assign-role/delete 四个按钮码，无状态切换对应码，按「无码不控权」（同 G1/G2）不编造前端专属权限码；后端若补 `auth:user:enable` 类码，按 §7.3 状态展示型用 `disabled` 接入。
  - 仍由 `ROOT_ONLY_CODES` 菜单拦截兜底（非 root 看不到 auth 菜单），按钮控权为「未来放开 auth 给非 root 角色」的前置准备。
  - ✅ G3 前端侧已对齐（2026-06-30）：`PERM` 的 `ACCESS_MANAGE`/`SYSTEM_USER_VIEW`/`SYSTEM_ROLE_VIEW` 已改名 `AUTH_MANAGE`/`AUTH_USER_VIEW`/`AUTH_ROLE_VIEW`，值对齐后端 `auth:manage`/`auth:user:view`/`auth:role:view`（`src/constants/permission.ts` + `.umirc.ts` + `ROOT_ONLY_CODES` + `MENU_TREE` 同步），一并消除 dev 告警 ① 对这三个码的「漂移」告警。[SPEC_menu_permission](./SPEC_menu_permission.md) 示例片段仍有旧 `SYSTEM_*` 残留，待该文档同步。
- [x] **三方设备接入**（`device:*`，2026-06-30 已接入）：5 类设备（电梯/自动门/充电桩/交通灯/风淋门）的 `add`/`update`/`delete`/`operate` 按钮码已收录 `PERM_BUTTON`，并在各设备列表页完成接入。接入点（按 §7 场景）：
  - 电梯（`TriDevice/Elevator_back/index.tsx`）、自动门（`TriDevice/AutoDoor_back/index.tsx`）、风淋门（`TriDevice/AirShowerDoor_back/index.tsx`）：工具栏「新增设备」`device:*:add`（§7.1）；操作列「编辑」`device:*:update`、「删除」`device:*:delete`（§7.2 单项隐藏，保留空列）；「操作项」Dropdown（开关门/呼叫/风淋/清除占用等设备控制）`device:*:operate`（§7.4 粗粒度码，入口隐藏即子项全隐）；「状态」按钮为 view 行为（查询设备状态），不控权。
  - 充电桩（`TriDevice/ChargePile/ModbusChargePile/index.tsx`）：新增/编辑/删除 +「操作」Dropdown（开始/停止充电）`device:charge-pile:operate`；无状态查看按钮。
  - 交通灯（`TriResource/TrafficLights/index.tsx`，⚠️ 位于 `TriResource` 而非 `TriDevice` 目录，路由 `/tri-resource/tri-device/traffic-lights` 指向它）：新增/编辑/删除 +「测试」按钮（发起连通性请求，属设备控制操作）`device:traffic-light:operate`——交通灯无独立 test 码，归入 operate（§7.4，同 G1/G2「无码不控权、不编造前端专属码」）。
  - 各设备 Modal（新增/编辑弹窗）内提交按钮**不重复控权**——入口已控权，且均为单一入口触发（§7.7）。
  - ⚠️ `TriDevice/ConveyorLine`（输送线）无路由、后端无对应权限码，为未启用代码，未接入；`TriDevice` 下 `Elevator`/`AutoDoor`/`AirShowerDoor`（非 `_back` 版）等同为路由未引用的旧版，未接入。实际路由引用的是各 `_back` 版 + `ChargePile/ModbusChargePile` + `TriResource/TrafficLights`。
- [x] **系统管理接入**（`system:*`，2026-06-30 已接入）：版本管理/系统日志/系统设置/软件信息/数据库备份的按钮码已收录 `PERM_BUTTON`，并在 `src/pages/SystemInvolve` 下各页面完成接入。接入点（按 §7 场景）：
  - 版本管理（`VersionControl/index.tsx`）：工具栏「重启程序」`system:version:restart`（§7.1）；操作列「下载」`system:version:download`、「回滚」`system:version:rollback`、「删除」`system:version:delete`（§7.2 单项隐藏，保留空列）；「更新版本包」入口在子组件 `VersionControl/UpdateVersion/index.tsx`，挂 `system:version:upload`（§7.1）；「刷新」为 view 行为不控权。
  - 系统日志（`SystemLog/index.tsx`）：「下载日志」入口在子组件 `SystemLog/SearchForm/index.tsx`，挂 `system:log:download`（§7.1）。
  - 系统设置（`SystemSetting/components/ImageSettings` + `UploadCard`）：三张上传卡片分别挂 `system:setting:upload-navbar`/`upload-login-bg`/`upload-tab-icon`（§7.1）；`SettingItem` 新增 `permCode: PermButtonCode` 字段由父级下发，无权限仅隐藏「上传图片」按钮、预览图保留可见。
  - 软件信息（`SoftwareInformation/index.tsx`）：banner 与空态两处「激活软件」共用 `system:software:activate`（§7.1）；「复制激活码/硬件信息」为 view 行为不控权；激活弹窗确认按钮为单一入口触发，不重复控权（§7.7）。
  - 数据库备份管理（`DatabaseBackupManagement/index.tsx`）：操作列「下载」`system:database-backup:download`（§7.2 单项隐藏）。
  - 操作日志（`OperationLog/index.tsx`）：后端 `system:operation-log` 仅 `:view` 无按钮码，页面无写操作，不控权。
  - ⚠️ `SystemInvolve/UserManagement`/`RoleManagement`/`SystemFile` 未被路由引用（实际权限管理页在 `AccessManagement`），属旧版死代码，未接入。
- [ ] 其余模块接入：数据统计、调度中心。
- [ ] **后端补细粒度码**（G1/G2）：
  - `map-edit` 下补 `map-edit:node-delete`/`map-edit:reverse-add`/`map-edit:batch-delete`/`map-edit:create-node`/`map-edit:insert`/`map-edit:align`/`map-edit:exclusive-group`/`map-edit:traffic-group` 等；
  - `vehicle-list` 下补 `vehicle-list:operate:pause`/`:resume`/`:charge`… 子码，`batch-operate` 同理。
- [ ] **菜单级 `auth:*` vs `system:*` 前缀对齐**（G3）：在 [SPEC_menu_permission](./SPEC_menu_permission.md) 中统一 `PERM`/`ROOT_ONLY_CODES` 为后端的 `auth:*`。
- [ ] 若产品要求「操作列全空隐藏整列」，抽 `filterActions` 辅助并推翻 B8。
- [ ] 权限实时刷新（当前下次登录生效 B15，沿用 D11；未来可考虑重拉接口或 WebSocket 推送）。

---

## 附录 A：与 [SPEC_menu_permission](./SPEC_menu_permission.md) 的衔接

| 维度 | 菜单级（已实现） | 按钮级（本 SPEC） |
| --- | --- | --- |
| 数据源 | `permissionsTree`（树）→ 扁平化 + 祖先填充 | `data.permissions`（平铺数组）→ `new Set` |
| `InitialState` 字段 | `permissions: Set<string>` | `buttonPermissions: Set<string>`（新增） |
| 判定入口 | `access.ts`（umi access 集成，过滤菜单/拦截 URL） | `useAccess().hasPerm`（页面内条件渲染） |
| 超管短路 | `username === "root"`（D5/D14） | 同（B13） |
| 权限时效 | 下次登录（D11） | 同（B15） |
| 码常量 | `PERM`（菜单码，有限） | `PERM_BUTTON`（按钮码，100+，新增） |

> 两者通过同一登录返回（`data.permissions` + `data.permissionsTree`）派生，共用 `accessInfo` 存储、root 短路与时效策略，但**数据源与判定路径完全独立**（B2/B3），互不影响。
