# 独占区/三方交管区域 批量添加与移除 规格说明

> 状态：已定稿（访谈 4 轮，14 项决策）
> 日期：2026-07-20
> 范围：`src/pages/MapThrough/MapNestModify/NestGraph/ContextMenu/` 右键菜单 + `src/constants/mapThrough.ts` 菜单项
> 不在范围：Drawer（ExclusiveDrawer/TrafficDrawer/PathDrawer/CollapseChildren）、BrushSelect、Overlook

---

## 1. 背景与目标

地图编辑器（MapNestModify）已支持框选批量节点/路径（`BrushSelect` 四模式：默认/节点/路径/同向路径），并支持批量删除（`batchDelete`，stage 空白右键 + `selectShapes`）。

但**独占区（exclusiveGroup）/三方交管区域（trafficGroup）的添加与移除仍只支持单个元素**：右键菜单的子菜单仅操作 `event.target` 命中的单个 node/edge，完全忽略 `selectShapes`。

**目标**：让独占区/三方交管成员的添加与移除支持批量，复用已有的框选选中集（`selectShapes`）。

---

## 2. 现状分析

### 2.1 数据结构

```ts
// src/types/MapNestModify/index.d.ts:70
interface NodeEdgeGroup {
    id: string;
    name: string;
    edgeIds: string[];
    nodeIds: string[];
    userDefinedProperties?: {
        [key: string]: any // 约定字段 nodeEdgeGroupType = SINGLE_VEHICLE（独占区）/ TRIPARTITE_TRAFFIC（三方交管）
    };
}
```

- 独占区与三方交管**同结构**，仅 `nodeEdgeGroupType` 不同。
- 一个区域可同时持有 `nodeIds` 与 `edgeIds`（天然支持 node+edge 混合）。
- `exclusiveGroups` / `trafficGroups` 是两组独立 state，由 `GraphStage` 从 `mapJson.nodeEdgeGroups` 按 type 过滤而来。

### 2.2 现有三入口

| 入口 | 位置 | 批量能力 |
|---|---|---|
| Drawer 抽屉 | `ExclusiveDrawer` / `TrafficDrawer` | `PathDrawer` 用 Checkbox 全列表勾选（单区域批量）；`CollapseChildren` 单个删除 |
| 右键菜单 | `ContextMenu` | **仅单元素**（`event.target`） |
| 框选 | `BrushSelect` | 填充 `selectShapes`（node/edge/同向 edge），供 `batchDelete` 等消费 |

### 2.3 右键菜单现状的关键代码

`ContextMenu/index.tsx:54-120` 的 `useMemo`：

- `menuItems.filter` 按 `event.target` 类型（stage/node/edge/robot）过滤；`exclusiveGroup`/`trafficGroup` 的 `enable` 为 `["node","edge"]`，**仅在 node/edge 命中时显示**。
- `children`（每个区域一项）的 `label`/`danger` 基于**单个** `targetId` + `type` 计算：在区域内→`移除【X】`+`danger`；不在→`添加【X】`。

`ContextMenu/index.tsx:310-362` 的 `onClick`：

- `keyPath.indexOf("exclusiveGroup") !== -1` 分支：对**单个** `targetId` 翻转其在区域的 `nodeIds`/`edgeIds`。
- 操作后 `removeAreaHighlightFromShape(stage, key, targetId)`（移除时褪色、添加幂等空操作）。

### 2.4 核心缺口

右键菜单**完全忽略 `selectShapes`**：

- node/edge 右键 → 只操作 `event.target`。
- stage 空白右键 → 只显示 `batchDelete`/`evenlyInsertNodes`/`alignTwoPoints`（这些才用 `selectShapes`），**不显示**独占区/三方交管子菜单。

---

## 3. 决策清单（B1–B14）

| # | 决策 | 选择 |
|---|---|---|
| **B1** | 批量入口 | ① stage 空白右键（扩展现有项 enable 到 stage） + ② node/edge 右键复用现有子菜单（命中在选中集内时自动批量）。**不含** Drawer |
| **B2** | 批量语义 | **智能判断 + 翻转**：全不在→添加全部；全在→移除全部；混合→每个元素各自翻转（toggle） |
| **B3** | 命中 vs 选中 | 命中元素 ∈ `selectShapes` → 操作整个 `selectShapes`；否则操作单个命中元素 |
| **B4** | node+edge 混合 | **允许**：node 进 `nodeIds`、edge 进 `edgeIds`（与单元素行为一致） |
| **B5** | 菜单形态 | 扩展 `exclusiveGroup`/`trafficGroup` 的 `enable` 为 `["node","edge","stage"]`，**一套子菜单**两种入口共用 |
| **B6** | label 数量 | 操作范围 `length === 1` → 无数量（兼容现有 `添加【X】`/`移除【X】`）；`length > 1` → 带数量 |
| **B7** | 反馈与选中 | `message.success` 反馈 + **保留** `selectShapes`（不清空，便于连续加入多个区域） |
| **B8** | 移除确认 | **不弹确认**，直接执行（区域成员变更风险低，且有 undo 兜底） |
| **B9** | message 文案 | **只报总数**，不拆节点/路径 |
| **B10** | 翻转 label 格式 | `添加{outCount}/移除{inCount}【X】`（紧凑，`/` 分隔） |
| **B11** | `selectShapes` 为空 + stage 右键 | 子菜单**仍显示**，点击任一区域时拦截并 `message.warning("请先框选元素")`（参照 `batchDelete` 的空选拦截模式；文案与 batchDelete 不强求一致） |
| **B12** | 单元素反馈 | 操作范围 `length === 1` 时**静默**（不加 message，兼容现状）；仅批量加 message。与 B13 的区别：B12 按"范围长度"判定，B13 按"命中是否在选中集"判定（B13 必然落入 `length === 1`） |
| **B13** | 命中不在选中集 + `selectShapes` 非空 | **只操作命中元素，静默**（严格按 B3，不加额外提示）。此时操作范围 `length === 1`，同时满足 B12 的静默条件 |
| **B14** | 混合翻转 danger | `danger = true`（红色，因含移除动作） |

---

## 4. 核心设计

### 4.1 关键洞察：统一翻转语义

B2 的三种分支（全添加/全移除/翻转）在**操作层面是同一个动作**——对操作范围内每个元素，翻转其在区域的成员关系：

- 全不在 → 翻转后全部加入（`added = N, removed = 0`）
- 全在 → 翻转后全部移除（`added = 0, removed = N`）
- 混合 → 翻转后部分加部分移除

因此**操作统一为翻转**，仅 `label`/`danger` 根据**翻转前**的 in/out 分布展示不同文案。这把三种语义收敛为一套算法，消除分支歧义。

### 4.2 操作范围判定（`resolveOperateMembers`）

判定"本次菜单操作哪些元素"——`useMemo`（生成 label）与 `onClick`（执行）**都调用**此函数，保证一致。

```ts
interface OperateMember {
    id: string;
    type: "node" | "edge";
}

/**
 * 解析本次右键菜单的操作范围（B3 + B5）。
 * - stage 空白右键（event.target === stage）→ 整个 selectShapes
 * - node/edge 右键 + 命中 id ∈ selectShapes → 整个 selectShapes
 * - node/edge 右键 + 命中 id ∉ selectShapes → 仅命中元素（单元素）
 * - 其余（robot 等）→ 空数组（不会进入独占区/三方交管分支）
 *
 * 仅收集 enableSelect 为 node/edge 的成员，过滤 robot/设备图标等。
 * selectShapes 中可能残留已销毁的 shape 引用——这里只取 attrs.id/enableSelect，
 * 不依赖 shape 存活；后续高亮褪色由 removeAreaHighlightFromShape 内部 findOne 容错。
 */
function resolveOperateMembers(
    event: Konva.KonvaEventObject<MouseEvent> | undefined,
    selectShapes: Konva.Shape[]
): OperateMember[] {
    const target = event?.target;
    const stage = target?.getStage?.();
    if (!target || !stage) return [];

    // stage 空白右键
    if (target === stage) {
        return collectMembers(selectShapes);
    }
    // node/edge 右键
    const targetType = target.attrs?.enableSelect;
    if (targetType === "node" || targetType === "edge") {
        const targetId = target.attrs?.id;
        const inSelection = selectShapes.some(s => s.attrs?.id === targetId);
        if (inSelection) {
            return collectMembers(selectShapes);
        }
        return [{ id: targetId, type: targetType }];
    }
    return [];
}

function collectMembers(shapes: Konva.Shape[]): OperateMember[] {
    return shapes
        .filter(s => s.attrs?.enableSelect === "node" || s.attrs?.enableSelect === "edge")
        .map(s => ({ id: s.attrs?.id, type: s.attrs?.enableSelect }));
}
```

### 4.3 label / danger / action 生成（`computeAreaItem`）

对每个区域，基于操作范围统计 in/out，输出菜单项展示信息。

```ts
type AreaAction = "add" | "remove" | "toggle" | "empty";

interface AreaItemMeta {
    label: string;
    danger: boolean;
    action: AreaAction;
    inCount: number;  // 操作范围内、已在区域内的数量
    outCount: number; // 操作范围内、不在区域内的数量
}

/**
 * 计算某个区域子菜单项的 label/danger（B2 + B6 + B10 + B14）。
 * - members.length === 0（selectShapes 空 + stage 右键）：退化 label，点击时由 onClick 给 warning（B11）
 * - outCount === 0（全在）→ 移除全部；单元素无数量，批量带数量
 * - inCount === 0（全不在）→ 添加全部；单元素无数量，批量带数量
 * - 混合 → 翻转 label「添加{out}/移除{in}【X】」，danger=true
 *
 * 注：members.length === 1 时不可能混合（in+out=1），故翻转 label 仅在批量出现。
 */
function computeAreaItem(members: OperateMember[], group: NodeEdgeGroup): AreaItemMeta {
    let inCount = 0, outCount = 0;
    for (const m of members) {
        const inGroup = m.type === "node"
            ? group.nodeIds.includes(m.id)
            : group.edgeIds.includes(m.id);
        if (inGroup) inCount++; else outCount++;
    }
    const name = group.name;
    const isBatch = members.length > 1;

    if (members.length === 0) {
        return { label: `添加【${name}】`, danger: false, action: "empty", inCount, outCount };
    }
    if (outCount === 0) {
        return {
            label: isBatch ? `移除 ${inCount} 个出【${name}】` : `移除【${name}】`,
            danger: true,
            action: "remove",
            inCount, outCount
        };
    }
    if (inCount === 0) {
        return {
            label: isBatch ? `添加 ${outCount} 个到【${name}】` : `添加【${name}】`,
            danger: false,
            action: "add",
            inCount, outCount
        };
    }
    return {
        label: `添加${outCount}/移除${inCount}【${name}】`,
        danger: true,
        action: "toggle",
        inCount, outCount
    };
}
```

### 4.4 执行翻转（`applyToggleToGroup`）

统一翻转语义（§4.1）：对操作范围内每个成员翻转其在区域的存在性，返回新 `nodeIds`/`edgeIds` 及 added/removed 计数。

```ts
interface ToggleResult {
    nodeIds: string[];
    edgeIds: string[];
    added: number;
    removed: number;
}

/**
 * 对区域 group 应用翻转：操作范围内每个成员，
 * 已在区域→移除；不在区域→添加。返回新成员列表与增减计数。
 * 用 Set 保证幂等去重（与现有单元素 [...new Set(...)] 一致）。
 */
function applyToggleToGroup(group: NodeEdgeGroup, members: OperateMember[]): ToggleResult {
    const nodeSet = new Set(group.nodeIds);
    const edgeSet = new Set(group.edgeIds);
    let added = 0, removed = 0;
    for (const m of members) {
        const set = m.type === "node" ? nodeSet : edgeSet;
        if (set.has(m.id)) {
            set.delete(m.id);
            removed++;
        } else {
            set.add(m.id);
            added++;
        }
    }
    return { nodeIds: [...nodeSet], edgeIds: [...edgeSet], added, removed };
}
```

### 4.5 message 反馈（`notifyBatchResult`）

仅批量（`members.length > 1`）时调用（B7 + B9 + B12）。

```ts
/**
 * 批量操作后的 message 反馈（B9 只报总数）。
 * - 全添加：已添加 N 个元素到【X】
 * - 全移除：已移除 N 个元素出【X】
 * - 混合：已于【X】添加a个、移除b个
 * added=0 && removed=0 不可能（members 非空时翻转必有变化），无需处理。
 */
function notifyBatchResult(added: number, removed: number, name: string): void {
    if (added > 0 && removed === 0) {
        message.success(`已添加 ${added} 个元素到【${name}】`);
    } else if (removed > 0 && added === 0) {
        message.success(`已移除 ${removed} 个元素出【${name}】`);
    } else {
        message.success(`已于【${name}】添加${added}个、移除${removed}个`);
    }
}
```

> 落地位置见 §5.4：因含 `message` 副作用，`notifyBatchResult` 留在组件层（`ContextMenu/index.tsx`），不下沉到 `batchAreaMember.ts`。

### 4.6 高亮褪色

翻转后**被移除**的成员需立即褪色（若区域当前正高亮）；**被添加**的成员不处理（幂等，遵循现有"新增兜底"——等 Drawer 勾选高亮时才上色）。

被移除的成员 = 操作范围内、**翻转前**已在区域的成员（即 §4.3 统计为 `inCount` 的那部分）。在 `setExclusiveGroups` 之前先记录这些 id，翻转后逐个褪色。

```ts
// 翻转前在区域内的成员（这些会被移除 → 需褪色）
const removedIds = members
    .filter(m => (m.type === "node" ? group.nodeIds : group.edgeIds).includes(m.id))
    .map(m => m.id);

// ... setExclusiveGroups(applyToggleToGroup) ...

// 逐个褪色（removeAreaHighlightFromShape 内部 findOne 容错：shape 不存在则跳过）
const stage = event?.target?.getStage();
if (stage) {
    removedIds.forEach(id => removeAreaHighlightFromShape(stage, groupId, id));
    stage.batchDraw();
}
```

> 性能：逐个调用 `removeAreaHighlightFromShape`（每个内含一次 `findOne`）。区域成员量通常 < 百，可接受。若实测密集地图卡顿，后续可抽"一次扫描 stage 收集所有待褪色 shape"的批量工具，**本期不做**（遵循最小化改动）。

---

## 5. 改动点

### 5.1 `src/constants/mapThrough.ts` — menuItems enable 扩展（B5）

```diff
  {
      key: "exclusiveGroup",
      label: "独占区",
-     enable: ["node", "edge"]
+     enable: ["node", "edge", "stage"]
  },
  {
      key: "trafficGroup",
      label: "三方交管区域",
-     enable: ["node", "edge"]
+     enable: ["node", "edge", "stage"]
  }
```

### 5.2 `ContextMenu/index.tsx` — `useMemo` 改造（filter + children）

**filter 调整**：enable 含 stage 后，stage 命中时也会通过 `includes("stage")`，但独占区/三方交管仍需"有区域"才显示：

```ts
const filteredItems = menuItems.filter(item => {
    const isStage = event?.target.getStage() === event?.target;
    if (isStage) {
        if (!item.enable.includes("stage")) return false;
        // stage 命中时，独占区/三方交管仍需有区域才显示（与 node/edge 分支一致）
        if (item.key === "exclusiveGroup") return !!exclusiveGroups?.length;
        if (item.key === "trafficGroup") return !!trafficGroups?.length;
        return true;
    }
    if (event?.target.attrs.enableSelect === "node" || event?.target.attrs.enableSelect === "edge") {
        if (item.key === "exclusiveGroup") return !!exclusiveGroups?.length;
        if (item.key === "trafficGroup") return !!trafficGroups?.length;
        return item.enable.includes(event?.target.attrs.enableSelect);
    }
    if (event?.target.attrs.isRobot) return item.enable.includes("robot");
    return false;
});
```

**children 生成**：用 `resolveOperateMembers` + `computeAreaItem` 替换原基于 `targetId`/`type` 的单元素逻辑：

```ts
const operateMembers = resolveOperateMembers(event, selectShapes);

const itemsWithChildren = (exclusiveGroups?.length || trafficGroups?.length)
    ? filteredItems.map(item => {
        let children;
        if (item.key === "exclusiveGroup") {
            children = exclusiveGroups?.map(group => {
                const meta = computeAreaItem(operateMembers, group);
                return { key: group.id, label: meta.label, danger: meta.danger };
            });
        } else if (item.key === "trafficGroup") {
            children = trafficGroups.map(group => {
                const meta = computeAreaItem(operateMembers, group);
                return { key: group.id, label: meta.label, danger: meta.danger };
            });
        }
        return { ...item, children };
    })
    : filteredItems;
```

**`evenlyInsertNodes`/`alignTwoPoints` 置灰**：现有 `twoNodesSelected` 逻辑保留，但需同步变量名——原 `const finalItems = (exclusiveItems || items).map(...)` 中的 `exclusiveItems`/`items` 要替换为本节新名 `itemsWithChildren`/`filteredItems`：

```ts
const finalItems = (itemsWithChildren || filteredItems).map(item =>
    item.key === "evenlyInsertNodes" || item.key === "alignTwoPoints"
        ? { ...item, disabled: !twoNodesSelected }
        : item
);
return { items: finalItems };
```

**useMemo 依赖**：保持 `[selectShapes, event?.target?.getType(), exclusiveGroups, trafficGroups]`（`selectShapes` 已在内，label 随选中集变化实时更新）。

### 5.3 `ContextMenu/index.tsx` — `onClick` 改造

`keyPath.indexOf("exclusiveGroup") !== -1` 与 `trafficGroup` 两个分支，从"操作单个 targetId"改为"操作 operateMembers"：

```ts
if (keyPath.indexOf("exclusiveGroup") !== -1) {
    const operateMembers = resolveOperateMembers(event, selectShapes);
    // B11：操作范围为空（stage 右键 + 未框选 / 选中集无 node|edge）→ warning，不动 state
    if (!operateMembers.length) {
        message.warning("请先框选元素");
        return;
    }
    const targetGroup = exclusiveGroups.find(g => g.id === key);
    // 守卫前置：targetGroup 找不到（区域被并发删除等）时直接 return，
    // 必须在 saveSnapshot 之前，否则会压入"无操作"的空快照，污染 undo 栈
    if (!targetGroup) return;

    saveSnapshot(); // 整个批量算 1 次快照（与现有单元素一致：操作前一次）

    // 对 targetGroup 计算一次翻转结果（含 added/removed/nodeIds/edgeIds），
    // setExclusiveGroups 与 message 共用，避免"写 state 一次、取计数又一次"的双调
    const toggleResult = applyToggleToGroup(targetGroup, operateMembers);

    // 翻转前在区域内的成员 → 翻转后会被移除 → 需褪色
    const removedIds = operateMembers
        .filter(m => (m.type === "node" ? targetGroup.nodeIds : targetGroup.edgeIds).includes(m.id))
        .map(m => m.id);

    setExclusiveGroups(groups => groups.map(g =>
        g.id !== key ? g : { ...g, nodeIds: toggleResult.nodeIds, edgeIds: toggleResult.edgeIds }
    ));

    // 高亮褪色（被移除成员）
    const stage = event?.target?.getStage();
    if (stage) {
        removedIds.forEach(id => removeAreaHighlightFromShape(stage, key, id));
        stage.batchDraw();
    }

    // B7 + B12：仅批量反馈
    if (operateMembers.length > 1) {
        notifyBatchResult(toggleResult.added, toggleResult.removed, targetGroup.name);
    }
    return;
}
// trafficGroup 分支同构，与上面 exclusiveGroup 的差异仅在：
//   - 数据源：exclusiveGroups → trafficGroups
//   - setter：setExclusiveGroups → setTrafficGroups
// resolveOperateMembers / applyToggleToGroup / removedIds / 褪色 / notifyBatchResult 完全一致
```

> `applyToggleToGroup` 只调用一次：在 `setExclusiveGroups` 之前对 `targetGroup` 计算出完整 `toggleResult`（含 `added`/`removed`/`nodeIds`/`edgeIds`），updater 直接消费预计算结果，message 也直接读 `toggleResult.added/removed`。"写入"与"计数"同源，避免双调在并发 setState 场景下两次输入可能不一致的理论风险。

### 5.4 公共工具函数落地位置

**纯逻辑函数**下沉到同目录新文件（不依赖 antd / 无 UI 副作用）：

- `resolveOperateMembers` / `collectMembers`
- `computeAreaItem`
- `applyToggleToGroup`

```
src/pages/MapThrough/MapNestModify/NestGraph/ContextMenu/batchAreaMember.ts
```

**`notifyBatchResult` 留在组件层**（`ContextMenu/index.tsx`）：其内部调用 `message.success(...)`，若下沉会让纯逻辑模块耦合 antd 副作用，违背"工具文件不放 UI 副作用"的约定。组件层已 `import { message } from "antd"`（`index.tsx:6`），直接调用即可；若要复用文案组装，可把"根据 added/removed 组装文案字符串"拆成纯函数 `formatBatchResultText(added, removed, name)` 下沉，`message.success` 调用仍留组件。

**`batchAreaMember.ts` import 清单**：

```ts
import type Konva from "konva";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
```

理由：仅 `ContextMenu` 使用，贴近消费处；不污染全局 `utils`；未来若 Drawer 需要复用再上提。全部函数加多行简体中文注释（遵循项目约定）。

---

## 6. 不改的部分

- **Drawer**（`ExclusiveDrawer`/`TrafficDrawer`/`PathDrawer`/`CollapseChildren`）：本期不动。`PathDrawer` 的 Checkbox 全列表与右键批量入口功能上有重叠，但用户明确未选 Drawer 入口（B1）。
- **BrushSelect**：四模式（默认/节点/路径/同向路径）不变，`selectShapes` 填充逻辑不变。
- **Overlook** 画布：不涉及。
- **现有单元素右键行为**：操作范围 `length === 1` 时，label 无数量、静默、不弹确认——与改造前完全一致（向后兼容，B6 + B12 + B8）。

---

## 7. 边界与容错

| 场景 | 处理 |
|---|---|
| `selectShapes` 为空 + stage 右键 | `operateMembers = []`；子菜单仍显示（B11）；点击区域时 `warning("请先框选元素")` 并 return，不动 state |
| `selectShapes` 为空 + node/edge 右键 | `operateMembers = [命中元素]`（单元素）；走兼容路径 |
| 命中元素 ∉ `selectShapes` + `selectShapes` 非空 | 仅操作命中元素，静默（B13） |
| `selectShapes` 含已销毁的 shape 引用 | `resolveOperateMembers` 只取 `attrs.id`/`enableSelect`，不依赖存活；褪色时 `removeAreaHighlightFromShape` 内 `findOne` 失败则 `return`（已有容错） |
| node + edge 混合 | 允许（B4）；node 进 `nodeIds`、edge 进 `edgeIds`，互不干扰 |
| 同向路径（`brushSelectSameDir`）框选 | `selectShapes` 全是 edge，作为普通批量加入；无特殊处理 |
| 区域正在高亮 + 批量添加新成员 | 新成员不上色（幂等，遵循现有"新增兜底"）；用户在 Drawer 取消再勾选高亮时才上色 |
| 区域正在高亮 + 批量移除成员 | 被移除成员立即褪色（§4.6） |
| 撤销（undo） | `saveSnapshot()` 在批量前调一次，undo 一次回退整个批量操作 |
| 无任何区域（`exclusiveGroups.length === 0`） | 独占区子菜单不显示（filter 中 `!!exclusiveGroups?.length` 守卫，stage/node/edge 三分支一致） |
| `targetGroup` 找不到（区域被并发删除等异常） | `if (!targetGroup) return`（守卫在 `saveSnapshot` **之前**，避免压入空快照污染 undo 栈），不动 state |
| `selectShapes` 非空但全是非 node/edge（默认框选选入 robot 等） | `collectMembers` 过滤后 `operateMembers` 为空 → 等同 B11：子菜单显示，点击区域 warning，不动 state |
| `selectShapes` 残留已销毁 shape 引用（其 `attrs.id` 仍可读） | 褪色由 `findOne` 容错（见上）；但 `applyToggleToGroup` 会把该幽灵 id 写入 `nodeIds`/`edgeIds`（无效成员）。BrushSelect 框选时通常只收存活 shape，此边界几乎不触发，**本期不处理**，后续若出现可加"写入前校验 shape 存活" |

---

## 8. 验证清单（手动）

项目无自动化测试，以下场景需手动验证：

1. **stage 空白右键 + 框选多 node** → 独占区子菜单显示 `添加 N 个到【X】`（非 danger）→ 点击 → 成员加入 + `已添加 N 个元素到【X】` + `selectShapes` 保留。
2. **stage 空白右键 + 框选多 edge** → 同 1，edge 进 `edgeIds`。
3. **stage 空白右键 + 框选混合 node+edge** → 一次加入，node/edge 分别入对应数组（B4）。
4. **node 右键（命中 ∈ 选中集，选中集含多个）** → 子菜单批量 label → 点击 → 整个选中集操作。
5. **node 右键（命中 ∉ 选中集，选中集非空）** → 子菜单单元素 label（无数量）→ 点击 → 仅操作命中元素，**无 message**（B13 + B12）。
6. **node 右键（未框选，选中集仅命中自身）** → 单元素 label `添加【X】`/`移除【X】`，行为与改造前一致（兼容）。
7. **全在区域**（选中集元素都已在 X 内）→ label `移除 N 个出【X】` + `danger=true` → 点击 → 翻转移除 + `已移除 N 个元素出【X】`。
8. **混合**（选中集部分在 X 内）→ label `添加{out}/移除{in}【X】` + `danger=true` → 点击 → 各自翻转 + `已于【X】添加a个、移除b个`。
9. **stage 空白右键 + 未框选** → 子菜单仍显示 → 点击区域 → `warning("请先框选元素")`，state 不变（B11）。
10. **区域高亮 + 批量移除** → 被移除成员立即褪色；其余区域高亮混色正确（`blendColors`）。
11. **区域高亮 + 批量添加** → 新成员不上色（幂等）；Drawer 取消再勾选高亮后新成员上色。
12. **undo** → 一次回退整个批量操作（成员、高亮均恢复）。
13. **连续操作多区域**（框选一次 → 加入 A → 加入 B）→ `selectShapes` 保留，第二次操作仍生效（B7）。
14. **三方交管（trafficGroup）** → 与独占区对称，全部场景等价。
15. **同向路径框选 + 批量加入三方交管** → 一簇 edge 一次加入（典型场景）。

---

## 9. 决策溯源（访谈轮次）

| 轮次 | 决策项 |
|---|---|
| 第 1 轮 | B1 入口、B2 语义、B3 命中vs选中、B4 混合类型 |
| 第 2 轮 | B5 菜单形态、B6 label数量、B7 反馈与选中、B8 移除确认 |
| 第 3 轮 | B9 文案粒度、B10 翻转label、B11 空选中、B12 单元素反馈 |
| 第 4 轮 | B13 选中集外命中提示、B14 翻转danger |

---

## 10. 实施顺序建议

1. 新建 `ContextMenu/batchAreaMember.ts`，实现 §4.2–§4.4 的 4 个纯逻辑函数（`resolveOperateMembers` / `collectMembers` / `computeAreaItem` / `applyToggleToGroup`，含中文注释）；`notifyBatchResult` 按 §5.4 留组件层（`ContextMenu/index.tsx`）。
2. 改 `constants/mapThrough.ts` 的 `menuItems` enable（§5.1）。
3. 改 `ContextMenu/index.tsx` 的 `useMemo`（§5.2）。
4. 改 `ContextMenu/index.tsx` 的 `onClick` 两个分支（§5.3）。
5. 按 §8 验证清单逐项手动验证。
