# 调度监控（Overlook）画布接入自适应视觉倍率（visualScale）

> 状态：已定稿（三轮访谈完成）　|　日期：2026-07-07　|　分支：v1_dev
>
> 目标：把地图编辑器（MapNestModify）已有的「路径粗细、节点大小、字号随画布缩放自适应」
> 机制，移植到调度监控画布（Overlook），让两个画布缩放观感一致。
>
> 涉及文件：
>
> - `src/pages/Overlook/ForceGraph/GraphStage/index.tsx`
> - `src/pages/Overlook/ForceGraph/GraphStage/NodesLayer/index.tsx`
> - `src/pages/Overlook/ForceGraph/GraphStage/EdgesLayer/index.tsx`
> - `src/pages/Overlook/ForceGraph/GraphStage/DeviceLayer/index.tsx`
> - `src/pages/Overlook/ForceGraph/GraphStage/ActionBadgeLayer/index.tsx`
> - `src/plugins/konva/runtime/adaptiveScale.ts`（新增，共享纯函数）
> - `src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/index.tsx`（改 import：内联函数改为引用共享模块，逻辑零变化）
>
> 常量 `MAP_NEST_STAGE_ATTR` **保持原名不重命名**（最小化修改，见 D9 / §5.2）。Overlook 的缩放按钮
> `GraphBar/ZoomIn`、`GraphBar/ZoomOut`（`Konva.Tween` 改 stage.scale）**无需改动**——天然触发
> `scaleXChange`，被 §5.3(c) 的统一监听捕获。
>
> 参考范例：`src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/index.tsx`（既有命令式实现）
>
> 关联：与 [SPEC_add_edge_ranging_visual_scale.md](./SPEC_add_edge_ranging_visual_scale.md)、
> [SPEC_node_edge_action_display.md](./SPEC_node_edge_action_display.md) 同属 visualScale 体系。

---

## 1. 背景与问题

MapNestModify 已实现「自适应视觉倍率」：画布缩放时节点变小、路径变细、字号同步缩小
（屏幕像素近似恒定，避免放大后元素撑满屏幕、缩小时元素糊成一团）。

调度监控画布 Overlook **没有这套机制**——节点半径、路径线宽、标签字号都是固定地图坐标值，
完全随 `stage.scale` 等比放大/缩小：

- zoom in（放大）时节点圆撑得很大、路径很粗、文字巨大，遮挡周围元素；
- zoom out（缩小）时节点缩成点、路径细到看不见、文字挤成一团。

两个画布缩放观感不一致，监控人员放大查看局部路况时体验差。

---

## 2. 两画布现状对比

| 维度 | MapNestModify（命令式） | Overlook（声明式） |
| --- | --- | --- |
| Shape 创建 | `new Konva.Shape({...})` 命令式挂入 Layer | `<Shape>` React 组件 + `useMemo` 预计算 |
| sceneFunc | 抽到共享函数 `nodeSceneFunc` / `edgeSceneFunc` | **内联**在组件 `sceneFunc={(ctx, shape) => {...}}` |
| 节点/路径 `listening` | `true`（可选中、可拖拽） | **`false`**（纯展示，不参与命中） |
| visualScale 来源 | `stage.getAttr(MAP_NEST_STAGE_ATTR.visualScale)` | **无** |
| 字号 | `0.2 * visualScale`（随缩放） | 固定 `"bold .2px Arial"` |
| 缩放入口 | 滚轮（`stage.scale`） | 滚轮 + ZoomIn/ZoomOut 按钮（`Konva.Tween`） + 换图 `fitStageToNodes` |
| 设备图标 / 动作角标 | 命令式，`data.scale = visualScale`（已接） | 声明式，`data.scale = 1`（**未接**，注释写「走 stage.scale 缩放」） |
| 性能模式 | 无 | `enableOptimize`（节点+边 ≥ `maxCount=20000` 时开启，关闭标签/箭头/设备/角标） |

### 2.1 MapNestModify 既有 visualScale 机制（移植范本）

**倍率计算**（`GraphStage/index.tsx:63-71`，对数插值）：

```ts
// stageScale=50  → visualScale=1.0（满血）
// stageScale=1000 → visualScale=0.05（最小）
// 50~1000 之间按自然对数线性插值
const computeAdaptiveScale = (stageScale: number): number => {
    if (stageScale <= 50) return 1;
    if (stageScale >= 1000) return 0.05;
    return 1 - 0.95 * (Math.log(stageScale) - LN_50) / LN_SPAN;
};
```

**更新链路**：任何来源改 `stage.scale` → Konva 触发 `scaleXChange` 事件 →
`updateAdaptiveScale`（`requestAnimationFrame` 合流，每帧最多一次，变化 < 0.01 跳过）→ 写三处：

1. `visualScaleRef.current`（ref 缓存）
2. `stage.setAttr(MAP_NEST_STAGE_ATTR.visualScale, newScale)`（命令式 sceneFunc 读）
3. `setVisualScaleForReact(newScale)`（驱动声明式组件 re-render）

随后 `applyVisualScaleToAllShapes`（`applyVisualScale.ts`）按 layer name 遍历
`nodesLayer` / `edgesLayer`，直接 `setAttr` 改 `shapeStyle.radius / lineWidth` +
重算节点 `arrowPoints` + 同步 `hitStrokeWidth`，最后 `batchDraw`。

**两类消费者**（见 [SPEC_add_edge_ranging_visual_scale.md §2.3](./SPEC_add_edge_ranging_visual_scale.md)）：

| 类型 | 代表 | 消费方式 |
| --- | --- | --- |
| 命令式 Shape | `NodesLayer`、`EdgesLayer` | `applyVisualScaleToAllShapes` 按 layer name `setAttr`，**不经过 React**；`radius/lineWidth` 从 `shapeStyle` attr 读 |
| 声明式组件 | `ControlPoints`、`AddNode`、`AnglesLayer`、`DeviceLayer`、`ActionBadgeLayer`、`AddEdge`、`Ranging` | 接 `visualScale` prop（值 = `visualScaleForReact`），prop 变化触发 re-render |

> **注意一个易混淆点**：MapNestModify 的 `nodeSceneFunc.ts:17`、`edgeDrawFuncs.ts:24`
> **已经**通过 `stage.getAttr(...)` 在 sceneFunc 内运行时读取 `visualScale`（用于字号）
> 和 `labelVisible`。也就是说 MapNestModify 是**混合**消费：
> `radius/lineWidth` 走 `applyVisualScale` 改 attrs（因 `listening=true` 需同步
> `hitStrokeWidth`），`font` 走 sceneFunc 运行时读 stage attr。**「sceneFunc 读 stage attr」
> 在 MapNestModify 已是成熟先例**，Overlook 沿用此模式无创新风险。

---

## 3. 关键技术差异与设计推论

Overlook 与 MapNestModify 的根本差异是 **声明式 + `listening=false`**，由此推出两个重要简化：

### 3.1 Overlook 节点/路径无需 `applyVisualScaleToAllShapes`

MapNestModify 用 `applyVisualScaleToAllShapes` 直接改 `shapeStyle` attrs，原因有二：
① 它的 `nodeSceneFunc` 从 `attrs.shapeStyle.radius` 读半径；② 节点/路径 `listening=true`，
命中区域 `hitStrokeWidth` 必须随线宽同步，否则缩放后点不中。

Overlook 的节点/路径 `listening={false}`（纯展示，不响应点击/hover），**没有命中区域问题**；
且其 sceneFunc 决定**运行时读 stage attr 直接乘**（见 D1），不依赖 `shapeStyle` attr 被改。

→ **结论：Overlook 不引入 `applyVisualScaleToAllShapes`，节点/路径 sceneFunc 直接
`stage.getAttr(visualScale)` 读倍率，绘制时 `radius * visualScale`。缩放时只需
`setAttr(visualScale) + batchDraw` 让 sceneFunc 重绘即可**。比 MapNestModify 更简洁，
也不存在命令式 setAttr 被声明式 re-render 覆盖的 sync-back 风险。

### 3.2 设备图标/动作角标必须一并接入，否则比例失调

Overlook 的 `DeviceLayer` / `ActionBadgeLayer` 当前 `data.scale = 1`，注释写
「声明式画布走 stage.scale 缩放」——即它们**随 `stage.scale` 等比放大**。

若只给节点/路径接 visualScale（visualScale 随 stageScale 增大而减小，**抵消** stage 放大），
而设备/角标仍 `scale=1`（随 stage 放大），就会出现：zoom in 时节点变小、设备图标变大，
**比例失调**。因此设备/角标必须同步接入（D3）。

好在它们的共享 sceneFunc（`deviceIconSceneFunc` / `actionBadgeSceneFunc`）**已内置
`data.scale` 字段**（`R = BASE_RADIUS * scale`），只需把 `data.scale` 从固定 1 改为
visualScale 即可，sceneFunc 零改动（D5）。

### 3.3 Overlook 缩放初始 scale 不固定（fit 自适应）

MapNestModify 初始固定 `stage.scale = 50`（满血 visualScale=1）。
Overlook 首次进入/换图走 `fitStageToNodes` 自适应，fit 后 scale 由地图大小决定
（小地图可达 200+，大地图可能 < 50）。沿用 50/1000 锚点意味着 Overlook fit 后初始
visualScale 可能 < 1（节点偏小）——这是用户在 D6 明确接受的权衡（见 §11）。

---

## 4. 决策记录（三轮访谈结论）

| # | 决策点 | 结论 | 理由 |
| --- | --- | --- | --- |
| D1 | 节点/路径接入方式 | **sceneFunc 运行时读 stage attr**：visualScale 写入 `MAP_NEST_STAGE_ATTR.visualScale`，NodesLayer/EdgesLayer 内联 sceneFunc 绘制时 `radius * visualScale` / `lineWidth * visualScale` / `font = 0.2 * visualScale` | 不触发 React re-render（缩放只 `batchDraw`），无 sync-back 风险，与 MapNestModify 字号机制、`labelVisible` 同源，最契合 Overlook 声明式架构。NodesLayer/EdgesLayer 是 `memo`，缩放时 props 不变被跳过，sceneFunc 读最新 stage attr 重绘 |
| D2 | 字号是否随缩放 | **随缩放**（`font = 0.2 * visualScale`），对齐 MapNestModify | zoom out 文字同步缩小避免重叠遮挡；zoom in 文字放大；与编辑器表现完全一致 |
| D3 | 配套图层范围 | **节点 + 路径 + 设备图标 + 动作角标**；**不含 RobotLayer** | 设备/角标当前 `scale=1` 随 stage 放大，必须同步否则比例失调（§3.2）；RobotLayer 是另一套渲染体系（车辆实时位置），改动范围/风险大，保持现状 |
| D4 | `enableOptimize` 性能模式 | **性能模式下 visualScale 照常响应** | 性能模式已裁剪标签/箭头/设备/角标分支，节点/路径本身仍需绘制；sceneFunc 多读一个 attr + 乘法，增量可忽略；`rAF` 合流保证每帧最多一次 `batchDraw` |
| D5 | 设备/角标喂入方式 | **prop 传入 `data.scale`**：`DeviceLayer`/`ActionBadgeLayer` 接 `visualScaleForReact` prop，写入 `data.scale`。双轨制对齐 MapNestModify | 共享 sceneFunc（`deviceIconSceneFunc`/`actionBadgeSceneFunc`）零改动，无回归风险；设备/角标数量少且性能模式不渲染，缩放时全量 re-render 开销可接受；`hitFunc` 已用 `data.scale`，prop 传入后命中区域自动同步 |
| D6 | 对数插值锚点 | **沿用 50/1000**（直接复用 `computeAdaptiveScale`） | 与编辑器行为完全一致；接受 Overlook fit 后初始 visualScale 可能 < 1（节点偏小）的权衡 |
| D7 | 箭头缩放行为 | **对齐编辑器：节点朝向箭头随 visualScale，边公共方向箭头不随**（只缩 `lineWidth`） | 与 MapNestModify `applyVisualScale` 完全一致（节点 `arrowPoints` 按 `scaledRadius` 重算，边 `arrowPoints` 不动）；边箭头跟随路径线宽变细即可，避免极端缩小时方向标看不清 |
| D8 | 代码组织 | **抽共享纯函数**：`computeAdaptiveScale` + `LN_50/LN_1000/LN_SPAN` 移到 `src/plugins/konva/runtime/adaptiveScale.ts`，两画布共用；各自的 `updateAdaptiveScale` / `scaleXChange` 监听留在 GraphStage | 纯函数无副作用、无回归风险；两画布 stage attr 写入策略不同（MapNestModify 还写 `labelVisible`/`isDark` + 调 `applyVisualScale`，Overlook 只写 `visualScale` + `batchDraw`），编排逻辑各自保留更清晰 |
| D9 | stage attr 常量命名 | **保持 `MAP_NEST_STAGE_ATTR` 原名不重命名**，Overlook 直接复用该常量 | 最小化修改：重命名需同步改动 13 个引用文件、徒增回归面，而 Overlook 复用一个名为 `MAP_NEST_STAGE_ATTR` 的常量仅是命名不够"通用"，无任何功能影响；命名整洁度不抵重命名风险。`MAP_NEST_LAYER_NAME` / `MAP_NEST_EVENT` 同样保持不变 |

---

## 5. 改造方案

### 5.1 新增共享纯函数模块 `src/plugins/konva/runtime/adaptiveScale.ts`

把 `MapNestModify/GraphStage/index.tsx:63-71` 的常量与函数原样迁出：

```ts
/**
 * @description 自适应视觉倍率纯函数（MapNestModify / Overlook 共用）
 * @date 2026-7-7
 *
 * 根据 stage 缩放倍率计算视觉补偿比例：
 * 缩放越大（zoom in），visualScale 越小，抵消 stage 放大，让节点/路径/字号
 * 屏幕像素近似恒定，避免放大后撑满屏幕。
 * 对数插值锚点：stageScale=50 → 1.0（满血），stageScale=1000 → 0.05（最小）。
 */

/** 满血锚点 scale（对数下界） */
const LN_50 = Math.log(50);
/** 最小锚点 scale（对数上界） */
const LN_1000 = Math.log(1000);
/** 对数跨度 */
const LN_SPAN = LN_1000 - LN_50;

/**
 * 计算 visualScale：stageScale <= 50 返回 1，>= 1000 返回 0.05，中间对数插值
 */
export const computeAdaptiveScale = (stageScale: number): number => {
    if (stageScale <= 50) return 1;
    if (stageScale >= 1000) return 0.05;
    return 1 - 0.95 * (Math.log(stageScale) - LN_50) / LN_SPAN;
};
```

`MapNestModify/GraphStage/index.tsx` 删除内联的 `LN_50/LN_1000/LN_SPAN/computeAdaptiveScale`，
改为 `import { computeAdaptiveScale } from "@/plugins/konva/runtime/adaptiveScale"`。
**逻辑零变化**，纯迁移。

### 5.2 常量命名保持不变（不重命名）

`MAP_NEST_STAGE_ATTR`（`src/plugins/konva/runtime/constants.ts:10`）**保持原名**，Overlook 直接 import 复用：

```ts
// Overlook GraphStage 新增 import（复用既有常量，零改名）
import { MAP_NEST_STAGE_ATTR } from "@/plugins/konva/runtime/constants";
```

该常量当前定义 `{ visualScale, labelVisible, isDark }` 已覆盖 Overlook 所需的 `visualScale` 字段，
**无需改动 `constants.ts`**，也无需触碰其余 13 个既有引用文件（见 D9：重命名风险 > 命名整洁收益）。
Overlook 与 MapNestModify 共用同一常量名，仅是命名带 "NEST" 前缀不够通用，无功能影响。

### 5.3 Overlook `GraphStage/index.tsx`：引入 visualScale 机制

**(a) 新增 import 与运行时状态**（仿 MapNestModify `GraphStage/index.tsx:84-98,114-144`）：

```ts
import { computeAdaptiveScale } from "@/plugins/konva/runtime/adaptiveScale";
import { MAP_NEST_STAGE_ATTR } from "@/plugins/konva/runtime/constants";

// 组件内：
/**
 * visualScale 运行时值（节点/路径 sceneFunc 通过 stage attr 读取）
 * 不作为 React state 驱动 NodesLayer/EdgesLayer 的 re-render
 */
const visualScaleRef = useRef<number>(1);
/** rAF 合流 id，避免滚轮 / Tween 高频触发 */
const rafIdRef = useRef<number>(0);
/** 轻量 React state，仅驱动声明式设备/角标图层的 re-render */
const [visualScaleForReact, setVisualScaleForReact] = useState<number>(1);
```

**(b) rAF 合流更新**（与 MapNestModify 的关键差异：**不调 `applyVisualScaleToAllShapes`**）：

```ts
/**
 * rAF 合流更新自适应倍率。
 * 每帧最多执行一次，不经过 NodesLayer/EdgesLayer 的 React 渲染周期：
 * 直接 setAttr + batchDraw，节点/路径 sceneFunc 重绘时读新 attr 乘上去。
 */
const updateAdaptiveScale = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = 0;
        const scaleX = stage.scaleX();
        const newScale = computeAdaptiveScale(scaleX);
        // 变化 < 0.01 跳过，避免微小抖动反复 batchDraw
        if (Math.abs(visualScaleRef.current - newScale) < 0.01) return;
        visualScaleRef.current = newScale;
        // 节点/路径 sceneFunc 运行时读取此 attr（D1）
        stage.setAttr(MAP_NEST_STAGE_ATTR.visualScale, newScale);
        // 设备/角标声明式图层经此 re-render 更新 data.scale（D5）
        setVisualScaleForReact(newScale);
        // 重绘：节点/路径 sceneFunc 读新 attr；设备/角标因 prop 变化各自重绘
        stage.batchDraw();
    });
}, []);
```

**(c) 监听 `scaleXChange`（统一捕获滚轮 / ZoomIn-ZoomOut Tween / fit 所有来源）**：

```ts
useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.on("scaleXChange", updateAdaptiveScale);
    return () => {
        stage.off("scaleXChange", updateAdaptiveScale);
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
}, [updateAdaptiveScale]);
```

> `Konva.Tween`（ZoomIn/ZoomOut）持续改 scaleX 会高频触发 `scaleXChange`，rAF 合流
> 把每帧多次收敛为一次 `batchDraw`，平滑过渡。`fitStageToNodes` 用 `animate:false`
> 瞬时改 scale，触发一次 `scaleXChange` → 一帧内更新。

**(d) 换图重置**（注入点：Overlook `GraphStage/index.tsx` 的 `getMapInfo` 回调内，紧跟 `setEdges` 之后）：

```ts
// 地图数据加载后，重置 visualScale（fit 前 visualScaleForReact 先回到 1，
// 避免 DeviceLayer/ActionBadgeLayer 用上一张图的倍率渲染；fit 完成后 scaleXChange 自动驱动真实值）
if (stageRef.current) {
    visualScaleRef.current = 1;
    stageRef.current.setAttr(MAP_NEST_STAGE_ATTR.visualScale, 1);
    setVisualScaleForReact(1);
}
```

> **时序说明**：Overlook 的 fit 在**独立的 useEffect**（监听 `[mapId, nodes]`、50ms 轮询等 stage 就绪）
> 内执行，不在 getMapInfo 回调里。因此换图后存在一次有界视觉跳变：先以 visualScale=1（满血）渲染新地图
> → fit 完成、`scaleXChange` 触发 → 跳到 fit 后的真实倍率。因 fit 用 `animate:false` 瞬时完成，跳变
> 通常在一两帧内，可接受；若实测闪烁明显，可把重置下沉到 fit useEffect 的 `fitStageToNodes` 成功分支之后。

**(e) 向 DeviceLayer / ActionBadgeLayer 下传 `visualScaleForReact`**：

```tsx
<DeviceLayer
    edges={edges}
    visible={overlayVisible.device}
    enableOptimize={enableOptimize}
    isDark={isDark}
    visualScale={visualScaleForReact}   // 新增
/>
<ActionBadgeLayer
    nodes={nodes}
    edges={edges}
    visible={overlayVisible.actions}
    enableOptimize={enableOptimize}
    isDark={isDark}
    onActionHover={onActionHover}
    visualScale={visualScaleForReact}   // 新增
/>
```

> `NodesLayer` / `EdgesLayer` **不下传** visualScale——它们走 stage attr（D1），prop 不变，
> `memo` 跳过 re-render，仅靠 `batchDraw` 重绘。

### 5.4 Overlook `NodesLayer/index.tsx`：sceneFunc 读 stage attr

接口不变（仍 `nodes / enableOptimize / nodeLabelVisible`），仅改内联 sceneFunc。

```tsx
sceneFunc={(context, shape) => {
    // 运行时从 stage attr 读 visualScale（D1）
    const stage = shape.getStage();
    const visualScale = stage?.getAttr(MAP_NEST_STAGE_ATTR.visualScale) ?? 1;
    const { attrs: { shapeStyle: { radius, fill, stroke, lineWidth, labelFill }, data: { name, arrowPoints } } } = shape;
    // 节点半径 / 描边 / 字号随 visualScale 等比缩放
    const scaledRadius = radius * visualScale;
    const scaledLineWidth = lineWidth * visualScale;
    // 画圆
    context.beginPath();
    context.arc(0, 0, scaledRadius, 0, Math.PI * 2);
    context.fillStyle = fill;
    context.strokeStyle = stroke;
    context.lineWidth = scaledLineWidth;
    context.stroke();
    context.fill();
    if (arrowPoints && !enableOptimize) {
        // 节点朝向箭头随 visualScale（D7）：arrowPoints 是相对圆心的向量，整体乘 visualScale
        context.beginPath();
        const [[tx, ty], [rx, ry], [bx, by]] = arrowPoints;
        context.moveTo(tx * visualScale, ty * visualScale);
        context.lineTo(rx * visualScale, ry * visualScale);
        context.lineTo(bx * visualScale, by * visualScale);
        context.strokeStyle = stroke;
        context.lineWidth = scaledLineWidth;
        context.stroke();
    }
    if (nodeLabelVisible && !enableOptimize) {
        // 字号随缩放（D2）；标签位置用 scaledRadius 保持与圆的相对间距
        context.textAlign = "left";
        context.font = `bold ${0.2 * visualScale}px Arial`;
        context.textBaseline = "top";
        context.fillStyle = labelFill;
        context.fillText(name, 0, scaledRadius * 1.5, scaledRadius * 4);
    }
    context.fillStrokeShape(shape);
}}
```

> **线性性已确认**：节点 `arrowPoints` 由 `mountGraphNodes` 经 `computeRotateArrow(radius, angle)`
> 预计算（`graph.ts:603-610`）。该函数返回 `[0,-r/2],[r/2,0],[0,r/2]` 经 `rotatePointByRad` 旋转，
> 每个点都是 `radius` 的线性函数，故 `arrowPoints * visualScale ≡ computeRotateArrow(radius*visualScale, angle)`。
> 上面的 `arrowPoints * visualScale` 方案确定可行，无需兜底重算分支。
>
> **maxWidth 同步缩小**：`fillText` 第四参 `scaledRadius * 4`（原 `radius * 4`）也随之缩小，文字会更早
> 触发 maxWidth 压缩，与节点圆等比一致，符合预期。

### 5.5 Overlook `EdgesLayer/index.tsx`：sceneFunc 读 stage attr

接口不变，仅改内联 sceneFunc。

```tsx
sceneFunc={(context, shape) => {
    const stage = shape.getStage();
    const visualScale = stage?.getAttr(MAP_NEST_STAGE_ATTR.visualScale) ?? 1;
    const { attrs: {
        shapeStyle: { labelFill, stroke, lineWidth },
        data: { sx, sy, cx = null, cy = null, dx = null, dy = null, ex, ey, name, labelX, labelY, arrowPoints, isBackEdge, userDefinedProperties }
    } } = shape;
    // 路径线宽随 visualScale；路径几何坐标（sx/sy/.../ex/ey）不变
    const scaledLineWidth = lineWidth * visualScale;
    context.beginPath();
    if (cx === null || cy === null || dx === null || dy === null) {
        context.moveTo(sx, -sy);
        context.lineTo(ex, -ey);
    } else {
        context.moveTo(sx, -sy);
        context.bezierCurveTo(cx, -cy, dx, -dy, ex, -ey);
    }
    // 公共方向箭头：坐标不乘 visualScale（D7 边箭头不随），仅描边用 scaledLineWidth
    const [lx, ly, tx, ty, rx, ry] = arrowPoints;
    context.moveTo(lx, ly);
    context.lineTo(tx, ty);
    context.lineTo(rx, ry);
    context.strokeStyle = stroke;
    context.lineWidth = scaledLineWidth;
    context.stroke();
    if (edgeLabelVisible && !enableOptimize) {
        context.textAlign = "center";
        // 字号随缩放（D2）
        context.font = `bold ${0.2 * visualScale}px Arial`;
        context.textBaseline = "top";
        context.fillStyle = labelFill;
        let textX = labelX + 0.2 * visualScale;
        let textY = labelY + 0.2 * visualScale;
        if (resolveDeviceType(userDefinedProperties)) {
            // 有设备的边，name 标签沿法线让位：偏移量随 visualScale，与设备图标 offset 同源
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

> **让位偏移同步缩放**：原 `offset = DEVICE_BASE_RADIUS * DEVICE_NORMAL_OFFSET_RATIO`
> 是设备图标满血时的法线偏移。设备图标接入 visualScale 后其 `offset = R * RATIO =
> DEVICE_BASE_RADIUS * visualScale * RATIO`（见 `deviceIconSceneFunc.ts:306-307`）。
> 边标签让位必须用同一 `offset`，否则 zoom in 设备变小、让位距离不变 → 标签与设备
> 位置关系失调。此处 `* visualScale` 保持同源。
>
> `labelX + 0.2` / `labelY + 0.2` 的「防压线」偏移也乘 visualScale（与 AddEdge preview
> 同口径，见 [SPEC_add_edge_ranging_visual_scale.md §5.2](./SPEC_add_edge_ranging_visual_scale.md)）。

### 5.6 Overlook `DeviceLayer/index.tsx`：接 prop

```ts
interface DeviceLayerProps {
    edges: MapEdge[];
    visible: boolean;
    enableOptimize: boolean;
    isDark: boolean;
    /** 自适应视觉倍率（来自 visualScaleForReact，写入 data.scale） */
    visualScale: number;   // 新增
}
// 组件内解构 visualScale，Shape 的 data：
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
```

> 共享 `deviceIconSceneFunc` / `deviceIconHitFunc` **零改动**（已内置 `R = DEVICE_BASE_RADIUS * scale`）。
> `hitFunc` 同样读 `data.scale`，命中区域自动随 visualScale 同步。

### 5.7 Overlook `ActionBadgeLayer/index.tsx`：接 prop

```ts
interface ActionBadgeLayerProps {
    nodes: MapNode[];
    edges: MapEdge[];
    visible: boolean;
    enableOptimize: boolean;
    isDark: boolean;
    onActionHover: (payload: ActionHoverPayload | null) => void;
    /** 自适应视觉倍率（来自 visualScaleForReact，写入 data.scale） */
    visualScale: number;   // 新增
}
// Shape 的 data：
data={{
    anchorX: item.anchorX,
    anchorY: item.anchorY,
    count: item.count,
    severity: item.severity,
    scale: visualScale,   // 改：原固定 1 → visualScale
    isDark,
    isSelected: false,
}}
```

> 共享 `actionBadgeSceneFunc` / `actionBadgeHitFunc` 零改动。
>
> ⚠️ `ActionBadgeLayer` 的 `useMemo`（`badgeShapes`）依赖 `[nodes, edges]`，
> **不要**把 `visualScale` 加进 `useMemo` 依赖——只需 `data.scale` 在每次 re-render 时取最新
> `visualScale`。否则缩放会触发整个 `mountGraphNodes/mountGraphEdges` 重算，性能退化。
>
> **角标「位置偏移」不随 visualScale（明确权衡）**：角标锚点偏移 `ACTION_NODE_OFFSET` /
> `ACTION_EDGE_NORMAL_OFFSET` 是固定地图坐标常量，**不乘 visualScale**。这意味着 zoom in 时
> 节点圆 / 设备图标 / 边标签让位都变小，但角标离锚点的距离不变 → 角标相对元素会「飘远」一点。
> 这与 §3.2 的「比例失调」论证存在不对称：设备/角标的**大小**必须同步（否则 zoom in 图标爆炸），
> 但角标的**位置偏移**保持固定，理由是 ① 角标本身需醒目、离元素稍远反而更易辨认；② 若让偏移随
> visualScale，需改动共享 `actionBadgeSceneFunc`（不再是零改动）或在 useMemo 内引用 visualScale
> （触发重算），成本不抵收益。此为已知可接受权衡，记录在 §11。

### 5.8 MapNestModify `GraphStage/index.tsx`：改 import

删除内联 `LN_50/LN_1000/LN_SPAN/computeAdaptiveScale`，改为 import 共享模块（§5.1）。
**逻辑零变化**。`MAP_NEST_STAGE_ATTR` 保持原名（§5.2 不重命名），故该文件无其它改动。

---

## 6. 数据流与运行时机制

### 6.1 缩放时的完整链路

```
用户滚轮 / 点 ZoomIn-ZoomOut / 换图 fit
        │
        ▼
 stage.scaleX() 变化 → Konva 触发 scaleXChange
        │
        ▼
 updateAdaptiveScale（rAF 合流，每帧最多一次，Δ<0.01 跳过）
        │
        ├─ visualScaleRef.current = newScale
        ├─ stage.setAttr(MAP_NEST_STAGE_ATTR.visualScale, newScale)
        ├─ setVisualScaleForReact(newScale)  ──► GraphStage re-render
        │                                            │
        │                       ┌────────────────────┴────────────────────┐
        │                       ▼                                          ▼
        │          NodesLayer/EdgesLayer (memo, props 不变)     DeviceLayer/ActionBadgeLayer
        │                       │ (React 跳过 re-render)           (visualScale prop 变 → re-render)
        │                       │                                     data.scale = visualScale
        └─ stage.batchDraw() ──┤                                     │
                                ▼                                     ▼
                  sceneFunc 重绘，读最新 stage attr           sceneFunc 重绘，读最新 data.scale
                  → radius/lineWidth/font/节点箭头 乘 visualScale  → R = BASE_RADIUS * scale
```

### 6.2 双轨制总结

| 消费者 | 通道 | re-render？ | 重绘触发 |
| --- | --- | --- | --- |
| NodesLayer / EdgesLayer | stage attr（sceneFunc 运行时读） | 否（memo 跳过） | `batchDraw` |
| DeviceLayer / ActionBadgeLayer | `visualScaleForReact` prop → `data.scale` | 是（prop 变；`enableOptimize` 时两层 `return null` 不渲染，visualScale 对它们无可见效果） | React re-render |
| RobotLayer | **不接**（保持 `stage.scale` 等比缩放） | — | — |

### 6.3 各缩放来源的覆盖

| 来源 | 实现 | 是否触发 `scaleXChange` | 平滑度 |
| --- | --- | --- | --- |
| 滚轮 `onStageWheel` | `stage.scale({...})` | 是 | rAF 合流，丝滑 |
| ZoomIn / ZoomOut 按钮 | `Konva.Tween`（duration 0.3s） | 是（高频） | rAF 合流收敛为每帧一次，平滑过渡 |
| 换图 `fitStageToNodes` | `animate:false` 瞬时 `stage.scale` | 是（一次） | 一帧内更新到 fit 后倍率 |

---

## 7. 边界与不变项

- **`labelVisible` 机制不变**：Overlook 节点/路径标签显隐仍由 `nodeLabelVisible` /
  `edgeLabelVisible` prop 控制（`overlayVisible` 下传），**不**改成 stage attr。本次只引入
  visualScale 的 stage attr。
- **`isDark` 机制不变**：Overlook 设备/角标的 `isDark` 仍走 prop（`useLocalStorageState("theme")`），
  与 MapNestModify 写 stage attr 的方式不同，本次不动。
- **stage 旋转**：`visualScale` 仅与 `stage.scaleX` 关联，不受 `rotation` 影响；节点/路径
  用地图坐标，旋转由 stage 变换矩阵自动处理。
- **`enableOptimize` 性能模式**：visualScale 照常响应（D4）。性能模式下标签/箭头/设备/角标
  不渲染（sceneFunc 分支裁剪 / Layer 返回 null），节点/路径 sceneFunc 仍执行，多读一个 attr
  的增量可忽略；`rAF` 合流保证每帧最多一次 `batchDraw`。
- **节点 `arrowPoints` 线性性**：已确认 `computeRotateArrow` 关于 radius 线性（见 §5.4），`arrowPoints * visualScale` 等价于按 scaledRadius 重算，方案确定。
- **地图切换**：`getMapInfo` 回调内重置 `visualScaleRef=1` / `stage.attr.visualScale=1` /
  `setVisualScaleForReact(1)`，fit 完成后 `scaleXChange` 自动驱动真实倍率。
- **`ActionBadgeLayer` 的 `useMemo` 依赖**：不加入 `visualScale`（§5.7 ⚠️）。
- **GraphStage 的 `memo + propsForceGraphIsEqual`**：`visualScaleForReact` 是内部 state，
  其变化触发自身 re-render，不受 props 比较影响；memo 只拦父级 re-render。

---

## 8. 实施步骤（建议顺序）

1. **抽共享纯函数**（§5.1）：新建 `adaptiveScale.ts`，MapNestModify GraphStage 改 import，
   删除内联常量/函数。`pnpm build` 验证编辑器无回归。
2. **Overlook GraphStage 引入机制**（§5.3）：refs / state / `updateAdaptiveScale` /
   `scaleXChange` 监听 / 换图重置 / 下传 `visualScaleForReact`。
3. **Overlook NodesLayer / EdgesLayer sceneFunc**（§5.4 / §5.5）：读 stage attr，
   radius/lineWidth/font/节点箭头 乘 visualScale（`computeRotateArrow` 已确认线性）。
4. **Overlook DeviceLayer / ActionBadgeLayer**（§5.6 / §5.7）：接 `visualScale` prop，
   `data.scale = visualScale`。
5. **手动验证**（§9）。

> 本次不做常量重命名（§5.2），故无独立的「机械重命名」步骤；步骤 1「先重构、后加功能」仍保证
> 编辑器回归与 Overlook 新功能隔离，每步独立可验证。

---

## 9. 验证清单（手动，项目无自动化测试）

`pnpm dev` 启动，进入调度监控页（Overlook），打开任一地图：

- [ ] **节点缩放**：滚轮放大，节点圆变小、描边变细；缩小则变大。与编辑器缩放观感一致。
- [ ] **路径缩放**：放大路径变细、缩小变粗，线宽随 visualScale 变化。
- [ ] **字号缩放**：节点名、路径名文字随缩放等比变大变小（D2）。
- [ ] **节点朝向箭头**：随节点圆同步缩放（D7）。
- [ ] **边公共箭头**：大小不随 visualScale（只描边线宽变），与编辑器一致（D7）。
- [ ] **设备图标**：随缩放与节点保持比例一致，不再「zoom in 变大、节点变小」失调（D3/D5）。
- [ ] **动作角标**：随缩放与节点保持比例一致（打开 `overlayVisible.actions` 开关验证）。
- [ ] **ZoomIn/ZoomOut 按钮**：Tween 缩放过程中 visualScale 平滑过渡（rAF 合流）。
- [ ] **fit 自适应**：换图后 fit 完成，节点/路径按 fit 后 scale 的 visualScale 显示
      （小地图 fit 后 scale 大 → 节点偏小，符合 D6 预期）。
- [ ] **换图重置**：连续切换地图，visualScale 正确重置并按新地图 fit 重新计算。
- [ ] **性能模式**：打开节点+边 ≥ 20000 的大地图（或临时调小 `konvaConfig.maxCount` 触发），
      `enableOptimize` 开启后缩放仍响应 visualScale，且流畅（D4）。
- [ ] **暗黑主题**：切换主题，设备/角标配色正确，节点/路径颜色不受影响。
- [ ] **stage 旋转**：旋转地图后缩放，节点/路径/设备/角标位置不错位。
- [ ] **编辑器无回归**：进入 MapNestModify，缩放行为与改造前完全一致（步骤 1 验证）。

---

## 10. 不在本次范围

- **RobotLayer 接入 visualScale**：车辆图标保持现状（随 `stage.scale` 等比缩放）。
  已知权衡：zoom in 时机器人变大、节点变小，比例失调（D3 排除）。后续若需统一可另开任务。
- **Overlook `labelVisible` / `isDark` 改 stage attr**：维持现有 prop 机制，本次不动。
- **为 Overlook 重新标定对数锚点**：沿用 50/1000（D6）。
- **节点 `arrowPoints` 非线性兜底**：`computeRotateArrow` 已确认线性（§5.4），无需重算封装。
- **`MAP_NEST_STAGE_ATTR` 重命名**：保持原名不重命名（D9），Overlook 直接复用，见 §5.2。
- **`MAP_NEST_LAYER_NAME` / `MAP_NEST_EVENT` 重命名**：仍为 Nest 专用，Overlook 不用，保持不变。

---

## 11. 风险与权衡

- **RobotLayer 比例失调（已知，D3 接受）**：RobotLayer 不接 visualScale，zoom in 时
  车辆图标随 stage 放大、节点因 visualScale 抵消而变小，二者比例不一致。监控场景下
  车辆本就需突出显示，用户已明确接受此权衡。
- **Overlook fit 后初始节点偏小（已知，D6 接受）**：沿用 50/1000 锚点，小地图 fit 后
  scale 可达 200+ → visualScale ≈ 0.6 → 节点比编辑器初始满血状态偏小。若实测观感不佳，
  后续可按 D6 备选「以 fit 后 scale 为满血基准」调整，但需记录 fit 基准、处理多次 fit，
  复杂度上升。
- **设备/角标 re-render 开销（可接受，D5）**：缩放时 DeviceLayer/ActionBadgeLayer 因
  `visualScaleForReact` prop 变化全量 re-render。但二者元素少（仅有设备/有动作的边/节点），
  且 `enableOptimize` 时不渲染，`rAF` 合流每帧最多一次，开销可忽略。
- **`computeAdaptiveScale` 抽共享的回归风险（低）**：纯函数无副作用，MapNestModify 改 import
  后逻辑零变化；步骤 1 单独验证编辑器无回归后再继续。
- **节点 `arrowPoints` 线性性（已确认，无风险）**：`computeRotateArrow`（`graph.ts:603-610`）
  关于 radius 线性，`arrowPoints * visualScale` 与按 scaledRadius 重算等价，箭头不会变形。
- **角标位置偏移不随 visualScale（已知权衡，§5.7）**：ActionBadgeLayer 的锚点偏移
  （`ACTION_NODE_OFFSET` / `ACTION_EDGE_NORMAL_OFFSET`）保持固定、不乘 visualScale，zoom in 时
  角标相对缩小的元素会「飘远」。设备/角标的**大小**已同步（避免图标爆炸），位置偏移不同步是
  醒目优先 + 零改动成本的取舍；若后续要求严格比例，需改共享 `actionBadgeSceneFunc`。
- **换图瞬时视觉跳变（已知，§5.3d）**：Overlook fit 在独立 useEffect 异步执行，换图后先以
  visualScale=1 渲染、fit 完成再跳到真实倍率。因 fit 用 `animate:false` 瞬时完成，跳变在一两帧内。
- **边标签让位偏移未同步（已规避）**：§5.5 已让让位 offset 乘 visualScale 与设备图标同源，
  避免标签/设备位置失调。
