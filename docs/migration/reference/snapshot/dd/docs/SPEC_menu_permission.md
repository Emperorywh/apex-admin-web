# 菜单权限动态渲染 — 规格说明

| 项 | 值 |
| --- | --- |
| 文档版本 | v1.1（评审修订版） |
| 日期 | 2026-06-29 |
| 状态 | 已纳入评审修订 |
| 分支 | v2_dev |
| 关联接口 | 登录成功接口（返回 `permissionsTree`） |

---

## 1. 背景与目标

登录成功接口现已返回 `permissionsTree`（菜单 + 按钮权限树），但前端**完全未使用**：现有权限是 `src/access.ts` 中基于 `username` 的三级硬编码（`root` / `rootAdmin` / `rootAdminUser`），无法做到「按角色细粒度控制菜单可见性」。

**目标**：基于后端 `permissionsTree`，实现菜单的动态渲染 —— 不同角色登录后，仅看到其拥有权限的菜单；未授权菜单不可见、URL 直接访问被拦截。

**本次范围**：
- ✅ 菜单级权限（控制菜单可见性与路由访问）
- ✅ 按钮级权限的**基础设施**（`access` map + `useAccess` / `<Access>` 工具），供页面后续零成本接入
- ❌ 各业务页面按钮的实际接入（后续按需逐页改造，不在本次范围）

---

## 2. 现状分析

### 2.1 现有权限体系

`src/access.ts`：
```ts
const isRoot = username === 'root';
const isAdmin = username === 'admin';
return {
  root: isLogged && isRoot,
  rootAdmin: isLogged && (isRoot || isAdmin),
  rootAdminUser: isLogged,
};
```

- 三级权限，靠 `username` 字符串硬编码判定，与后端角色/权限解耦。
- `.umirc.ts` 每条路由用 `access: "root" | "rootAdmin" | "rootAdminUser"` 拦截。
- 仅区分 root / admin / 普通用户三档，无法表达「某角色只能看调度监控和任务管理」。

### 2.2 登录与存储现状

- `src/pages/Login/index.tsx`：登录成功后 `setAccessInfo({ username, token })` 写入 `localStorage.accessInfo`，硬编码跳转 `/over-look`。
- `src/app.tsx` → `getInitialState`：从 `localStorage.accessInfo` 同步读取 `{ username, token }`。
- `src/components/ActionsRender/index.tsx` → `handleLoginOut`：登出时 `setAccessInfo({ username: "", token: "" })`。
- `permissionsTree` 目前**未存储、未消费**。

### 2.3 路由现状

`.umirc.ts` 为静态路由，`layout: "mix"`（顶部一级 + 侧边多级）。**菜单层级口径**：前端可点击菜单最深 **3 层**（如 `三方资源 → 三方设备 → 电梯`）；后端 `permissionsTree` 最深 **4 层**（末层为按钮节点，如 `… → 电梯 → [按钮]`），二者计数口径不同，下文涉及层级时统一以此说明为准。已有 `unAccessible: <UnAccess />` 与 `access: {}` 空配置。

---

## 3. 后端数据契约

### 3.1 登录返回结构（节选）

```jsonc
{
  "data": {
    "token": "...",
    "activated": true,
    "user": { "id": 2, "username": "root", "state": "ENABLED", "level": 2 },
    "roles": ["user_1"],
    "permissions": [],            // 扁平权限码列表（本次不用）
    "permissionsTree": [ /* 权限树，见下 */ ]
  }
}
```

### 3.2 permissionsTree 节点结构

```ts
interface PermissionNode {
  id: number;
  code: string;            // 权限码，唯一标识，如 "overview:view"
  name: string;            // 中文名，如 "调度监控"
  type: "MENU" | "BUTTON";
  parentCode: string;      // 父节点 code，顶级为 ""
  path: string;            // 前端路由路径（分组节点为空 ""）
  icon: string;            // 图标名（仅顶级节点有值）
  sort: number;            // 排序值
  state: "ENABLED" | ...;
  childPermissions: PermissionNode[] | null;
}
```

### 3.3 关键观察

1. `type` 区分 `MENU`（菜单）与 `BUTTON`（按钮）。本次菜单渲染只关心 `MENU`，但扁平化收集 code 时两类都要收（按钮基础设施需要）。
2. `path` 为空的 `MENU` 是**纯分组节点**（如 `vehicle:manage` 车辆管理），仅作层级容器，不对应可访问页面。
3. 后端 `permissionsTree` 最深 **4 层**：`三方资源(third-party:manage) → 三方设备(third-party-device:manage) → 电梯(device:elevator:view) → [按钮]`。其中末层（按钮）不渲染为菜单，故前端可见菜单仍是 **3 层**。
4. root 用户 `permissions: []` 但 `permissionsTree` 为全集 —— 以 `permissionsTree` 为准。

### 3.4 权限树祖先完整性契约（重要）

前端菜单可见性依赖一个**后端契约**，须由后端保证并在评审中确认：

> **若某角色拥有一个子菜单/按钮权限，则其全部祖先分组（`type: MENU`、`path` 为空的节点）必须一并出现在该角色的 `permissionsTree` 中。**

这是树形返回的自然结果（节点通过 `parentCode` 串成树，子节点存在则其到根的路径节点都在），但需后端在「按角色权限 id 组装树」时不要漏掉中间祖先。

**前置背景**：仓库内 `RoleManagement/PermissionModal`（角色分配权限弹窗）已实现，其提交逻辑 `collectCheckedPermissionKeys` 会把「选中/半选」的祖先分组 id 一并上送后端 —— 即经此弹窗分配的角色天然满足祖先完整性。但仍可能有**预置角色、直接 DB 配置、历史数据**不满足，因此前端在 §6.4 增加**防御性祖先填充**（`expandWithAncestors`），即便后端断链也能保证「有子菜单则父分组可见」。详见 §6.4 与决策 D15。

---

## 4. 决策汇总（访谈结论）

| # | 决策点 | 结论 |
| --- | --- | --- |
| D1 | 核心架构 | **静态路由 + 菜单过滤**：`.umirc.ts` 路由不变，靠 `access` 字段拦截 + umi access 与 layout 的自动集成过滤菜单 |
| D2 | 权限码关联 | **路由标注 `permissionCode`**：每条路由新增自定义字段，与后端 `code` 匹配，与 `path` 解耦 |
| D3 | 数据存储 | **localStorage**：与 `accessInfo` 同生命周期 |
| D4 | 按钮权限 | **现在搭基础设施**：access map 含按钮码 + `useAccess` / `<Access>` |
| D5 | 超管判定 | **仅 root 短路**：`username === "root"` 直接全权限；普通用户严格按树；树为空则无权限 |
| D6 | 登录跳转 | **动态首个可用菜单**：按路由顺序找首个可访问菜单；全无权限跳提示 |
| D7 | 详情页权限 | **绑定父菜单 code**：`/order-info`→`order-record:view`，`/vehicle-info`→`vehicle-list:view` |
| D8 | 三级 access 去留 | **完全替换**：删除 `root/rootAdmin/rootAdminUser` 作为路由 access，全部改用 permissionCode |
| D9 | 菜单文案/图标 | **前端路由为准**：`name`/`icon` 用 `.umirc.ts` 定义，i18n 走 `t()`；后端仅判可见性 |
| D10 | 菜单排序 | **前端路由书写顺序**：不按 `sort` 重排 |
| D11 | 权限时效 | **下次登录生效**：登出清理权限数据 |
| D12 | 父分组可见性 | **双向联动 + 保留多层**：① 任一子菜单有权限 → 父分组可见（祖先填充 D15）；② 所有子菜单无权限 → 隐藏父分组；保留菜单 3 层嵌套 |
| D13 | 权限码引用 | **常量枚举**：`src/constants/permission.ts` 维护 |
| D14 | 超管判定依据 | `username === "root"`（沿用现状，已验证） |
| D15 | 祖先填充 | **前端防御性补全**：基于全量菜单结构常量 `MENU_TREE`，用户拥有任一后代 code 则补全其全部祖先分组 code，防御后端权限树断链（§3.4 契约的前端兜底） |
| D16 | 首菜单来源 | **前端维护有序清单**：`getFirstAccessiblePath` 遍历 `MENU_ROUTE_ORDER`（由 `MENU_TREE` 派生），不依赖运行时 `routes` API |

> **D5 与 D8 的关系**：D8「完全替换」指路由 `access` 字段不再用三级 key；但 `username === "root"` 的超管短路逻辑保留在 `access.ts` 内部（D5/D14），不作为路由 access 值暴露。

---

## 5. 总体架构与数据流

```
登录成功
  │  login API 返回 data.permissionsTree
  ▼
Login/index.tsx
  │  setAccessInfo({ username, token, permissionsTree })  ← 扩展存储
  │  refresh() → 触发 getInitialState 重算
  ▼
getInitialState (app.tsx)
  │  从 localStorage 同步读取 permissionsTree
  │  flattenPermissionCodes 扁平化 → expandWithAncestors 祖先填充 (D15)
  │  写入 initialState.permissions / initialState.permissionsTree
  ▼
access.ts (initialState => accessMap)
  │  root 短路 → 所有 code = true
  │  否则 → { [code]: permissionsSet.has(code) }
  ▼
┌───────────────────────────────────┐
│ (1) 菜单过滤                       │  umi access 与 layout 自动集成：
│     access=false 的路由不出现在菜单 │  + menuDataRender 后处理「空父节点隐藏」(D12)
│ (2) URL 拦截                       │  access=false 的路由直接访问 → <UnAccess />
│ (3) 按钮权限                       │  useAccess(code) / <Access code> 查 accessMap
└───────────────────────────────────┘
  │
  ▼
登录跳转：getFirstAccessiblePath() → 首个可访问菜单 (D6)
```

---

## 6. 详细设计

### 6.1 数据结构

#### 6.1.1 `AccessInfo`（`src/types/Login/index.d.ts`）扩展

```ts
/**
 * 后端权限树节点结构
 * 与登录接口 data.permissionsTree 节点一一对应
 */
export interface PermissionNode {
  id: number;
  code: string;
  name: string;
  type: "MENU" | "BUTTON";
  parentCode: string;
  path: string;
  icon: string;
  sort: number;
  state: string;
  childPermissions: PermissionNode[] | null;
}

export interface AccessInfo {
  username?: string;
  token?: string;
  /**
   * 登录接口返回的完整权限树原样存储
   * 用于菜单过滤、按钮权限判定、超管判定
   */
  permissionsTree?: PermissionNode[];
}
```

#### 6.1.2 `InitialState`（`src/types/typing.d.ts`）扩展

```ts
declare namespace GlobalTypes {
  interface InitialState {
    username?: string;
    token?: string;
    headerLogoUrl?: string;
    faviconUrl?: string;
    /** 权限树（运行时消费） */
    permissionsTree?: PermissionNode[];
    /** 扁平化的权限码集合（O(1) 查询，菜单+按钮码全集） */
    permissions?: Set<string>;
  }
}
```

> 注意：`Set` 不可直接 JSON 序列化，因此 `permissions` 仅存在于内存 `initialState`，不进 localStorage；localStorage 只存原始 `permissionsTree`，`getInitialState` 中现算 `Set`。

> **跨文件类型引用**（U3）：`PermissionNode` 定义在 `src/types/Login/index.d.ts`，而 `typing.d.ts` 的 `InitialState` 处于 `declare namespace GlobalTypes` 全局命名空间内。全局命名空间不能直接引用另一文件的接口，需在 `typing.d.ts` **文件顶部** 增加 `import type { PermissionNode } from "./Login";`（或把 `PermissionNode` 一并迁入 `GlobalTypes` 命名空间），否则编译报错。同理 `app.tsx`、`access.ts` 引用 `PermissionNode` 时也走正常 import。

### 6.2 权限码常量（`src/constants/permission.ts`，新增）

集中维护菜单级权限码常量（路由标注用），按钮级可按需补充。**只收录前端有对应路由的 code**（见 §9 gap 清单中「前端无路由」的 3 项不收录）。

```ts
/**
 * 菜单权限码常量
 * 与后端 permissionsTree 中 type=MENU 的 code 一一对应
 * 路由 access 字段与 useAccess 判定统一引用此处，避免魔法字符串
 */
export const PERM = {
  // 顶级分组（path 为空，仅作菜单容器）
  VEHICLE_MANAGE: "vehicle:manage",
  MAP_MANAGE: "map:manage",
  THIRD_PARTY_MANAGE: "third-party:manage",
  THIRD_PARTY_DEVICE_MANAGE: "third-party-device:manage",
  PROCESS_MANAGE: "process:manage",
  ACTION_MANAGE: "action:manage",
  SYSTEM_MANAGE: "system:manage",
  STATISTICS_MANAGE: "statistics:manage",

  // 可访问菜单（有 path）
  OVERVIEW_VIEW: "overview:view",
  ORDER_RECORD_VIEW: "order-record:view",
  VEHICLE_GROUP_VIEW: "vehicle-group:view",
  VEHICLE_LIST_VIEW: "vehicle-list:view",
  MAP_LIST_VIEW: "map-list:view",
  MAP_EDIT_VIEW: "map-edit:view",
  CROSS_MAP_VIEW: "cross-map:view",
  POINT_EDGE_COMBINATION_VIEW: "point-edge-combination:view",
  DISPATCH_HUB_VIEW: "dispatch-hub:view",
  DEVICE_ELEVATOR_VIEW: "device:elevator:view",
  DEVICE_AUTO_DOOR_VIEW: "device:auto-door:view",
  DEVICE_CHARGE_PILE_VIEW: "device:charge-pile:view",
  DEVICE_TRAFFIC_LIGHT_VIEW: "device:traffic-light:view",
  DEVICE_AIR_SHOWER_DOOR_VIEW: "device:air-shower-door:view",
  TRAFFIC_TRIPARTITE_VIEW: "traffic:tripartite:view",
  MISSION_FLOW_VIEW: "mission-flow:view",
  MISSION_TEMPLATE_VIEW: "mission-template:view",
  OBSTACLE_AVOIDANCE_VIEW: "obstacle-avoidance:view",
  ACTION_VEHICLE_VIEW: "action:vehicle:view",
  ACTION_GROUP_VIEW: "action-group:view",
  SYSTEM_VERSION_VIEW: "system:version:view",
  SYSTEM_LOG_VIEW: "system:log:view",
  SYSTEM_SETTING_VIEW: "system:setting:view",
  SYSTEM_OPERATION_LOG_VIEW: "system:operation-log:view",
  SYSTEM_SOFTWARE_VIEW: "system:software:view",
  SYSTEM_DATABASE_BACKUP_VIEW: "system:database-backup:view",
  SYSTEM_USER_VIEW: "system:user:view",
  SYSTEM_ROLE_VIEW: "system:role:view",
  STATISTICS_ORDER_VIEW: "statistics:order:view",
  RECORD_PLAYBACK_VIEW: "record-playback:view",
} as const;

export type PermCode = typeof PERM[keyof typeof PERM];
```

#### 6.2.1 全量菜单结构常量 `MENU_TREE`（新增）

集中维护菜单的**层级 + code + path** 全量结构，作为单一数据源派生出多处所需数据。**只收录前端有对应路由的 code**。

```ts
/**
 * 全量菜单权限结构（与 .umirc.ts 路由层级、后端 permissionsTree 的 MENU 节点一一对齐）
 * 三大用途：
 *  1. 派生 MENU_ROUTE_ORDER —— getFirstAccessiblePath 的有序遍历依据（D16），不依赖运行时 routes
 *  2. 祖先填充 expandWithAncestors（D15）—— 用户有任一后代则补全祖先分组 code
 *  3. 单一数据源，避免 access 判定 / 跳转 / 路由三处分别维护 code 列表
 *
 * 维护说明：本结构是 .umirc.ts 菜单层级的镜像，菜单低频变更；
 *          新增/调整菜单时需同步更新此处与 .umirc.ts。
 */
export interface MenuPermNode {
  code: string;          // 权限码，与 PERM 常量一致
  path: string;          // 前端路由路径，分组节点为 ""
  children?: MenuPermNode[];
}

export const MENU_TREE: MenuPermNode[] = [
  { code: PERM.OVERVIEW_VIEW, path: "/over-look" },
  { code: PERM.ORDER_RECORD_VIEW, path: "/order-record" },
  {
    code: PERM.VEHICLE_MANAGE, path: "/vehicle-deploy",
    children: [
      { code: PERM.VEHICLE_GROUP_VIEW, path: "/vehicle-deploy/vehicle-group" },
      { code: PERM.VEHICLE_LIST_VIEW, path: "/vehicle-deploy/vehicle-diplay" },
    ],
  },
  {
    code: PERM.MAP_MANAGE, path: "/map-through",
    children: [
      { code: PERM.MAP_LIST_VIEW, path: "/map-through/map-list" },
      { code: PERM.MAP_EDIT_VIEW, path: "/map-through/map-nest-modify" },
      { code: PERM.CROSS_MAP_VIEW, path: "/map-through/cross-maps" },
      { code: PERM.POINT_EDGE_COMBINATION_VIEW, path: "/map-through/point-edge-combination" },
    ],
  },
  { code: PERM.DISPATCH_HUB_VIEW, path: "/dispatch-hub" },
  {
    code: PERM.THIRD_PARTY_MANAGE, path: "/tri-resource",
    children: [
      {
        code: PERM.THIRD_PARTY_DEVICE_MANAGE, path: "/tri-resource/tri-device",
        children: [
          { code: PERM.DEVICE_ELEVATOR_VIEW, path: "/tri-resource/tri-device/elevator" },
          { code: PERM.DEVICE_AUTO_DOOR_VIEW, path: "/tri-resource/tri-device/auto-door" },
          { code: PERM.DEVICE_CHARGE_PILE_VIEW, path: "/tri-resource/tri-device/charge-pie" },
          { code: PERM.DEVICE_TRAFFIC_LIGHT_VIEW, path: "/tri-resource/tri-device/traffic-lights" },
          { code: PERM.DEVICE_AIR_SHOWER_DOOR_VIEW, path: "/tri-resource/tri-device/air-shower-door" },
        ],
      },
      { code: PERM.TRAFFIC_TRIPARTITE_VIEW, path: "/tri-resource/tri-traffic" },
    ],
  },
  {
    code: PERM.PROCESS_MANAGE, path: "/mission-cluster",
    children: [
      { code: PERM.MISSION_FLOW_VIEW, path: "/mission-cluster/mission-create" },
      { code: PERM.MISSION_TEMPLATE_VIEW, path: "/mission-cluster/mission-flow" },
      { code: PERM.OBSTACLE_AVOIDANCE_VIEW, path: "/mission-cluster/obstacle-avoidance" },
      {
        code: PERM.ACTION_MANAGE, path: "/mission-cluster/action-control",
        children: [
          { code: PERM.ACTION_VEHICLE_VIEW, path: "/mission-cluster/action-control/agv-action" },
          { code: PERM.ACTION_GROUP_VIEW, path: "/mission-cluster/action-control/agv-action-group" },
        ],
      },
    ],
  },
  {
    code: PERM.SYSTEM_MANAGE, path: "/system-involve",
    children: [
      { code: PERM.SYSTEM_VERSION_VIEW, path: "/system-involve/version-control" },
      { code: PERM.SYSTEM_LOG_VIEW, path: "/system-involve/system-log" },
      { code: PERM.SYSTEM_SETTING_VIEW, path: "/system-involve/system-setting" },
      { code: PERM.SYSTEM_OPERATION_LOG_VIEW, path: "/system-involve/operation-log" },
      { code: PERM.SYSTEM_SOFTWARE_VIEW, path: "/system-involve/software-information" },
      { code: PERM.SYSTEM_DATABASE_BACKUP_VIEW, path: "/system-involve/database-backup" },
      { code: PERM.SYSTEM_USER_VIEW, path: "/system-involve/user-management" },
      { code: PERM.SYSTEM_ROLE_VIEW, path: "/system-involve/role-management" },
    ],
  },
  {
    code: PERM.STATISTICS_MANAGE, path: "/analyze-visual",
    children: [
      { code: PERM.STATISTICS_ORDER_VIEW, path: "/analyze-visual/order-statistics" },
      { code: PERM.RECORD_PLAYBACK_VIEW, path: "/analyze-visual/record-playback" },
    ],
  },
];
```

> 按钮级 code 数量大（200+），建议**不在常量里硬编码全量**，而是运行时从 `permissionsTree` 扁平化动态消费（见 §6.7）。仅对代码中高频引用的按钮码补充常量。

### 6.3 `access.ts` 改造

```ts
/**
 * 权限定义
 * 基于后端 permissionsTree 的权限码判定
 *
 * - root 用户：短路全权限（D5/D14）
 * - 普通用户：严格按 permissions 集合判定（该集合已做祖先填充，见 §6.4 / D15）
 *
 * 方案选型（U2 已收敛为唯一方案）：「显式枚举 PERM 生成 map」，不使用 Proxy。
 * 理由：路由 access 字段值仅取自 PERM（菜单码，有限集合），显式枚举即可覆盖；
 *       按钮码（200+，不在 PERM）不走路由 access，统一由 §6.7 useAccess 基于 Set 判定；
 *       显式 map 规避了 Proxy 在 Umi access model 下「是否枚举 keys」的不确定性。
 */
import { GlobalTypes } from "./types/typing";
import { PERM } from "@/constants/permission";

// 路由 access 字段引用的全部 code（菜单级，有限可枚举）
const ROUTE_ACCESS_CODES = Object.values(PERM);

export default (initialState: GlobalTypes.InitialState) => {
  const { username, token, permissions } = initialState ?? {};
  const isLogged = !!(username && token);

  // root 短路：所有路由 access code 放行（D5/D14）
  if (isLogged && username === "root") {
    return Object.fromEntries(ROUTE_ACCESS_CODES.map((c) => [c, true]));
  }

  // 普通用户：逐 code 判定是否在（已祖先填充的）权限集合中
  // 未登录或无权限树时 permissions 为空 → 全部 code 为 false → 全拦截
  const map: Record<string, boolean> = {};
  ROUTE_ACCESS_CODES.forEach((c) => (map[c] = !!permissions?.has(c)));
  return map;
};
```

> **为何不用 Proxy**：早期曾考虑 Proxy 以支持任意 code（含按钮码）。但按钮权限已统一交给 §6.7 `useAccess`（基于 `initialState.permissions` Set，天然支持任意 code），路由 access 只服务菜单码（PERM 内）。显式枚举更简单、确定，规避了 Umi 内部对 access 返回值「是否 `Object.keys` 枚举」的兼容风险，故定为唯一方案，不再保留备选。

> **按钮码如何判定**：见 §6.7 `useAccess`。按钮码不在 `PERM` 中，运行时从 `permissionsTree` 扁平化进 `initialState.permissions`，`hasPerm(code)` 直接查 Set，无需 access.ts 参与。

### 6.4 `getInitialState`（`app.tsx`）改造

> `flattenPermissionCodes` 与 `expandWithAncestors` 均定义在 `src/utils/permission.ts`（见 §6.8.1），此处仅 import 调用 —— 不在运行时配置文件 `app.tsx` 内定义被业务 utils 反向引用的函数（避免循环依赖）。

```ts
import { flattenPermissionCodes, expandWithAncestors } from "@/utils/permission";

export async function getInitialState(): Promise<GlobalTypes.InitialState> {
  const accessInfo = localStorage.getItem("accessInfo");
  const localInfo: AccessInfo = accessInfo ? JSON.parse(accessInfo) : {};
  if (!localInfo?.username || !localInfo?.token) {
    history.replace({ pathname: "/login" });
    return { username: localInfo?.username, token: localInfo?.token };
  }

  const [headerLogoUrl, faviconUrl] = await Promise.all([
    fetchImageUrl("headerLogo"),
    fetchImageUrl("favicon"),
  ]);
  if (faviconUrl) setFavicon(faviconUrl);

  // 权限集合：先扁平化收集全部 code，再做祖先填充（D15）
  // 祖先填充保证「有任一后代 code → 其全部祖先分组 code 进入集合」，
  // 使 access.ts 对父分组路由的判定（map[code]）为 true，防御后端权限树断链（§3.4）
  const rawCodes = flattenPermissionCodes(localInfo?.permissionsTree);
  const permissions = expandWithAncestors(rawCodes);

  return {
    username: localInfo?.username,
    token: localInfo?.token,
    headerLogoUrl,
    faviconUrl,
    permissionsTree: localInfo?.permissionsTree,
    permissions,
  };
}
```

### 6.5 `.umirc.ts` 路由标注

每条业务路由的 `access` 字段值改为对应的 `permissionCode`（引用 §6.2 常量）。**特殊页（login / authorize-ingress / 404）保持无 `access` 字段**（umi 对无 access 字段的路由不拦截，天然适合公开页）。

示例（节选，完整映射见 §7）：
```ts
import { PERM } from "@/constants/permission";

routes: [
  { path: "/", redirect: "/login" },
  { name: "登录", path: "/login", component: "./Login", layout: false },           // 无 access
  { name: "软件授权", path: "/authorize-ingress", component: "./AuthorizeIngress", layout: false }, // 无 access

  {
    name: "调度监控", icon: "BorderlessTableOutlined",
    path: "/over-look", component: "./Overlook",
    access: PERM.OVERVIEW_VIEW,
  },
  {
    name: "车辆管理", icon: "CarOutlined",
    path: "/vehicle-deploy", component: "./VehicleDeploy",
    access: PERM.VEHICLE_MANAGE,   // 分组节点也标 code
    routes: [
      { name: "车辆分组", path: "/vehicle-deploy/vehicle-group",
        component: "./VehicleDeploy/VehicleGroup", access: PERM.VEHICLE_GROUP_VIEW },
      { name: "车辆列表", path: "/vehicle-deploy/vehicle-diplay",
        component: "./VehicleDeploy/VehicleDisplay", access: PERM.VEHICLE_LIST_VIEW },
    ],
  },
  // ...
  {
    name: "任务详情", path: "/order-info", component: "./OrderInfo",
    layout: false, access: PERM.ORDER_RECORD_VIEW,   // 详情页绑父菜单 code (D7)
  },
  {
    name: "车辆详情", path: "/vehicle-info", component: "./VehicleInfo",
    layout: false, access: PERM.VEHICLE_LIST_VIEW,   // 详情页绑父菜单 code (D7)
  },
  { path: "/*", component: "@/pages/NotFound" },   // 无 access
]
```

> `.umirc.ts` 是构建期配置，能否 `import` 常量需确认（Umi 配置文件支持 TS import）。若不便，可直接写字符串字面量 `"overview:view"`，常量仅用于业务代码（`useAccess`）。**实施时优先验证 `.umirc.ts` 中 import 常量的可行性**。

### 6.6 菜单过滤（`layout` 配置，`app.tsx`）

Umi Max 的 access 插件与 layout **自动集成**：`access` 返回 false 的路由会自动从菜单移除、URL 访问被拦截到 `unAccessible`。因此基础过滤无需额外代码。

但需处理 D12「空父节点隐藏」：当父分组 `access` 为 true 但所有子菜单都被过滤时，父分组会显示为空可展开项。需在 `layout.menuDataRender` 中后处理，移除无可见子项的父节点。

```ts
import type { MenuDataItem } from "@umijs/max";

/**
 * 菜单数据后处理：递归移除「无可见子菜单」的父分组节点
 * 配合 umi access 自动过滤，实现 D12「随子联动隐藏空父节点」
 */
function pruneEmptyParents(menuData: MenuDataItem[]): MenuDataItem[] {
  return menuData
    .map((item) => {
      if (item.children?.length) {
        item.children = pruneEmptyParents(item.children);
      }
      return item;
    })
    .filter((item) => {
      // 有 children 的父节点：至少要有一个可见子项才保留
      // 无 children 的叶子节点：已被 access 过滤，此处保留即可
      if (item.children) {
        return item.children.length > 0;
      }
      return true;
    });
}

// layout 返回值中新增：
layout: ({ initialState }) => ({
  // ...原有配置
  menuDataRender: (menuData) => pruneEmptyParents(menuData),
  unAccessible: <UnAccess />,
});
```

> **祖先填充与 pruneEmptyParents 的分工**（D12 双向联动）：祖先填充（§6.4 `expandWithAncestors`）解决「**有子无父**」—— 用户有子菜单但后端漏返祖先时，补全父分组 code 使其 access=true；`pruneEmptyParents` 解决「**有父无子**」—— 用户仅有父分组 code 但所有子菜单都无权限时，隐藏这个空壳父分组。两者配合才能覆盖 D12 的双向规则。

> **保留多层**（D12）：`pruneEmptyParents` 仅剪除空父节点，不改变层级深度，菜单 3 层嵌套原样保留，由 mix 布局自然渲染（顶部一级、侧边多级）。

### 6.7 按钮权限基础设施

新增 `src/hooks/useAccess.ts`（或复用 Umi 内置 `useAccess`）：

```ts
/**
 * 按钮级权限判定 Hook
 * 基于 initialState.permissions（扁平化 code 集合）查询
 *
 * 用法：
 *   const { hasPerm } = useAccess();
 *   <Button disabled={!hasPerm("order-record:create")}>创建任务</Button>
 *   {hasPerm("vehicle-list:delete") && <Button>删除</Button>}
 */
import { useModel } from "@umijs/max";

export const useAccess = () => {
  const { initialState } = useModel("@@initialState");
  const username = initialState?.username;
  const isRoot = username === "root";

  const hasPerm = (code: string): boolean => {
    if (isRoot) return true;              // root 短路 (D5)
    return !!initialState?.permissions?.has(code);
  };
  return { hasPerm };
};
```

> Umi Max 自带 `useAccess()`（读 access 函数返回值），亦可直接用 `const access = useAccess(); access["order-record:create"]`。但本方案 `access.ts` 只返回菜单码（PERM）的判定 map（§6.3），**不含按钮码**，故按钮权限必须用上面的自定义 `useAccess`（基于 `permissions` Set，含全部扁平化 + 祖先填充后的 code）来判定。

可配套提供 `<Access>` 组件包裹（条件渲染），或直接用 `hasPerm &&` 短路。本次只交付 Hook，页面接入留后续。

### 6.8 登录存储改造（`Login/index.tsx`）

```ts
const handleClickLogin = (values: LoginType) => {
  setLoading(true);
  login({ ...values, password: md5(values.password) }).then(async (res) => {
    if (res.code === 200 && res.message === "success") {
      message.success(t("登录成功"));
      // 扩展：存储 permissionsTree (D3)
      setAccessInfo({
        username: values.username,
        token: "Bearer " + res?.data?.token,
        permissionsTree: res?.data?.permissionsTree ?? [],
      });
      await refresh();
      await sleep(3);

      // D6：动态首个可用菜单（替代硬编码 /over-look）
      // 传 username 使 root 走短路；普通用户按 MENU_ROUTE_ORDER 顺序找首个命中
      const targetPath =
        res?.data?.activated === false
          ? "/authorize-ingress"
          : getFirstAccessiblePath(res?.data?.permissionsTree, values.username);
      window.location.href = window.location.origin + "/#" + targetPath;
    } else {
      setLoading(false);
      message.warning(res?.message);
    }
  });
};
```

### 6.8.1 `src/utils/permission.ts`（新增，权限工具集）

集中放置权限相关纯函数，供 `app.tsx`、`Login`、`access.ts`、`useAccess` 复用。`flattenPermissionCodes` 统一定义于此（不在 `app.tsx` 内），解决原 `flattenPermissionCodes` 定义位置矛盾（E1）。

```ts
import { MENU_TREE, MenuPermNode } from "@/constants/permission";
import type { PermissionNode } from "@/types/Login";

/**
 * 扁平化收集后端权限树的全部 code（MENU + BUTTON），深度优先
 * 仅收集「用户实际拥有」的 code；祖先分组完整性由 expandWithAncestors 兜底
 */
export function flattenPermissionCodes(
  nodes?: PermissionNode[] | null,
): Set<string> {
  const set = new Set<string>();
  const walk = (list?: PermissionNode[] | null) => {
    if (!list) return;
    for (const n of list) {
      set.add(n.code);
      if (n.childPermissions) walk(n.childPermissions);
    }
  };
  walk(nodes);
  return set;
}

/**
 * 防御性祖先填充（D15）：基于全量菜单结构 MENU_TREE
 * 若用户拥有某节点或其后代 code，则该节点及其全部祖先分组 code 进入结果集
 * 用于兜底后端权限树断链（§3.4）—— 保证「有子菜单则父分组可见」
 */
export function expandWithAncestors(userSet: Set<string>): Set<string> {
  const result = new Set(userSet);
  // 子树内是否存在任一用户拥有的 code
  const subtreeHas = (node: MenuPermNode): boolean => {
    if (userSet.has(node.code)) return true;
    return (node.children ?? []).some(subtreeHas);
  };
  const walk = (nodes: MenuPermNode[], ancestors: string[]) => {
    for (const n of nodes) {
      if (subtreeHas(n)) {
        result.add(n.code);                       // 命中则补全自身
        ancestors.forEach((a) => result.add(a));   // 及全部祖先分组
      }
      if (n.children?.length) {
        walk(n.children, [...ancestors, n.code]);
      }
    }
  };
  walk(MENU_TREE, []);
  return result;
}

/**
 * 有序菜单路由清单：按 MENU_TREE 深度优先顺序，仅保留有 path 的节点（D16）
 * 作为 getFirstAccessiblePath 的遍历依据，不依赖运行时 routes API
 */
export const MENU_ROUTE_ORDER: { path: string; code: string }[] = (() => {
  const order: { path: string; code: string }[] = [];
  const walk = (nodes: MenuPermNode[]) => {
    for (const n of nodes) {
      if (n.path) order.push({ path: n.path, code: n.code });
      if (n.children?.length) walk(n.children);
    }
  };
  walk(MENU_TREE);
  return order;
})();

/**
 * 找首个可访问菜单路径（D6）
 * 策略：root 短路进首页；否则按 MENU_ROUTE_ORDER 顺序（即 .umirc.ts 书写顺序，D10）
 *       返回第一个「用户有权限」的菜单 path；全无权限返回 "/no-permission"
 */
export function getFirstAccessiblePath(
  tree?: PermissionNode[] | null,
  username?: string,
): string {
  if (username === "root") return "/over-look";   // root 直接进首页（D5）
  const permSet = expandWithAncestors(flattenPermissionCodes(tree));
  for (const r of MENU_ROUTE_ORDER) {
    if (permSet.has(r.code)) return r.path;
  }
  return "/no-permission";   // 兜底：全无权限
}
```

> **不再依赖运行时 `routes`**：早期方案考虑从 `import { routes } from "@umijs/max"` 读取路由顺序，但该 API 是否暴露自定义 `access` 字段、顺序是否稳定均未经验证（原 E2 风险）。现统一由 §6.2.1 `MENU_TREE` 派生 `MENU_ROUTE_ORDER`，单一数据源、顺序确定，`getFirstAccessiblePath` 直接遍历即可。

> **root 短路**：登录调用处须传入 `values.username`（见上方登录代码），否则 `username === "root"` 分支不生效（原 E3 死代码）。root 进首页 `/over-look`，与其 permissionsTree 为全集天然命中首个路由等价，两条路径冗余但一致。

> **兜底页 `/no-permission`**：新增一条 `{ path: "/no-permission", component: "./UnAccess", layout: false }` 路由（无 access），复用已存在的 `UnAccess` 组件。注意区分两条机制：① URL 直接访问无权限菜单 → umi access 渲染 `unAccessible`（布局内占位，不走路由）；② 全无权限登录跳转 → `/no-permission` 真路由。两者复用同一组件，体验优化见 §13.8。

### 6.9 登出清理（`ActionsRender/index.tsx`）

```ts
const handleLoginOut = () => {
  logout().then(async (res) => {
    if (res.code === 200 && res.message === "success") {
      // 清除权限数据（permissionsTree 一并清除，D11）
      setAccessInfo({ username: "", token: "" });  // 不传 permissionsTree 即清除
      await refresh();
      history.replace({ pathname: "/login" });
    } else {
      message.warning(t("退出登录出错") + res?.message);
    }
  });
};
```

> `useLocalStorageState` 的 setter 为**整体替换**语义（与 `useState` 一致，并非浅合并）。因此 `setAccessInfo({ username: "", token: "" })` 会将存储值整体替换为该对象，`permissionsTree` 字段随之消失，权限数据被清除 —— 行为确定，无需额外处理，也无需实测。

> 同步检查 `app.tsx` responseInterceptor 中 token 过期（code 1000000）分支：`localStorage.removeItem("accessInfo")` 已是整体清除，权限数据一并清除，无需额外改动。

---

## 7. 完整路由 ↔ 权限码映射表

> 「前端路由为准」(D9)：菜单 name/icon 取自此表「路由 name」列，path 取自「前端 path」列。后端 `path`/`icon` 仅作参考，不一致处已标注，**因采用 code 关联 (D2) 不影响权限判定**。

### 7.1 顶级菜单与分组

| 前端 path | 路由 name | 前端 icon | permissionCode | 后端 path | 后端 icon | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `/over-look` | 调度监控 | BorderlessTableOutlined | `overview:view` | `/over-look` | BorderlessTableOutlined | 一致 |
| `/order-record` | 任务管理 | BarsOutlined | `order-record:view` | `/order-record` | BarsOutlined | 一致 |
| `/vehicle-deploy` | 车辆管理 | CarOutlined | `vehicle:manage` | `""` | CarOutlined | 分组(path 空) |
| `/map-through` | 地图管理 | PictureOutlined | `map:manage` | `""` | PictureOutlined | 分组 |
| `/dispatch-hub` | 调度中心 | BlockOutlined | `dispatch-hub:view` | `/dispatch-hub` | BlockOutlined | 一致 |
| `/tri-resource` | 三方资源 | **ApiOutlined** | `third-party:manage` | `""` | **AppstoreOutlined** | ⚠️ 图标不一致，前端为准 |
| `/mission-cluster` | 工艺配置 | InteractionOutlined | `process:manage` | `""` | InteractionOutlined | 分组 |
| `/system-involve` | 系统管理 | SettingFilled | `system:manage` | `""` | SettingFilled | 分组 |
| `/analyze-visual` | 数据统计 | SignalFilled | `statistics:manage` | `""` | SignalFilled | 分组 |

### 7.2 二级及以下菜单

| 前端 path | 路由 name | permissionCode | 后端 path | 备注 |
| --- | --- | --- | --- | --- |
| `/vehicle-deploy/vehicle-group` | 车辆分组 | `vehicle-group:view` | `/vehicle-deploy/vehicle-group` | |
| `/vehicle-deploy/vehicle-diplay` | 车辆列表 | `vehicle-list:view` | `/vehicle-deploy/vehicle-diplay` | |
| `/map-through/map-list` | 地图列表 | `map-list:view` | `/map-through/map-list` | |
| `/map-through/map-nest-modify` | 地图编辑 | `map-edit:view` | `/map-through/map-nest-modify` | |
| `/map-through/cross-maps` | 地图关联 | `cross-map:view` | `/map-through/cross-maps` | |
| `/map-through/point-edge-combination` | 多地图点边组合 | `point-edge-combination:view` | `/map-through/point-edge-combination` | |
| `/tri-resource/tri-device` | 三方设备 | `third-party-device:manage` | `""` | 分组(path 空) |
| `/tri-resource/tri-device/elevator` | 电梯 | `device:elevator:view` | `/tri-resource/tri-device/elevator` | |
| `/tri-resource/tri-device/auto-door` | 自动门 | `device:auto-door:view` | `/tri-resource/tri-device/auto-door` | |
| `/tri-resource/tri-device/charge-pie` | 充电桩 | `device:charge-pile:view` | `/tri-resource/tri-device/charge-pie` | ⚠️ charge-pie vs charge-pile 拼写差异，code 为准 |
| `/tri-resource/tri-device/traffic-lights` | 交通灯 | `device:traffic-light:view` | `/tri-resource/tri-device/traffic-lights` | |
| `/tri-resource/tri-device/air-shower-door` | 风淋门 | `device:air-shower-door:view` | `/tri-resource/tri-device/air-shower-door` | |
| `/tri-resource/tri-traffic` | 三方交管 | `traffic:tripartite:view` | `/tri-resource/tri-traffic` | |
| `/mission-cluster/mission-create` | 任务工艺 | `mission-flow:view` | `/mission-cluster/mission-create` | |
| `/mission-cluster/mission-flow` | 工艺管理 | `mission-template:view` | `/mission-cluster/mission-flow` | |
| `/mission-cluster/obstacle-avoidance` | 避障模板 | `obstacle-avoidance:view` | `/mission-cluster/obstacle-avoidance` | |
| `/mission-cluster/action-control` | 动作管理 | `action:manage` | `""` | 分组(path 空) |
| `/mission-cluster/action-control/agv-action` | 车辆动作 | `action:vehicle:view` | `/mission-cluster/action-control/agv-action` | |
| `/mission-cluster/action-control/agv-action-group` | 动作分组 | `action-group:view` | `/mission-cluster/action-control/agv-action-group` | |
| `/system-involve/version-control` | 版本管理 | `system:version:view` | `/system-involve/version-control` | |
| `/system-involve/system-log` | 系统日志 | `system:log:view` | `/system-involve/system-log` | |
| `/system-involve/system-setting` | 系统设置 | `system:setting:view` | `/system-involve/system-setting` | |
| `/system-involve/operation-log` | 操作日志 | `system:operation-log:view` | `/system-involve/operation-log` | |
| `/system-involve/software-information` | 软件信息 | `system:software:view` | `/system-involve/software-information` | |
| `/system-involve/database-backup` | 数据库备份管理 | `system:database-backup:view` | `/system-involve/database-backup` | |
| `/system-involve/user-management` | 用户管理 | `system:user:view` | `/system-involve/user-manage` | ⚠️ path 不一致(manage vs management)，code 为准 |
| `/system-involve/role-management` | 角色管理 | `system:role:view` | `/system-involve/role-manage` | ⚠️ path 不一致，code 为准 |
| `/analyze-visual/order-statistics` | 任务统计 | `statistics:order:view` | `/analyze-visual/order-statistics` | |
| `/analyze-visual/record-playback` | 录制回放 | `record-playback:view` | `/analyze-visual/record-playback` | |

### 7.3 详情页（layout:false，绑父菜单 code，D7）

| 前端 path | 路由 name | permissionCode（绑父） | 说明 |
| --- | --- | --- | --- |
| `/order-info` | 任务详情 | `order-record:view` | 从调度监控/任务管理进入详情 |
| `/vehicle-info` | 车辆详情 | `vehicle-list:view` | 从车辆列表进入详情 |

### 7.4 特殊页（无 access 字段，不拦截）

| 前端 path | 说明 |
| --- | --- |
| `/login` | 登录页（未登录可访问） |
| `/authorize-ingress` | 软件授权页（`activated === false` 时进入） |
| `/no-permission` | 全无权限兜底页（新增，复用 `UnAccess`） |
| `/*` | 404 |

---

## 8. 按钮权限码清单（后端契约参考）

> 以下为 `permissionsTree` 中 `type: "BUTTON"` 的全集，按父菜单分组。供页面后续接入 `useAccess` 时参考。前端无需在 `PERM` 常量中硬编码全部，运行时从树中扁平化消费。

| 父菜单 | 按钮码 |
| --- | --- |
| 调度监控 | `overview:map-check` `overview:order-record-create` `overview:vehicle-operate` `overview:order-record-check` `overview:order-record-operate` |
| 任务管理 | `order-record:create` `order-record:check` `order-record:operate` |
| 车辆分组 | `vehicle-group:add` `vehicle-group:update` `vehicle-group:delete` |
| 车辆列表 | `vehicle-list:add` `vehicle-list:update` `vehicle-list:delete` `vehicle-list:operate` `vehicle-list:enable` `vehicle-list:batch-operate` |
| 载具类型 | `carrier:add` `carrier:update` `carrier:delete` |
| 地图列表 | `map-list:add` `map-list:upload-dispatcher-map` `map-list:upload-vehicle-map` `map-list:update` `map-list:delete` `map-list:version` `map-version:update` `map-version:publish` `map-version:download` |
| 地图编辑 | `map-edit:update` |
| 地图关联 | `cross-map:add` `cross-map:update` `cross-map:delete` |
| 多地图点边组合 | `point-edge-combination:add` `point-edge-combination:update` `point-edge-combination:delete` |
| 调度中心 | `dispatch-hub:save` `dispatch-hub:reset` |
| 电梯 | `device:elevator:add` `device:elevator:update` `device:elevator:delete` `device:elevator:operate` |
| 自动门 | `device:auto-door:add` `device:auto-door:update` `device:auto-door:delete` `device:auto-door:operate` |
| 充电桩 | `device:charge-pile:add` `device:charge-pile:update` `device:charge-pile:delete` `device:charge-pile:operate` |
| 交通灯 | `device:traffic-light:add` `device:traffic-light:update` `device:traffic-light:delete` `device:traffic-light:operate` |
| 风淋门 | `device:air-shower-door:add` `device:air-shower-door:update` `device:air-shower-door:delete` `device:air-shower-door:operate` |
| 三方交管 | `traffic:tripartite:add` `traffic:tripartite:update` `traffic:tripartite:delete` `traffic:tripartite:check` |
| 任务工艺 | `mission-flow:add` `mission-flow:update` `mission-flow:delete` `mission-flow:copy` |
| 工艺管理 | `mission-template:create` `mission-template:resend` `mission-template:operate` `mission-template:sub-operate` |
| 避障模板 | `obstacle-avoidance:add` `obstacle-avoidance:update` `obstacle-avoidance:delete` |
| 车辆动作 | `action:vehicle:add` `action:vehicle:update` `action:vehicle:delete` |
| 动作分组 | `action-group:add` `action-group:update` `action-group:delete` |
| 系统动作 | `action:sys:add` `action:sys:update` `action:sys:delete` |
| 版本管理 | `system:version:restart` `system:version:upload` `system:version:rollback` `system:version:download` `system:version:delete` |
| 系统日志 | `system:log:download` |
| 系统设置 | `system:setting:upload-navbar` `system:setting:upload-login-bg` `system:setting:upload-tab-icon` |
| 软件信息 | `system:software:activate` |
| 数据库备份管理 | `system:database-backup:download` |
| 用户管理 | `system:user:add` `system:user:update` `system:user:delete` `system:user:assign-role` |
| 角色管理 | `system:role:add` `system:role:update` `system:role:delete` `system:role:assign-permission` |

---

## 9. 数据契约 Gap 与不一致清单

### 9.1 ⚠️ 后端有权限码但前端无对应路由（3 项）

这 3 项在后端为 `type: "MENU"` 但 `path` 为空，前端 `.umirc.ts` 无对应路由。由于 path 空，**不产生可访问菜单项，本次不影响菜单渲染**。但需产品确认：

| code | 后端 name | 后端位置 | 处理建议 |
| --- | --- | --- | --- |
| `carrier:view` | 载具类型 | 车辆管理下 | 若需该页面，前端补路由（如 `/vehicle-deploy/carrier`）+ 组件；否则后端移除该节点 |
| `action:sys:view` | 系统动作 | 动作管理下 | 同上（如 `/mission-cluster/action-control/sys-action`） |
| `system:resource:view` | 服务资源 | 系统管理下 | 同上（如 `/system-involve/resource`） |

> **决策待定**：本次实施若产品未确认，先**不补路由**，这 3 个 code 不会出现在前端菜单（因无路由匹配）。后端返回它们不影响。文档记录待后续。

### 9.2 ⚠️ path 不一致（2 项，已通过 code 关联化解）

| 前端 path | 后端 path | code |
| --- | --- | --- |
| `/system-involve/user-management` | `/system-involve/user-manage` | `system:user:view` |
| `/system-involve/role-management` | `/system-involve/role-manage` | `system:role:view` |

> 因采用 permissionCode 关联 (D2)，权限判定不依赖 path，**前端路由 path 无需修改**。仅作记录。

### 9.3 ⚠️ 图标不一致（1 项，前端为准）

| 前端 icon | 后端 icon | code |
| --- | --- | --- |
| `ApiOutlined`（三方资源） | `AppstoreOutlined` | `third-party:manage` |

> 「前端路由为准」(D9)，菜单图标用前端 `ApiOutlined`，后端 icon 不消费。

### 9.4 ⚠️ 后端权限树祖先完整性（契约，须后端确认）

详见 §3.4。若某角色拥有子菜单/按钮权限，后端须保证其全部祖先分组节点一并出现在该角色的 `permissionsTree` 中。前端已用 `expandWithAncestors`（§6.4 / D15）做防御性兜底，但后端契约仍须明确，避免预置角色 / 历史 DB 数据断链导致菜单异常。

> **评审动作项**：请后端确认「按角色权限 id 组装 permissionsTree 时，是否保留从叶到根路径上的全部中间祖先节点」。若不保留，则前端 `expandWithAncestors` 是唯一保障，须作为必须项而非可选。

---

## 10. 边界与降级策略

| 场景 | 策略 |
| --- | --- |
| root 用户 | `username === "root"` 短路全权限 (D5)，所有菜单/按钮可见，跳 `/over-look` |
| 普通用户 permissionsTree 为空 | 严格按树判定 → 无任何菜单 → 跳 `/no-permission` (D6) |
| 用户无某菜单 code | 菜单不显示 + URL 直接访问拦截到 `<UnAccess />` |
| 父分组下所有子菜单无权限 | `pruneEmptyParents` 移除父分组 (D12) |
| 后端新增菜单 code 但前端无路由 | 菜单不出现（无路由匹配），不影响；待前端补路由 |
| 后端新增按钮 code | `useAccess` 自动支持（运行时从树扁平化），无需改代码 |
| token 过期 | responseInterceptor 已 `removeItem("accessInfo")`，权限数据一并清除 |
| 切换用户/重新登录 | 重新写入 `permissionsTree`，`getInitialState` 重算 `permissions` Set，菜单刷新 |
| localStorage 被手动篡改 | 权限树被改大也只是多看菜单，后端接口仍按真实权限校验（前端权限仅控可见性，**非安全边界**） |
| 浏览器多标签页 | `useLocalStorageState({ listenStorageChange: true })` 已启用，登出会同步；权限变更需重新登录 (D11) |

> ⚠️ **安全提示**：前端菜单/按钮权限只是**体验层过滤**，真正的安全边界在后端接口校验。敏感操作务必后端鉴权，不能只靠前端隐藏按钮。

---

## 11. 改动文件清单

| 文件 | 改动类型 | 说明 |
| --- | --- | --- |
| `src/constants/permission.ts` | **新增** | 权限码常量 `PERM` (§6.2) + 全量菜单结构 `MENU_TREE` (§6.2.1) |
| `src/utils/permission.ts` | **新增** | `flattenPermissionCodes`、`expandWithAncestors`、`MENU_ROUTE_ORDER`、`getFirstAccessiblePath` (§6.8.1) |
| `src/hooks/useAccess.ts` | **新增** | 按钮权限 Hook (§6.7) |
| `src/types/Login/index.d.ts` | 修改 | `AccessInfo` 加 `permissionsTree`；新增 `PermissionNode` (§6.1.1) |
| `src/types/typing.d.ts` | 修改 | `InitialState` 加 `permissionsTree` / `permissions` (§6.1.2) |
| `src/access.ts` | **重写** | 基于 permissionsTree 的权限码判定 + root 短路 (§6.3) |
| `src/app.tsx` | 修改 | `getInitialState` 扁平化权限；`layout.menuDataRender` 剪空父节点 (§6.4/§6.6) |
| `.umirc.ts` | 修改 | 每条路由 `access` 改为 permissionCode；新增 `/no-permission` 路由 (§6.5) |
| `src/pages/Login/index.tsx` | 修改 | 登录存 `permissionsTree`；跳转改 `getFirstAccessiblePath` (§6.8) |
| `src/components/ActionsRender/index.tsx` | 修改 | 登出清除权限数据 (§6.9) |

> 不改动：`src/pages/UnAccess/index.tsx`（复用）、各业务页面（按钮接入留后续）。

---

## 12. 实施步骤（建议分阶段）

### 阶段 1：基础设施（不影响现有功能）
1. 新增 `src/constants/permission.ts`、`src/utils/permission.ts`、`src/hooks/useAccess.ts`
2. 扩展 `AccessInfo` / `InitialState` 类型
3. 改造 `getInitialState`（扁平化权限，向下兼容）
4. 改造 `Login` 存储 `permissionsTree`（保留跳转 `/over-look` 不变，先不接 D6）

### 阶段 2：权限判定接入
5. 重写 `access.ts`（显式枚举 PERM 方案，§6.3；消费祖先填充后的 `permissions` Set）
6. 改造 `.umirc.ts`：所有路由 `access` 换成 permissionCode；父分组补 code；详情页绑父 code；新增 `/no-permission`
7. `layout.menuDataRender` 接入 `pruneEmptyParents`

### 阶段 3：跳转与清理
8. `Login` 跳转改 `getFirstAccessiblePath`
9. `ActionsRender` 登出清权限

### 阶段 4：验证
10. 用 root / 不同角色账号登录，验证菜单可见性、URL 拦截、跳转、登出清理
11. 验证 mix 布局下菜单 3 层嵌套（三方资源 → 三方设备 → 电梯）正常展示
12. 验证「全无权限用户」跳 `/no-permission`

> 每阶段可独立验证，便于回滚。**Git 操作由用户决定**（CLAUDE.md 规定 Claude 不主动操作 git）。

---

## 13. 风险与注意事项

1. ~~**Proxy 方案兼容性**~~（已消解，对应 U2）：原方案 Proxy 存在「Umi `@@access` 是否对返回值 `Object.keys` 枚举」的不确定性。现已收敛为 §6.3「显式枚举 PERM」唯一方案，按钮码改由 §6.7 `useAccess` 基于 Set 判定，该风险不复存在，不再保留备选。

2. **`.umirc.ts` 引用常量**：构建期配置文件 import 业务常量（`PERM`）需验证可行性；若不便，路由 `access` 直接写字符串字面量（如 `"overview:view"`），常量仅供业务代码与 `MENU_TREE` 使用。注意 `MENU_TREE` 不需被 `.umirc.ts` 引用，无此问题。

3. ~~**`getFirstAccessiblePath` 路由顺序**~~（已消解，对应 E2 / D16）：原依赖运行时 `routes` API 的可用性与顺序保持。现改由 §6.2.1 `MENU_TREE` 派生 `MENU_ROUTE_ORDER`，单一数据源、顺序确定。**衍生成本**：`MENU_TREE` 是 `.umirc.ts` 路由层级的镜像，新增/调整菜单时需两处同步（菜单低频变更，可接受）。

4. **权限仅控可见性，非安全边界**：后端必须独立鉴权。前端被篡改 localStorage 最多多看菜单，不影响数据安全。

5. ~~**ahooks `setAccessInfo` 清除语义**~~（已消解，对应 E4）：`useLocalStorageState` setter 为整体替换，登出 `setAccessInfo({ username: "", token: "" })` 必然清除 `permissionsTree`，行为确定，无需实测。

6. **mix 布局菜单 3 层嵌套**：ProLayout 对较深层级（顶部 1 + 侧边至多 2 级，如 三方资源→三方设备→电梯）的展示需视觉验证，必要时调整 `layout` 模式。

7. **i18n 文案**：新增提示文案（如「无权限访问」「全无可用菜单」「返回首页」）须同步 `zh-CN.json` / `en-US.json`（CLAUDE.md 规范）。

8. **UnAccess 对「已登录无权限」的体验**：现有 `UnAccess` 按钮「去登录」对已登录用户不贴切。本次 D6 会将「全无权限用户」跳到 `/no-permission`（复用 UnAccess），故**该体验问题落在本次范围内**，建议本次即区分「已登录 vs 未登录」两种状态（已登录时按钮改为「返回首页」或「退出登录」），而非推迟到后续。

9. **root 短路仍硬编码 `username === "root"`**（D5/D14，已知限制）：新权限体系引入了 `roles` / `level` 字段，但超管判定仍用 username 字符串。沿用现状可接受，但若将来 root 用户名可配置，则需改为按 `level` / `role` 判定 —— 记为已知约束。

---

## 14. 后续工作（不在本次范围）

- [ ] 各业务页面按钮接入 `useAccess`（按 §8 清单逐页改造）
- [ ] §9.1 三个 gap 菜单（载具类型 / 系统动作 / 服务资源）的产品确认与补路由
- [ ] 权限变更实时感知（当前为下次登录生效 D11，未来可考虑 WebSocket 推送）
- [ ] 后端契约确认（§9.4）：角色权限树组装是否保留全部祖先节点
- [ ] `MENU_TREE` 与 `.umirc.ts` 路由层的同步维护（考虑后续用脚本从 `.umirc.ts` 自动生成 `MENU_TREE`，消除双重维护）

> **关于「角色管理权限分配」**（原 v1.0 列为后续，现已实现）：仓库内 `RoleManagement/PermissionModal` 已实现权限树可视化分配（`getPermissions` 渲染、`assignPermissions` 提交，父子联动含祖先 id 上送）。本规格的「菜单动态渲染」是其**消费端**，两者通过权限 **id（分配侧）↔ code（消费侧）** 衔接 —— 实施时须确认同一权限节点的 id 与 code 一一对应、且 `PermissionModal` 提交的祖先 id 能在登录返回的 `permissionsTree` 中还原为祖先 code（即 §3.4 契约成立）。这条衔接契约在原 v1.0 中缺失，现补齐。
