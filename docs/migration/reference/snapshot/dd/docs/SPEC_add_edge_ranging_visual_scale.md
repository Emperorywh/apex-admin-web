# AddEdge 预览线 / Ranging 测距线接入自适应视觉倍率（visualScale）

> 涉及文件：
>
> - `src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/index.tsx`
> - `src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/ActionLayer/index.tsx`
> - `src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/ActionLayer/AddEdge/index.tsx`
> - `src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/ActionLayer/Ranging/index.tsx`
>
> 参考范例：`src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/ActionLayer/ControlPoints/index.tsx`

---

## 1. 背景与问题

地图编辑器（MapNestModify）已有一套「自适应视觉倍率」机制：随着画布缩放，
节点变小、路径变细（屏幕像素近似恒定，避免放大后元素撑满屏幕）。

但 `ManualPane` 中的两组功能没有跟随：

- **添加直线 / 添加曲线**（manualKey：`forwardLine` / `reverseLine` / `forwardBezier` /
  `reverseBezier`）—— 由 `AddEdge` 组件绘制的「预览线」（跟随鼠标的临时线 + 虚线
  平行四边形 + 距离标签）。
- **测距**（manualKey：`ranging`）—— 由 `Ranging` 组件绘制的测距线 + 距离文字。

放大时这两组辅助图形的线宽 / 字号 / 虚线间距保持原值，与已缩小的节点、变细的路径
视觉脱节。

> 注：`AddEdge.getCreateShapeAttribute`（`AddEdge/index.tsx:70-71`）在**创建真实边**
> 时已从 `stage.attr.visualScale` 读取倍率计算 `lineWidth`，最终落到 `edgesLayer` 的
> 边是正确的。**本 SPEC 只处理「预览线」本身**，不动 `getCreateShapeAttribute`。

---

## 2. 现有 visualScale 机制回顾

### 2.1 倍率计算

`GraphStage/index.tsx:67-71`（常量 `LN_50`/`LN_1000`/`LN_SPAN` 在 63–65 行）：

```ts
// 对数插值：stageScale=50  → ratio=1.0
//          stageScale=1000 → ratio=0.05
const computeAdaptiveScale = (stageScale: number): number => {
    if (stageScale <= 50) return 1;
    if (stageScale >= 1000) return 0.05;
    return 1 - 0.95 * (Math.log(stageScale) - LN_50) / LN_SPAN;
};
```

### 2.2 更新链路

`onStageWheel` 改 `stage.scale` → Konva 触发 `scaleXChange` 事件 →
`updateAdaptiveScale`（`rAF` 合流，每帧最多一次）→ 同时写三处：

1. `visualScaleRef.current`（命令式消费者通过 stage attr 读）
2. `stage.setAttr(MAP_NEST_STAGE_ATTR.visualScale, newScale)`
3. `setVisualScaleForReact(newScale)` —— **驱动声明式组件 re-render**

随后调用 `applyVisualScaleToAllShapes` 直接改 `nodesLayer` / `edgesLayer` 内所有
Shape 的 `shapeStyle.radius / lineWidth`，并 `batchDraw`。

### 2.3 两类消费者

| 类型 | 代表 | 消费方式 |
| --- | --- | --- |
| 命令式 Shape | `NodesLayer`、`EdgesLayer` | `applyVisualScaleToAllShapes` 按 layer name 遍历 `setAttr`，不经过 React |
| 声明式组件 | `ControlPoints`、`AddNode`、`AnglesLayer`、`DeviceLayer`、`ActionBadgeLayer` | 接收 `visualScale` prop（值为 `visualScaleForReact`），prop 变化触发 re-render |

`AddEdge` 与 `Ranging` 本属第二类（声明式 `<Shape>`），但**当前未接收 `visualScale`
prop**，因此落在体系之外。

---

## 3. 根因分析

`AddEdge` / `Ranging` 没跟上的原因有两个，且叠加：

1. **未接收 prop**：`ActionLayer/index.tsx` 在渲染 `<AddEdge>` / `<Ranging>` 时没有
   下传 `visualScale`（对比 `<AddNode visualScale={visualScale}>` / `<ControlPoints
   visualScale={visualScale}>` 都已下传）。
2. **视觉参数硬编码在 sceneFunc 内部**：线宽 / 字号 / dash / 偏移量以字面量写死在
   `sceneFunc` 闭包里（如 `context.lineWidth = .05`、`context.font = "bold .2px Arial"`、
   `setLineDash([.03, .03, 0, .03])`），既不在 `shapeStyle` 上，也不读任何倍率。

两层原因叠加：① `applyVisualScaleToAllShapes`（`applyVisualScale.ts:18-19`）按 layer name
精确查找 `nodesLayer` / `edgesLayer`，AddEdge / Ranging 位于 `ActionLayer`，**根本不在遍历范围内**；
② 即便强行遍历，硬编码值是 sceneFunc 闭包里的局部量（不在 `shapeStyle` attr 上），
`setAttr` 也够不到——必须从 sceneFunc 内部接入。

---

## 4. 决策记录（访谈结论）

| # | 决策点 | 结论 | 理由 |
| --- | --- | --- | --- |
| D1 | 实现路径 | **声明式 prop 透传**：`GraphStage` → `ActionLayer` → `AddEdge` / `Ranging`，复用 `visualScaleForReact` | 与 `ControlPoints` / `AddNode` 现有模式一致；rAF 合流与 re-render 时机已就绪；改动最小 |
| D2 | 缩放策略 | **全面对齐 ControlPoints**：`lineWidth` / `dash` / 字号 / 文字偏移 / 文字宽度 全部乘 `visualScale` | AddEdge 预览线 / Ranging 与 ControlPoints 同属 ActionLayer 临时辅助图形、同为 `visualScaleForReact` 声明式消费者；对齐它可保持 ActionLayer 内部策略统一，避免出现「第三种策略」 |
| D3 | 实时性 | **实时跟随**：画线 / 测距进行中滚轮缩放，线宽 / 字号立即按新比例重绘 | D1 下自动成立 —— `visualScaleForReact` 变化 → 组件 re-render → sceneFunc 用新值 |
| D4 | 范围 | **仅这两个组件**：AddEdge preview + Ranging | 不顺带审计 BrushSelect / Transformer / Coordinate 等其他 ActionLayer 组件，留作后续 |
| D5 | 文字极端值 | **不钳制**，字号纯按 `visualScale` 缩放 | 与 ControlPoints 一致；D2 下放大时字号会变小，已天然缓解「scale=1000 时文字 500px」的极端情况 |
| D6 | 线宽 / dash 下限 | **不加最小值保护** | 现有 `computeAdaptiveScale` 下限 0.05，最小 `lineWidth = 0.0025`，在 scale=1000 下屏幕 ≈ 2.5px，仍可见 |

> D2 覆盖了访谈中早期的「字号固定 / 偏移不缩放」草案。修正原因：早期只参照了
> `applyVisualScale`（命令式 nodes/edges，不动 font），未核实 ActionLayer 声明式这一侧；
> 复核 `ControlPoints` 后确认 ActionLayer 临时辅助图形的惯例是「全等比缩放」。

---

## 5. 改造方案

### 5.1 `ActionLayer/index.tsx`

向 `<AddEdge>` 与 `<Ranging>` 下传 `visualScale`（与同层 `<AddNode>` / `<ControlPoints>`
完全一致）：

```tsx
<AddEdge
    stage={stage}
    useMapId={useMapId}
    manualKey={manualKey}
    visualScale={visualScale}   // 新增
/>
// ...
<Ranging
    stage={stage}
    manualKey={manualKey}
    enableModify={enableModify}
    visualScale={visualScale}   // 新增
/>
```

> `ActionLayerProps.visualScale` 已存在（来自 `GraphStage` 的 `visualScaleForReact`），
> 无需改动 `GraphStage/index.tsx` 的 `<ActionLayer>` 调用。
>
> **顺带更新 JSDoc**：`ActionLayer/index.tsx:21-24` 现有注释写的是「仅透传给声明式
> 消费者：AddNode、ControlPoints」，改造后需补成 `AddNode、ControlPoints、AddEdge、Ranging`，
> 否则会留下与实现脱节的过期注释。

### 5.2 `AddEdge/index.tsx`

**(a) 接口新增 prop：**

```ts
interface AddEdgeProps {
    // ... 原有字段
    /** 自适应视觉倍率（来源于 visualScaleForReact，预览线视觉参数据此等比缩放） */
    visualScale: number;
}
```

组件内解构：`const { stage, useMapId, manualKey, visualScale } = props;`

**(b) sceneFunc 内所有视觉字面量乘 `visualScale`**（颜色 `strokeStyle` / `fillStyle`
除外）：

| 位置 | 原值 | 改为 |
| --- | --- | --- |
| 主线 lineWidth | `.05` | `0.05 * visualScale` |
| 虚线 lineWidth | `.05` | `0.05 * visualScale` |
| 虚线 dash | `[.03, .03, 0, .03]` | `[0.03 * visualScale, 0.03 * visualScale, 0, 0.03 * visualScale]` |
| 距离标签 font | `"bold .2px Arial"` | `` `bold ${0.2 * visualScale}px Arial` `` |
| 标签位置偏移 | `label.x + .2, label.y + .2` | `label.x + 0.2 * visualScale, label.y + 0.2 * visualScale` |

> `label.x` / `label.y` 是几何世界坐标（由 `computeLinePoint` 算出），**不乘**
> `visualScale`；只有「让文字不压在线上」的偏移量 `.2` 乘。
>
> 主线 `strokeStyle`（`forwardPath.stroke` / `reversePath.stroke`）、虚线 `strokeStyle`
> （`#D50000`）、标签 `fillStyle`（`#D50000`）均为颜色，不乘。

**(c) 不改动 `getCreateShapeAttribute`**：创建真实边的 `lineWidth` 已从
`stage.attr.visualScale` 读取（`AddEdge/index.tsx:70-71`），且新建边进入 `edgesLayer`
后由 `applyVisualScaleToAllShapes` 接管。preview 与最终边读取同一倍率源，视觉连续。

### 5.3 `Ranging/index.tsx`

**(a) 接口新增 prop：**

```ts
interface RangingProps {
    stage: Konva.Stage | null;
    manualKey: string;
    enableModify: boolean;
    /** 自适应视觉倍率（来源于 visualScaleForReact，测距线视觉参数据此等比缩放） */
    visualScale: number;
}
```

组件内解构：`const { stage, manualKey, enableModify, visualScale } = props;`

**(b) sceneFunc 内视觉字面量乘 `visualScale`**：

| 位置 | 原值 | 改为 |
| --- | --- | --- |
| lineWidth | `.05` | `0.05 * visualScale` |
| 距离文字 font | `"bold .5px Arial"` | `` `bold ${0.5 * visualScale}px Arial` `` |
| 文字位置偏移 | `ex + .5` | `ex + 0.5 * visualScale` |

> `ex` / `ey` 是 `screenToWorld` 得到的世界坐标，**不乘**；只有偏移量 `.5` 乘。
> `strokeStyle`（`#FC5E5F`）/ `fillStyle`（`#FE0101`）为颜色，不乘。

**(c) 命令式 data 安全性（已满足，无需处理）**：`Ranging` 的 `data`（`sx/sy/ex/ey/text`）
通过命令式 `setAttrs` 维护，JSX 上刻意不写 `data` 默认值（见 `Ranging/index.tsx:99-102`
注释）。传入 `visualScale` prop 后，`visualScale` 变化会触发 `Ranging` re-render，但
re-render 不会重置 `attrs.data`（JSX 上没有该字段就不会被同步覆盖），测距起点不会飘走。

---

## 6. 不变项与边界

- **stage 旋转**：`visualScale` 仅与 `stage.scaleX` 关联，不受 `rotation` 影响；
  AddEdge preview 用世界坐标，Ranging 用 `screenToWorld`（已含旋转逆变换），位置正确。
- **地图切换**：`GraphStage` 在地图加载时重置 `visualScaleRef = 1`、
  `stage.attr.visualScale = 1`、`setVisualScaleForReact(1)`，两组件回到基准比例。
- **性能**：`visualScaleForReact` 由 `rAF` 合流，每帧最多触发一次 re-render；两组件
  均为单 Shape，开销可忽略。`AddEdge` preview 的 `mousemove` 高频 `setPoints` 为既有
  行为，不因本次改动增加频率。
- **`AddEdge` 是 `memo`**：`visualScale` prop 变化会触发其 re-render，sceneFunc 闭包
  更新到新值。
- **`Ranging` 不是 `memo`**：`GraphStage` re-render 时本就跟随；传入 `visualScale` 后
  行为符合预期，不引入额外问题。

---

## 7. 验证步骤（手动）

项目无自动化测试，按以下步骤手动验证：

1. `pnpm dev` 启动，进入地图编辑器，打开任一地图。
2. **添加直线预览**：菜单选「添加直线 → 正走直线」，鼠标按住一个节点拖向另一节点，
   观察预览线（正向主实线为灰色 `#BDBDBD`、反向为红粉色 `#E57373`；外圈红色 `#D50000`
   虚线平行四边形 + 距离标签）。
3. 滚轮放大 / 缩小，确认预览线线宽、虚线间距、字号、文字偏移**随缩放等比变化**，
   与同时缩小的节点 / 变细的已有路径视觉一致。
4. 拖动过程中滚轮缩放，确认实时跟随（D3）。
5. 松开鼠标完成连线，确认最终落地的边线宽与 preview 一致（视觉连续）。
6. **测距**：菜单选「测距」，点击两点，确认红色测距线 + 距离文字随缩放等比变化。
7. 测距进行中滚轮缩放，确认实时跟随。
8. 切换暗黑主题、旋转地图，确认线 / 文字位置不错位（颜色不变属预期）。
9. 切换地图，确认两组件回到基准比例。

---

## 8. 不在本次范围

- `BrushSelect` 框选虚线框、`Transformer` 缩放手柄、`Coordinate` 坐标轴等其它
  ActionLayer 声明式辅助图形的 visualScale 接入（D4）。
- 颜色 / 配色随主题或缩放调整。
- 文字屏幕像素钳制（D5）。
- 线宽 / dash 最小值保护（D6）。
