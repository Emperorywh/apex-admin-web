# SPEC：Ctrl+左键 toggle 取消选中（节点 / 路径）

> 状态：设计规格（核心决策经三轮访谈确认）
> 日期：2026-06-28
> 关联代码：`src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/index.tsx`、`src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/ActionLayer/BrushSelect/index.tsx`、`src/utils/graph.ts`、`src/pages/MapThrough/MapNestModify/NestGraph/ContextMenu/index.tsx`、`src/pages/MapThrough/MapNestModify/index.tsx`

---

## 1. 背景与目标

地图编辑器（MapNestModify）现有交互：**Ctrl + 鼠标左键** 可对节点 / 路径做「选中」与「追加选中」（单击点选、框选拖选两条路径皆然）。但当某个元素**已被选中**时，再次 Ctrl+左键点它不会有任何反应——`onStageClick` 在 `state === "selected"` 时直接 `return`（`GraphStage/index.tsx:233`）。

本次需求：**已选中的元素，再次 Ctrl+左键应当取消选中（toggle）**。同时统一框选 Ctrl 的语义，使其与单击一致地支持 toggle，并顺带修复既有去重遗漏。

> 范围限定：仅 MapNestModify 编辑器画布（D9）。Overlook 监控视图不在本期。

---

## 2. 现状回顾（实现基线）

阅读相关代码后确认的关键事实，新功能必须遵守 / 借助：

### 2.1 单击路径（`GraphStage/index.tsx` → `onStageClick`，210-242）

```
点击空白(stage 本身) + 已有选中 + 非 Ctrl → setSelectShapes([]) + unSelectShapeEvent   (225-229)
点击节点/路径(enableSelect)：
  ├─ 隐藏元素 → return                                          (232)
  ├─ state === "selected" → return  ← 本次改造核心落点           (233)
  ├─ unSelectShapeEvent(event)  // 非 Ctrl 时清其他选中样式        (234)
  ├─ updateShapeStyle(clickTarget)  // 设选中样式 + moveToTop      (235)
  └─ Ctrl ? [...selected, clickTarget] : [clickTarget]            (236-240)
```

设备图标（三方设备）点击会重定向到其所属 edge shape（217-223），toggle 需保留该重定向。

### 2.2 框选路径（`BrushSelect/index.tsx` → `onStageMouseUp`，137-202）

```
退化矩形(<2px)：非 Ctrl 清空 / Ctrl 保持                        (158-165)
命中检测 findShapesInRect → inRectShapes                          (173-175)
同向模式：selectSameDirectionEdges 筛选 + 「未找到同向路径」提示   (177-193)
Ctrl ? [...selected, ...inRectShapes]   ← 不去重，本次改造        (195-199)
     : inRectShapes                    ← 非 Ctrl 覆盖
changeSelectShapes(inRectShapes) → 对所有命中 updateShapeStyle     (201, 35-40)
```

### 2.3 选中样式机制（`src/utils/graph.ts`）

| 函数 | 行号 | 作用 |
| --- | --- | --- |
| `updateShapeStyle(shape)` | 626-641 | `state="selected"`；node: `radius × selectedState.radius`；`lineWidth × selectedState.lineWidth`；`moveToTop()`。已 selected 则 return |
| `unSelectShapeEvent(event)` | 384-412 | 遍历 stage 内所有 `state==="selected"` 的 shape 还原（`state=""`、`radius ÷`、`lineWidth ÷`）。**`evt.ctrlKey` 为真时直接 return**（保护 Ctrl 追加的已有样式） |
| `selectedState` | `plugins/konva/state/selected.ts:8` | 选中态放大常量（`radius` / `lineWidth`），graph.ts:13 已 import |

**关键约束**：`unSelectShapeEvent` 在 Ctrl 下 return，**不能用于 Ctrl 场景的取消**——必须新写单 shape 还原逻辑。

### 2.4 既有「取消选中」先例（`ContextMenu/index.tsx`）—— 复用点

右键菜单删除元素时已有取消选中逻辑：

- 126 / 131：`setSelectShapes(shapes => shapes.filter(shape => shape.attrs?.id !== attrs?.id))` —— 按 **`shape.attrs.id`** 过滤移除（稳定标识，非 `id()`）
- 187-190：还原样式 `shape.setAttrs({ state: "", shapeStyle: { ...rest, radius: radius / selectedState.radius, lineWidth: lineWidth / selectedState.lineWidth } })`（node 含 radius，edge 不含）

> 这段样式还原与 `unSelectShapeEvent` 的单 shape 分支**完全重复**。应抽取为公共函数 `deselectShape`，供 `unSelectShapeEvent`、`ContextMenu`、本次 toggle 三处复用。

### 2.5 「数组 ≠ 视觉态」陷阱（`EvenlyInsertModal/index.tsx:335` 注释）

> `setSelectShapes([])` 仅清空 React 维护的选中数组，画布上节点的视觉选中态（`state=selected`、被放大的 `radius/lineWidth`）**并不会随之还原**。

含义：**`selectShapes` 数组与 Konva `shape.state` 是两套状态，必须手工同步**。这正是 D6「用 `state` 作唯一判据」的根因——视觉真相是 `state`，数组只是逻辑集合；toggle 取消时**必须显式调样式还原**，不能只改数组。

### 2.6 既有遗漏（顺手修复点）

`BrushSelect:198` 非 Ctrl 框选覆盖时**未调 `unSelectShapeEvent`**，若旧选中元素不在新命中集合内，其 `state="selected"` 样式会残留（数组已被覆盖、视觉却未还原，违反 §2.5）。对比 `GraphStage:234` 非 Ctrl 单击覆盖前调了 `unSelectShapeEvent`——框选路径遗漏了。建议本次顺手补齐（见 §6.5）。

---

## 3. 需求详述

### 3.1 用户故事

> 作为地图编辑者，我希望：
> - **Ctrl + 单击**一个已选中节点 / 路径 → 取消选中它（其余选中保留）；
> - **Ctrl + 单击**一个未选中节点 / 路径 → 追加选中（沿用现状）；
> - **Ctrl + 框选**命中的元素 → 对命中集合做 XOR 翻转（已选的取消、未选的加入），未被命中的已有选中保持不变；
> - 普通左键（非 Ctrl）行为不变（单击已选元素仍保持现状，框选仍为覆盖）。

### 3.2 核心难点：框选 toggle 的混合语义

已选 `{A, B}`，Ctrl 框选命中 `{A, B, C}`（A、B 已选，C 未选）——这是「框选 toggle」经典难题。本规格采用 **XOR（命中的全部翻转）**：结果为 `{C}`（A、B 取消，C 加入）。详见 D5。

---

## 4. 设计决策（访谈结论）

| # | 决策 | 选项 | 依据 |
| --- | --- | --- | --- |
| D1 | **作用范围** | 单击 + 框选都支持 toggle | R1-Q1 |
| D2 | **修饰键** | 仅 Ctrl 切换（加选 / 取消二合一），**不引入 Shift** | R1-Q2 |
| D3 | **非 Ctrl 单击已选元素** | 保持现状（`return`，无反应） | R1-Q3 |
| D4 | **框选 Ctrl 去重** | 顺便去重 | R1-Q4 |
| D5 | **框选 Ctrl 混合语义** | **XOR**：命中的全部翻转（已选→取消，未选→加入） | R2-Q1 |
| D6 | **「已选中」判据** | 统一用 `shape.state === "selected"`（视觉真相，§2.5） | R2-Q2 |
| D7 | **取消后 z-order** | 不动（不还原 `moveToTop`） | R2-Q3 |
| D8 | **同向路径模式** | 也遵循 toggle（与默认 / 节点 / 路径模式一致） | R2-Q4 |
| D9 | **Overlook 视图** | 不改，仅 MapNestModify 编辑器 | R3-Q1 |
| D10 | **undo 历史** | toggle 不进 undo（选中非数据变更） | R3-Q3 |
| D11 | **Ctrl + 点击空白** | 保持选中不变（沿用现状） | R3-Q4 |
| D12 | **去重收口** | 源头统一去重（setter wrapper，覆盖所有写入点） | R3-Q2 |

### 4.1 D5 XOR 的边界推演

| 命中集合 vs 已选集合 | XOR 结果 |
| --- | --- |
| 命中全是未选 | 全部加入（等价追加） |
| 命中全是已选 | 全部取消 |
| 命中混合（部分已选 + 部分未选） | 已选的取消、未选的加入 |
| 命中与已选无交集 | 全部加入 |
| 未被命中的已有选中 | 原样保留 |

XOR 天然涵盖「去重」：已选元素被命中时不会重复加入，而是被移除——与 D4 去重一致。

### 4.2 D8 同向模式 toggle 的语义

`brushSelectSameDir` 模式下，Ctrl 框选先做同向筛选（`selectSameDirectionEdges`）得到本次同向簇，**再对该簇施加 XOR**：

- 簇内已选的边 → 取消；
- 簇内未选的边 → 加入；
- 「未找到同向路径」提示触发条件不变（§7），与 XOR 独立。

---

## 5. 边界与异常

| 场景 | 行为 |
| --- | --- |
| Ctrl + 单击已选元素 | 取消选中（toggle）；其余选中保留；不进 undo（D10） |
| Ctrl + 单击未选元素 | 追加选中（沿用现状，去重由 D12 保证） |
| 非 Ctrl 单击已选元素 | 保持现状 `return`（D3，**原 233 行 return 收窄到此分支**） |
| 非 Ctrl 单击未选元素 | 覆盖为单选（沿用现状） |
| Ctrl + 框选，命中全为已选 | 全部取消 |
| Ctrl + 框选，命中全为未选 | 全部加入 |
| Ctrl + 框选，命中混合 | XOR 翻转（D5） |
| Ctrl + 框选，命中与已选无交集 | 全部加入，旧选中保留 |
| Ctrl + 点击空白 | 保持选中不变（D11） |
| 非 Ctrl 点击空白 | 清空选中（沿用现状 225-229） |
| 退化矩形（<2px）Ctrl | 保持原选中（沿用 161-164） |
| 点击三方设备图标 | 重定向到 edge shape 后走 toggle（保留 217-223） |
| 已隐藏元素（`!isVisible()`） | 不参与 toggle（沿用 232） |
| 右键（button===2） | 不参与（沿用 215） |
| 同向模式 Ctrl 框选 | 同向簇 XOR（D8）；「未找到同向路径」提示条件不变 |
| `selectShapes` 含历史重复项 | D12 源头去重从根上消除；toggle 移除按 `attrs.id` 一次清干净 |
| 取消后的 z-order | 不还原（D7；可能被其他选中元素轻微遮挡，无碍） |

---

## 6. 技术实现方案

### 6.1 涉及文件

| 文件 | 改动 |
| --- | --- |
| `src/utils/graph.ts` | 新增 `deselectShape(shape)`（抽取自 `unSelectShapeEvent` / `ContextMenu`）；新增 `dedupShapes(shapes)`；建议 `unSelectShapeEvent` 内部改为遍历调 `deselectShape` |
| `src/pages/MapThrough/MapNestModify/index.tsx` | `useState` setter 包一层去重 wrapper（D12 源头收口） |
| `src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/index.tsx` | `onStageClick` 233 行 return 收窄 + Ctrl 分支接入 toggle |
| `src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/ActionLayer/BrushSelect/index.tsx` | `onStageMouseUp` Ctrl 分支改为 XOR；非 Ctrl 分支补 `unSelectShapeEvent`（顺手修复 §2.6）；`changeSelectShapes` 在 Ctrl 下按 state 分流 |
| `src/pages/MapThrough/MapNestModify/NestGraph/ContextMenu/index.tsx`（建议） | 187-190 替换为 `deselectShape`，消除重复 |

### 6.2 新增 `deselectShape`（`src/utils/graph.ts`）

`updateShapeStyle` 的逆操作（除 z-order 外，D7）。抽取后 `unSelectShapeEvent`（graph.ts:390-411）与 `ContextMenu`（187-190）均可复用。

```ts
/**
 * @description 还原单个元素的「选中样式」：state 置空、radius/lineWidth 除回去。
 *              抽取自 unSelectShapeEvent / ContextMenu 的单 shape 还原逻辑，供 toggle 取消选中复用。
 *              与 updateShapeStyle 互为逆操作（按 D7 不还原 moveToTop 的 z-order）。
 *              只处理 node / edge；非选中态直接跳过，幂等。
 * @param shape 要取消选中的元素
 * @returns void
 */
export const deselectShape = (shape: Konva.Shape | Konva.Node) => {
    const { attrs } = shape;
    if (attrs?.enableSelect !== "node" && attrs?.enableSelect !== "edge") return;
    if (attrs?.state !== "selected") return;
    const { shapeStyle: { radius = 0, lineWidth = 0, ...rest } = {} } = attrs as any;
    if (attrs.enableSelect === "node") {
        // 节点：radius 与 lineWidth 都除回去
        shape.setAttrs({
            state: "",
            shapeStyle: {
                ...rest,
                radius: radius / selectedState.radius,
                lineWidth: lineWidth / selectedState.lineWidth
            }
        });
    } else {
        // 路径：只除 lineWidth（路径无 radius）
        shape.setAttrs({
            state: "",
            shapeStyle: {
                ...rest,
                lineWidth: lineWidth / selectedState.lineWidth
            }
        });
    }
};
```

> `unSelectShapeEvent` 建议重构为：`stage.find(state==="selected").forEach(deselectShape)`（Ctrl 守卫保留），消除与 `deselectShape` 的重复。

### 6.3 新增 `dedupShapes` + 源头去重 wrapper（D12）

```ts
/**
 * @description 按 attrs.id 对 shape 数组去重，保留首次出现项。
 *              attrs.id 是节点 / 路径的业务稳定标识（ContextMenu 既有过滤亦用此字段）。
 * @param shapes 待去重的 shape 数组
 * @returns 去重后的新数组（保持原序）
 */
export const dedupShapes = (shapes: Konva.Shape[]): Konva.Shape[] => {
    const seen = new Set<string>();
    const result: Konva.Shape[] = [];
    shapes.forEach(shape => {
        const id = shape?.attrs?.id;
        const key = id != null ? String(id) : `__ref_${shape?.id?.() ?? Math.random()}`;
        if (seen.has(key)) return;
        seen.add(key);
        result.push(shape);
    });
    return result;
};
```

源头收口（`MapNestModify/index.tsx:23`）——所有下游透传的 `setSelectShapes` 自动去重，覆盖全部 ~14 个写入点（含 `GraphStage`、`BrushSelect`、`ContextMenu`、`GraphPixel`、`CollapseChildren`、`MapSelect`、`useUndoHistory` 等）：

```ts
// 原：const [selectShapes, setSelectShapes] = useState<Konva.Shape[]>([]);
const [selectShapes, setSelectShapesRaw] = useState<Konva.Shape[]>([]);

/**
 * 源头去重 setter：拦截所有写入，按 attrs.id 去重后再落 state。
 * 杜绝 Ctrl 框选 [...selected, ...inRectShapes] 拼接产生的重复项（D12）。
 * 对 setSelectShapes([]) / ([single]) 等天然无重复的写入零副作用。
 */
const setSelectShapes = useCallback((value: React.SetStateAction<Konva.Shape[]>) => {
    setSelectShapesRaw(prev => {
        const next = typeof value === "function"
            ? (value as (prev: Konva.Shape[]) => Konva.Shape[])(prev)
            : value;
        return dedupShapes(next);
    });
}, []);
```

> `useCallback` 按需 import。透传链下游无需改动（签名不变）。

### 6.4 `onStageClick` toggle 改造（`GraphStage/index.tsx` 230-241）

**核心**：原 233 行 `if (attrs?.state === "selected") return;` 对所有情况（含 Ctrl）都 return，需**收窄到「非 Ctrl + 已选中」分支**，腾出 Ctrl 已选中分支做 toggle。

```ts
if (attrs?.enableSelect === "node" || attrs?.enableSelect === "edge") {
    // 隐藏的元素不允许被单击选中 / 取消
    if (!clickTarget.isVisible()) return;
    // D6：用 state 作「是否已选中」唯一判据（视觉真相，§2.5）
    const isAlreadySelected = attrs?.state === "selected";

    if (evt.ctrlKey) {
        if (isAlreadySelected) {
            // Ctrl + 已选中 → 取消选中（本次新增的 toggle）
            deselectShape(clickTarget);
            // 按 attrs.id 从数组移除（与 ContextMenu:126 既有模式一致）
            setSelectShapes(selected => selected.filter(s => s.attrs?.id !== attrs?.id));
        } else {
            // Ctrl + 未选中 → 追加（去重由 D12 源头 wrapper 保证）
            updateShapeStyle(clickTarget);
            setSelectShapes(selected => [...selected, clickTarget as Konva.Shape]);
        }
    } else {
        // D3：非 Ctrl + 已选中 → 保持现状
        if (isAlreadySelected) return;
        // 非 Ctrl + 未选中 → 覆盖单选（清其他选中样式 + 设本元素选中）
        unSelectShapeEvent(event);
        updateShapeStyle(clickTarget);
        setSelectShapes([clickTarget as Konva.Shape]);
    }
}
```

> 改动要点：① 删除原 233 行无差别 return；② Ctrl 分支按 `isAlreadySelected` 二分为 toggle / 追加；③ 非 Ctrl 已选中分支保留原 return 语义（D3）。`updateShapeStyle` / `deselectShape` 已保证样式与数组同步。

### 6.5 `BrushSelect` XOR 改造（`onStageMouseUp` 195-201）

```ts
if (event.evt.ctrlKey) {
    // D5：XOR —— 命中的全部翻转（已选→取消，未选→加入）
    const hitIds = new Set(inRectShapes.map(s => s.attrs?.id));
    setSelectShapes(selected => {
        // 未被命中的旧选中原样保留；命中的旧选中被移除（翻转）
        const kept = selected.filter(s => !hitIds.has(s.attrs?.id));
        // 命中里未选中的，追加（翻转）
        const toAdd = inRectShapes.filter(s => s.attrs?.state !== "selected");
        return [...kept, ...toAdd];
    });
    // 样式分流（与数组同步，§2.5）：命中的已选→还原，命中的未选→设选中
    inRectShapes.forEach(shape => {
        if (shape.attrs?.state === "selected") {
            deselectShape(shape);
        } else {
            updateShapeStyle(shape);
        }
    });
} else {
    // 非 Ctrl：覆盖。补 unSelectShapeEvent 还原旧选中样式（顺手修复 §2.6 既有遗漏）
    unSelectShapeEvent(event);
    setSelectShapes(inRectShapes);
    inRectShapes.forEach(updateShapeStyle); // 等价原 changeSelectShapes
}
```

> 改动要点：
> - **Ctrl 分支**：不再用 `[...selected, ...inRectShapes]` 拼接，改为 XOR 计算；不再调 `changeSelectShapes`（它会对全部命中无差别 `updateShapeStyle`，与 XOR 冲突），改为按 `state` 分流调 `deselectShape` / `updateShapeStyle`。
> - **非 Ctrl 分支**：在 `setSelectShapes(inRectShapes)` 前补 `unSelectShapeEvent(event)`，确保旧选中（不在命中内的）样式被还原（§2.6）。`changeSelectShapes(inRectShapes)` 可保留为 `inRectShapes.forEach(updateShapeStyle)` 的等价封装，或直接内联。
> - 同向模式（D8）：同向筛选（177-193）在 XOR 之前完成，`inRectShapes` 已是同向簇，XOR 直接作用于簇——无需特判。

### 6.6 实现纯度与一致性

- `deselectShape` / `updateShapeStyle` 互为逆操作，都只改 `state` + `shapeStyle`，**不依赖 stage 坐标 / 缩放 / 旋转**，无坐标系坑。
- D12 源头去重后，`selectShapes` 数组内不再有重复 `attrs.id`，XOR 的 `hitIds` Set 与 `filter` 判定可靠。
- toggle 不调用 `saveSnapshot`（D10），不污染 undo 栈。

---

## 7. 交互与反馈

- **静默操作**：toggle 取消 / XOR 翻转不弹 `message`、不加动画（与既有选中瞬时 `setAttrs` 一致）。
- **「未找到同向路径」提示**：触发条件不变（`hitCount > 1 && 筛选后仅剩基准 && 基准无下游出口候选`，BrushSelect:190-192）。该提示针对「同向筛选结果」，与 XOR 独立——同向模式 Ctrl 框选时，若本次无同向簇仍提示，随后对（仅基准的）簇施加 XOR。
- **鼠标光标**：沿用 `onStageMouseMove`（GraphStage:177-207），hover 节点 / 路径显示 pointer，不因 toggle 改变。

---

## 8. 验收用例

### 8.1 单击 toggle

| # | 场景 | 预期 |
| --- | --- | --- |
| 1 | 选中 A 后，Ctrl+左键点 A | A 取消选中（样式还原、从数组移除），选区空 |
| 2 | 选中 {A,B} 后，Ctrl+左键点 A | A 取消，B 保持 → 选区 {B} |
| 3 | Ctrl+左键点未选中的 C | C 加入 → 追加选中 |
| 4 | 选中 A 后，普通左键点 A | 无反应（D3，保持选中） |
| 5 | Ctrl+左键点三方设备图标（其 edge 已选中） | 重定向到 edge，edge 取消选中 |
| 6 | 连续 Ctrl+左键点同一元素 | 加入 → 取消 → 加入 → 取消（标准 toggle） |
| 7 | Ctrl+左键点画布空白 | 选中集合不变（D11） |

### 8.2 框选 XOR

| # | 场景 | 预期 |
| --- | --- | --- |
| 8 | 已选 {A,B}，Ctrl 框选命中 {A,B,C} | XOR → {C}（A、B 取消，C 加入） |
| 9 | 已选 {A,B}，Ctrl 框选命中 {A,B} | 全取消 → {} |
| 10 | 已选 {A,B}，Ctrl 框选命中 {C,D}（无交集） | {A,B,C,D}（旧保留 + 新加入） |
| 11 | 无选中，Ctrl 框选命中 {A,B,C} | {A,B,C}（等价追加，去重） |
| 12 | 已选 {A,B,C}，Ctrl 框选命中 {B,C,D} | {A,D}（B、C 取消，D 加入，A 保留） |
| 13 | 非 Ctrl 框选命中 {C,D}（原选 {A,B}） | 覆盖为 {C,D}，且 A、B 样式被还原（§2.6 修复） |
| 14 | 退化矩形（<2px）Ctrl | 原选中不变 |

### 8.3 同向模式 toggle（D8）

| # | 场景 | 预期 |
| --- | --- | --- |
| 15 | 已选环内 2 条边，同向模式 Ctrl 框选整环（4 条全命中） | 同向簇 = 4 条；XOR → 已选 2 条取消、未选 2 条加入 → 结果为另外 2 条 |
| 16 | 无选中，同向模式 Ctrl 框选整环 | 同向簇 4 条全加入（等价追加） |
| 17 | 同向模式 Ctrl 框选，命中多条但无同向 | 提示「未找到同向路径」，对（仅基准的）簇施加 XOR |

### 8.4 去重 / 一致性（D12）

| # | 场景 | 预期 |
| --- | --- | --- |
| 18 | 任意路径写入后，`selectShapes` 内无重复 `attrs.id` | 数组长度 == unique id 数 |
| 19 | toggle 取消后，元素 `state` 与数组一致（无「数组已移除但视觉仍选中」） | 视觉与逻辑同步（§2.5） |
| 20 | toggle 不进 undo | 撤销 / 重做不影响 toggle 前后选中态（D10） |

---

## 9. 未决 / 后续

- **`unSelectShapeEvent` / `ContextMenu` 重构**：建议用 `deselectShape` 收口两处重复逻辑（§6.2）。属代码质量改进，可与本次一并做，也可独立 PR。
- **非 Ctrl 框选覆盖补 `unSelectShapeEvent`**（§2.6 / §6.5）：属顺手修复既有遗漏，已纳入本次；若希望最小化改动面，可拆出独立提交。
- **Overlook 监控视图**（D9）：本期不动。若后续 Overlook 也有同类 Ctrl 点选诉求，可复用 `deselectShape` / `dedupShapes`，但需单独评估其选中语义（调度场景与编辑器不同）。
- **跨地图选中残留**：切换地图时 `setSelectShapes([])`（`MapSelect:46/57`）只清数组、不清旧 shape 的 `state`（§2.5 陷阱）。属既有问题、不在本次范围，但 D12 的 wrapper 不解决它（旧 shape 已不在新 stage）。后续可考虑在切图时遍历清 `state`。
