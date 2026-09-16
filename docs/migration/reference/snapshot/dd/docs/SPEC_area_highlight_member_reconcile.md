# SPEC：区域高亮随成员变动对账（独占区 / 三方交管）

> 状态：设计规格（核心决策经两轮访谈确认）
> 日期：2026-07-17
> 关联代码：`src/pages/MapThrough/MapNestModify/NestGraph/GraphMenu/AreaDropdown/ExclusiveDrawer/index.tsx`、`.../TrafficDrawer/index.tsx`、`.../ExclusiveDrawer/CollapseChildren/index.tsx`、`.../TrafficDrawer/CollapseChildren/index.tsx`、`.../ExclusiveDrawer/PathDrawer/index.tsx`、`.../TrafficDrawer/PathDrawer/index.tsx`、`src/pages/MapThrough/MapNestModify/NestGraph/ContextMenu/index.tsx`、新增 `src/utils/areaHighlight.ts`

> 注：文中行号为撰写时快照，后续代码变动后可能失准；定位请以函数名 / 分支描述为准，行号仅作辅助。

---

## 1. 背景与目标

MapNestModify 编辑器的「区域」功能含两类分组：**独占区**（`SINGLE_VEHICLE`）与**三方交管区**（`TRIPARTITE_TRAFFIC`），均支持「高亮」——把区域内节点 / 路径在画布上染色（节点 fill、路径 stroke、label labelFill），多区域叠加时按颜色混色。

**缺陷现象**：
1. 勾选某区域「高亮」 → 该区域成员染色；
2. 右键单个节点 / 路径 →「移除【区域名】」，把它从区域成员里删掉；
3. 此时该节点 / 路径**染色残留不褪**（画布颜色仍在）；
4. 再点「高亮 / 取消高亮」勾选框来回切换，残留色**始终不消失**。

**根因**：高亮态分散在两处——React 的 `highlightedAreas: Set<string>`（在两个 Drawer 内部）+ 命令式写在每个 shape 上的 `highlightColorMap` / `originalColors` / 被改写后的 `shapeStyle`。而所有「改变区域成员」的入口（右键菜单、CollapseChildren 列表删除、PathDrawer 勾选）**只更新 `setExclusiveGroups / setTrafficGroups`，从不同步 shape 上的高亮**；取消高亮时 `applyHighlightToStage` 又只遍历「当前成员」，于是被移除的 shape 的残留色永远清不掉。

**目标**：
- **删除实时**：从高亮区域移除成员时，该 shape 立即褪色（无需 toggle）。
- **新增兜底**：向高亮区域新增成员时不立即上色，留待下次勾选高亮时对账（保持现状语义，避免改造所有入口的上色路径）。
- **toggle 兜底**：取消高亮时做全 stage 扫描，确保该区域在任意 shape 上的残留色被清干净。
- **对称覆盖**：独占区与三方交管区做同样修复。

> 范围限定：仅 MapNestModify 编辑器画布。撤销 / 恢复的高亮一致性**不在本次范围**（D4）。

---

## 2. 现状回顾（实现基线）

### 2.1 高亮写态（`ExclusiveDrawer/index.tsx` 104-167 / `TrafficDrawer/index.tsx` 127-193）

`applyHighlightToStage(itemKey, checked)` 不更新 React state，仅命令式操作 stage：

- **`checked=true`**：遍历 `allIds = [...nodeIds, ...edgeIds]`，对每个 shape：
  - 首次染色时用 `originalColors` 备份原 `fill / stroke / labelFill`；
  - `colorMap[itemKey] = areaColor`（`getAreaColor(id)` 哈希取色）；
  - 用 `blendColors(Object.values(colorMap))` 混色后写 `shapeStyle`（节点改 fill、路径改 stroke、label 改 labelFill）。
- **`checked=false`**：遍历 `allIds`，对每个 shape `delete colorMap[itemKey]`；空则还原 `originalColors`，非空则重新混色。

> **缺陷落点**：`checked=false` 只遍历 `allIds`（当前成员），已被移除的 shape 不在其中 → 残留色清不掉。

`handleHighlightExclusiveArea / handleHighlightTrafficArea` 调用上面函数后 `stage.batchDraw()`、更新 `highlightedAreas` Set、并可选地平移画布到首个成员（`calcStagePosition` 兼容旋转 / 缩放）。

### 2.2 颜色与混色

- `getAreaColor(id)`：按 id 哈希在各自调色板取色。**独占区与三方交管区调色板不同**（`AREA_COLORS` 数组不同），故 `getAreaColor` 必须留在各自 Drawer。
- `blendColors(colors)`：纯函数，RGB 均值混色。两个 Drawer 内**完全重复**。

### 2.3 改变区域成员的三类入口（均不在 Drawer 内、均拿不到高亮逻辑）

| 入口 | 文件 | 行为 | 是否 saveSnapshot |
| --- | --- | --- | --- |
| 右键菜单增 / 删单个成员 | `ContextMenu/index.tsx` `onContextMneuClick` 302-342 | 按 `keyPath` 命中 `exclusiveGroup` / `trafficGroup`，toggle 单个 `targetId` | 是（304 / 324） |
| 列表删除单个成员 | `CollapseChildren/index.tsx` `handleDelClick` | 从 `areaId` 的 `nodeIds` / `edgeIds` 过滤掉单个 id | 否 |
| 勾选整体替换成员 | `PathDrawer/index.tsx` `onCheckboxChange` | 用勾选集合整体覆盖 `currentArea` 的 `nodeIds` / `edgeIds` | 否 |

> 三者都只调 `setExclusiveGroups / setTrafficGroups`，**没有任何 stage 高亮同步**。

### 2.4 既有「先取消高亮再删区域」先例（`CollapseExtra/index.tsx`）

`handleDelClick` 在删除整个区域前，若该区域高亮中会先 `onHighlightExclusiveArea(itemKey, false)`——说明社区已意识到「删区域需先清高亮」。本次修复后，这条路径由 toggle 全扫描兜底自动覆盖。

### 2.5 两个隐患（与修复策略强相关）

- **撤销栈含高亮（经代码复核，原描述有误，已更正）**：`saveSnapshot` → `createCurrentSnapshot`（`undoHistory.ts` 的 `createCurrentSnapshot`）通过 `shape.getAttrs()` 捕获**全部** attrs，**包含 `highlightColorMap` / `originalColors` / 被改写的 `shapeStyle`**（并对 `shapeStyle` 深拷贝）。`applySnapshot` 并非「只回放分组」，而是依次：删除多余 shape → 重建缺失 shape → `shape.setAttrs(snapData.attrs)` 回放**全部 shape attrs（含高亮三项）** → 回放分组 `setExclusiveGroupsFn / setTrafficGroupsFn` → `applyVisualScaleToAllShapes` 重算缩放；其中 `applyVisualScaleToAllShapes` 明确保留 `fill / stroke / labelFill`（见其源码注释），不会覆盖回放回来的高亮色。因此**撤销「移除成员」本身会把颜色连同 attrs 一起恢复**（`saveSnapshot` 在 `ContextMenu` 移除前调用，捕获的就是带色状态）。真正未被回放的是 `highlightedAreas`（Drawer 内 React state，undoHistory 取不到），失配方向是**反方向**：撤销一个「早于高亮」的操作时，快照里没有高亮色 → 画布掉色，但 `highlightedAreas` 仍勾选。属既有问题，**本次不处理（D4）**。
- **两系统共用同一 shape 的 `highlightColorMap`**：独占区与三方交管区 areaId 全局唯一（`getRandomString`），同节点同时被两类区域高亮时按 areaId 混色。本次修复按 areaId 精确增删，天然互不影响（D6）。

---

## 3. 需求详述

### 3.1 用户故事

> 作为地图编辑者，我希望：
> - 把节点 / 路径从「高亮中的区域」移除（右键 / 列表 / PathDrawer 取消勾选）→ 它**立即褪色**；
> - 取消某区域高亮 → 画布上该区域的**所有**染色（含一切历史残留）被清干净；
> - 向「高亮中的区域」新增成员 → 沿用现状暂不上色，下次勾选高亮时自然对账；
> - 独占区与三方交管区行为一致；同节点同时属两类高亮区域时维持混色。

---

## 4. 设计决策（访谈结论）

| # | 决策 | 选项 | 依据 |
| --- | --- | --- | --- |
| D1 | **对账时机** | 删除实时 + 新增兜底（移除立即褪色；新增不实时，留待 toggle 对账） | R1-Q1 |
| D2 | **跨系统同节点展示** | 维持混色（独占 + 交管同节点按 areaId 混色，修复按 areaId 精确增删互不影响） | R1-Q4 |
| D3 | **重复代码处理** | 就地各改一份：仅抽取极小共用工具，不做大重构 | R1-Q3 |
| D4 | **撤销 / 恢复一致性** | 不在本次范围。经代码复核：撤销「移除成员」会随 shape attrs 一起恢复颜色（非原以为的「不恢复」）；真正的失配是 `highlightedAreas` 未纳入快照导致**反方向**掉色（撤销早于高亮的操作时画布掉色而勾选态仍亮），本次不处理 | R1-Q2 / R2-Q3 |
| D5 | **实时褪色落地机制** | 抽极小共用工具 `removeAreaHighlightFromShape`，入口与 Drawer 共用 | R2-Q1 |
| D6 | **toggle-off 行为** | 保留「全 stage 扫描移除 areaId」作为安全兜底 | R2-Q2 |

### 4.1 D3 与 D5 的协调

两条决策合起来：**不重构两个 Drawer 既有的 ~150 行重复**（`getAreaColor` 因调色板不同本就无法共用；`applyHighlightToStage` 的上色分支、`handleHighlight*`、`handleClose`、`collapseItems` 各自保留），**仅**把「单个 shape 移除某 areaId 高亮」这段被多处需要的逻辑 + `blendColors` 抽成一个极小共用文件 `src/utils/areaHighlight.ts`，供 Drawer 与三类入口共用。这是唯一的共享点，非大重构。

### 4.2 D1 对账时机推演

| 操作 | 区域是否高亮 | 行为 |
| --- | --- | --- |
| 移除成员 | 是 | 该 shape 立即褪色（入口调 util） |
| 移除成员 | 否 | util 幂等空操作（shape 无该 areaId） |
| 新增成员 | 是 | 暂不上色；下次 toggle 高亮时由 `applyHighlightToStage(checked=true)` 对账上色 |
| 新增成员 | 否 | 无高亮可上，无操作 |
| 取消高亮 | — | 全 stage 扫描清掉该 areaId（D6） |
| 再次勾选高亮 | — | 仅当前成员上色（已移除的不会再上色） |

---

## 5. 边界与异常

| 场景 | 行为 |
| --- | --- |
| 从高亮区域移除成员 | 立即褪色（D1） |
| 从非高亮区域移除成员 | util 幂等空操作，无副作用 |
| 向高亮区域新增成员 | 暂不上色，待下次 toggle 对账（D1） |
| 取消高亮（toggle off） | 全 stage 扫描清除该 areaId 的所有残留（D6） |
| 删除整个高亮中的区域 | `CollapseExtra.handleDelClick` 先 `onHighlight(itemKey,false)` → 全扫描清色 → 再移除区域（既有流程，现由 D6 兜底） |
| 关闭抽屉 | `handleClose` 遍历 `highlightedAreas` 逐个 `applyHighlightToStage(*,false)` 全扫描（既有流程，现由 D6 兜底） |
| 同节点同时属「高亮独占区」+「高亮交管区」 | 混色；从任一区域移除只删对应 areaId，另一区域颜色保留并重新混色（D2） |
| shape 已被销毁 / 不在 stage | util `findOne` 返回空，直接 return |
| 撤销「移除成员」 | 成员回到分组，**颜色随 shape attrs 一并恢复**（`saveSnapshot` 在移除前已捕获带色状态，`applySnapshot` 经 `setAttrs` 回放，`applyVisualScaleToAllShapes` 保留高亮色） |
| 撤销 / 恢复 | 不回放 `highlightedAreas`；撤销「早于高亮」的操作时画布会掉色而勾选态仍亮（反方向失配，D4，既有行为，本次不处理） |
| 区域高亮中但成员为空 | 无 shape 可染色；后续新增成员走「新增兜底」 |

---

## 6. 技术实现方案

### 6.1 涉及文件

| 文件 | 改动 |
| --- | --- |
| `src/utils/areaHighlight.ts` | **新增**：`blendColors`（从两 Drawer 抽出）+ `removeAreaHighlightFromShape(stage, areaId, shapeId)` |
| `ExclusiveDrawer/index.tsx` | 删本地 `blendColors`，改从 util import；`applyHighlightToStage` 的 `checked=false` 分支改为「全 stage 扫描 + util」 |
| `TrafficDrawer/index.tsx` | 同上 |
| `ContextMenu/index.tsx` | `exclusiveGroup` / `trafficGroup` 分支：`setExclusiveGroups / setTrafficGroups` 之后对 `targetId` 调 util + `batchDraw`（新增为幂等空操作） |
| `ExclusiveDrawer/CollapseChildren/index.tsx` | `handleDelClick` 删除后对 `id` 调 util + `batchDraw` |
| `TrafficDrawer/CollapseChildren/index.tsx` | 同上 |
| `ExclusiveDrawer/PathDrawer/index.tsx` | `onCheckboxChange` 计算被移除集合（旧成员 \ 新勾选），逐个调 util，最后 `batchDraw` 一次 |
| `TrafficDrawer/PathDrawer/index.tsx` | 同上 |

### 6.2 新增 `src/utils/areaHighlight.ts`

`blendColors` 原样抽取；`removeAreaHighlightFromShape` 即 `applyHighlightToStage` 现有 `checked=false` 单 shape 分支的精确提取，**按 areaId 精确移除**，幂等。

```ts
/**
 * @description 区域高亮(独占区/三方交管)的公共命令式工具。
 *              blendColors 从两个 Drawer 抽取去重；removeAreaHighlightFromShape
 *              供 Drawer 的 toggle 全扫描兜底与三类成员变动入口(右键/列表/PathDrawer)
 *              共用，保证"从高亮区域移除成员时立即褪色"(决策 D1/D5)。
 */
import type Konva from "konva";

/**
 * 混合多个十六进制颜色(#RRGGBB)，取 RGB 均值后返回大写 hex。
 * 抽取自独占区/三方交管 Drawer 的同名重复实现，供高亮对账公共使用。
 * @param colors 颜色数组
 * @returns 混色后的颜色字符串
 */
export function blendColors(colors: string[]): string {
    if (colors.length === 0) return "#000000";
    if (colors.length === 1) return colors[0].toUpperCase();
    let r = 0, g = 0, b = 0;
    for (const hex of colors) {
        r += parseInt(hex.slice(1, 3), 16);
        g += parseInt(hex.slice(3, 5), 16);
        b += parseInt(hex.slice(5, 7), 16);
    }
    const n = colors.length;
    return `#${Math.round(r / n).toString(16).padStart(2, "0")}${Math.round(g / n).toString(16).padStart(2, "0")}${Math.round(b / n).toString(16).padStart(2, "0")}`.toUpperCase();
}

/**
 * 从单个 shape 上移除某个区域的高亮条目(按 areaId 精确移除)。
 * - shape 上 highlightColorMap 无该 areaId → 直接返回(幂等：新增成员时调用也安全)。
 * - 移除后仍有其它区域高亮 → 用剩余颜色重新混色并更新 shapeStyle(节点 fill、路径 stroke、label labelFill)。
 * - 移除后无任何区域高亮 → 还原 originalColors，清空 highlightColorMap / originalColors。
 * 不触发 batchDraw，由调用方统一刷新，避免批量场景多次重绘。
 * @param stage Konva 舞台
 * @param areaId 要移除的区域 ID
 * @param shapeId 目标 shape 的 id
 */
export function removeAreaHighlightFromShape(stage: Konva.Stage, areaId: string, shapeId: string): void {
    const shape = stage.findOne(`#${shapeId}`);
    if (!shape) return;
    const colorMap: Record<string, string> = { ...((shape.getAttr("highlightColorMap") as Record<string, string>) || {}) };
    // 无该区域高亮条目，幂等跳过(新增成员/区域未高亮等场景)
    if (!Object.prototype.hasOwnProperty.call(colorMap, areaId)) return;
    delete colorMap[areaId];
    const currentStyle = shape.attrs.shapeStyle || {};
    const isNode = shape.attrs.enableSelect === "node";
    if (Object.keys(colorMap).length === 0) {
        // 无任何高亮区域残留：还原原始颜色
        const originalColors = shape.getAttr("originalColors");
        if (originalColors) {
            shape.setAttrs({
                highlightColorMap: {},
                originalColors: undefined,
                shapeStyle: { ...currentStyle, ...originalColors }
            });
        } else {
            // 兜底：originalColors 缺失（异常态，正常首次染色必写入）时，
            // 至少清掉 highlightColorMap，避免 shape 残留空映射条目
            shape.setAttr("highlightColorMap", {});
        }
    } else {
        // 仍有其它区域高亮：用剩余颜色重新混色(维持 D2 混色语义)
        const blended = blendColors(Object.values(colorMap));
        shape.setAttrs({
            highlightColorMap: colorMap,
            shapeStyle: {
                ...currentStyle,
                fill: isNode ? blended : currentStyle.fill,
                stroke: isNode ? currentStyle.stroke : blended,
                labelFill: blended
            }
        });
    }
}
```

> 与既有 `checked=false` 分支逐行等价；差别仅在于「按单个 shapeId 操作」+「无 areaId 时幂等返回」。`getAreaColor` 不在此文件（调色板不同，留各 Drawer）。

### 6.3 Drawer：`applyHighlightToStage` 取消分支改全扫描（D6）

两个 Drawer 同改。以 `ExclusiveDrawer/index.tsx` 为例（138-164 行原 `else` 分支替换）：

```ts
} else {
    // 决策 D6：取消高亮时做全 stage 扫描兜底，清理所有持有该 areaId 的 shape
    //         （含已被移除出成员列表、但残留高亮色的 shape），用公共工具逐个精确移除
    const staleShapes = stage.find((node: Konva.Node) => {
        const map = node.getAttr("highlightColorMap");
        return !!map && Object.prototype.hasOwnProperty.call(map, itemKey);
    }) as Konva.Shape[];
    staleShapes.forEach(s => removeAreaHighlightFromShape(stage, itemKey, s.id()));
}
```

> `checked=true` 分支不变（仍遍历 `allIds` 上色）；`return allIds` 保留（仅 `checked` 时用于聚焦）。删掉两 Drawer 内本地 `blendColors`，改 `import { blendColors, removeAreaHighlightFromShape } from "@/utils/areaHighlight"`。`handleClose`、`CollapseExtra.handleDelClick` 无需改动——它们都经 `applyHighlightToStage(*, false)` 走全扫描。

### 6.4 `ContextMenu/index.tsx`：移除即褪色

`onContextMneuClick` 的 `exclusiveGroup` / `trafficGroup` 两分支，在 `setExclusiveGroups / setTrafficGroups` 之后对 `targetId` 调 util。util 对「新增」幂等空操作，故无需区分增 / 删。

> `key` 即区域 id：菜单 children 的 `key` 就是 `exclusive.id` / `traffic.id`（见 `ContextMenu/index.tsx` 构造 children 处，`group.id !== key` 的判断亦佐证），故可直接作 areaId 传入。`targetId` 取自 `event?.target.attrs?.id`。

```ts
if (keyPath.indexOf("exclusiveGroup") !== -1) {
    saveSnapshot();
    const type = event?.target.attrs.enableSelect;
    const targetId = event?.target.attrs?.id;
    setExclusiveGroups(groups => /* 既有 toggle 逻辑不变 */);
    // 决策 D1：移除成员时立即褪色；新增时 util 幂等空操作
    const stage = event?.target?.getStage();
    if (stage && targetId) {
        removeAreaHighlightFromShape(stage, key, targetId);
        stage.batchDraw();
    }
    return;
}
// trafficGroup 分支同构：removeAreaHighlightFromShape(stage, key, targetId)
```

### 6.5 `CollapseChildren`：删除即褪色

两个 Drawer 的 `CollapseChildren/index.tsx` `handleDelClick` 恒为移除，直接调 util：

```ts
const handleDelClick = ({ id, type }) => {
    setExclusiveGroups(areas => /* 既有过滤不变 */);
    // 决策 D1：从高亮区域删除成员，立即褪色(区域未高亮时 util 幂等)
    if (stage) {
        removeAreaHighlightFromShape(stage, areaId, id);
        stage.batchDraw();
    }
};
```

### 6.6 `PathDrawer`：整体替换时为「被移除集合」褪色

两个 Drawer 的 `PathDrawer/index.tsx` `onCheckboxChange` 为整体覆盖，需计算被移除集合（旧成员 \ 新勾选），逐个调 util，最后批量重绘一次：

```ts
const onCheckboxChange = (checkedValues) => {
    // 既有：按 enableSelect 把 checkedValues 拆成 nodeIds / edgeIds
    // ...
    // 决策 D1：计算被移除成员(旧成员 \ 新勾选)，立即褪色
    if (stage && currentArea) {
        const prev = exclusiveGroups.find(a => a.id === currentArea);
        const prevIds = prev ? [...prev.nodeIds, ...prev.edgeIds] : [];
        const newSet = new Set([...nodeIds, ...edgeIds]);
        prevIds.filter(id => !newSet.has(id)).forEach(id => {
            removeAreaHighlightFromShape(stage, currentArea, id);
        });
        stage.batchDraw();
    }
    setExclusiveGroups(areas => /* 既有覆盖逻辑不变 */);
};
```

> 「新增」成员（新勾选但旧区域已高亮）不在此处理，遵循 D1 新增兜底，下次 toggle 高亮对账。

### 6.7 实现纯度与一致性

- `removeAreaHighlightFromShape` 只读 / 写 shape 的 `highlightColorMap` / `originalColors` / `shapeStyle`，**不依赖坐标 / 缩放 / 旋转**，无 `visualScale` 坑。
- 不调 `saveSnapshot`，不污染 undo 栈（与既有高亮操作一致）。
- 所有调用方各只 `batchDraw` 一次；util 本身不重绘。
- 跨系统（独占 + 交管）天然隔离：areaId 全局唯一，util 只动传入的那个 areaId，另一系统的条目保留并参与重新混色（D2）。

---

## 7. 交互与反馈

- **静默操作**：移除成员褪色、toggle 全扫描清色均不弹 `message`、不加动画（与既有高亮瞬时 `setAttrs` 一致）。
- **画布平移**：仅「勾选高亮（checked=true）」时平移到首个成员（沿用 `calcStagePosition`），褪色 / 清色不平移。
- **性能**：全扫描为一次 `stage.find` 谓词遍历 O(n)，仅在「取消高亮」与 PathDrawer 整体替换时触发，非连续高频路径，大地图可接受。

---

## 8. 验收用例

### 8.1 核心：移除即褪色（D1）

| # | 场景 | 预期 |
| --- | --- | --- |
| 1 | 高亮区域 A（含节点 X）→ 右键 X「移除【A】」 | X 立即褪色，无需 toggle |
| 2 | 高亮区域 A（含路径 E）→ 右键 E「移除【A】」 | E 立即褪色 |
| 3 | 高亮区域 A（含 X）→ CollapseChildren 列表删 X | X 立即褪色 |
| 4 | 高亮区域 A（含 X、Y）→ PathDrawer 取消勾选 X | X 立即褪色，Y 保持 |
| 5 | 区域 A 未高亮 → 右键 X「移除【A】」 | 无副作用（util 幂等） |

### 8.2 toggle 全扫描兜底（D6）

| # | 场景 | 预期 |
| --- | --- | --- |
| 6 | 高亮 A（含 X）→ 右键移除 X → 取消高亮 A | 画布无任何 A 残留色（含 X） |
| 7 | 高亮 A → 取消高亮 A | A 所有成员恢复原色 |
| 8 | 高亮 A → 删除整个区域 A（CollapseExtra 删除） | 画布无 A 残留色，区域从列表消失 |
| 9 | 高亮 A、B → 取消 A | 仅 A 色清除，B 色保留 |

### 8.3 新增兜底（D1）

| # | 场景 | 预期 |
| --- | --- | --- |
| 10 | 高亮 A（无 X）→ 右键 X「添加【A】」 | X 暂不上色；取消再勾选高亮 A 后 X 上色 |
| 11 | 高亮 A → PathDrawer 新勾选 Y | Y 暂不上色；再次 toggle 高亮后 Y 上色 |

### 8.4 跨系统混色（D2）

| # | 场景 | 预期 |
| --- | --- | --- |
| 12 | X 同时属高亮独占区 + 高亮交管区 | X 显示两色混色 |
| 13 | 场景 12 下，右键 X 从独占区移除 | X 仅保留交管区颜色（重新混色为单色） |
| 14 | 场景 12 下，右键 X 从交管区移除 | X 仅保留独占区颜色 |

### 8.5 对称性

| # | 场景 | 预期 |
| --- | --- | --- |
| 15 | 三方交管区重复用例 1-9 | 与独占区行为完全一致 |

### 8.6 撤销行为（D4，经代码复核更正）

| # | 场景 | 预期 |
| --- | --- | --- |
| 16 | 高亮 A → 右键移除 X（X 褪色）→ 撤销 | X 回到 A 成员列表，**颜色一并恢复**（`saveSnapshot` 在移除前调用，捕获了 X 的带色 attrs；`applySnapshot` 经 `setAttrs` 回放，`applyVisualScaleToAllShapes` 保留高亮色） |
| 17 | 高亮 A → 执行某项早于高亮的可撤销操作（如移动节点）→ 撤销该操作 | 画布上 A 的染色可能掉色（快照早于高亮、不含高亮 attrs），但 `highlightedAreas` 仍显示 A 勾选 → 勾选态与画布失配（D4 真实隐患，本次不处理） |

> 用例 16 的预期依据 `undoHistory.ts`（`createCurrentSnapshot` / `applySnapshot`）+ `applyVisualScale.ts` 的静态分析得出，建议实测确认。

---

## 9. 未决 / 后续

- **撤销 / 恢复高亮一致性（D4）**：本次明确不做。经代码复核，撤销「移除成员」会随 shape attrs 恢复颜色，无需特殊处理；真正缺的是 `highlightedAreas` 未纳入快照——撤销「早于高亮」的操作时画布掉色而勾选态仍亮。后续若需彻底一致，可在 `applySnapshot` 后按当前 `highlightedAreas` + 分组做一次全量重放高亮，但需把 `highlightedAreas` 纳入可恢复状态（目前是 Drawer 组件内 state，undoHistory 取不到），改动面较大。
- **跨地图高亮残留**：切换地图时 stage 重建，shape 上的 `highlightColorMap` 随之消失；但若 Drawer 未卸载，`highlightedAreas` 可能残留过期 areaId（实际 `findOne` 取不到 shape 时为空操作，无视觉错误）。属既有问题，不在本次范围。
- **PathDrawer 新增实时上色**：当前遵循 D1「新增兜底」。若后续希望「向高亮区域新增成员也立即上色」，可在入口对「新增集合」调用一段上色逻辑（需要 `getAreaColor` + `blendColors`，因调色板不同需由各 Drawer 提供或下传），届时可考虑把上色也收进 `areaHighlight.ts`。
