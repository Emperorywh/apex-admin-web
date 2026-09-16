# 录制回放（RecordPlayback）画布接入自适应视觉倍率（visualScale）

> 状态：已定稿（两轮访谈完成）　|　日期：2026-07-07　|　分支：v1_dev
>
> 目标：把调度监控（Overlook）/ 地图编辑器（MapNestModify）已有的「节点大小、路径粗细、字号、
> 三方设备图标随画布缩放自适应」机制，移植到录制回放画布（RecordPlayback），让三个画布缩放观感一致。
>
> 涉及文件：
>
> - `src/pages/RecordPlayback/components/KonvaRender/index.tsx`（容器：派生 visualScale 并下传）
> - `src/pages/RecordPlayback/components/KonvaRender/MapNodeLayer/index.tsx`（接 prop + sceneFunc 闭包 + memo + 清理 `!false`）
> - `src/pages/RecordPlayback/components/KonvaRender/MapEdgeLayer/index.tsx`（接 prop + sceneFunc 闭包 + memo）
> - `src/pages/RecordPlayback/components/KonvaRender/DeviceLayer/index.tsx`（接 prop + `data.scale` + memo）
> - `src/pages/RecordPlayback/components/KonvaRender/ActionBadgeLayer/index.tsx`（接 prop + `data.scale`，**不加 memo**）
>
> 复用（均已落地，零改动）：
>
> - `src/plugins/konva/runtime/adaptiveScale.ts`（`computeAdaptiveScale` 纯函数）
> - `src/plugins/konva/devices/deviceIconSceneFunc.ts` / `deviceIconHitFunc.ts`（已内置 `R = BASE_RADIUS * scale`）
> - `src/plugins/konva/actions/actionBadgeSceneFunc.ts` / `actionBadgeHitFunc.ts`（已内置 `scale`）
>
> 不涉及：`RobotLayer`（已是 `memo`，保持随 `stage.scale` 等比缩放，不接 visualScale）。
>
> 参考范例：`src/pages/Overlook/ForceGraph/GraphStage/index.tsx`（Overlook 已落地实现）
>
> 关联：与 [SPEC_overlook_visual_scale.md](./SPEC_overlook_visual_scale.md)、
> [SPEC_add_edge_ranging_visual_scale.md](./SPEC_add_edge_ranging_visual_scale.md)、
> [SPEC_node_edge_action_display.md](./SPEC_node_edge_action_display.md) 同属 visualScale 体系。

---

## 1. 背景与问题

Overlook / MapNestModify 已实现「自适应视觉倍率」：画布缩放时节点变小、路径变细、字号同步缩小
（屏幕像素近似恒定，避免放大后元素撑满屏幕、缩小时元素糊成一团）。

录制回放画布 RecordPlayback **没有这套机制**——节点半径、路径线宽、标签字号、三方设备图标半径
都是固定地图坐标值，完全随 `stage.scale` 等比放大/缩小：

- zoom in（放大）时节点圆撑得很大、路径很粗、文字巨大、三方设备图标爆炸，遮挡周围元素；
- zoom out（缩小）时节点缩成点、路径细到看不见、文字挤成一团、设备图标缩到不可辨认。

三个画布缩放观感不一致，回放人员放大查看局部车辆轨迹 / 设备状态时体验差。

---

## 2. 三画布现状对比

| 维度 | MapNestModify（命令式） | Overlook（声明式，已落地） | RecordPlayback（待改造） |
| --- | --- | --- | --- |
| Shape 创建 | `new Konva.Shape` 命令式 | `<Shape>` + 内联 sceneFunc | `<Shape>` + 内联 sceneFunc |
| 节点/路径 `listening` | `true` | `false` | `false` |
| **scale 来源** | 命令式 `stage.scale` | **命令式** `stage.scale` / Tween / fit | **受控 React state `scale`**（`scaleX={scale}`） |
| **scale 变化是否触发 React re-render** | 否 | **否** | **是**（KonvaRender 整棵重渲染） |
| 缩放按钮 | 滚轮 | `Konva.Tween`（0.3s 动画，高频 `scaleXChange`） | `setScale(scale * 1.2)` **瞬时**（一次 state 变化） |
| visualScale 驱动 | `applyVisualScale` 改 attrs + sceneFunc 读 stage attr | 监听 `scaleXChange` + rAF 合流 + `stage.setAttr` + `batchDraw` | **纯声明式 prop**（`useMemo(computeAdaptiveScale(scale))`，sceneFunc 闭包读） |
| 是否需要 stage attr / scaleXChange / rAF | 是 | 是 | **否**（方案 B 关键简化） |
| 换图 stage 复用 | 复用 | 复用（同 stage） | **查询流程经 `setIsLoading` 切换 → 卸载重挂**（单纯 `mapData` 变则复用，详见 §3.3） |
| fit 机制 | 命令式 | `fitStageToNodes`（命令式） | useEffect 内算 bbox + `setScale` + `setPosition`（React state） |
| fit scale 范围 | — | 无上限（小地图可达 200+） | **上限 200，默认 100**（手动 zoom 无上下限） |
| 性能模式 | 无 | `enableOptimize`（≥20000 裁剪） | **无** |
| ActionBadgeLayer | 纯展示（`listening=false`） | 纯展示（`listening=false`） | **`listening=true`**（hover 弹 ActionTooltip） |
| 独有高频 re-render 源 | — | — | **`currentFrame` 每帧变化**（回放播放 10-30fps） |

### 2.1 RecordPlayback 的根本差异：scale 是受控 React state

这是本次方案与 Overlook 分道扬镳的根因。Overlook 的 `scale` 由命令式 `stage.scale()` 写入，**不经过
React**，因此必须靠监听 `scaleXChange` + `rAF` 合流 + `stage.batchDraw()` 来触发 sceneFunc 重绘
（其 `NodesLayer` / `EdgesLayer` 是 `memo`，scale 变化时 props 不变会被跳过，只能靠 `batchDraw`）。

RecordPlayback 的 `scale` 是 `RecordPlayback/index.tsx` 的页面级 `useState`，通过 props 下传给
`KonvaRender`，绑定到 `<Stage scaleX={scale} scaleY={scale}>`。**任何 `setScale` 都已经触发
KonvaRender 整棵 re-render**——滚轮、ZoomIn/ZoomOut 按钮、fit 全部走 `setScale`。

因此 Overlook 那套「监听 scaleXChange + rAF 合流 + stage.setAttr + batchDraw」机制在 RecordPlayback
里**完全冗余**：scale 变化已经驱动 re-render，sceneFunc 闭包直接读到新的派生值即可，无需再绕一道
stage attr。

---

## 3. 关键技术差异与设计推论

### 3.1 方案 B（纯声明式 prop 驱动）：不引入 stage attr / scaleXChange / rAF

```ts
// KonvaRender 内：
const visualScale = useMemo(() => computeAdaptiveScale(scale), [scale]);
// 下传给所有图层作 prop；sceneFunc 闭包直读 visualScale
```

**为何不照搬 Overlook 的 scaleXChange 监听方案**：

1. Overlook 用 stage attr 是因为其 scale 命令式写入、不触发 React，**必须**靠事件 + batchDraw
   触发重绘。RecordPlayback 的 scale 已是 React state，re-render 已然发生，再监听 `scaleXChange`
   属重复触发。
2. Overlook 用 rAF 合流是因为 ZoomIn/ZoomOut 的 `Konva.Tween` 在 0.3s 内高频改 scaleX，每帧多次
   触发 `scaleXChange`。RecordPlayback 的缩放按钮是**瞬时** `setScale(scale * 1.2)`（一次 state
   变化），滚轮也是每次 deltaY 一次 `setScale`，**不存在同帧多次触发**，React 18 自身合批已足够。
3. 方案 B 下 visualScale 是 scale 的纯函数派生值，**与 stage 实例、地图数据完全解耦**：换图时无论
   KonvaRender / stage 是否重建，新 render 周期的 `useMemo(computeAdaptiveScale(scale), [scale])` 都
   从当前 scale 派生（scale 不变则命中缓存返回同值），**根本不存在 stage attr 可残留**，无需重置。
   stage attr 方案则必须在换图回调里手动重置 attr + 重新挂监听，方案 B 天然回避（详见 §3.3）。

→ **结论：RecordPlayback 用方案 B，`useMemo` 派生 visualScale + prop 下传 + sceneFunc 闭包读取。
不 import `MAP_NEST_STAGE_ATTR`、不监听 `scaleXChange`、不引入 rAF、不写 stage attr、不写换图重置。
比 Overlook 简洁得多，也不存在命令式 setAttr 被声明式 re-render 覆盖的 sync-back 风险。**

### 3.2 设备图标 / 动作角标必须一并接入，否则比例失调

RecordPlayback 的 `DeviceLayer` / `ActionBadgeLayer` 当前 `data.scale = 1`，注释写
「回放走 stage.scale 缩放」——即它们**随 `stage.scale` 等比放大**。

若只给节点/路径接 visualScale（visualScale 随 stageScale 增大而减小，**抵消** stage 放大），
而设备/角标仍 `scale=1`（随 stage 放大），就会出现：zoom in 时节点变小、设备图标变大，**比例失调**
（与 Overlook §3.2 同理论证）。因此设备/角标必须同步接入。

好在它们的共享 sceneFunc（`deviceIconSceneFunc` / `actionBadgeSceneFunc`）**已内置 `data.scale`
字段**（`R = BASE_RADIUS * scale`），只需把 `data.scale` 从固定 1 改为 visualScale，sceneFunc 零改动。

### 3.3 换图无 attr 残留：方案 B 下无时序坑

Overlook 换图复用同一 stage，需在 `getMapInfo` 回调里手动重置 `visualScaleRef=1` / stage attr / React
state（§5.3d），否则 DeviceLayer 会用上一张图倍率渲染——因其 visualScale 存于 stage attr，attr 不随
换图自动清空。**方案 B 下 visualScale 是 scale 的纯函数，从不写入 stage attr，与 stage 实例解耦**：
换图时无论 KonvaRender / stage 是否重建，新 render 周期的 `useMemo(computeAdaptiveScale(scale), [scale])`
都从当前 scale 重新派生（scale 不变则命中缓存返回同值），**无 attr 可残留、无需任何重置代码**。这才是
方案 B 相对 Overlook 的真正红利（不依赖"重挂"本身）。

> **关于"换图是否重挂 stage"**：单是 `mapData` 这个 prop 变化，React 对同位置同类型组件是复用实例、
> `<Stage>` 与底层 `Konva.Stage` 也复用，并不会卸载。真正让 KonvaRender 卸载重挂的是查询流程里
> `handleQuery` 的 `setIsLoading(true→false)` 切换（`RecordPlayback/index.tsx`），使条件渲染
> `{!isLoading && mapData && <KonvaRender>}` 短暂为 false。结论不依赖这一点——即便 stage 复用，方案 B
> 也不写 attr、无残留。

> **一帧视觉跳变（已知可接受）**：换图后 `scale` state 不重置（沿用上一张图值），KonvaRender 首帧
> 用旧 scale 算 visualScale 渲染 → `mountNodes` 就绪后 fit useEffect（依赖 `[mountNodes, dimensions]`）
> 跑 `setScale(newScale)` → visualScale 跳到 fit 后真实值。这与现状（scale 本身就在 fit 时跳变）同源，
> 非本次引入，一两帧内完成，可接受。

### 3.4 RecordPlayback 独有：currentFrame 高频 re-render（memo 优化的动机）

回放播放时 `currentFrame` 每帧变化（10-30fps），驱动 KonvaRender re-render。`MapNodeLayer` /
`MapEdgeLayer` / `DeviceLayer` 当前**非 memo**，即使其输入（`mountNodes` / `mountEdges` /
`visualScale` / `overlayVisible`）完全不变，也会随每帧重绘——接入 visualScale 后内联 sceneFunc 闭包
也会每帧重建。给这三层加 `React.memo` 可在 `currentFrame` 变化时跳过无谓重绘，提升回放流畅度。

> 注：`RobotLayer` 已经是 `memo`（它依赖 `currentFrame`，currentFrame 变引用变 → 浅比较不等 → 重绘，
> 行为正确）。本次只给缺失 memo 的三层补上。

---

## 4. 决策记录（两轮访谈结论）

| # | 决策点 | 结论 | 理由 |
| --- | --- | --- | --- |
| D1 | visualScale 驱动机制 | **方案 B 纯声明式 prop 驱动**：KonvaRender 内 `useMemo(() => computeAdaptiveScale(scale), [scale])`，下传所有图层；节点/路径 sceneFunc 闭包直读 visualScale | RecordPlayback 的 scale 已是受控 React state，scale 变化已触发 re-render；Overlook 的 scaleXChange + rAF + stage attr 机制在此冗余。方案 B 最契合 React 受控架构，代码最简，无 sync-back 风险，换图无 stage attr 残留、无需重置（§3.1 / §3.3） |
| D2 | 配套图层范围 | **节点 + 路径 + 三方设备 + 动作角标**；**不含 RobotLayer** | 设备/角标当前 `scale=1` 随 stage 放大，必须同步否则比例失调（§3.2）；RobotLayer 是另一套渲染体系（车辆实时轨迹），Overlook D3 同样排除，改动风险大，保持随 stage 等比缩放 |
| D3 | 对数插值锚点 | **沿用 50/1000**（直接复用 `computeAdaptiveScale`） | 与 Overlook / MapNestModify 公式完全一致；fit 上限 200 时 visualScale≈0.56 效果温和但足够（回放以观览全局为主）；手动 zoom 无上下限、可达 1000+，公式的全范围仍会被触发 |
| D4 | 字号是否随缩放 | **随缩放**（`font = bold ${0.2 * visualScale}px Arial`），对齐 Overlook | zoom out 文字同步缩小避免重叠遮挡；zoom in 文字放大；与另两画布表现完全一致 |
| D5 | 箭头缩放行为 | **节点朝向箭头随 visualScale，边公共方向箭头不随**（只缩 `lineWidth`） | 与 Overlook / MapNestModify 完全一致；节点 `arrowPoints` 关于 radius 线性（`computeRotateArrow` 已确认），`arrowPoints * visualScale` 等价于按 scaledRadius 重算；边箭头跟随路径线宽变细即可 |
| D6 | 边标签让位 / 防压线偏移 | **同步乘 visualScale**（与设备图标 offset 同源） | 设备图标 offset = `BASE_RADIUS * visualScale * RATIO`，标签让位必须同源否则 zoom in 设备变小、让位距离不变 → 标签与设备位置失调（Overlook §5.5 同论证）；防压线偏移 `labelX+0.2` 同口径 |
| D7 | 角标命中区（RecordPlayback 独有） | **随 visualScale 缩放**（`actionBadgeHitFunc` 读 `data.scale`，零改动） | 与 Overlook 一致；回放页 fit 后 visualScale∈[0.56,1]，命中区最多缩到约 56% 仍可 hover；手动 zoom out 到 scale<50 时 visualScale=1（满血）命中区不缩。改共享 hitFunc 保持固定大小会增加回归面（MapNestModify / Overlook 共用） |
| D8 | 顺手优化 | **清理 MapNodeLayer `!false` 遗留** + **给 MapNodeLayer/MapEdgeLayer/DeviceLayer 加 `React.memo`（默认浅比较）** | `!false` 恒真系拷贝遗留（Overlook 原为 `!enableOptimize`，本画布无此概念）；回放 currentFrame 高频变化驱动 KonvaRender re-render，三层非 memo 会无谓重绘，加 memo 跳过提升流畅度（§3.4）。三层 props 全为值稳定类型（useMemo 缓存 / state 稳定引用 / 原始值），默认浅比较即可，无需自定义比较函数（区别于 Overlook 的 `propsForceGraphIsEqual`） |
| D9 | ActionBadgeLayer 是否加 memo | **不加**（用户未选） | 元素少（仅有动作的节点/边），重绘开销小，保持非 memo 与现状一致，缩小本次改动面。其 props 同样值稳定，后续若需可无成本补 memo。**注意 hover 会触发 KonvaRender 整树 re-render**：`onActionHover→setActionHover` 是 KonvaRender 自身 state（`KonvaRender/index.tsx`），hover 任一角标都让 KonvaRender re-render；此时三层 memo 图层 props 不变会跳过，仅 ActionBadgeLayer 非 memo 跟随重绘。元素少故开销可忽略，但「不加 memo 零代价」不成立——频繁 hover 时仍有其重绘开销 |

---

## 5. 改造方案

### 5.1 `KonvaRender/index.tsx`：派生 visualScale 并下传

**(a) 新增 import 与派生值**：

```ts
import { computeAdaptiveScale } from "@/plugins/konva/runtime/adaptiveScale";
// 组件内（紧邻 scale 相关逻辑）：
/**
 * 自适应视觉倍率（D1 方案 B）：scale 的纯函数派生值。
 * scale 是受控 React state，其变化已驱动 KonvaRender re-render，
 * 故 visualScale 经 useMemo 重算后随 props 下传，sceneFunc 闭包直读。
 * 不引入 stage attr / scaleXChange 监听 / rAF 合流（与 Overlook 的关键差异）。
 */
const visualScale = useMemo(() => computeAdaptiveScale(scale), [scale]);
```

**(b) 向四个图层下传 `visualScale`**（RobotLayer 不传）：

```tsx
<MapNodeLayer
    mountNodes={mountNodes}
    overlayVisible={overlayVisible}
    visualScale={visualScale}      // 新增
/>
<MapEdgeLayer
    mountEdges={mountEdges}
    overlayVisible={overlayVisible}
    visualScale={visualScale}      // 新增
/>
{/* 三方设备图标层：挂载于 MapEdgeLayer 之后 */}
<DeviceLayer
    mountEdges={mountEdges}
    visible={overlayVisible.device}
    isDark={isDark}
    visualScale={visualScale}      // 新增
/>
{/* 动作角标层：挂载于 DeviceLayer 之后 */}
<ActionBadgeLayer
    mountNodes={mountNodes}
    mountEdges={mountEdges}
    visible={overlayVisible.actions}
    isDark={isDark}
    onActionHover={onActionHover}
    visualScale={visualScale}      // 新增
/>
```

> 无需新增 ref / state / useEffect / 事件监听。无换图重置逻辑（§3.3）。

### 5.2 `MapNodeLayer/index.tsx`：接 prop + sceneFunc 闭包 + memo + 清理 `!false`

**(a) 接口加 `visualScale`，组件用 `memo` 包裹**：

```tsx
import { memo } from 'react';
// ...
interface MapNodeLayerProps {
    mountNodes: MountNode[];
    overlayVisible: OverlayVisible;
    /** 自适应视觉倍率（来自 KonvaRender 的 useMemo 派生值） */
    visualScale: number;   // 新增
}

const MapNodeLayer = ({ mountNodes, overlayVisible, visualScale }: MapNodeLayerProps) => {
    // ... 原有 JSX
};

// 默认浅比较：mountNodes（useMemo 稳定）/ overlayVisible（state 稳定）/ visualScale（原始值）
export default memo(MapNodeLayer);
```

**(b) sceneFunc 闭包读 visualScale**（替代固定值；清理 `!false`）：

```tsx
sceneFunc={(context, shape) => {
    const { attrs: { shapeStyle: { radius, fill, stroke, lineWidth, labelFill }, data: { name, arrowPoints } } } = shape;
    // 节点半径 / 描边随 visualScale 等比缩放（D1/D5）
    const scaledRadius = radius * visualScale;
    const scaledLineWidth = lineWidth * visualScale;
    // 画元素的圆圈
    context.beginPath();
    context.arc(0, 0, scaledRadius, 0, Math.PI * 2);
    context.fillStyle = fill;
    context.strokeStyle = stroke;
    context.lineWidth = scaledLineWidth;
    context.stroke();
    context.fill();
    if (arrowPoints) {
        // 画元素的箭头（D5：节点朝向箭头随 visualScale）。
        // arrowPoints 关于 radius 线性（computeRotateArrow），整体乘 visualScale 等价于按 scaledRadius 重算。
        // 原 `!false` 系拷贝遗留（Overlook 为 `!enableOptimize`，本画布无此概念），已清理（D8）。
        context.beginPath();
        // 分别对应箭头的顶点，左，右
        const [[tx, ty], [rx, ry], [bx, by]] = arrowPoints;
        context.moveTo(tx * visualScale, ty * visualScale);
        context.lineTo(rx * visualScale, ry * visualScale);
        context.lineTo(bx * visualScale, by * visualScale);
        context.strokeStyle = stroke;
        context.lineWidth = scaledLineWidth;
        context.stroke();
    }
    if (overlayVisible.nodeLabel) {
        // 开始画站点标签（D4：字号随缩放）；标签位置用 scaledRadius 保持与圆的相对间距
        context.textAlign = "left";
        context.font = `bold ${0.2 * visualScale}px Arial`;
        context.textBaseline = "top";
        context.fillStyle = labelFill;
        context.fillText(name, 0, scaledRadius * 1.5, scaledRadius * 4);
    }
    context.fillStrokeShape(shape);
}}
```

> **maxWidth 同步缩小**：`fillText` 第四参 `scaledRadius * 4`（原 `radius * 4`）也随之缩小，文字会更早
> 触发 maxWidth 压缩，与节点圆等比一致，符合预期。

### 5.3 `MapEdgeLayer/index.tsx`：接 prop + sceneFunc 闭包 + memo

**(a) 接口加 `visualScale`，`memo` 包裹**：

```tsx
import { memo } from 'react';
// ...
interface MapEdgeLayerProps {
    mountEdges: MountLine[];
    overlayVisible: OverlayVisible;
    /** 自适应视觉倍率 */
    visualScale: number;   // 新增
}

const MapEdgeLayer = ({ mountEdges, overlayVisible, visualScale }: MapEdgeLayerProps) => {
    // ... 原有 JSX
};

export default memo(MapEdgeLayer);
```

**(b) sceneFunc 闭包读 visualScale**：

```tsx
sceneFunc={(context, shape) => {
    const { attrs: {
        shapeStyle: { labelFill, stroke, lineWidth },
        data: { sx, sy, cx = null, cy = null, dx = null, dy = null, ex, ey, name, labelX, labelY, arrowPoints, isBackEdge, userDefinedProperties }
    } } = shape;
    // 路径线宽随 visualScale；路径几何坐标（sx/sy/.../ex/ey）不变（D1）
    const scaledLineWidth = lineWidth * visualScale;
    context.beginPath();
    if (cx === null || cy === null || dx === null || dy === null) {
        // 直线
        context.moveTo(sx, -sy);
        context.lineTo(ex, -ey);
    } else {
        // 贝塞尔曲线
        context.moveTo(sx, -sy);
        context.bezierCurveTo(cx, -cy, dx, -dy, ex, -ey);
    }
    // 画公共部分箭头（D5：边公共箭头坐标不乘 visualScale，仅描边用 scaledLineWidth）
    const [lx, ly, tx, ty, rx, ry] = arrowPoints;
    context.moveTo(lx, ly);
    context.lineTo(tx, ty);
    context.lineTo(rx, ry);
    context.strokeStyle = stroke;
    context.lineWidth = scaledLineWidth;
    context.stroke();
    if (overlayVisible.edgeLabel) {
        // 标签（D4：字号随缩放）
        context.textAlign = "center";
        context.font = `bold ${0.2 * visualScale}px Arial`;
        context.textBaseline = "top";
        context.fillStyle = labelFill;
        // 防压线偏移随 visualScale（D6，与 AddEdge preview 同口径）
        let textX = labelX + 0.2 * visualScale;
        let textY = labelY + 0.2 * visualScale;
        // 有设备的边，name 标签沿法线对侧让位（D6：让位 offset 与设备图标同源，乘 visualScale）
        if (resolveDeviceType(userDefinedProperties)) {
            const angle = computeEdgeTangentAngle(sx, sy, cx, cy, dx, dy, ex, ey);
            const offset = DEVICE_BASE_RADIUS * DEVICE_NORMAL_OFFSET_RATIO * visualScale;
            const labelPos = computeDeviceLabelPos(labelX, labelY, angle, !!isBackEdge, offset);
            textX = labelPos.x;
            textY = labelPos.y;
        }
        context.fillText(name, textX, textY);
    }
    context.fillStrokeShape(shape);
}}
```

> **让位偏移同步缩放**：设备图标接入 visualScale 后其 offset = `DEVICE_BASE_RADIUS * visualScale *
> DEVICE_NORMAL_OFFSET_RATIO`（见 `deviceIconSceneFunc.ts`）。边标签让位必须用同一 offset，否则
> zoom in 设备变小、让位距离不变 → 标签与设备位置关系失调（与 Overlook §5.5 同论证）。

### 5.4 `DeviceLayer/index.tsx`：接 prop + `data.scale` + memo

```tsx
import { memo } from "react";
// ...
interface DeviceLayerProps {
    mountEdges: MountLine[];
    visible: boolean;
    isDark: boolean;
    /** 自适应视觉倍率（写入 data.scale） */
    visualScale: number;   // 新增
}

const DeviceLayer = ({ mountEdges, visible, isDark, visualScale }: DeviceLayerProps) => {
    // deviceShapes 的 useMemo 依赖保持 [mountEdges]，不加入 visualScale（仅 data.scale 在 render 取最新）
    // ... 原有 useMemo 不变
    return (
        <Layer listening={false} visible={visible}>
            {deviceShapes.map(item => (
                <Shape
                    key={item.id}
                    sceneFunc={deviceIconSceneFunc}
                    listening={false}
                    perfectDrawEnabled={false}
                    shadowForStrokeEnabled={false}
                    data={{
                        deviceType: item.deviceType,
                        anchorX: item.anchorX,
                        anchorY: item.anchorY,
                        angle: item.angle,
                        isBackEdge: item.isBackEdge,
                        scale: visualScale,   // 改：原固定 1 → visualScale
                        isDark,
                        isSelected: false,
                    }}
                />
            ))}
        </Layer>
    );
};

export default memo(DeviceLayer);
```

> 共享 `deviceIconSceneFunc` / `deviceIconHitFunc` **零改动**（已内置 `R = DEVICE_BASE_RADIUS * scale`）。
> DeviceLayer `listening=false` 无命中区问题，但 hitFunc 同样读 `data.scale`，保持一致。

### 5.5 `ActionBadgeLayer/index.tsx`：接 prop + `data.scale`（**不加 memo**）

```tsx
interface ActionBadgeLayerProps {
    mountNodes: MountNode[];
    mountEdges: MountLine[];
    visible: boolean;
    isDark: boolean;
    onActionHover: (payload: ActionHoverPayload | null) => void;
    /** 自适应视觉倍率（写入 data.scale） */
    visualScale: number;   // 新增
}

const ActionBadgeLayer = ({ mountNodes, mountEdges, visible, isDark, onActionHover, visualScale }: ActionBadgeLayerProps) => {
    // ... badgeShapes 的 useMemo 依赖保持 [mountNodes, mountEdges]，【不要】加入 visualScale
    return (
        <Layer visible={visible}>
            {badgeShapes.map(item => (
                <Shape
                    // ... 原有属性不变
                    data={{
                        anchorX: item.anchorX,
                        anchorY: item.anchorY,
                        count: item.count,
                        severity: item.severity,
                        scale: visualScale,   // 改：原固定 1 → visualScale
                        isDark,
                        isSelected: false,
                    }}
                />
            ))}
        </Layer>
    );
};
// 不加 memo（D9）
export default ActionBadgeLayer;
```

> 共享 `actionBadgeSceneFunc` / `actionBadgeHitFunc` 零改动。
>
> ⚠️ `badgeShapes` 的 `useMemo` 依赖 `[mountNodes, mountEdges]`，**不要**把 `visualScale` 加进依赖
> ——只需 `data.scale` 在每次 re-render 时取最新 `visualScale`。否则缩放会触发整个 `mountNodes` /
> `mountEdges` 遍历重算，性能退化（与 Overlook §5.7 ⚠️ 同约束）。
>
> **命中区随 visualScale 缩放（D7）**：`actionBadgeHitFunc` 读 `data.scale`，接入后 hover 命中区随
> visualScale 缩放。回放页 fit 后 visualScale∈[0.56,1]，命中区最多缩到约 56% 仍可 hover；scale<50 时
> visualScale=1 不缩。此为期望行为，零额外改动。

---

## 6. 数据流与运行时机制

### 6.1 缩放时的完整链路（方案 B）

```
用户滚轮 / 点 ZoomIn-ZoomOut 按钮 / 换图 fit
        │  全部走 setScale（RecordPlayback/index.tsx 的 setState）
        ▼
 scale（React state）变化 → KonvaRender re-render（本就在发生）
        │
        ▼
 visualScale = useMemo(computeAdaptiveScale(scale), [scale])  ── O(1) 重算
        │
        ▼  visualScale 作为 prop 下传四个图层
        │
        ├─ MapNodeLayer / MapEdgeLayer / DeviceLayer（memo）
        │     visualScale prop 变 → 浅比较不等 → re-render
        │     sceneFunc 闭包读新 visualScale → radius/lineWidth/font/箭头 乘 visualScale
        │
        ├─ ActionBadgeLayer（非 memo）
        │     父 re-render → 跟随 re-render → data.scale = visualScale
        │
        └─ RobotLayer（memo，不接 visualScale）→ props 不变 → 跳过（保持 stage 等比缩放）
```

### 6.2 回放播放时（currentFrame 高频变化）

```
currentFrame 每帧变化 → KonvaRender re-render
        │
        ├─ visualScale = useMemo(...) → scale 未变 → 不重算，返回缓存值（引用稳定）
        │
        ├─ MapNodeLayer / MapEdgeLayer / DeviceLayer（memo）
        │     props（mountNodes/mountEdges/visualScale/overlayVisible）均不变 → 浅比较相等 → 跳过 re-render ✅
        │
        ├─ ActionBadgeLayer（非 memo）→ 跟随 re-render（元素少，开销可忽略）
        │
        └─ RobotLayer（memo）→ currentFrame prop 引用变 → 浅比较不等 → re-render（正确，它依赖 currentFrame）
```

> memo 优化（D8）的核心收益：把「地图静态图层」与「currentFrame 高频变化」解耦，回放播放时节点/路径/
> 设备不再每帧无谓重绘，只让真正依赖 currentFrame 的 RobotLayer 重绘。

### 6.3 各缩放来源的覆盖

| 来源 | 实现 | 触发 setScale | visualScale 响应 |
| --- | --- | --- | --- |
| 滚轮 `onWheel` | `setScale(newScale)` + `setPosition` | 是（每次 deltaY 一次） | scale 变 → useMemo 重算 → 下帧生效 |
| ZoomIn / ZoomOut 按钮 | `setScale(scale * 1.2)` / `setScale(scale / 1.2)` | 是（瞬时一次） | 瞬时跳变（无 Tween 动画，无需 rAF 合流） |
| 换图 fit | useEffect 算 bbox + `setScale(newScale)` | 是（一次） | fit 后 scale 定 → visualScale 定 |

> 与 Overlook 的差异：Overlook 缩放按钮用 `Konva.Tween`（0.3s 动画、高频 `scaleXChange`，需 rAF 合流）；
> RecordPlayback 是瞬时 `setScale`，一次 state 变化，React 自身合批即可，无需 rAF。

---

## 7. 边界与不变项

- **不引入 stage attr 机制**：方案 B 下 sceneFunc 闭包读 visualScale prop，**不** import
  `MAP_NEST_STAGE_ATTR`、**不**监听 `scaleXChange`、**不**写 `stage.setAttr`、**不**调 `batchDraw`、
  **不**用 rAF 合流、**不**写换图重置逻辑（§3.1 / §3.3）。这是与 Overlook 的根本差异。
- **`overlayVisible` 机制不变**：节点/路径标签显隐仍由 `overlayVisible.nodeLabel` / `edgeLabel` 控制，
  设备/角标由 `overlayVisible.device` / `actions` 控制（Layer `visible`），与 visualScale 正交。
- **`isDark` 机制不变**：设备/角标的 `isDark` 仍走 `useLocalStorageState('theme')` prop，本次不动。
- **stage 旋转（RotateMap）**：visualScale 仅与 `scale` 关联，不受 `rotation` 影响；节点/路径用地图
  坐标，旋转由 stage 变换矩阵自动处理。缩放与旋转可叠加，互不干扰。
- **跟随动画（lerp position）**：锁定车辆后 `startFollowAnimation` 用 rAF 逐帧 `setPosition`，只改
  position 不改 scale，visualScale 不受影响，无需特殊处理。
- **全屏切换**：改变容器尺寸 → `dimensions` 变 → fit useEffect（依赖 `dimensions`）重跑 → `setScale`
  → visualScale 重算。正常链路，无需特殊处理。
- **scale 无上下限**：RecordPlayback 滚轮 / 按钮**无** `minZoom` / `maxZoom` 限制（区别于 Overlook 的
  `konvaConfig.minZoom/maxZoom`）。手动 zoom 可达 scale≥1000（visualScale 钳位 0.05）或 scale→0
  （visualScale=1 满血，节点随 stage 缩小）。沿用 50/1000 公式在全范围行为正确。
- **节点 `arrowPoints` 线性性**：`computeRotateArrow`（`graph.ts`）关于 radius 线性，
  `arrowPoints * visualScale` 等价于按 scaledRadius 重算，方案确定（与 Overlook §5.4 同结论）。
  RecordPlayback 与 Overlook 共用 `mountGraphNodes`，数据同源。
- **换图无 stage attr 残留**：方案 B 不写入任何 stage attr，visualScale 是 scale 的纯函数、与 stage
  实例解耦。换图时 KonvaRender / stage 是否重建（查询流程经 `setIsLoading` 切换会重挂，单纯 `mapData`
  变化则复用）都不影响——新 render 周期 `useMemo` 从当前 scale 派生，无 attr 可残留、无需重置代码。
  一帧视觉跳变已知可接受（§3.3）。
- **`ActionBadgeLayer` 的 `useMemo` 依赖**：不加入 `visualScale`（§5.5 ⚠️）。
- **`DeviceLayer` 的 `useMemo` 依赖**：同样不加入 `visualScale`（§5.4）。
- **memo 比较函数**：三层用默认 `React.memo`（浅比较），无需自定义。因 props 全为值稳定类型：
  `mountNodes` / `mountEdges`（KonvaRender 内 `useMemo` 缓存，引用稳定）、`overlayVisible`
  （`index.tsx` 的 `useState`，开关时才变）、`visualScale` / `visible` / `isDark`（原始值）。
  区别于 Overlook `propsForceGraphIsEqual`（其为 GraphStage 整体 memo、props 含复合对象而写的逐字段比较）。

---

## 8. 实施步骤（建议顺序）

> **实施前确认（RobotGroup 不读 stage attr）**：RecordPlayback 的 `RobotLayer` 复用 Overlook 的
> `RobotGroup` / `TrafficGroup`（`RobotLayer/index.tsx`）。本次不向 RobotLayer 传 visualScale、也不写
> `MAP_NEST_STAGE_ATTR`，若 RobotGroup 子树内任何 shape 读取该 stage attr，会取默认值 1 与 stage 等比
> 缩放叠加，行为可能与 Overlook（写 attr）略有差异。动手前先 grep 一次 `MAP_NEST_STAGE_ATTR` 在
> `src/pages/Overlook/ForceGraph/GraphStage/RobotLayer/` 子树的使用情况：若未使用即可放心排除（与 D2
> 结论一致）；若使用则需评估是否一并处理（超出本次范围，另开任务）。

1. **KonvaRender 派生 visualScale + 下传**（§5.1）：加 `computeAdaptiveScale` import +
   `useMemo`，给四个图层加 `visualScale` prop。此时子组件尚未消费，无视觉变化，仅打通数据。
2. **MapNodeLayer / MapEdgeLayer sceneFunc**（§5.2 / §5.3）：接 `visualScale` prop，sceneFunc 闭包
   读取，radius/lineWidth/font/节点箭头/让位偏移 乘 visualScale。MapNodeLayer 顺手清理 `!false`。
3. **DeviceLayer / ActionBadgeLayer**（§5.4 / §5.5）：接 `visualScale` prop，`data.scale = visualScale`。
4. **加 memo**（§5.2 / §5.3 / §5.4）：MapNodeLayer / MapEdgeLayer / DeviceLayer 用 `memo` 包裹导出。
   可与步骤 2/3 合并提交，但因属正交优化，建议单独一步便于回溯。
5. **手动验证**（§9）。

> 本次不新增 / 改动任何共享模块（`adaptiveScale.ts` / sceneFunc / hitFunc 均已就绪），无跨画布回归面。
> 改动完全限定在 RecordPlayback 五个文件内。

---

## 9. 验证清单（手动，项目无自动化测试）

`pnpm dev` 启动，进入录制回放页（RecordPlayback），选择地图与时间范围查询，播放回放：

- [ ] **节点缩放**：滚轮放大，节点圆变小、描边变细、朝向箭头同步缩小；缩小则变大。与 Overlook 缩放观感一致。
- [ ] **路径缩放**：放大路径变细、缩小变粗，线宽随 visualScale 变化；公共方向箭头大小不变（只线宽变）。
- [ ] **字号缩放**：节点名、路径名文字随缩放等比变大变小（D4）。
- [ ] **三方设备**（打开「展示-三方设备」开关）：随缩放与节点保持比例一致，不再「zoom in 图标爆炸、节点缩小」失调。
- [ ] **动作角标**（打开「展示-动作角标」开关）：随缩放与节点保持比例一致；hover 仍能弹出 ActionTooltip
      （命中区随 visualScale 缩放，D7）；zoom out 到 scale<50 时命中区恢复满血。
- [ ] **边标签让位**：有设备的边，name 标签沿法线让位距离随 visualScale 同步缩放，与设备图标位置关系稳定。
- [ ] **ZoomIn/ZoomOut 按钮**：瞬时缩放，visualScale 即时跟随（无动画、无延迟）。
- [ ] **fit 自适应**：查询后 fit 完成，节点/路径按 fit 后 scale 的 visualScale 显示。
- [ ] **换图**：切换地图，新地图 fit 后 visualScale 正确按新 scale 计算；无上一张图倍率残留。
- [ ] **回放播放流畅度**（memo 验证）：播放回放时观察节点/路径/设备不随每帧闪烁或重绘卡顿（currentFrame
      变化时三层 memo 跳过）；RobotLayer 正常随帧更新位置。
- [ ] **暗黑主题**：切换主题，设备/角标配色正确，节点/路径颜色不受影响。
- [ ] **stage 旋转**：用 RotateMap 旋转地图后缩放，节点/路径/设备/角标位置不错位、比例不失调。
- [ ] **锁定车辆跟随**：锁定一辆车播放，跟随动画（lerp position）期间缩放正常，visualScale 不受跟随影响。
- [ ] **全屏**：全屏切换后 fit 重算，visualScale 正确响应新尺寸。
- [ ] **极限缩放**：手动滚轮放大到 scale≥1000（visualScale 钳位 0.05，节点缩到最小）；缩小到 scale<50
      （visualScale=1 满血），行为正确无异常。

---

## 10. 不在本次范围

- **RobotLayer 接入 visualScale**：车辆图标保持现状（已是 `memo`，随 `stage.scale` 等比缩放）。
  已知权衡：zoom in 时机器人变大、节点变小，比例失调（D2 排除，与 Overlook D3 一致）。后续若需统一
  可另开任务。
- **为回放页重新标定对数锚点**：沿用 50/1000（D3）。
- **给缩放加 minZoom/maxZoom 限制**：RecordPlayback 现状无上下限，本次不引入（与 Overlook 不同）。
- **ActionBadgeLayer 加 memo**：本次不加（D9），保持现状。
- **换图时重置 scale state**：现状换图沿用旧 scale 至 fit 重算，本次不改（一帧跳变可接受，§3.3）。
- **节点 `arrowPoints` 非线性兜底**：`computeRotateArrow` 已确认线性，无需重算封装。
- **`overlayVisible` / `isDark` 改 stage attr**：维持现有 prop 机制，本次不动。

---

## 11. 风险与权衡

- **RobotLayer 比例失调（已知，D2 接受）**：RobotLayer 不接 visualScale，zoom in 时车辆图标随 stage
  放大、节点因 visualScale 抵消而变小，二者比例不一致。回放场景下车辆本就需突出显示（轨迹追踪），
  与 Overlook D3 同权衡。
- **换图瞬时视觉跳变（已知，§3.3）**：换图后先以旧 scale 的 visualScale 渲染一帧，fit 完成再跳到真实
  倍率。因 fit 的 `setScale` 在 `mountNodes` 就绪后即触发，跳变在一两帧内。与现状（scale 本身 fit 时
  跳变）同源，非本次引入。
- **方案 B 的 sceneFunc 闭包重建（可忽略）**：MapNodeLayer / MapEdgeLayer 的内联 sceneFunc 在每次
  re-render（visualScale 变）时重建。但加 memo 后，re-render 仅在 visualScale / overlayVisible /
  mountNodes 变化时发生（currentFrame 变化时跳过），频率与缩放一致，开销可忽略。未用稳定引用（模块级
  函数）是因为方案 B 闭包读 prop 最简洁，稳定引用需把 visualScale 经 stage attr 传递，反而引入方案 A
  的复杂度，得不偿失。
- **memo 浅比较的隐含前提（需满足）**：默认浅比较有效的前提是 `mountNodes` / `mountEdges` /
  `overlayVisible` 引用稳定。当前 `mountNodes` / `mountEdges` 在 KonvaRender 内 `useMemo([nodes])` /
  `useMemo([edges])` 缓存（`nodes` / `edges` 来自 `mapJson`，换图才变），`overlayVisible` 是
  `index.tsx` 的 `useState`（开关才变）。若未来有人在 KonvaRender render 内联构造这些对象（如
  `{...overlayVisible}`），memo 会失效——需在代码注释中标注此约束。
- **边标签让位偏移已同步（已规避）**：§5.3 已让让位 offset 与防压线偏移乘 visualScale，与设备图标
  同源，避免标签/设备位置失调。
- **角标命中区缩放（已知，D7 接受）**：zoom out 时角标命中区随 visualScale 缩小，极端缩小后 hover 略
  难。但回放页 fit 后 visualScale∈[0.56,1] 命中区最多缩到约 56% 仍可用；scale<50 时满血不缩。保持与
  Overlook 一致、零共享函数改动。
- **`computeAdaptiveScale` 复用（零风险）**：纯函数已落地且 Overlook / MapNestModify 共用，本次仅
  import 调用，无回归面。
- **overlayVisible 粒度会击穿图层 memo（已知，非本次引入）**：`overlayVisible` 是 `RecordPlayback/index.tsx`
  的整体 `useState`，切换任一开关（如 device）会重建整个对象 → 所有 memo 图层（MapNodeLayer/MapEdgeLayer/
  DeviceLayer）浅比较不等、全部 re-render。这是现有机制（本次不改造），与 D8「memo 提升 currentFrame 高频
  场景流畅度」的收益正交：memo 只在「overlayVisible 不变、仅 currentFrame 变」的回放播放场景生效；切开关时
  本就会全图层重绘。验收时勿把「切 device 开关、节点层也重绘」误判为 memo 失效。
