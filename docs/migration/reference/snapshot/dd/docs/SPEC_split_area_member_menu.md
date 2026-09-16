# 独占区/三方交管 右键菜单拆分为 4 个一级项 规格说明

> 状态：已定稿（访谈 4 轮，23 项决策）
> 日期：2026-07-20
> 范围：`src/pages/MapThrough/MapNestModify/NestGraph/ContextMenu/`（`index.tsx` + `batchAreaMember.ts`）+ `src/constants/mapThrough.ts` 的 `menuItems`
> 不在范围：Drawer（ExclusiveDrawer/TrafficDrawer/PathDrawer/CollapseChildren）、BrushSelect、Overlook
> 前置文档：`docs/SPEC_batch_area_member.md`（本期取代其"混合 toggle"语义）

---

## 1. 背景与目标

### 1.1 前序实现的问题

`SPEC_batch_area_member.md` 已把独占区/三方交管的右键操作改造为"智能翻转"：

- 右键菜单两个一级项：`独占区`、`三方交管区域`，各挂区域子菜单。
- 子菜单项 label 根据**操作范围内元素的 in/out 分布**智能生成：
  - 全不在 → `添加 N 个到【X】`
  - 全在 → `移除 N 个出【X】`（danger）
  - **混合 → `添加{out}/移除{in}【X】`（toggle，一次点击同时添加和移除）**

**核心痛点**：混合 toggle 语义不明确——用户点一个区域项，却同时发生"添加"与"移除"两种相反动作，label `添加3/移除2【X】` 难以一眼理解，danger 标记也含糊（既有加又有减）。

### 1.2 目标

把"独占区 / 三方交管"两个混合一级项，**拆分为 4 个语义明确的单向一级项**：

1. 添加独占区
2. 移除独占区
3. 添加三方交管
4. 移除三方交管

每个一级项下挂"目标区域列表"，用户**先明确意图（加 or 移）**，再选目标区域。彻底消除 toggle，单向操作遇到"部分越界"用幂等跳过处理。

---

## 2. 现状回顾

### 2.1 数据结构（不变）

```ts
// src/types/MapNestModify/index.d.ts
interface NodeEdgeGroup {
    id: string;
    name: string;
    edgeIds: string[];
    nodeIds: string[];
    userDefinedProperties?: {
        [key: string]: any // nodeEdgeGroupType = SINGLE_VEHICLE（独占区）/ TRIPARTITE_TRAFFIC（三方交管）
    };
}
```

- 独占区与三方交管同结构，仅 `nodeEdgeGroupType` 不同。
- 一个区域可同时持有 `nodeIds` 与 `edgeIds`（天然支持 node+edge 混合）。
- `exclusiveGroups` / `trafficGroups` 是两组独立 state，由 `GraphStage` 从 `mapJson.nodeEdgeGroups` 按 type 过滤而来。

### 2.2 当前 menuItems（将被替换）

```ts
// src/constants/mapThrough.ts
{ key: "exclusiveGroup", label: "独占区", enable: ["node", "edge", "stage"] },
{ key: "trafficGroup",   label: "三方交管区域", enable: ["node", "edge", "stage"] }
```

### 2.3 当前 batchAreaMember.ts（将重构）

为 toggle 语义设计：`resolveOperateMembers` / `collectMembers` / `computeAreaItem`（add|remove|toggle|empty 分支）/ `applyToggleToGroup`。

### 2.4 保留不变的基础设施

- `BrushSelect` 四模式（默认/节点/路径/同向路径）与 `selectShapes` 填充逻辑。
- `removeAreaHighlightFromShape(stage, groupId, shapeId)`：区域高亮褪色工具（内部 `findOne` 容错）。
- `saveSnapshot()`：undo 快照。
- B3 操作范围判定、B4 node+edge 混合、B7 selectShapes 保留、褪色与 undo 策略——全部沿用。

---

## 3. 决策清单（D1–D23）

| # | 决策 | 选择 |
|---|---|---|
| **D1** | 菜单层级 | 2 层：4 个一级项（动作+类型），各挂目标区域列表（二级） |
| **D2** | 一级项排序 | 类型成对：`添加独占区` / `移除独占区` / `添加三方交管` / `移除三方交管` |
| **D3** | 单向操作越界语义 | **幂等跳过**：添加遇已在跳过、移除遇不在跳过，仅对有效部分执行，静默 |
| **D4** | 操作范围判定 | 保留原 B3：stage 右键→整个 selectShapes；命中∈选中集→整个 selectShapes；命中∉→仅命中 |
| **D5** | node+edge 混合 | 允许（原 B4）：node 进 nodeIds、edge 进 edgeIds |
| **D6** | 区域项置灰 | 某区域对选中集完全无可操作元素（添加全已在 / 移除全不在）→ 该区域项 disabled |
| **D7** | 一级项置灰统一规则 | **一级项 disabled ⟺ 其下所有区域项都 disabled**（含未框选的特例） |
| **D8** | 未框选呈现 | 操作范围为空 → 4 个一级项全 disabled（不可展开）。取代原 B11 的"显示+warning" |
| **D9** | 无区域呈现 | 某类型 groups 为空 → 对应两个一级项**隐藏**（沿用原 `!!groups.length` 守卫） |
| **D10** | danger 标记 | 移除一级项 danger（红），添加一级项不 danger；区域项 danger 跟随所属一级项（移除 danger、添加不 danger） |
| **D11** | 置灰 label 注释 | 加简洁注释：添加全已在 → `（全已在）`；移除全不在 → `（不在该区域）` |
| **D12** | 区域项 label 数量 | 批量（operateMembers.length > 1）且待操作数 > 0 → `{name} · {N}`；单元素 → 仅 `{name}`；置灰 → `{name}（注释）` |
| **D13** | "全部区域"快捷项 | **不加**，保持 4 项 × N 区域朴素结构（避免菜单层级膨胀，与 D1 两层结构保持一致） |
| **D14** | 单元素反馈 | 沿用原 B6/B12/B13：label 无数量、操作后**静默**（无 message） |
| **D15** | 批量 message 文案 | 只报实际增减总数：`已添加 N 个元素到【X】` / `已移除 N 个元素出【X】`；不拆节点/路径、不提跳过数；`changed === 0` 不弹（防御性守卫，正常路径下区域项 disabled 已拦截"全已在/全不在"） |
| **D16** | 工具函数重构 | 拆为独立 add/remove 函数（删除 toggle 相关） |
| **D17** | enable 字段 | 4 个一级项 enable 均为 `["node", "edge", "stage"]` |
| **D18** | 褪色逻辑 | 仅移除分支褪色（被移除成员）；添加分支不褪色（幂等，沿用 §4.6） |
| **D19** | undo | 一次操作一次 `saveSnapshot()`（操作前一次） |
| **D20** | selectShapes 保留 | 操作后不清空（沿用 B7，便于连续加入多个区域） |
| **D21** | i18n | 中文硬编码（沿用 menuItems 现状，不走 locales） |
| **D22** | Drawer | 不动 |
| **D23** | key 命名 | `addToExclusiveGroup` / `removeFromExclusiveGroup` / `addToTrafficGroup` / `removeFromTrafficGroup` |

---

## 4. 核心设计

### 4.1 关键洞察：单向 + 幂等，取代统一翻转

前序实现的"统一翻转"把三种语义（全加/全移/混合）收敛为一个 toggle 动作，正是语义模糊的根源。本期反向操作：

- **动作在菜单层显式分开**（4 个一级项 = 4 种明确意图）。
- **每个动作单向执行**：添加只加不移，移除只移不加。
- **遇到"部分越界"用幂等跳过**：添加时已在的跳过、移除时不在的跳过。

由此 label 永远只表达一种动作，danger 永远只属于移除，用户点之前就能准确预判结果。

### 4.2 操作范围判定（`resolveOperateMembers`，沿用不变）

与 `SPEC_batch_area_member.md` §4.2 完全一致，**保留不改**：

- stage 空白右键 → 整个 `selectShapes`
- node/edge 右键 + 命中 ∈ `selectShapes` → 整个 `selectShapes`
- node/edge 右键 + 命中 ∉ `selectShapes` → 仅命中元素
- 其余（robot 等）→ 空数组

> 注：node/edge 右键时 `operateMembers` 至少含命中元素（非空）；`operateMembers === []` 仅在 stage 右键 + 未框选时出现，此时由 D8 把一级项置灰（§4.5）。

### 4.3 区域项 meta 计算（`computeAddItem` / `computeRemoveItem`）

对每个区域，基于操作范围统计"待操作数"，输出 label / disabled。

```ts
/** 区域项展示元信息 */
export interface AreaItemMeta {
    label: string;
    /** 区域项 danger：移除模式 true、添加模式 false（与一级项一致，确保视觉） */
    danger: boolean;
    /** 置灰（该区域对选中集完全无可操作元素） */
    disabled: boolean;
    /** 待操作数：添加 = outCount（不在区域内的），移除 = inCount（已在区域内的） */
    operateCount: number;
}

/**
 * 计算添加模式下区域项的 label / disabled（D3 + D6 + D11 + D12）。
 * - outCount === 0（全已在）→ 置灰，label「{name}（全已在）」
 * - outCount > 0 + 批量（members.length > 1）→ label「{name} · {outCount}」
 * - outCount > 0 + 单元素 → label「{name}」（无数量，兼容 B6）
 * 仅在 members 非空时调用（members 空时由 buildAreaChildren 直接返回空，不进入此函数）。
 */
export function computeAddItem(members: OperateMember[], group: NodeEdgeGroup): AreaItemMeta {
    const name = group.name;
    const outCount = members.filter(m =>
        m.type === "node" ? !group.nodeIds.includes(m.id) : !group.edgeIds.includes(m.id)
    ).length;
    const isBatch = members.length > 1;

    // 全已在 → 置灰（D6 + D11）
    if (outCount === 0) {
        return { label: `${name}（全已在）`, danger: false, disabled: true, operateCount: 0 };
    }
    // 可添加：批量带数量（D12）
    return {
        label: isBatch ? `${name} · ${outCount}` : name,
        danger: false,
        disabled: false,
        operateCount: outCount
    };
}

/**
 * 计算移除模式下区域项的 label / disabled（D3 + D6 + D11 + D12）。
 * - inCount === 0（全不在）→ 置灰，label「{name}（不在该区域）」
 * - inCount > 0 + 批量 → label「{name} · {inCount}」
 * - inCount > 0 + 单元素 → label「{name}」
 * 仅在 members 非空时调用。
 */
export function computeRemoveItem(members: OperateMember[], group: NodeEdgeGroup): AreaItemMeta {
    const name = group.name;
    const inCount = members.filter(m =>
        m.type === "node" ? group.nodeIds.includes(m.id) : group.edgeIds.includes(m.id)
    ).length;
    const isBatch = members.length > 1;

    // 全不在 → 置灰（D6 + D11）
    if (inCount === 0) {
        return { label: `${name}（不在该区域）`, danger: false, disabled: true, operateCount: 0 };
    }
    // 可移除：批量带数量（D12）；danger 跟随一级项（D10）
    return {
        label: isBatch ? `${name} · ${inCount}` : name,
        danger: true,
        disabled: false,
        operateCount: inCount
    };
}
```

> **注**：单元素（members.length === 1）时 outCount/inCount ∈ {0, 1}。若为 0 → 置灰带注释；若为 1 → 正常但 label 无数量（兼容 B6）。即单元素可操作项 label 恒为 `{name}`，单元素不可操作项 label 为 `{name}（注释）`。

### 4.4 应用单向变更（`applyAddToGroup` / `applyRemoveToGroup`）

```ts
/** 单向变更结果：新成员列表 + 实际增减数 */
export interface MembershipResult {
    nodeIds: string[];
    edgeIds: string[];
    /** 实际增减数：添加 = 新增数、移除 = 移除数（幂等跳过不计入） */
    changed: number;
}

/**
 * 添加模式：把 members 中不在区域内的加入，已在的跳过（幂等，D3）。
 * 用 Set 保证去重（与原 [...new Set(...)] 一致）。
 * @param group 目标区域（不会被修改）
 * @param members 本次操作范围
 */
export function applyAddToGroup(group: NodeEdgeGroup, members: OperateMember[]): MembershipResult {
    const nodeSet = new Set(group.nodeIds);
    const edgeSet = new Set(group.edgeIds);
    let added = 0;
    for (const m of members) {
        const set = m.type === "node" ? nodeSet : edgeSet;
        if (!set.has(m.id)) {
            set.add(m.id);
            added++;
        }
    }
    return { nodeIds: [...nodeSet], edgeIds: [...edgeSet], changed: added };
}

/**
 * 移除模式：把 members 中已在区域内的移除，不在的跳过（幂等，D3）。
 * @param group 目标区域（不会被修改）
 * @param members 本次操作范围
 */
export function applyRemoveToGroup(group: NodeEdgeGroup, members: OperateMember[]): MembershipResult {
    const nodeSet = new Set(group.nodeIds);
    const edgeSet = new Set(group.edgeIds);
    let removed = 0;
    for (const m of members) {
        const set = m.type === "node" ? nodeSet : edgeSet;
        if (set.has(m.id)) {
            set.delete(m.id);
            removed++;
        }
    }
    return { nodeIds: [...nodeSet], edgeIds: [...edgeSet], changed: removed };
}
```

### 4.5 菜单结构生成（useMemo 内）

#### 4.5.1 filter：enable + "有区域"守卫（D9 + D17）

```ts
const filteredItems = menuItems.filter(item => {
    const isStage = event?.target.getStage() === event?.target;
    const targetType = event?.target?.attrs?.enableSelect;
    const isNodeOrEdge = targetType === "node" || targetType === "edge";
    const isRobot = event?.target?.attrs?.isRobot;

    // 1) enable 基础过滤
    if (isStage) {
        if (!item.enable.includes("stage")) return false;
    } else if (isNodeOrEdge) {
        if (!item.enable.includes(targetType)) return false;
    } else if (isRobot) {
        if (!item.enable.includes("robot")) return false;
    } else {
        return false;
    }

    // 2) 4 个区域一级项的"有区域"守卫（D9）：某类型无区域则对应两项隐藏
    if (item.key === "addToExclusiveGroup" || item.key === "removeFromExclusiveGroup") {
        return !!exclusiveGroups?.length;
    }
    if (item.key === "addToTrafficGroup" || item.key === "removeFromTrafficGroup") {
        return !!trafficGroups?.length;
    }
    return true;
});
```

#### 4.5.2 children + 一级项 disabled（D6 + D7 + D8）

```ts
const operateMembers = resolveOperateMembers(event, selectShapes);

const itemsWithChildren = filteredItems.map(item => {
    let children: MenuProps["items"] = undefined;
    if (item.key === "addToExclusiveGroup") {
        children = buildAreaChildren(exclusiveGroups, operateMembers, "add");
    } else if (item.key === "removeFromExclusiveGroup") {
        children = buildAreaChildren(exclusiveGroups, operateMembers, "remove");
    } else if (item.key === "addToTrafficGroup") {
        children = buildAreaChildren(trafficGroups, operateMembers, "add");
    } else if (item.key === "removeFromTrafficGroup") {
        children = buildAreaChildren(trafficGroups, operateMembers, "remove");
    }
    // D7 + D8：一级项 disabled ⟺ children 非空且全部 disabled
    // （children 为 undefined 表示非区域项，保持原 disabled；children 为 [] 表示未框选，every 空 = true → 一级项置灰）
    const itemDisabled = children
        ? children.every(c => !!c?.disabled)
        : item.disabled;
    return { ...item, children, disabled: itemDisabled };
});
```

#### 4.5.3 `buildAreaChildren`（辅助，可内联或下沉组件层）

```ts
type AreaMode = "add" | "remove";

/**
 * 构造某一级项下的区域子菜单（D6 + D11 + D12）。
 * - members 为空（未框选 + stage 右键）→ 返回 []，使一级项在 §4.5.2 中被置为 disabled（D8）
 * - 否则逐区域用 computeAddItem / computeRemoveItem 生成 label / disabled / danger
 * @param groups 该类型的区域列表
 * @param members 操作范围
 * @param mode 添加 / 移除
 */
function buildAreaChildren(
    groups: NodeEdgeGroup[] | undefined,
    members: OperateMember[],
    mode: AreaMode
): { key: string; label: string; danger: boolean; disabled: boolean }[] {
    if (!members.length || !groups?.length) return [];
    return groups.map(group => {
        const meta = mode === "add"
            ? computeAddItem(members, group)
            : computeRemoveItem(members, group);
        return {
            key: group.id,
            label: meta.label,
            danger: meta.danger,
            disabled: meta.disabled
        };
    });
}
```

> **D7 + D8 的统一**：`children.every(c => c.disabled)` 在 `children = []`（未框选）时为 `true`（空数组 every 恒真），自动让一级项置灰——无需为"未框选"写特判分支。

#### 4.5.4 `evenlyInsertNodes` / `alignTwoPoints` 置灰（保留原逻辑）

```ts
const twoNodesSelected =
    selectShapes.length === 2 &&
    selectShapes.every(s => s.attrs?.enableSelect === "node");
const finalItems = itemsWithChildren.map(item =>
    item.key === "evenlyInsertNodes" || item.key === "alignTwoPoints"
        ? { ...item, disabled: !twoNodesSelected }
        : item
);
return { items: finalItems };
```

**useMemo 依赖**：保持 `[selectShapes, event?.target?.getType(), exclusiveGroups, trafficGroups]`。

> **⚠ 既有隐患（本期不修，仅留痕）**：依赖中的 `event?.target?.getType()` 只反映目标**类型**（`"Shape"`/`"Stage"`），不反映**实例**。若用户不关闭菜单、连续右键两个同类型的 node（A→B），deps 未变 → `useMemo` 返回**缓存 items**（仍基于 A 的命中），菜单显示 A 的 label；而 `onClick`/`handleAreaClick` 是每次渲染重新定义的闭包，捕获的是**最新 event（B）**，点击时 `resolveOperateMembers` 按 B 重算——**显示 A、操作 B 的不一致**。此隐患继承自原代码（`ContextMenu/index.tsx` 当前 useMemo 同依赖），本期沿用既有依赖以最小化改动；若后续要修，把依赖改为整个 `event` 对象（每次右键引用必变）即可消除。

### 4.6 点击执行（onClick）

把 4 个区域分支的共同逻辑抽成 `handleAreaClick`，避免 4 份重复。

```ts
const onContextMneuClick: MenuProps["onClick"] = ({ key, keyPath }) => {
    // key = 区域 id；keyPath 末尾为一级项 key
    if (keyPath.indexOf("addToExclusiveGroup") !== -1) {
        handleAreaClick("exclusive", "add", key);
        return;
    }
    if (keyPath.indexOf("removeFromExclusiveGroup") !== -1) {
        handleAreaClick("exclusive", "remove", key);
        return;
    }
    if (keyPath.indexOf("addToTrafficGroup") !== -1) {
        handleAreaClick("traffic", "add", key);
        return;
    }
    if (keyPath.indexOf("removeFromTrafficGroup") !== -1) {
        handleAreaClick("traffic", "remove", key);
        return;
    }
    switch (key) {
        // ... 其余非区域项保持不变（selectReverseEdge / addReverseEdge / delete / batchDelete /
        //     createNodeByRobot / evenlyInsertNodes / alignTwoPoints）
        default:
            break;
    }
};

/**
 * 4 个区域一级项统一的点击处理（D3 + D14 + D15 + D18 + D19 + D20）。
 * @param type 独占区 / 三方交管（决定数据源与 setter）
 * @param mode 添加 / 移除（决定 apply 函数、danger、褪色、message 文案）
 * @param groupId 目标区域 id（key）
 */
const handleAreaClick = (
    type: "exclusive" | "traffic",
    mode: "add" | "remove",
    groupId: string
) => {
    const groups = type === "exclusive" ? exclusiveGroups : trafficGroups;
    const setGroups = type === "exclusive" ? setExclusiveGroups : setTrafficGroups;

    const operateMembers = resolveOperateMembers(event, selectShapes);
    // 守卫：操作范围为空（不应触发——未框选时一级项已置灰不可点；此处防御性 return）
    if (!operateMembers.length) return;

    const targetGroup = groups.find(g => g.id === groupId);
    // 守卫前置：targetGroup 找不到（区域被并发删除等）时直接 return，
    // 必须在 saveSnapshot 之前，否则会压入"无操作"的空快照，污染 undo 栈
    if (!targetGroup) return;

    saveSnapshot(); // 整个批量算 1 次快照（D19）

    const result = mode === "add"
        ? applyAddToGroup(targetGroup, operateMembers)
        : applyRemoveToGroup(targetGroup, operateMembers);

    // D18：仅移除分支需褪色（被移除成员 = 翻转前已在区域内的）
    if (mode === "remove") {
        const removedIds = operateMembers
            .filter(m => (m.type === "node" ? targetGroup.nodeIds : targetGroup.edgeIds).includes(m.id))
            .map(m => m.id);
        const stage = event?.target?.getStage();
        if (stage) {
            // removeAreaHighlightFromShape 内部 findOne 容错：shape 不存在则跳过
            removedIds.forEach(id => removeAreaHighlightFromShape(stage, groupId, id));
            stage.batchDraw();
        }
    }

    setGroups(gs => gs.map(g =>
        g.id !== groupId ? g : { ...g, nodeIds: result.nodeIds, edgeIds: result.edgeIds }
    ));

    // D14 + D15：仅批量（length > 1）反馈，单元素静默；只报实际增减总数。
    // 防御性守卫 result.changed > 0：正常路径下区域项 disabled 已拦截"全已在/全不在"的点击，
    // 不会进入此分支；此处兜底防止异常穿透时弹出"已添加 0 个"的丑陋 message。
    if (operateMembers.length > 1 && result.changed > 0) {
        const name = targetGroup.name;
        if (mode === "add") {
            message.success(`已添加 ${result.changed} 个元素到【${name}】`);
        } else {
            message.success(`已移除 ${result.changed} 个元素出【${name}】`);
        }
    }
};
```

> **闭包**：`handleAreaClick` 在组件内定义，捕获 `event` / `exclusiveGroups` / `trafficGroups` / `setExclusiveGroups` / `setTrafficGroups` / `selectShapes`，与原 `onClick` 两个分支风格一致。

---

## 5. 改动点

### 5.1 `src/constants/mapThrough.ts` — menuItems 替换（D1 + D2 + D10 + D17 + D23）

```diff
- {
-     key: "exclusiveGroup",
-     label: "独占区",
-     enable: ["node", "edge", "stage"]
- },
- {
-     key: "trafficGroup",
-     label: "三方交管区域",
-     enable: ["node", "edge", "stage"]
- }
+ {
+     key: "addToExclusiveGroup",
+     label: "添加独占区",
+     enable: ["node", "edge", "stage"]
+ },
+ {
+     key: "removeFromExclusiveGroup",
+     label: "移除独占区",
+     danger: true,
+     enable: ["node", "edge", "stage"]
+ },
+ {
+     key: "addToTrafficGroup",
+     label: "添加三方交管",
+     enable: ["node", "edge", "stage"]
+ },
+ {
+     key: "removeFromTrafficGroup",
+     label: "移除三方交管",
+     danger: true,
+     enable: ["node", "edge", "stage"]
+ }
```

> 4 项按 D2 类型成对排列。替换位置仍在 menuItems 末尾（原 exclusiveGroup/trafficGroup 的位置）。

### 5.2 `batchAreaMember.ts` — 重构（D16）

**保留**：`resolveOperateMembers` / `collectMembers` / `OperateMember`（§4.2 不变）。

**删除**：`computeAreaItem` / `applyToggleToGroup` / `AreaAction` / `ToggleResult`（toggle 语义不再需要）。

**新增**：`computeAddItem` / `computeRemoveItem` / `applyAddToGroup` / `applyRemoveToGroup` / `AreaItemMeta` / `MembershipResult`（§4.3 + §4.4）。

**import 清单不变**：
```ts
import type Konva from "konva";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
```

**文件顶部注释**同步更新为"4 个单向一级项（添加/移除 × 独占区/三方交管）的纯逻辑工具"。

### 5.3 `ContextMenu/index.tsx` — useMemo 改造（§4.5）

- filter：把 `exclusiveGroup` / `trafficGroup` 两个 key 守卫替换为 4 个新 key 守卫（§4.5.1）。
- children 生成：用 `buildAreaChildren` + `computeAddItem`/`computeRemoveItem` 替换原 `computeAreaItem`；一级项 disabled 按 §4.5.2 计算（`children.every(disabled)`）。
- `evenlyInsertNodes`/`alignTwoPoints` 置灰逻辑保留（§4.5.4），变量名沿用 `itemsWithChildren`。

### 5.4 `ContextMenu/index.tsx` — onClick 改造（§4.6）

- 删除原 `keyPath.indexOf("exclusiveGroup")` 与 `trafficGroup` 两个分支。
- 新增 4 个 keyPath 分支，统一委托给 `handleAreaClick(type, mode, groupId)`。
- `notifyBatchResult` 删除（toggle 的"混合"文案不再需要）；message 调用直接内联在 `handleAreaClick`（仅 2 种简单文案，无需抽函数）。
- `switch (key)` 中的 `case "exclusiveGroup"` / `case "trafficGroup"` 删除（已由 keyPath 分支提前 return）。

### 5.5 `buildAreaChildren` 落地位置

含对 `computeAddItem`/`computeRemoveItem` 的调用与 mode 分支，但**不含 UI 副作用**，是纯数据转换。可二选一：

- **方案 A（推荐）**：下沉到 `batchAreaMember.ts`，签名 `buildAreaChildren(groups, members, mode)`，返回 `{ key, label, danger, disabled }[]`。组件层直接 `.map` 挂到 item。
- 方案 B：留在组件层 useMemo 内联。

推荐 A：与其它纯逻辑函数同处，组件层更薄。注意返回类型用结构化对象（不直接构造 antd `ItemType`，避免工具文件耦合 antd 类型）。**类型契合**：返回的 `{ key, label, danger, disabled }[]` 是 antd `MenuItemType` 的合法子集，但 §4.5.2 中 `children` 变量声明为 `MenuProps["items"]`（`ItemType[] | undefined`，含 `Divider`/`Group`/`null` 的联合），TS 严格模式下直接赋值可能报错——组件层挂载时按需 `as MenuProps["items"]` 断言即可（与原代码直接构造对象字面量的处理方式一致）。

---

## 6. 不改的部分

- **Drawer**（`ExclusiveDrawer`/`TrafficDrawer`/`PathDrawer`/`CollapseChildren`）：不动（D22）。
- **BrushSelect**：四模式与 `selectShapes` 填充不变。
- **Overlook** 画布：不涉及。
- **resolveOperateMembers / collectMembers / OperateMember**：§4.2 完全保留。
- **褪色工具 `removeAreaHighlightFromShape`**、**`saveSnapshot`**、**`selectShapes` 保留语义**：沿用。
- **现有单元素右键行为**：单元素 label 无数量、静默、不弹确认（D14，向后兼容）。

---

## 7. 边界与容错

| 场景 | 处理 |
|---|---|
| stage 空白右键 + 未框选（`selectShapes` 空） | `operateMembers = []` → `buildAreaChildren` 返回 `[]` → 4 个一级项 `children.every(disabled)=true` → **一级项全置灰不可展开**（D8）；不弹 warning（取代原 B11） |
| stage 空白右键 + 框选多 node | `operateMembers = [多 node]` → 每个区域项按 outCount/inCount 生成 label，可操作项正常、全已在/全不在项置灰 |
| node 右键（命中 ∈ 选中集，选中集含多个） | `operateMembers = 整个 selectShapes`（D4）→ 批量 label |
| node 右键（命中 ∉ 选中集，选中集非空） | `operateMembers = [命中元素]`（单元素，D4）→ 单元素 label 无数量、静默（D14） |
| node 右键（未框选） | `operateMembers = [命中元素]`（单元素）→ 兼容路径 |
| 选中集混合 node+edge | 允许（D5）：node 进 nodeIds、edge 进 edgeIds，互不干扰 |
| 同向路径（`brushSelectSameDir`）框选 | `selectShapes` 全是 edge，作为普通批量；无特殊处理 |
| 添加时部分元素已在区域内 | 幂等跳过已在的，只添加 outCount 个（D3）；message 只报 `changed`（D15） |
| 移除时部分元素不在区域内 | 幂等跳过不在的，只移除 inCount 个（D3）；message 只报 `changed` |
| 某区域对选中集全已在（添加模式） | 区域项置灰 + label`（全已在）`（D6 + D11） |
| 某区域对选中集全不在（移除模式） | 区域项置灰 + label`（不在该区域）`（D6 + D11） |
| 一级项下所有区域项都置灰 | 一级项置灰（D7）；含"未框选"与"有选中但该类型下全无可操作"两种触发 |
| 区域正在高亮 + 批量添加新成员 | 新成员不上色（幂等，遵循现有"新增兜底"）；Drawer 取消再勾选高亮时才上色 |
| 区域正在高亮 + 批量移除成员 | 被移除成员立即褪色（D18，§4.6） |
| 撤销（undo） | `saveSnapshot()` 在操作前调一次，undo 一次回退整个批量（D19） |
| 无任何独占区（`exclusiveGroups.length === 0`） | `添加独占区`/`移除独占区` 两项隐藏（D9）；三方交管两项不受影响 |
| 无任何三方交管（`trafficGroups.length === 0`） | `添加三方交管`/`移除三方交管` 两项隐藏（D9） |
| 两类都无区域 | 4 个一级项全隐藏，右键菜单仅留 batchDelete 等 |
| `targetGroup` 找不到（区域被并发删除等） | `if (!targetGroup) return`（守卫在 `saveSnapshot` 之前，避免空快照污染 undo 栈） |
| `operateMembers` 为空却触发点击（理论不应发生） | `handleAreaClick` 首行 `if (!operateMembers.length) return` 防御性兜底 |
| `selectShapes` 含已销毁 shape 引用 | `resolveOperateMembers` 只取 `attrs.id`/`enableSelect`，不依赖存活；褪色由 `findOne` 容错；但 `applyAddToGroup` 会把幽灵 id 写入 `nodeIds`/`edgeIds`（无效成员）。本期不处理（沿用前序决策） |
| robot 右键 | 4 个一级项 enable 不含 robot，不显示 |
| 不关闭菜单连续右键同类型 node（A→B） | **既有隐患**：`useMemo` 依赖 `event?.target?.getType()` 只看类型不看实例，deps 未变 → 缓存 items 仍基于 A，但 `onClick` 闭包捕获 B → 显示 A、操作 B。继承自原代码，本期不修（见 §4.5.4 警告） |
| 区域 id 与一级项 key 同名（如某 `group.id === "addToExclusiveGroup"`） | `keyPath.indexOf(...)` 会误匹配。区域 id 由后端或 `getRandomString()` 生成，冲突概率极低；沿用原 `keyPath.indexOf("exclusiveGroup")` 模式，本期不做 key 命名空间隔离 |

---

## 8. 验证清单（手动）

项目无自动化测试，以下场景需手动验证：

**结构与呈现**
1. **node 右键（有独占区 + 有三方交管）** → 4 个一级项按 `添加独占区/移除独占区/添加三方交管/移除三方交管` 顺序显示；移除两项红色（danger）。
2. **stage 空白右键 + 框选多 node** → 4 个一级项可展开，区域项 label 形如 `区域A · 3`（添加模式 outCount、移除模式 inCount）。
3. **stage 空白右键 + 未框选** → 4 个一级项**全置灰不可展开**（D8），不弹 warning。
4. **无任何独占区** → `添加独占区`/`移除独占区` 隐藏，只剩三方交管两项（D9）。
5. **两类都无区域** → 4 项全隐藏。

**置灰规则**
6. **添加模式 + 某区域已含全部选中元素** → 该区域项置灰 + label `区域A（全已在）`；其余区域项正常。
7. **移除模式 + 某区域不含任何选中元素** → 该区域项置灰 + label `区域A（不在该区域）`。
8. **某一级项下所有区域项都置灰**（如 node 不在任何独占区 + 点`移除独占区`）→ 该一级项整体置灰（D7）。
9. **单元素右键 + 该元素已在区域A**（添加模式）→ 区域A 置灰 `（全已在）`；单元素可操作项 label 仅 `区域B`（无数量）。

**操作语义（幂等跳过）**
10. **stage 框选 5 node（2 个已在区域A）→ 添加独占区 → 区域A** → label `区域A · 3` → 点击 → 实际加 3 个、跳过 2 个 → `已添加 3 个元素到【区域A】`（D15 不提跳过）。
11. **stage 框选 5 node（2 个已在区域A）→ 移除独占区 → 区域A** → label `区域A · 2` → 点击 → 实际移 2 个、跳过 3 个 → `已移除 2 个元素出【区域A】`。
12. **stage 框选混合 node+edge → 添加独占区 → 区域A** → 一次加入，node 进 nodeIds、edge 进 edgeIds（D5）。
13. **同向路径框选 → 添加三方交管 → 区域X** → 一簇 edge 一次加入。

**操作范围（D4）**
14. **node 右键（命中 ∈ 选中集，选中集 5 个）→ 添加独占区 → 区域A** → 批量 label、操作整个选中集。
15. **node 右键（命中 ∉ 选中集，选中集非空）→ 添加独占区 → 区域A** → 单元素 label 无数量 → 点击 → 仅操作命中元素、**无 message**（D14）。
16. **node 右键（未框选）→ 添加独占区 → 区域A** → 单元素 label `区域A` → 行为与改造前一致（兼容）。

**高亮 / undo / 连续操作**
17. **区域高亮 + 批量移除** → 被移除成员立即褪色；其余区域高亮混色正确。
18. **区域高亮 + 批量添加** → 新成员不上色（幂等）；Drawer 取消再勾选高亮后新成员上色。
19. **undo** → 一次回退整个批量（成员、高亮均恢复）。
20. **连续操作多区域**（框选一次 → 加入区域A → 加入区域B）→ `selectShapes` 保留，第二次仍生效（D20）。
21. **三方交管** → 与独占区对称，全部场景等价。

---

## 9. 决策溯源（访谈轮次）

| 轮次 | 决策项 |
|---|---|
| 第 1 轮 | D1 层级、D3 越界语义、D6 区域项置灰、D14 单元素反馈 |
| 第 2 轮 | D2 排序、D8 未框选呈现、D9 无区域呈现、D10 danger |
| 第 3 轮 | D16 工具重构、D7 一级项置灰统一规则、D11 置灰注释、D4 操作范围 |
| 第 4 轮 | D12 区域项 label、D13 全部区域快捷项、D15 message 文案 |

> **技术沿用项（D17–D23）**：以下 7 项不涉及访谈拍板，为沿用既有实现或无歧义的技术约定，列出以备查证，不计入"4 轮访谈"：
> - **D17 enable 字段**：沿用原 `exclusiveGroup`/`trafficGroup` 的 `["node","edge","stage"]`（前序 B5 已扩展到 stage）。
> - **D18 褪色逻辑**：沿用前序 §4.6"仅移除分支褪色被移除成员，添加分支幂等不褪色"。
> - **D19 undo**：沿用现状"操作前一次 `saveSnapshot()`"。
> - **D20 selectShapes 保留**：沿用前序 B7"操作后不清空，便于连续加入多区域"。
> - **D21 i18n**：沿用 `menuItems` 现状"中文硬编码，不走 locales"。
> - **D22 Drawer**：沿用前序"本期不动"。
> - **D23 key 命名**：单向语义下的新 key 命名，无歧义。

---

## 10. 实施顺序建议

1. 重构 `batchAreaMember.ts`：保留 `resolveOperateMembers`/`collectMembers`/`OperateMember`；删除 `computeAreaItem`/`applyToggleToGroup`/`AreaAction`/`ToggleResult`；新增 `computeAddItem`/`computeRemoveItem`/`applyAddToGroup`/`applyRemoveToGroup`/`AreaItemMeta`/`MembershipResult`（§4.3 + §4.4）；按 §5.5 决定 `buildAreaChildren` 是否下沉。全部函数加多行简体中文注释。
2. 改 `constants/mapThrough.ts` 的 `menuItems`：用 4 个新项替换原 2 项（§5.1）。
3. 改 `ContextMenu/index.tsx` 的 `useMemo`：filter 4 个新 key 守卫 + children 生成 + 一级项 disabled（§4.5）。
4. 改 `ContextMenu/index.tsx` 的 `onClick`：4 个 keyPath 分支委托 `handleAreaClick`，删除原两分支与 `notifyBatchResult`（§4.6 + §5.4）。
5. 按 §8 验证清单逐项手动验证（重点：置灰统一规则 D7/D8、幂等跳过 D3、单元素静默 D14）。
