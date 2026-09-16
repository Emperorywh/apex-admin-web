# SPEC：框选同向路径（右键菜单 + 显式基准，brushSelectSameDir v2）

> **部分拆分（2026-08-28）**：原「框选同向路径」菜单已拆分为「框选拓扑同向路径」与「框选方向同向路径」两个并列入口，见 [SPEC_brush_same_direction_split.md](./SPEC_brush_same_direction_split.md)（v3）。本规格所述的显式基准、一次性模式生命周期、右键交互等机制对两个模式均成立；仅差异点（菜单项、算法分派、提示文案）以 v3 为准，正文保留不改。
> 状态：设计规格（访谈决策已全部确认，待实施）
> 日期：2026-08-27（同日审核修订：Ctrl 不再特殊处理、无同向提示条件改为"去掉基准后命中仍非空"、折返守卫以现行代码全局实现为准、补 NestGraph 接线等 8 项）
> 前置规格：`docs/SPEC_brush_same_direction.md`（v1，入口为 ManualPane 框选菜单、基准 = 框选命中首条；本规格实施后 v1 整体废弃，仅在文首加"已由 v2 取代"标注，正文保留作历史记录）
> 关联代码：`src/pages/MapThrough/MapNestModify/NestGraph/ContextMenu/index.tsx`、`src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/index.tsx`、`src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/ActionLayer/BrushSelect/index.tsx`、`src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/ActionLayer/index.tsx`、`src/pages/MapThrough/MapNestModify/NestPanel/MapPaneTabs/ManualPane/index.tsx`、`src/pages/MapThrough/MapNestModify/NestPanel/MapPaneTabs/ManualPane/BrushSelectMenuLabel/index.tsx`、`src/constants/mapThrough.ts`、`src/utils/sameDirectionEdges.ts`、`src/plugins/konva/runtime/constants.ts`

---

## 1. 背景与目标

v1（`SPEC_brush_same_direction.md`）的同向路径框选从右侧操作栏「框选 → 同向路径」进入，基准 = **框选命中的首条边**（图层 DFS 序，用户不可预知）。虽然 §4.3 双向 BFS 修正了"基准落中段丢上游"的问题，但「多簇并存」场景下基准决定保留哪一簇，用户仍无法控制（v1 §8 用例 #4）。

本次把交互改为**显式基准**：

> 鼠标左键选中一条路径（基准）→ 右键弹出菜单 → 点「框选同向路径」→ 用户框选一块区域 → 以基准 + 框选命中为输入，找出**拓扑同向**的路径。

核心收益：基准由用户指定，方向语义完全可预测；入口收敛到右键菜单（与「选中反向路径」等边操作同区）。

### 1.1 与 v1 的差异总览

| 维度 | v1 | v2（本规格） |
| --- | --- | --- |
| 入口 | ManualPane「框选 → 同向路径」模式项 | 右键菜单「框选同向路径」（ManualPane 模式项移除） |
| 基准 | 框选命中首条（不可预知） | 用户左键显式单选的边（进入模式时快照） |
| 同向算法 | 拓扑双向 BFS ∪ 几何弦方向（并集） | **仅拓扑双向 BFS**（几何算法移除） |
| 模式生命周期 | 常驻，可连续框选 | 一次性：一次**有效**框选后自动退出 |
| Ctrl | XOR 翻转 | 不特殊处理：Ctrl 与非 Ctrl 等价，统一覆盖式产出（§4.6） |
| 无效框选（<2px / 拖出画布） | 非 Ctrl 清空选中 | 保持模式可重框，选中不变 |

---

## 2. 现有机制回顾（实现基线，已核实）

1. **左键选中已存在**：`GraphStage.onStageClick`——非 Ctrl 点击边 → 覆盖单选 `setSelectShapes([target])`；Ctrl → 追加/取消；点击空白 → 清空选中。右键（`evt.button === 2`）直接 return，**不改变现有选中**。
2. **右键菜单已存在**：`GraphStage.onStageContextMenu` → `setContextMenu({open, left, top, event, nearbyCandidates})` → `ContextMenu`（antd Dropdown）渲染 `menuItems`（`@/constants/mapThrough`）。菜单项按右键命中对象过滤（`enable: ["stage"|"node"|"edge"|"robot"]`），不可用项的惯例是**置灰**（如「等距插入节点」需恰好选中两个节点，在 ContextMenu 的 useMemo 里动态算 disabled）。
3. **右键与模式的关系**：`onStageContextMenu` 中框选系列（`brushSelect` / `brushSelectNode` / `brushSelectEdge` / `brushSelectSameDir`）右键**不退出模式、直接弹菜单**；其余模式右键先 `setManualKey("")` 退出且**不弹菜单**。
4. **框选组件**：`BrushSelect` 挂 `stage.on("mousedown/mousemove/mouseup/mouseleave")`，矩形 rubber-band，屏幕坐标系命中检测；`mousedown` 守卫要求 `event.target === stage`（**只能从空白处起框**）；`mouseup` 一次性产出结果。
5. **框选期间不会触发 onStageClick 干扰**（已对照 konva `Stage.js` 源码核实）：Konva 仅在 down/up 落点 target 一致时才派发 click（`clickStartShape === shape`），而空白处按下时 `clickStartShape` 为 undefined。有效框选时 mouseup 落点命中的是 `selectRect`（ActionLayer，层级在 EdgesLayer 之上、NodesLayer/RobotLayer 之下，`listening` 默认 true；落点在节点/车体上时命中的是其上方图层节点）——无论哪种都 ≠ 空白 stage，click 不派发。但**退化框选**（宽高≈0）时选框零尺寸不可命中，down/up 落点同为空白 → Konva 把 click 派发到 stage → `onStageClick` 清空选中（v1 无感是因为退化框选本来就清空）。
6. **算法现状**：`sameDirectionEdges.ts` 导出 `selectSameDirectionEdges`（拓扑双向 BFS + 折返守卫）、`selectSameVectorEdges`（几何弦方向）、`unionSameDirectionEdges`（并集），签名均为 `(hitEdges) => Shape[]`，基准取 `hitEdges[0]`。
7. **stage attr 先例**：`MAP_NEST_STAGE_ATTR`（visualScale / labelVisible / isDark 等）——命令式瞬态数据的既有存放处，`BrushSelect` 这类命令式事件处理器可直接 `stage.getAttr()` 读取，不受 React 闭包陈旧影响。

---

## 3. 需求详述

### 3.1 用户故事

> 作为地图编辑者，我先**左键点选一条路径**确定方向基准，然后**右键**选「框选同向路径」，接着拖一个矩形框选区域；系统以我选中的基准为起点，在框选命中的路径里找出所有拓扑同向（沿 snode→enode 首尾相接、顺流/回溯可达）的路径，连同基准一起选中，然后自动退出框选状态。

### 3.2 交互流程

```
左键点选基准边（恰好 1 条）
        │
        ▼
右键（任意位置：边/节点/空白）──► 弹出菜单，「框选同向路径」可点
        │ 点击
        ▼
进入框选模式：message 提示 + 十字光标 + 基准保持高亮（基准此刻快照）
        │
        ▼
拖框（从空白处起框）── mouseup ──► 命中检测 → 拓扑同向筛选
        │                              │
        │                     有效框选（≥2px）
        │                              ▼
        │              结果 = 命中同向簇 ∪ {基准} → setSelectShapes
        │              自动退出模式（cursor/基准快照清理）
        │
        ├─ 退化框选（<2px）/ 拖出画布 ──► 保持模式、选中不变，可重框
        │
        ├─ 模式期间左键点击边/空白 ──► 屏蔽（选中与基准高亮不动）
        │
        ├─ 模式期间右键 ──► 静默退出模式 + 照常弹菜单
        │
        └─ 模式期间切换其他模式 ──► setManualKey 覆盖，自然退出
```

---

## 4. 设计决策（访谈结论）

### 4.1 基准判据：恰好左键选中 1 条边 ✅

- 菜单项**显示条件**：右键空白 / 节点 / 边时都显示（`enable: ["stage", "node", "edge"]`，不含 robot——右键车体是"根据车体坐标创建节点"场景）。
- 菜单项**可点条件**：`selectShapes.length === 1 && selectShapes[0].attrs?.enableSelect === "edge"`，即恰好左键选中 1 条路径；选中 0 条 / 多条 / 含节点时**置灰**（与「等距插入节点」同机制，见 §2.2）。
- 基准 = 该选中边。右键命中的边与左键选中的边可能不同（右键不改变选中，§2.1），**以左键选中集为准**，与"左键选基准 → 右键"的叙事严格一致。
- 右键不命中任何特定对象也不影响——只要左键选中了基准，空白处右键同样能弹出可点项。

### 4.2 模式生命周期：一次性，有效框选后自动退出 ✅

- 点菜单项 → `setManualKey("brushSelectSameDir")` + 快照基准（§6.4）。
- **模式的自动完成仅由有效框选（有效框选 mouseup）触发**；右键（§4.8）、基准失效（§4.9）、切换其他模式（§5）是彼此独立的退出路径，同样走 cursor / 基准快照清理（§6.6 effect 兜底）。有效完成时选中结果保留。
- 一次性设计的理由：基准是针对"这次框选"的参照物，任务完成即退出，避免"怎么还在框选模式"的困惑；用户想再来一次就重新走"左键选边 → 右键"流程。

### 4.3 无效框选不算完成 ✅

- 退化矩形（宽或高 < 2px）、鼠标拖出画布（mouseleave 中断）**不结束模式、不清空选中**，用户可直接重框。
- v1 的「非 Ctrl 退化框选清空选中」在 v2 **不再适用**（会连基准高亮一起清掉）。
- 顺带修复：退化框选的 click 事件不再有破坏力——模式期间 `onStageClick` 被整体屏蔽（§4.7），清空选中的路径走不到。

### 4.4 结果集：命中同向簇 ∪ {基准} ✅

- 最终选中 = 框选区域内的拓扑同向边 **∪ 基准边**；基准即使没被框进区域也保留选中。
- 数组顺序：**基准放首位**，其余按命中顺序（对现有右键批量操作无顺序敏感性，仅约定确定性）。
- 符合"以这条边为基准圈出整条流"的心理模型——框完基准的选中不会突然消失。

### 4.5 同向算法：仅拓扑双向 BFS（几何算法移除） ✅

- 沿用 v1 §4.1–4.7 的**纯拓扑**语义：以基准为起点，在「命中集合 ∪ {基准}」内做**双向** BFS（下游顺流 + 上游回溯），带同节点对折返守卫（`A↔B` 只选基准方向那一条）。
- 双向遍历保留的理由不变：基准（用户选的）可能落在链中间，只有双向才能框出完整同向链。
- **`selectSameVectorEdges`（几何弦方向）与 `unionSameDirectionEdges` 一并删除**，回到单一拓扑算法。代价（已确认接受）：v1 §10 的 U 形汇聚段（两条拓扑不相连但视觉同向）回退为"选不中"——v2 的显式基准使"方向"完全由拓扑定义，几何语义不再参与（验收用例 #15 记录该回归）。
- 函数签名改造：`selectSameDirectionEdges(baseEdge, hitEdges)`——基准与命中集合分离传入（v1 基准 = `hitEdges[0]` 内取）。

### 4.6 Ctrl：不做特殊处理（与非 Ctrl 等价） ✅

- sameDir 分支**不区分 Ctrl**：按住 Ctrl 框选与普通框选行为完全一致（结果 = 命中同向簇 ∪ {基准}，覆盖式产出）。
- 为什么不做"纯追加"：进入条件（§4.1）强制恰好选中 1 条边，模式期间 §4.7 又屏蔽全部选中变更，唯一能改选中的外部路径 undo/redo 也只会清空选中（`setSelectShapes([])`）——有效框选发生时选中集恒为 {基准}（或 undo 后的空集），"现有选中 ∪ 结果"里的"现有选中"永远 ⊆ 结果，追加无从谈起，Ctrl 与非 Ctrl 的输出恒等价，保留独立分支是无意义的死代码。
- v1 的 XOR 同样不适用：结果恒含基准，XOR 会把处于选中态的基准"翻出"选中集。
- 仅 `brushSelectSameDir` 分支如此；其他框选模式的 XOR 行为不动。

### 4.7 模式期间屏蔽左键选中变更 ✅

- 模式期间 `onStageClick` 对 `brushSelectSameDir` 提前 return（同 `ranging` 先例）：点其他边不覆盖选中、点空白不清空选中。
- 理由：基准是进入模式时的快照，若放任点击改选中，会出现"高亮的是 B 边、实际基准是 A 边"的脱节；屏蔽后模式语义专一——只有框选产出结果。
- 基准高亮因此天然稳定：进入模式时是 selected 态，期间无任何路径清它（点击被屏蔽、右键不动选中），mouseup 后结果集含基准会重新 `updateShapeStyle`。

### 4.8 模式期间的右键：静默退出 + 照常弹菜单 ✅

- 模式期间右键 → **退出框选模式**（`setManualKey("")`），**同时照常弹出右键菜单**（不 return）。
- 与现有框选系列"右键不退出"的白名单行为区分开：v2 是一次性模式，右键意味着任务转向；但菜单照常弹出（避免"首次右键退出、第二次才出菜单"），且菜单里「框选同向路径」仍可点——基准选中态未变，点它等于重新进入，无副作用。
- 不引入 ESC 退出（现有各模式均无 ESC 机制，不为此新开全局 keydown）。

### 4.9 基准失效防御：提示并取消 ✅

- 进入模式后、框选 mouseup 前，基准边可能被外部摧毁（模式期间 Ctrl+Z 回退删边、地图数据重载等）。
- mouseup 时校验快照的基准 shape：`!baseEdge || baseEdge.getStage() == null`（shape 已 destroy / 脱离 stage）→ `message.warning("基准路径已失效")`，**取消本次选中变更**（选中集保持原样）、退出模式。
- 不做"undo 发生瞬间主动退出"的提前检测（需侵入 undo 流程，复杂度不值）。

### 4.10 无同向提示：提示 + 保留成对结构特判 ✅

- 触发条件：**框选命中了基准之外的边**（`hitEdges` 中存在 `id() !== 基准.id()` 的边，即去掉基准后命中仍非空）、筛选后结果仅剩基准自身、且命中集合中**不存在**基准的相邻边候选（`snodeId === 基准.enodeId` 的下游候选 **或** `enodeId === 基准.snodeId` 的上游候选）→ `message.warning("未找到同向路径")`。
- **仅框住基准自身不提示**：命中 = [基准] 时基准与自身同向，不算"未找到"。这是 v1 `hitCount > 1` 守卫在 v2 的等价改写——v2 基准可能不在框内，`> 1` 不再等价于"基准之外还有命中"，须显式按 id 排除基准判空。
- 成对结构特判保留（v1 §7 / §10.5 同思路，v2 扩展为双向）：`A↔B` 双向段框选时反向边被折返守卫排除属正常，不提示。
- 命中 0 条边（框到空区域）：不算"未找到"（没框到东西），不提示，按有效框选处理（结果 = 仅基准，模式退出）。
- 基准被框进区域与否不影响提示判定（提示只看命中集合与基准的拓扑关系）。

### 4.11 进入模式的反馈 ✅

- **message 轻提示**：`message.info(\`请框选区域，将选中与【${基准边名}】拓扑同向的路径\`)`，一次性。
- **基准保持高亮**：见 §4.7，不引入额外视觉标记。
- **十字光标**：模式期间画布 `container.style.cursor = "crosshair"`，覆盖现有 hover pointer/default 逻辑；退出模式恢复 default（后续 mousemove 会按 hover 状态重设）。

### 4.12 旧入口移除 ✅

- ManualPane「框选」子菜单删除「同向路径」项及 `BrushSelectMenuLabel` 的 `mode="sameDir"` 分支。
- `manualKey = "brushSelectSameDir"` **字符串保留复用**（v2 仍是这个 key，只是入口与内部行为变了）：`BrushSelect` 守卫列表、`GraphStage` 的 `Stage.draggable` 排除列表（框选时画布不可拖）原样保留。
- v1 规格 `SPEC_brush_same_direction.md` 文首加"已由 v2 取代"标注。

---

## 5. 边界与异常

| 场景 | 行为 |
| --- | --- |
| 左键选中 0 条 / 多条 / 含节点时右键 | 菜单项显示但置灰，不可点（§4.1） |
| 右键命中的边 ≠ 左键选中的边 | 以左键选中集为准（右键不改变选中，§2.1） |
| 框选命中 0 条边（空区域） | 有效框选：结果 = 仅基准保持选中，不提示，模式退出（§4.10） |
| 仅框住基准自身（命中 = [基准]） | 有效框选：不提示（基准与自身同向，§4.10），结果 = 仅基准，模式退出 |
| 命中边但全部与基准不同向且无相邻候选 | 提示「未找到同向路径」，结果 = 仅基准，模式退出 |
| `A↔B` 双向段（基准 `A→B`，反向边同时命中） | 折返守卫排除反向边，结果 = 仅基准，**不提示**（相邻候选存在，§4.10） |
| 基准不在框选区域内 | 基准仍进结果（§4.4），遍历图 = 命中 ∪ {基准}（§4.5） |
| 退化矩形（宽或高 < 2px） | 保持模式、选中不变、可重框（§4.3） |
| 框选中途拖出画布（mouseleave） | 放弃本次框选（沿用现有放弃逻辑），保持模式 |
| 模式期间左键点边 / 点空白 | 屏蔽选中变更，基准高亮不动（§4.7） |
| 模式期间右键 | 退出模式 + 照常弹菜单（§4.8） |
| 模式期间切换其他模式 | `setManualKey` 覆盖，自然退出；cursor / 基准快照由清理 effect 兜底（§6.6） |
| 模式期间 Ctrl+Z 删了基准边 | mouseup 校验失效 → 提示「基准路径已失效」+ 选中不变 + 退出模式（§4.9） |
| 按住 Ctrl 框选 | 与不按 Ctrl 行为一致：结果 = 基准 ∪ 同向簇，基准不被翻出（§4.6） |
| 已隐藏（`!isVisible()`）的边 | 不参与命中（沿用 `findShapesInRect` 既有过滤） |
| 基准为曲线边 / 命中含曲线边 | 拓扑算法只看 `snodeId/enodeId`，与几何形状无关 |
| U 形汇聚段（拓扑不连、视觉同向） | **不再选中**（几何算法已移除，回归记录，验收 #15） |
| `enableModify = false` | 右键 `preventDefault` 不开菜单，功能天然不可达（沿用现状） |

---

## 6. 技术实现方案

### 6.1 涉及文件

| 文件 | 改动 |
| --- | --- |
| `src/constants/mapThrough.ts` | `menuItems` 在「添加反向路径」后新增 `brushSelectSameDir` 项（§6.2） |
| `ContextMenu/index.tsx` | 新增 case：快照基准 + 进入模式 + message；置灰逻辑；新增 `setManualKey` prop（§6.3） |
| `NestGraph/index.tsx` | ContextMenu 渲染处传入 `setManualKey`（一行 props 接线——NestGraph 已持有该 prop，但目前未传给 ContextMenu） |
| `GraphStage/index.tsx` | `onStageClick` 屏蔽；`onStageContextMenu` 右键退出分支；cursor crosshair；`manualKey` 清理 effect（§6.5–6.6） |
| `ActionLayer/index.tsx` | 透传 `setManualKey` 给 `BrushSelect`（一行 props 链） |
| `BrushSelect/index.tsx` | sameDir 分支重写：基准来自 stage attr 快照、失效校验、退化框选 return、Ctrl 不特殊处理、有效框选后退出模式（§6.7） |
| `src/utils/sameDirectionEdges.ts` | `selectSameDirectionEdges` 签名改为 `(baseEdge, hitEdges)`；删除 `selectSameVectorEdges` / `unionSameDirectionEdges`（§6.8） |
| `src/plugins/konva/runtime/constants.ts` | `MAP_NEST_STAGE_ATTR` 新增 `sameDirBaseEdge` 键 |
| `ManualPane/index.tsx` | 删除「同向路径」菜单项；注释更新为"三种框选"（§6.9） |
| `BrushSelectMenuLabel/index.tsx` | 删除 `mode="sameDir"` 分支与类型收窄 |
| `docs/SPEC_brush_same_direction.md` | 文首加"已由 v2（本规格）取代"标注 |

### 6.2 菜单项（constants/mapThrough.ts）

在「添加反向路径」之后追加：

```ts
{
    key: "brushSelectSameDir",
    label: "框选同向路径",
    enable: ["node", "edge", "stage"]
}
```

> `enable` 覆盖右键边/节点/空白三种命中（不含 robot）。key 与 manualKey 同名：`onContextMneuClick` 的 case 直接 `setManualKey("brushSelectSameDir")`。

### 6.3 ContextMenu：置灰 + 进入模式

**置灰**（`items` useMemo 内，与 `twoNodesSelected` 同机制追加）：

```ts
// v2 §4.1：恰好左键选中 1 条路径时「框选同向路径」才可点
const exactlyOneEdge =
    selectShapes.length === 1 &&
    selectShapes[0].attrs?.enableSelect === "edge";
const finalItems = itemsWithChildren.map(item =>
    item.key === "evenlyInsertNodes" || item.key === "alignTwoPoints"
        ? { ...item, disabled: !twoNodesSelected }
        : item.key === "brushSelectSameDir"
            ? { ...item, disabled: !exactlyOneEdge }
            : item
);
```

> useMemo 依赖已含 `selectShapes`，无需新增。

**点击处理**（`onContextMneuClick` switch 新增 case）：

```ts
case "brushSelectSameDir": {
    // 防御性再校验（置灰已拦截，双保险）
    const base = selectShapes[0];
    if (!base || base.attrs?.enableSelect !== "edge") return;
    const stage = event?.target?.getStage?.() ?? null;
    // 右键目标已脱离 stage（菜单开着期间目标被删等极端情况）：
    // 无处写入基准快照，不进入模式
    if (!stage) return;
    // 基准快照写入 stage attr：命令式瞬态数据，BrushSelect mouseup 直接读，
    // 不受 React 闭包陈旧影响，也不需要 NestGraph→GraphStage→ActionLayer 三层 props 链
    stage.setAttr(MAP_NEST_STAGE_ATTR.sameDirBaseEdge, base);
    setManualKey("brushSelectSameDir");
    // v2 §4.11：一次性轻提示，报出基准路径名
    message.info(`请框选区域，将选中与【${base.attrs?.data?.name ?? ""}】拓扑同向的路径`);
    break;
}
```

**props**：`ContextMneuProps`（接口名沿用源码既有拼写）新增 `setManualKey`，由 `NestGraph` 渲染处传入（NestGraph 已持有该 prop，但目前未传给 ContextMenu，需补一行——见 §6.1）。

### 6.4 基准快照的存放：stage attr

- 进入模式时把基准 shape 写入 `stage.setAttr(MAP_NEST_STAGE_ATTR.sameDirBaseEdge, shape)`；`BrushSelect.onStageMouseUp` 读取后立即（用毕）由清理机制置 null。
- 选 stage attr 而非 React state 透传的理由：基准只在命令式事件处理器（mouseup）里被消费，与 `visualScale` / `isDark` 等 stage attr 同类（§2.7）；避免为单消费者新拉一条 NestGraph→GraphStage→ActionLayer→BrushSelect 的 props 链。
- `setManualKey` 仍走 props（`GraphStage` 已持有，`ActionLayer` 需新增透传一行）。

### 6.5 GraphStage：onStageClick 屏蔽 + cursor

```ts
// 画布鼠标左键的点击事件
const onStageClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
    ...
    if (evt.button === 2) return;
    if (manualKey === "ranging") return;
    // v2 §4.7：框选同向模式期间屏蔽选中变更——基准是进入模式时的快照，
    // 放任点击改选中会出现「高亮 B 边、基准实为 A 边」的脱节
    if (manualKey === "brushSelectSameDir") return;
    ...
};
```

`onStageMouseMove` 中，`enableModify` 判断之后、pointer 判断之前：

```ts
// v2 §4.11：框选同向模式期间十字光标，覆盖 hover pointer/default
if (manualKey === "brushSelectSameDir") {
    container.style.cursor = "crosshair";
    return;
}
```

### 6.6 GraphStage：右键退出 + 清理 effect

`onStageContextMenu`——把 `brushSelectSameDir` 从"右键不退出"白名单移出，改为专门分支：

```ts
if (manualKey === "brushSelectSameDir") {
    // v2 §4.8：一次性模式，右键=任务转向 → 静默退出，但照常弹菜单
    // （菜单里该项仍可点：基准选中态未变，点它重新进入，无副作用）
    setManualKey("");
} else if (manualKey && !["brushSelect", "brushSelectNode", "brushSelectEdge"].includes(manualKey)) {
    // 其余模式维持原行为——右键先退出模式且不弹菜单
    ...
    return;
}
```

新增 `useEffect` 兜底清理（覆盖所有退出路径：有效框选后 BrushSelect 内部退出、右键退出、切换其他模式）：

```ts
// v2 §4.2/§4.11：退出框选同向模式时清理基准快照与十字光标。
// 所有退出路径最终都表现为 manualKey 离开 brushSelectSameDir，这里统一兜底，
// BrushSelect / onStageContextMenu 无需各自重复清理
useEffect(() => {
    if (manualKey === "brushSelectSameDir") return;
    const stage = stageRef.current;
    if (!stage) return;
    if (stage.getAttr(MAP_NEST_STAGE_ATTR.sameDirBaseEdge)) {
        stage.setAttr(MAP_NEST_STAGE_ATTR.sameDirBaseEdge, null);
    }
    if (stage.container()?.style?.cursor === "crosshair") {
        stage.container().style.cursor = "default";
    }
}, [manualKey]);
```

### 6.7 BrushSelect：sameDir 分支重写（onStageMouseUp）

`onStageMouseDown` 守卫列表不变（仍含 `brushSelectSameDir`，框选从空白起框的约束沿用）。`onStageMouseUp` 结构：

```ts
// 退化矩形（点击/极小拖拽）视为无效框选，避免误触
const MIN_BRUSH_PX = 2;
if (Math.abs(screenRect.width) < MIN_BRUSH_PX || Math.abs(screenRect.height) < MIN_BRUSH_PX) {
    if (manualKeyRef.current === "brushSelectSameDir") {
        // v2 §4.3：同向模式一次性流程里无效框选不算完成——保持模式与选中，可直接重框
        // （v1 的「非 Ctrl 清空选中」在显式基准下会连基准高亮一起清掉，不再适用）
        return;
    }
    if (!event.evt.ctrlKey) {
        setSelectShapes([]);
    }
    return;
}

// 命中类型映射沿用：sameDir 与 brushSelectEdge 一样只筛边
const brushSelect = ...;
const enableSelectShapes = ...;
const hitEdges = findShapesInRect(enableSelectShapes, screenRect, stage);

// ============ 同向路径模式（v2：显式基准） ============
if (manualKeyRef.current === "brushSelectSameDir") {
    // 1. 基准来自进入模式时的快照（stage attr），与实时选中态解耦
    const baseEdge = stage.getAttr(MAP_NEST_STAGE_ATTR.sameDirBaseEdge) as Konva.Shape | null;
    // 2. 失效校验（§4.9）：模式期间 Ctrl+Z 删边/地图重载后 shape 悬空
    if (!baseEdge || !baseEdge.getStage()) {
        message.warning("基准路径已失效");
        setManualKey("");   // 退出模式，选中集保持原样
        return;
    }
    // 3. 相邻候选（成对结构特判，§4.10）：命中里存在基准的下游或上游直接邻边
    //    （含被折返守卫排除的反向边）说明基准处于成对/交汇结构，只选基准属正常
    const baseData = baseEdge.attrs?.data ?? {};
    const hasNeighborCandidate = hitEdges.some(e => {
        const d = e.attrs?.data ?? {};
        return d.snodeId === baseData.enodeId || d.enodeId === baseData.snodeId;
    });
    // 基准之外的命中是否存在（§4.10）：仅框住基准自身时不提示（基准与自身同向）。
    // 不能沿用 v1 的 hitCount > 1——v2 基准可能不在框内，须按 id 显式排除基准判空
    const hasHitBeyondBase = hitEdges.some(e => e.id() !== baseEdge.id());
    // 4. 拓扑同向筛选（§4.5）：遍历图 = 命中 ∪ {基准}，基准放首位
    const result = selectSameDirectionEdges(baseEdge, hitEdges);
    // 5. 无同向提示（§4.10）：基准之外有命中、结果仅剩基准、且无相邻候选
    if (hasHitBeyondBase && result.length === 1 && !hasNeighborCandidate) {
        message.warning("未找到同向路径");
    }
    // 6. 产出结果 + 自动退出模式（§4.2/§4.4/§4.6：Ctrl 不特殊处理，统一覆盖式）。
    //    unSelectShapeEvent 内部有 ctrlKey 守卫，按住 Ctrl 时为 no-op——
    //    由于有效框选时旧选中恒 ⊆ 结果（§4.6 论证），两种情况视觉与数组最终一致
    unSelectShapeEvent(event);
    setSelectShapes(result);
    result.forEach(updateShapeStyle);
    setManualKey("");   // 一次性模式：有效框选后自动退出（cursor/快照清理由 §6.6 effect 兜底）
    return;
}

// ============ 其余框选模式：沿用现有逻辑（Ctrl XOR 等）不变 ============
...
```

> `setSelectShapes(result)` 后的样式同步沿用现有命令式模式（`updateShapeStyle` / `unSelectShapeEvent`），不引入新机制。
> `BrushSelect` props 新增 `setManualKey`（经 `ActionLayer` 透传，`ActionLayer` props 加一行）。

### 6.8 算法改造（src/utils/sameDirectionEdges.ts）

- `selectSameDirectionEdges(baseEdge: Konva.Shape, hitEdges: Konva.Shape[]): Konva.Shape[]`
  - 遍历图 = `hitEdges` ∪ `{baseEdge}`（基准可能不在框选区域内，必须并入才能从它出发接续）；
  - 从 `baseEdge` 做双向 BFS（下游 `snode→enode` 顺流 + 上游 `enode→snode` 回溯），两向均带同节点对折返守卫——**以 `sameDirectionEdges.ts` 现行的全局 `selectedPairs` 守卫实现为准，原样搬移**。注意：v1 规格文本 §4.7 描述的是旧版"局部守卫"（只检查当前边的直接反向边），现行代码已升级为全局有向节点对集合守卫，额外堵死了"经第三条边绕行"的泄漏路径（如 X↔Y、Y↔Z、Z↔X 三对双向边交于枢纽时旧守卫挡不住绕行）；改造时**不得**按 v1 §4.7 文本回退到局部守卫；
  - 返回基准簇，**基准放数组首位**，其余按命中顺序；
  - 仍是纯函数：只读 `attrs.data.snodeId / enodeId` 与 `id()`，不依赖 stage / 坐标 / 几何。
- **删除** `selectSameVectorEdges`、`unionSameDirectionEdges` 及几何相关注释（§4.5）。
- `BrushSelect` 的 `import { unionSameDirectionEdges }` 改为 `import { selectSameDirectionEdges }`。

### 6.9 ManualPane：旧入口清理

- 删除 `select.children` 里的 `brushSelectSameDir` 项（「同向路径」）；
- `BrushSelectMenuLabel` 删除 `mode="sameDir"` 支持（mode 类型收窄为 `"default" | "node" | "edge"`）；
- 「四种框选模式」等注释同步改回三种。

---

## 7. 交互与反馈汇总

| 时机 | 反馈 |
| --- | --- |
| 点菜单项进入模式 | `message.info`（含基准路径名）+ 画布十字光标 + 基准保持高亮 |
| 框选进行中 | 蓝色半透明矩形（沿用 `#selectRect`） |
| 有效框选完成 | 结果选中高亮；模式静默退出（cursor 恢复 default） |
| 命中非空但无同向 | `message.warning("未找到同向路径")`，基准保持选中 |
| 基准失效 | `message.warning("基准路径已失效")`，选中不变，模式退出 |
| 无效框选 | 无反馈（保持模式可重框） |

---

## 8. 验收用例

| # | 场景 | 预期 |
| --- | --- | --- |
| 1 | 左键选中 1 条边 → 右键（边/节点/空白处分别试） | 三处菜单均出现「框选同向路径」且可点；右键车体不出现 |
| 2 | 选中 0 条 / 2 条边 / 1 边 1 节点 → 右键 | 菜单项显示但置灰 |
| 3 | 点菜单项 | message 报出基准路径名；cursor 变十字；基准高亮保持 |
| 4 | 基准为 4 边矩形环的一条，框住全环 | 4 条全选（环内任意基准顺流绕全圈），模式自动退出、cursor 恢复 |
| 5 | 基准**不在**框选区域内，区域内有基准的同向链 | 基准 + 同向链全部选中 |
| 6 | 开链 `A→B→C→D→E`，基准选中间 `C→D`，框住全链 | 双向 BFS 全选 4 条（5 节点 4 边） |
| 7 | `A↔B` 双向段，基准 `A→B`，框住两条 | 只选 `A→B`，**不提示**（相邻候选存在） |
| 8 | 框住与基准正交且拓扑不连的边 | 仅基准保持选中 + `未找到同向路径` 提示，模式退出 |
| 9 | 按住 Ctrl 走完整框选流程（基准被框进 / 不框进区域各试一次） | 与不按 Ctrl 行为一致：结果 = 基准 ∪ 同向簇，基准不被翻出选中集（§4.6） |
| 10 | 退化框选（按下即松） | 无反馈，模式保持、选中不变，可立即重框 |
| 11 | 模式期间左键点其他边 / 点空白 | 选中与基准高亮均不变 |
| 12 | 模式期间右键 | 模式退出 + 菜单弹出；「框选同向路径」仍可点（基准选中未变），点后重新进入 |
| 13 | 模式期间 Ctrl+Z 把基准边回退删除，再框选 | `基准路径已失效` 提示，选中不变，模式退出 |
| 14 | 模式期间点右侧操作栏其他模式 | 模式自然退出，cursor 恢复，无残留状态 |
| 15 | U 形汇聚两段（拓扑不连、弦方向夹角 < 90°） | **仅基准**（几何算法已移除的回归记录，已确认接受） |
| 16 | 框到空白区域（0 条边命中） | 有效框选：仅基准保持选中，不提示，模式退出 |
| 17 | 隐藏边在框选区域内 | 不参与命中，结果不含隐藏边 |
| 18 | 画布缩放/旋转后框选 | 命中检测在屏幕坐标系（沿用 v1 §2），行为正确 |
| 19 | 紧框基准边自身（框内只有基准，无其他边） | 不提示「未找到同向路径」（基准与自身同向，§4.10），结果 = 仅基准，模式退出 |

---

## 9. 未决 / 后续

- **U 形汇聚段回归**（§4.5、用例 #15）：几何算法已按决策移除。若后续用户再反馈该场景，可在 `sameDirectionEdges.ts` 恢复几何算法并以 `baseEdge` 为中心重启并集（v1 §10 的实现可从 git 历史找回）。
- **Overlook 监控视图**：同 v1 §11，不在本期范围。
- **旧 SPEC 标注**：实施时在 `SPEC_brush_same_direction.md` 文首加一行"已由 SPEC_brush_same_direction_contextmenu.md（v2）取代"，正文保留作历史记录，不做删改。
