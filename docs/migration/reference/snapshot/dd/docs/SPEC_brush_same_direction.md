# SPEC：框选同向路径（brushSelectSameDir）

> **已由 [SPEC_brush_same_direction_contextmenu.md](./SPEC_brush_same_direction_contextmenu.md)（v2：右键菜单 + 显式基准）取代**（2026-08-27）。本规格整体废弃：入口迁至画布右键菜单、基准改为用户左键显式单选、几何同向算法按决策移除；正文保留作历史记录，不做删改。
> 状态：设计规格（核心决策已确认；§4.3 遍历方向经实测 bug 修正为双向 BFS；§4.7 反向边处理扩展为双向折返守卫；§10 新增「几何同向（弦方向）」算法并与拓扑算法取并集；§10.4 并集层折返守卫修正——见下）
> 日期：2026-06-28（§4.3 / §4.7 / §8 修正：2026-07-27；§10 几何同向 + 并集：2026-07-27；§10.4 并集层折返守卫：2026-08-20）
> 关联代码：`src/pages/MapThrough/MapNestModify/NestPanel/MapPaneTabs/ManualPane/index.tsx`、`src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/ActionLayer/BrushSelect/index.tsx`、`src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/index.tsx`、`src/utils/sameDirectionEdges.ts`

---

## 1. 背景与目标

地图编辑器（MapNestModify）右侧操作栏「框选」菜单现有三种类型：

| key | label | 命中对象 |
| --- | --- | --- |
| `brushSelect` | 默认 | 节点 + 路径 |
| `brushSelectNode` | 节点 | 仅节点 |
| `brushSelectEdge` | 路径 | 仅路径 |

本次新增第四种「**同向路径**」（key = `brushSelectSameDir`）：用户框选一块区域后，命中的路径里**只保留与基准边"同向"的那一簇**，其余命中路径全部丢弃。

"同向"在本规格里有**两层语义**，最终结果取两者**并集**（§10）：
- **拓扑同向**（§4.1-4.7）：沿 snode→enode 首尾相接、顺流而下的连通簇；
- **几何同向**（§10）：与基准边弦方向夹角 **< 90°** 的边。

典型场景：
- 一次框选围住一个矩形环路（4 条边首尾相接构成有向环），希望一次性选中整圈同向路径——拓扑同向覆盖；
- 框选 U 形 / S 形对称镜像段（如两段朝中央汇聚的贝塞尔），希望把视觉同向的两条都选中——几何同向覆盖。

---

## 2. 现有框选机制回顾（实现基线）

阅读 `BrushSelect/index.tsx` 后确认的关键事实，新功能必须遵守：

1. **框选是矩形 rubber-band**，`mousedown` 记录起点屏幕坐标 `startScreenRef`，`mousemove` 更新视觉 `#selectRect`，`mouseup` 一次性做命中检测。
2. **命中检测在屏幕坐标系下进行**：节点用 AABB 点测试；直线边用「线段 ↔ 矩形相交」；曲线边用 `bezierSamplePoints` 采样 32 点后逐段相交检测。
3. **结果一次性产出**：`mouseup` 时所有命中元素同时进入 `inRectShapes`，**不存在「谁先被框到」的时间顺序**。
4. **边数据 y 取反**：命中检测里用 `worldToScreen(sx, -sy, stage)`（数据里 edge 的 y 是反向的）。
5. **Ctrl 追加**：`mouseup` 时若 `event.evt.ctrlKey` 为真，则 `setSelectShapes(selected => [...selected, ...inRectShapes])`，否则覆盖。
6. **退化矩形**：屏幕宽或高 `< 2px` 视为无效框选（非 Ctrl 清空选中，Ctrl 保持原选中）。
7. **模式守卫**：`onStageMouseDown` 用 `["brushSelect","brushSelectNode","brushSelectEdge"].includes(manualKeyRef.current)` 守卫；`GraphStage` 的 `Stage.draggable` 用同一组 key 排除（框选时画布不拖动）。

---

## 3. 需求详述

### 3.1 用户故事

> 作为地图编辑者，我希望在「框选 → 同向路径」模式下拖一个矩形，系统以**框选命中的首条路径为方向基准**，沿其箭头方向（snode→enode）顺流接续，把命中范围内所有能首尾相接、同向可达的路径一次性选中；与基准不同向的命中路径自动忽略。

### 3.2 示例：4 条边构成的有向环

```
边1: S6pe → WTyk   (整体向左,  顶部水平)
边2: WTyk → yQIk   (整体向下,  左侧竖直)
边3: yQIk → 9sJN   (整体向右,  底部水平)
边4: 9sJN → S6pe   (整体向上,  右侧竖直, isBackEdge=true)
```

每条边的 `enodeId` 等于下一条边的 `snodeId`，闭合形成有向环：

```
        边1 ←────
   ●───────────────●
   │               │
 边4↑             ↓边2
   │               │
   ●────→──────────●
        边3
```

预期：框选围住这 4 条边后，**4 条全部选中**（无论基准是哪一条，顺流绕一圈都会 reachable 到全部 4 条）。

> 注意：纯「向量方向」算法无法识别此场景——边 1 向左、边 3 向右，夹角接近 180°，会被判为反向。本规格因此采用「连通流向」算法（见 §4.1）。

---

## 4. 设计决策（访谈结论）

### 4.1 同向判定算法：连通流向 ✅

**基于 `snodeId → enodeId` 的有向拼接**，而非几何向量夹角。从基准边出发做有向遍历，凡能沿行驶方向首尾相接形成单向流的边都算「同向」（但**排除同一对节点的反向折返边**，见 §4.7）。闭合环（≥3 边）、开链、分叉网状均可识别。能完美复现 §3.2 示例。

### 4.2 基准边确定：命中集合的首条 ✅

- 基准 = **`findShapesInRect` 命中数组的第一条**（`hitEdges[0]`），不做任何几何距离计算。
- 该顺序沿用现有命中检测的产出顺序（`stage.find` DFS 遍历序 → `findShapesInRect` 保持原序 `push`），即「框到了就算首次框选」，遵从原有框选逻辑，**不引入鼠标起点位置作为判据**（起点是用户未刻意控制的落点，用作基准会造成视觉与选中不一致）。
- 该顺序大致等于边在后端 edges 数组中的顺序，用户无法从画面预知基准具体是哪条：
  - 闭合环：环内任意基准都绕全圈，无影响；
  - 开链 / 多簇：基准是哪条决定选哪段（见 §8 用例 #3 / #7 的取舍说明）。

### 4.3 遍历方向：双向（下游顺流 + 上游回溯）✅（修正）

从基准边出发，做**双向**可达遍历（BFS）：
- **下游**：从基准 `enodeId` 出发，沿 `snode→enode` 顺流接续；
- **上游**：从基准 `snodeId` 出发，沿 `enode→snode` 反向回溯（找流向基准起点的入边）。

两向都带折返守卫（§4.7），都只在命中集合内接续（§4.4）。

- 环：从基准顺流绕一圈回到基准即停，环内所有边天然 reachable，全选；上游遍历不引入额外边。
- 开链 `A→B→C→D→E`，基准 = `B→C`：下游选 `B→C, C→D, D→E`，上游选 `A→B`，**整链全选**。
- 双向段夹单向中段（如 `A↔B→C→D↔E`），基准落在中段 `C→D`：下游经 `D↔E` 折返守卫只取基准方向，上游经 `A↔B` 折返守卫只取基准方向，**整条同向链全选**（4 条），不会因基准非端点而丢段。

> **修正原因（2026-07-27）**：原方案「仅下游不回溯上游」在「双向段夹单向中段」拓扑下出 bug——基准由图层 DFS 序决定（§4.2），不可预知。当基准落在中段时上游同向段整段丢失，用户看到「框选同向路径选不中全部」。改为双向 BFS 后，基准无论落哪条边都能选中完整同向链（验证见 §8 用例 #3、#11）。需求原文「以第一个框选到的路径为准，后续都只框选同向」的语义不变——基准仍是接续起点，只是向上下游两侧扩展。

### 4.4 遍历范围：仅命中集合内 ✅

有向接续**只在本次框选命中的边之间进行**，不穿越未被框选的边。

- 5 条边的环漏框中间 1 条：剩余 4 条若不直接相接，则只选基准所在那一段，**不借道未命中的边补全**。

### 4.5 分叉处理：全选所有下游可达边 ✅

基准下游某节点有多条命中出边（分叉）时，**所有下游 reachable 边都选中**（含各分支）。遍历为标准有向可达集合（BFS），天然处理环、网状、分叉。

### 4.6 多簇处理：仅保留基准簇 ✅

一次框选命中多个互不相连的边簇（如两个独立环，或一个环 + 几条孤立边）时，**只保留基准边所在那一簇**，其余命中边全部丢弃。

### 4.7 反向边（同节点对折返）：双向折返守卫 ✅（修正）

同一对节点间的正向边与反向边（如 `A→B` 与 `B→A`，几何上箭头完全相反）若同时被命中，**反向边无论作为下游直接后继还是上游直接前驱，都被跳过，不选中**。

- **下游守卫**：下游 BFS 接续时，若候选后继 `next` 的 `enodeId` == 当前边 `cur` 的 `snodeId`（`next` 是 `cur` 的同节点对反向边），跳过 `next`。
- **上游守卫**（2026-07-27 新增）：上游 BFS 回溯时，若候选前驱 `prev` 的 `snodeId` == 当前边 `cur` 的 `enodeId`（`prev` 是 `cur` 的同节点对反向边），跳过 `prev`。这是 §4.3 双向化的对称需求——否则上游遍历会把成对反向边都拉进来。
- 效果：`A↔B` 双向段只选基准方向那一条（基准 = `A→B` 选 `A→B`；基准 = `B→A` 选 `B→A`）；矩形环 / 三角环 / 开链 / 分叉因相邻边节点对不重复，整圈/整链仍全选。
- 这是纯 `snodeId/enodeId` 成对判断，**不引入几何、不依赖 `reverseEdgeId`**：实测数据中正反向边常均为 `isBackEdge=false / reverseEdgeId=null`，无法靠 `reverseEdgeId` 识别配对。
- 修正原因：原方案把「连通 = 同向」推广到了退化 2-环，导致 `A↔B` 这种箭头相反的成对边被同时选中，违背「同向」语义。折返守卫只在「同节点对反向」时排除，不影响 ≥3 边的合法环。上游守卫随 §4.3 双向化同步引入，保证两向对称。

### 4.8 匹配时机：单次框选内筛选 ✅

一次框选 `mouseup` 即时完成「命中 → 同向筛选」，与现有 `brushSelectEdge` 行为模型一致（一框一结果），**不跨操作累积**。

### 4.9 Ctrl 追加：支持，方向各自独立 ✅

新模式支持 Ctrl 追加，与现有框选一致。**每次 Ctrl 框选独立计算本次同向簇**，追加到已有选中；两次框选的方向可以不同（不锁定首次方向，无需额外状态/重置入口）。

---

## 5. 边界与异常

| 场景 | 行为 |
| --- | --- |
| 命中 0 条边 | 沿用现有：非 Ctrl 清空选中，Ctrl 保持原选中不变 |
| 命中 1 条边（仅基准，无下游） | 选中基准自己（基准簇 = {基准}） |
| 命中多条，但基准无任何下游同向边 | 仅选中基准自己 |
| 退化矩形（宽或高 < 2px） | 沿用现有：无效框选，非 Ctrl 清空 / Ctrl 保持 |
| 漏框中间边的环 | 仅命中集合内接续，不补全（§4.4） |
| 命中多个独立环 | 仅保留基准所在环（§4.6） |
| 正/反向边同时命中 | 反向边作为折返被排除，只选基准方向那条（§4.7） |
| 基准为曲线边 | 基准判定与几何无关（只看命中顺序）；遍历只看 `snodeId/enodeId` |
| Ctrl 追加且本次无命中 | 沿用现有：保持原选中不变 |
| 已隐藏（`!isVisible()`）的边 | 不参与命中（沿用 `findShapesInRect` 既有的 `isVisible()` 过滤） |

---

## 6. 技术实现方案

### 6.1 涉及文件

| 文件 | 改动 |
| --- | --- |
| `ManualPane/index.tsx` | 菜单 `select.children` 增加「同向路径」项；注释更新为"连通 + 方向并集"（§10） |
| `GraphStage/index.tsx` | `Stage.draggable` 排除列表增加 `brushSelectSameDir` |
| `BrushSelect/index.tsx` | 模式守卫 + 命中类型映射 + `mouseup` 接入同向筛选（§10 起改为并集）+ 无同向边提示（新增 `import { message } from "antd"`） |
| `src/utils/sameDirectionEdges.ts`（新增） | 同向筛选核心算法：`selectSameDirectionEdges`（拓扑，§6.5）、`selectSameVectorEdges`（几何，§10.3）、`unionSameDirectionEdges`（并集，§10.4） |

### 6.2 菜单项（ManualPane/index.tsx）

在 `select.children` 末尾、「路径」之后追加：

```ts
{
    key: "brushSelectSameDir",
    label: "同向路径"
}
```

`onManualSelect` 的 `default` 分支已 `setManualKey(key)`，无需特殊处理。

### 6.3 manualKey 接入点

两处 key 列表需追加 `"brushSelectSameDir"`：

1. `BrushSelect/index.tsx` → `onStageMouseDown` 守卫：
   ```ts
   if (!["brushSelect", "brushSelectNode", "brushSelectEdge", "brushSelectSameDir"].includes(manualKeyRef.current)) return;
   ```
2. `GraphStage/index.tsx` → `Stage.draggable` 表达式：
   ```ts
   draggable={!["brushSelect", "brushSelectNode", "brushSelectEdge", "brushSelectSameDir", "ranging", "forwardLine", "reverseLine", "forwardBezier", "reverseBezier"].includes(manualKey)}
   ```

### 6.4 命中类型映射（BrushSelect/index.tsx → onStageMouseUp）

现有映射需让 `brushSelectSameDir` 也只筛边：

```ts
// 根据manualKey确定筛选节点还是路径或者全部
const brushSelect =
    manualKeyRef.current === "brushSelectNode" ? ["node"] :
    (manualKeyRef.current === "brushSelectEdge" || manualKeyRef.current === "brushSelectSameDir") ? ["edge"] :
    ["node", "edge"];
```

### 6.5 核心算法函数（src/utils/sameDirectionEdges.ts，新增）

纯函数，输入命中边 Shape 数组，返回基准簇子集。**不依赖 stage、不做坐标变换、不计算几何距离**（基准判定与遍历都只看 `snodeId/enodeId`），便于复用与单测。

```ts
/**
 * @description 框选同向路径：以命中集合的首条边为基准，
 *              沿 snode→enode 方向在命中集合内做双向可达遍历
 *              （下游顺流 + 上游回溯），返回基准簇（含基准自身）。
 *              基准判定与几何无关（沿用命中顺序），遍历只看 snodeId/enodeId。
 */
import type Konva from "konva";

/**
 * 同向筛选主函数（纯函数，不依赖 stage / 坐标变换，便于复用与单测）。
 * @param hitEdges  本次框选命中的边 Shape 数组（已过滤可见性）
 * @returns         基准簇（基准双向可达集合，含基准自身）
 */
export function selectSameDirectionEdges(
    hitEdges: Konva.Shape[]
): Konva.Shape[] {
    if (!hitEdges?.length) return [];

    // 1. 基准边 = 命中数组首条（沿用 findShapesInRect 返回顺序，不做几何距离计算）
    const baseEdge = hitEdges[0];

    // 2. 在命中集合内建立双向索引：
    //    - outgoingBySnode: snodeId → [edges] 出边索引，下游顺流接续用
    //    - incomingByEnode: enodeId → [edges] 入边索引，上游反向回溯用
    //    双向遍历能解决「基准落在中段导致上游同向段被整段丢弃」的问题（§4.3 修正）
    const outgoingBySnode = new Map<string, Konva.Shape[]>();
    const incomingByEnode = new Map<string, Konva.Shape[]>();
    for (const edge of hitEdges) {
        const s = edge.attrs.data?.snodeId || "";
        const e = edge.attrs.data?.enodeId || "";
        if (!outgoingBySnode.has(s)) outgoingBySnode.set(s, []);
        outgoingBySnode.get(s)!.push(edge);
        if (!incomingByEnode.has(e)) incomingByEnode.set(e, []);
        incomingByEnode.get(e)!.push(edge);
    }

    // 3. 双向 BFS：下游沿 snode→enode 顺流接续，上游沿 enode→snode 反向回溯。
    //    用 Shape 的 Konva id() 作为去重 key（edge Shape id === edge.id，见 createEdgeShapeConfig）。
    //    两向都带折返守卫——跳过「当前边的精确反向边」作为直接后继/前驱，
    //    使 A↔B 只选基准方向；≥3 边的环仍可整圈选中（见 §4.7）。
    //    历史：原方案只走下游不回溯上游，导致「双向段夹单向中段」拓扑（如 A↔B→C→D↔E）
    //    里基准落中段时上游同向段整段丢失——这是双向遍历的修复动因（见 §4.3 修正记录）。
    const selected = new Set<string>([baseEdge.id()]);
    const queue: Konva.Shape[] = [baseEdge];
    while (queue.length) {
        const cur = queue.shift()!;
        const curSnode = cur.attrs.data?.snodeId || "";
        const curEnode = cur.attrs.data?.enodeId || "";

        // 下游：当前边的终点作为下一批边的起点，找命中集合内所有能接上的出边
        const nexts = outgoingBySnode.get(curEnode) || [];
        for (const next of nexts) {
            // 下游折返守卫：next 终点回到当前边起点（同节点对反向）→ 跳过
            if ((next.attrs.data?.enodeId || "") === curSnode) continue;
            if (!selected.has(next.id())) {
                selected.add(next.id());
                queue.push(next);
            }
        }

        // 上游：找命中集合内所有流向当前边起点的入边，反向接续到基准上游
        const prevs = incomingByEnode.get(curSnode) || [];
        for (const prev of prevs) {
            // 上游折返守卫：prev 起点等于当前边终点（同节点对反向）→ 跳过
            if ((prev.attrs.data?.snodeId || "") === curEnode) continue;
            if (!selected.has(prev.id())) {
                selected.add(prev.id());
                queue.push(prev);
            }
        }
    }

    // 4. 返回基准簇（保持命中顺序）
    return hitEdges.filter(edge => selected.has(edge.id()));
}
```

> 算法复杂度：O(N) 建索引 + O(N) BFS，N = 命中边数（通常几十条），无性能隐患。

### 6.6 BrushSelect 接入（onStageMouseUp）

在得到 `inRectShapes` 之后、Ctrl 判断之前，插入同向筛选：

```ts
// 在矩形内的点
let inRectShapes = findShapesInRect(enableSelectShapes, screenRect, stage);

// 同向路径模式：拓扑同向 + 几何同向取并集（§10.4）
if (manualKeyRef.current === "brushSelectSameDir") {
    // §7 无同向边提示：记录筛选前命中边数 + 基准是否有下游出口候选
    const hitCount = inRectShapes.length;
    // 基准下游出口候选：命中集合里是否存在以基准 enode 为起点的出边。
    // 存在（哪怕是被折返守卫排除的反向边）说明基准处于「成对/交汇」结构，
    // 只选基准自身属正常（如 A↔B 双向段）；不存在才是真正「无同向」。
    const baseEnode = inRectShapes[0]?.attrs?.data?.enodeId || "";
    const hasForwardCandidate = inRectShapes.some(
        e => (e.attrs?.data?.snodeId || "") === baseEnode
    );
    // §10.4 并集 = 拓扑簇 ∪ 几何簇；只剩基准 ⇔ 两算法都无扩展
    inRectShapes = unionSameDirectionEdges(inRectShapes);
    // 仅当「命中多条、并集后只剩基准、且基准无任何下游出口候选」时提示，
    // 避免 A↔B 双向段（拓扑/几何都只选基准方向，属正常）等正确场景误扰（§7 修正）
    if (hitCount > 1 && inRectShapes.length === 1 && !hasForwardCandidate) {
        message.warning("未找到同向路径");
    }
}

// Ctrl 追加逻辑沿用现有（§4.9：每次独立算同向簇，直接追加）
if (event.evt.ctrlKey) {
    setSelectShapes(selected => [...selected, ...inRectShapes]);
} else {
    setSelectShapes(inRectShapes);
}
changeSelectShapes(inRectShapes);
```

> **依赖**：`message` 来自 `antd`，`BrushSelect/index.tsx` 当前未引入，需在文件顶部新增 `import { message } from "antd"`。
> 提示触发在同向筛选之后、`setSelectShapes` 之前；命中仅 1 条边时不提示（避免选中单条边时误扰），与 §7 规则一致。

### 6.7 算法纯度

`selectSameDirectionEdges` 只读取 `edge.attrs.data.snodeId / enodeId` 与 `edge.id()`，**不依赖 stage、不做坐标变换、不计算几何距离**，因此：

- 不受 `stage` 缩放 / 旋转影响，不存在 `sy/ey` 取反之类的坐标系坑；
- 无副作用，可直接单测。

---

## 7. 交互与反馈

访谈中「交互增强」一题（高亮基准边 / 筛选结果轻提示 / 无同向边提示）原未返回选择。经确认，**仅启用「无同向边提示」**，其余两项保持关闭：

- ✅ **无同向边提示（已启用，修正触发条件）**：当本次框选**命中多于 1 条边**（筛选前 `inRectShapes.length > 1`），同向筛选后**仅剩基准自身**（结果 `length === 1`），**且基准在命中集合里没有任何下游出口候选**（不存在以基准 `enode` 为起点的命中边）时，调用 `message.warning("未找到同向路径")`。`A↔B` 双向段（只选基准方向属正常）、命中仅 1 条边，均不提示，避免误扰。
- ❌ 高亮基准边：不启用（与现有框选视觉一致）。
- ❌ 筛选结果轻提示：不启用（静默处理筛选数量）。

> 触发判定在 `BrushSelect.onStageMouseUp` 同向筛选之后、`setSelectShapes` 之前完成。

---

## 8. 验收用例

| # | 场景 | 预期选中 |
| --- | --- | --- |
| 1 | 框选围住 §3.2 的 4 条边环 | 4 条全选 |
| 2 | 同上环，基准为命中首条（具体是哪条取决于遍历序） | 仍 4 条全选（环内任意基准都绕全圈） |
| 3 | 开链 `A→B→C→D→E`（4 条边全命中），基准为命中首条 | 无论基准是 `A→B`、`B→C`、`C→D` 还是 `D→E`，**双向 BFS 都选全链 4 条**（下游顺流 + 上游回溯）。修正前基准落中段只选下游那一段，是 §4.3 双向化的修复对象 |
| 4 | 环 + 一条不相连的孤立边，全命中。基准为命中首条 | 首条在环内 → 选环内基准簇、孤立边丢弃；首条是孤立边 → 只选孤立边、环全丢。**取决于遍历序** |
| 5 | 5 边环漏框中间 1 条，剩 4 条不相接 | 仅选基准所在段，不补全 |
| 6 | 节点 A↔B 正向 `A→B` + 反向 `B→A` 同时命中 | 只选基准方向那一条（反向边作为折返被排除，§4.7）。基准取 `A→B` → 选 `A→B`；基准取 `B→A` → 选 `B→A` |
| 7 | `A→B` 与分叉 `B→C`、`B→D` 都命中，基准为命中首条 | 首条是 `A→B` → 下游选 `A→B, B→C, B→D`；首条是 `B→C` → 下游选 `B→C`、上游回溯选 `A→B`，**不拉入兄弟分支 `B→D`**（兄弟分支既非 `B→C` 上游也非下游）。`B→D` 仅当自身是基准或基准是其上下游时才被选 |
| 8 | 命中仅 1 条边 | 选该条 |
| 9 | Ctrl 框选第二次（不同方向环） | 第二次同向簇追加到首次选中，方向可不同 |
| 10 | 退化矩形（< 2px） | 非 Ctrl 清空 / Ctrl 保持原选中 |
| 11 | `A↔B→C→D↔E` 拓扑（两段双向贝塞尔夹一段单向直线中段，共 6 条边），全 6 条命中，基准为命中首条（图层 DFS 序，不可预知） | 无论基准是 6 条中的哪一条，**都选出 4 条同向链**（沿基准方向贯穿全链，双向段折返守卫只取基准方向那一条）。修正前基准落中段时只能选 1~3 条，是本次修复的目标场景（用户实测） |
| 12 | §10.1 U 形拓扑，仅框选两段"汇聚"贝塞尔（边 `1→2` 与边 `5→4`，拓扑不连、视觉夹角 73°） | 拓扑算法只剩基准自身；几何算法夹角 73° < 90° 纳入另一条；**并集选出 2 条**。修正前（仅拓扑）只剩基准，是 §10 新增几何算法的目标场景（用户实测） |
| 13 | §10.1 U 形拓扑，仅框选两段"散开"贝塞尔（边 `2→1` 与边 `4→5`，拓扑不连、视觉夹角 73°） | 同 #12，**并集选出 2 条** |
| 14 | `A↔B` 双向段正反两条（`A→B` + `B→A`）同框 | 拓扑折返守卫只选基准方向；几何夹角 180° 互斥也只选基准方向；**并集只选基准方向那一条**，且 hasForwardCandidate=true 不提示（§10.5） |
| 15 | §3.2 矩形环 4 条边全命中 | 拓扑全选 4 条；几何边方向各异（左右、上下夹角多为 90°/180°）但拓扑已全选；**并集仍全选 4 条**，不破坏 §4.1 用例 |
| 16 | 基准边与一对双向边近垂直（2026-08-20 实测：基准近似竖直、偏 ~1.5°；`A↔B` 近似水平、两端高差 0.14m 即倾斜 ~3.4°），拓扑簇沿基准方向含 `A→B`，几何锥纳入 `B→A`（夹角 ~88° < 90°） | 并集层折返守卫丢弃几何侧的 `B→A`，**同节点对只保留拓扑方向 `A→B`**，两方向不同时入选（§10.4 修正，用户实测的目标场景） |

---

## 10. 几何同向（弦方向）+ 并集策略

### 10.1 背景与动机

§4.1 选择「连通流向」而非「几何向量夹角」，是为了让矩形环（4 条边方向各异、但首尾相接成有向环）能被整圈选中。但该选择有反面盲区：**视觉同向但拓扑分离**的边无法被识别。

实测场景（用户 2026-07-27 反馈，U 形拓扑）：

```
            2 ──→ 3 ──→ 4
           ↗                ↘
       (1→2)              (4→5)
         1                  5
```

- 边 `1→2`（向右上）与边 `5→4`（向左上）在拓扑上无共享节点，但视觉上都"从下往上汇聚"——用户期望同框时两条都被选中。
- 拓扑算法从基准 BFS 走不到另一条，结果只剩基准自身，被用户视为 bug。

**结论**：拓扑同向与几何同向两个目标在单一算法里互斥（§4.1 已论证），但两者强项不重叠，**取并集**可同时满足两类场景，且符合用户「宁愿多选中」的偏好。本节新增几何同向算法，与 §4 拓扑算法在 `BrushSelect` 入口处取并集。

### 10.2 几何同向判定：弦方向 + 90° 阈值 ✅

- **方向定义**：边 `snode → enode` 的**弦方向**（起点到终点的直线向量），不读控制点 `cx/cy/dx/dy`，无视曲线弧度——与肉眼对"行驶方向"的直觉一致。
- **坐标系处理**：edge 数据 `y` 与画布 `y` 反向（§2.4 已确立：`worldToScreen(sx, -sy, stage)`），因此视觉向量取 `dy = sy - ey`、`dx = ex - sx`。注意是 `sy - ey` 不是 `ey - sy`。
- **阈值 90°**：候选边弦方向与基准弦方向夹角 **严格 `< 90°`** 才视为同向。用点积 `> 0` 判号（不含等号），使夹角恰为 90° 的正交方向（如水平边与竖直边）不被误纳入——"在同一半平面内且不垂直"算同向，反向边（180°）与正交边（90°）天然排除。
- **基准**：沿用 §4.2「命中首条」，与拓扑模式对齐，不引入新基准判据。

> 备选方案与放弃理由：
> - **更小阈值（如 60°）**：会让 U 形两段汇聚边（夹角常 60°~80°）漏选，违背本节初衷。
> - **向量聚类留最大簇**：聚类有传递性问题（A-B 同向、B-C 同向、但 A-C 反向时归簇歧义），且对命中顺序敏感。"以基准为中心"无歧义、可预测。

### 10.3 算法实现：`selectSameVectorEdges`（src/utils/sameDirectionEdges.ts，新增）

纯函数，输入命中边 Shape 数组，返回与基准弦方向夹角 < 90° 的子集（含基准自身，按命中顺序）。

**夹角 < 90° 的等价判定**：两向量点积 `a·b > 0` ⇔ 夹角 < 90°（无需 `atan2` / `acos`，避开反三角函数的数值噪声与符号坑；用严格大于 0 而非 ≥ 0，排除夹角恰为 90° 的正交方向）。

```ts
/**
 * 几何同向筛选：以基准边（命中首条）弦方向为中心，
 * 保留所有夹角 < 90° 的边（用点积 > 0 判号，等价于夹角 < 90°）。
 * 弦方向 = snode → enode 的直线向量；不读控制点，对贝塞尔/直线统一处理。
 * 数据 y 与画布 y 反向（§2.4），视觉向量 dy = sy - ey、dx = ex - sx。
 */
export function selectSameVectorEdges(
    hitEdges: Konva.Shape[]
): Konva.Shape[] {
    if (!hitEdges?.length) return [];

    // 1. 基准弦方向（命中首条）
    const base = hitEdges[0].attrs.data || {};
    const bDx = (base.ex ?? 0) - (base.sx ?? 0);
    const bDy = (base.sy ?? 0) - (base.ey ?? 0); // 数据 y 反向：sy - ey

    // 2. 基准退化为零长度边（无法定义方向）→ 全部命中保守留下
    if (bDx === 0 && bDy === 0) return hitEdges.slice();

    // 3. 保留点积 > 0 的边（夹角严格小于 90°；含基准自身：其点积 = |b|² > 0）
    return hitEdges.filter(edge => {
        const d = edge.attrs.data || {};
        const dx = (d.ex ?? 0) - (d.sx ?? 0);
        const dy = (d.sy ?? 0) - (d.ey ?? 0); // 数据 y 反向
        // 候选零长度边视为同向（保守纳入）
        if (dx === 0 && dy === 0) return true;
        return bDx * dx + bDy * dy > 0;
    });
}
```

> 算法复杂度：O(N)，N = 命中边数。无性能隐患。

### 10.4 并集策略：`unionSameDirectionEdges`（src/utils/sameDirectionEdges.ts，新增）✅（修正）

纯函数，调用拓扑 (`selectSameDirectionEdges`) + 几何 (`selectSameVectorEdges`) 两个算法，按命中顺序去重取并集，**并在并入时执行并集层折返守卫**（2026-08-20 修正，动机见下）。

```ts
/**
 * 同向并集：拓扑簇 ∪ 几何簇，按命中顺序去重。
 * 并集只剩基准 ⇔ 两算法都只剩基准 ⇔ 真正"无同向"（§10.5 提示判定依据）。
 * 并集层折返守卫：拓扑簇优先播种有向节点对集合，
 * 几何簇候选的反向节点对已在集合中 → 跳过。
 */
export function unionSameDirectionEdges(
    hitEdges: Konva.Shape[]
): Konva.Shape[] {
    if (!hitEdges?.length) return [];

    const topo = selectSameDirectionEdges(hitEdges);
    const vec = selectSameVectorEdges(hitEdges);

    // 并集层折返守卫：拓扑簇优先（其方向锚定基准边，是同向的主语义）；
    // 几何簇候选的反向节点对已在集合中 → 跳过（防止同节点对两方向共存）。
    // 与 §4.7 全局折返守卫同规则，只是作用域从拓扑 BFS 内部提升到并集层。
    const ids = new Set<string>();
    const selectedPairs = new Set<string>();
    const tryAdd = (e: Konva.Shape) => {
        const s = e.attrs.data?.snodeId || "";
        const n = e.attrs.data?.enodeId || "";
        if (selectedPairs.has(`${n}->${s}`)) return;
        if (!ids.has(e.id())) {
            ids.add(e.id());
            selectedPairs.add(`${s}->${n}`);
        }
    };
    topo.forEach(tryAdd);
    vec.forEach(tryAdd);

    // 用 Konva id() 去重，按原命中顺序过滤返回
    return hitEdges.filter(e => ids.has(e.id()));
}
```

`BrushSelect.onStageMouseUp` 中 `brushSelectSameDir` 分支调 `unionSameDirectionEdges`（§6.6 已同步更新）。其余流程（Ctrl 追加、样式同步、命中检测）不变。

> **修正原因（2026-08-20，用户实测）**：原实现只做 id 去重，折返守卫仅存在于拓扑 BFS 内部，**并集层没有任何「同节点对反向互斥」检查**。当基准弦方向与某双向边对**近垂直**时（实测：基准边近似竖直、偏离竖直仅 ~1.5°；`A↔B` 边对近似水平、一端比另一端低 0.14m 即倾斜 ~3.4°），基准与该边对某一方向的弦方向夹角 ~88° < 90°，几何锥恰好把该方向纳入——而拓扑簇沿基准行驶方向选出的是该边对的**另一方向**。拓扑给一条、几何给一条，并集把 `A→B` 与 `B→A` 同时选中，违背 §4.7 的同向语义。
>
> 修正后**拓扑簇优先**：拓扑方向是从基准边沿行驶方向推出的，是「同向」的主语义；几何簇的设计定位只是补充「拓扑分离但视觉同向」的场景（§10.1），不应推翻拓扑已确定的方向。
>
> 两个有保证的性质：
> - **几何簇内部不可能自带反向对**：同节点对反向的两条边弦向量精确互为反向（snode/enode 互换 ⇒ sx/sy 与 ex/ey 互换），与基准的点积必然异号，不可能同时 > 0。故守卫只需在并入时跨簇检查，几何簇遍历顺序不影响结果。
> - **不新触发「未找到同向路径」提示**（§10.5）：被守卫丢弃的几何边，其反向必然已在拓扑簇中，此时拓扑簇至少已有 2 条，并集不可能只剩基准，提示的触发集合不变。

### 10.5 提示触发的并集语义 ✅

`BrushSelect` 中"未找到同向路径"提示的触发条件**结构不变**，但语义随并集演化：

- 原条件：`hitCount > 1 && inRectShapes.length === 1 && !hasForwardCandidate`
- 现语义：命中多条、**并集后只剩基准**（即拓扑无扩展 且 几何无扩展）、且基准无下游出口候选 → 提示。
- `hasForwardCandidate` 判定（A↔B 成对结构不提示）保留：`A↔B` 双向段拓扑与几何都只选基准方向，并集仍只剩基准，但属正常结构，不提示。

用户的两类诉求被覆盖：
- U 形两段汇聚边同框（边 3 + 边 5）：几何算法有扩展（夹角 73° < 90°）→ 并集 > 1 → 不提示，结果 2 条。✅
- 真正孤立的单条边（如只框到 1 条，或框到 2 条方向正交且拓扑不连）：两算法都无扩展 → 提示。✅

### 10.6 反向边与守卫的关系

| 边对 | 拓扑算法 | 几何算法 | 并集结果 |
| --- | --- | --- | --- |
| `A→B` 与 `B→A`（同节点对反向） | 折返守卫排除反向（§4.7） | 弦方向夹角 180°，点积 < 0，互斥 | 只选基准方向那一条 ✅ |
| `A→B` 与 `C→D`（拓扑不连但视觉同向） | 不同簇，互不可达 | 夹角 < 90°，互相纳入 | 并集两条都选 ✅ |
| 矩形环 4 条边 | 顺流绕全圈，全选 | 边方向各异，多数夹角 > 90° | 拓扑全选，并集仍全选 ✅ |
| `A→B` 与 `B→A`，且**基准与它们近垂直** | 折返守卫沿基准行驶方向选一条（如 `A→B`） | 基准与 `B→A` 弦方向夹角可能 < 90°（如 ~88°），把 `B→A` 纳入 | 并集层折返守卫丢弃 `B→A`，**只保留拓扑方向**（§10.4 修正）✅ |

基准与边对大致共线时，几何算法天然按方向把 `A→B` / `B→A` 分到两侧（夹角 180°），与拓扑折返守卫效果一致。但该论证**不覆盖基准与边对近垂直的情形**（2026-08-20 实测暴露）：此时 90° 锥边界擦着边对轴线，端点的微小高度差就决定了哪个方向落进锥内，且可能与拓扑所选方向相反。§10.4 的并集层折返守卫正是为此而加，修正后**不破坏 §4.7 已验证用例**。

### 10.7 边界与异常

| 场景 | 行为 |
| --- | --- |
| 命中 0 条边 | 沿用现有：非 Ctrl 清空，Ctrl 保持 |
| 命中仅基准（1 条） | 两个算法都返回基准自身，并集 = {基准}；不提示（hitCount 不大于 1） |
| 基准是零长度边（`sx==ex && sy==ey`） | 几何算法保守返回全部命中（无法定义方向）；并集 = 拓扑簇 ∪ 全部命中，但其中与已选边构成同节点对反向的仍被并集层折返守卫过滤（§10.4 修正） |
| 候选边是零长度边 | 视为与基准同向，纳入几何簇；若与已选边构成同节点对反向，并入时仍被守卫过滤（§10.4 修正） |
| 基准弦方向与某双向边对近垂直 | 几何锥可能纳入该边对中与拓扑相反的方向；并集层折返守卫丢弃该几何边，同节点对只保留拓扑方向（§10.4 修正，2026-08-20 实测） |
| 命中多条但全部方向正交/反向且拓扑不连 | 并集只剩基准，hasForwardCandidate=false → 提示"未找到同向路径" |
| 贝塞尔曲线 | 弦方向无视控制点，与直线统一处理；不受曲线弧度影响 |
| Ctrl 追加 | 每次独立算本次并集簇，追加到已有选中；两次方向可不同（§4.9 不变） |

---

## 11. 未决 / 后续

- **§7 交互反馈三项**：待用户确认是否启用。
- **基准判据**：已定为命中集合首条（沿用 `findShapesInRect` 返回顺序）。自 §4.3 双向化后，单簇开链/环不再因基准位置丢边（基准无论哪条都选全簇）；仅「多簇并存」场景下基准决定保留哪一簇（§4.6）。若后续希望基准可由用户控制，可考虑改为「矩形扩张最先碰到的边」或「显式点选基准」。
- **Overlook 监控视图**：本规格仅覆盖 MapNestModify 编辑器。Overlook（`src/pages/Overlook/ForceGraph/`）若有同类框选诉求，可复用 `selectSameDirectionEdges` 纯函数，但不在本期范围。
