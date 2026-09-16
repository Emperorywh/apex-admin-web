# SPEC：路径属性着色开关（按属性独立控制）

> 状态：已定稿（访谈完成）　|　日期：2026-07-31　|　分支：1.0.0
>
> 目标：将路径的「载货避障 / 空载避障 / 车辆分组」三种属性着色从**默认始终显示**改为**默认关闭、用户按需按属性独立开启**，覆盖地图编辑、调度监控、录制回放三个画布。
>
> 关系：复用 `edgeHighlightColors.ts` 已有的颜色常量与优先级逻辑；复用 `OverlayVisible` + 各画布已有的 `stage attr`（MapNestModify / Overlook）或 `prop`（RecordPlayback）状态传递基础设施。

---

## 0. 决策汇总（访谈结论速查）

| # | 议题 | 决策 |
|---|------|------|
| D1 | 开关粒度 | **按属性分别控制**——载货避障着色 / 空载避障着色 / 车辆分组着色各一个独立开关，共 3 个 |
| D2 | 多属性共存着色 | **保持优先级单色**——多个开关同时打开时，维持 `allowVehicleGroups(紫) > loadSecurity(青) > freeSecurity(绿)` 优先级，只显示最高优先级颜色 |
| D3 | 仅部分开关打开时的行为 | **只参与已开启的属性**——某属性开关关闭时，即使边数据中有该属性也不参与着色（跳过该优先级，向下检查下一个已开启的属性） |
| D4 | 勾选语义 | **与现有一致：勾选 = 隐藏**——标签为「隐藏载货避障着色」等，**默认勾选**（= 颜色关闭），取消勾选才显示。与「隐藏三方设备」「隐藏动作角标」完全同构 |
| D5 | 默认状态 | **三种着色默认全部关闭**——`OverlayVisible` 新增 3 个字段初值均为 `false`（不可见），`checkedValues` 初始包含 3 个对应值（已勾选 = 已隐藏） |
| D6 | 编辑反馈 | **不需要额外反馈**——属性面板 Select 值变化 + label 旁色块标识已是充分反馈，画布不额外提示 |
| D7 | 三视图开关一致性 | **三个视图各加 3 个独立开关**——MapNestModify / Overlook / RecordPlayback 体验完全一致 |
| D8 | 菜单组织 | **直接追加，无分组**——3 个着色项直接插入现有 Checkbox 列表，不加分割线、不加色块标记 |
| D9 | 视觉辨识 | **仅改颜色，线宽不变**——开启着色时只改变描边颜色，不额外加粗 |
| D10 | 选中态交互 | **无冲突**——边的选中态通过加粗 `lineWidth` 体现（`updateShapeStyle` 只改 lineWidth 不改 stroke），与属性着色正交，两者可共存 |
| D11 | Overlook / RecordPlayback 渲染 | **新增着色渲染能力**——这两个画布目前 sceneFunc 直接用 `stroke` 不调用 `getEdgeStrokeColor`，需新增调用并受开关门控 |
| D12 | 属性面板色块 | **保持不变**——LoadSecurity / FreeSecurity / AllowVehicleGroups 属性面板 label 旁的小色块始终显示，作为「该属性对应颜色」的图例 |

---

### 0.1 背景与问题

当前 `getEdgeStrokeColor` 按 `allowVehicleGroups > loadSecurity > freeSecurity` 优先级，只要边数据中有任一属性就**始终**将该边描边改为对应颜色。存在的问题：

1. **默认视图过于花哨**——大地图上大量边有属性配置，默认全彩色让画面杂乱。
2. **多属性时信息丢失**——一条边同时配置了多种属性时只显示最高优先级色，用户无法选择性地查看某一类属性。
3. **覆盖范围不全**——着色逻辑只在 MapNestModify 的 `edgeSceneFunc` 中调用；Overlook 和 RecordPlayback 的 sceneFunc 直接用默认 `stroke`，从未展示属性颜色。

**解决方案**：默认关闭所有着色 → 展示菜单加 3 个独立开关（按属性） → 用户按需打开某一个或多个 → 三个画布统一支持。

---

## 1. 数据基础

### 1.1 颜色常量（已有，不改）

`src/plugins/konva/path/edgeHighlightColors.ts`：

```ts
export const edgeHighlightColors = {
    allowVehicleGroups: "#9C27B0",  // 紫
    loadSecurity: "#00BCD4",        // 青
    freeSecurity: "#09eb25"         // 绿
} as const;
```

### 1.2 属性数据来源（已核实源码）

三个画布的边数据均经 `mountGraphEdges`（`src/utils/graph.ts:59`）处理，该函数通过 `...rest` 展开**保留所有业务字段**（含 `loadSecurity`、`freeSecurity`、`allowVehicleGroups`）到 `data` 对象。因此：

- **MapNestModify（命令式）**：属性面板直接写入 `shape.attrs.data.loadSecurity` 等，`createEdgeShapeConfig` 的 `...rest` 也保留这些字段。✅
- **Overlook / RecordPlayback（声明式）**：`mountGraphEdges` 的 `...rest` 保留这些字段，edge 的 `data` 对象完整携带。✅
- **结论：三个画布的边数据中属性字段链路完全通畅，无需补字段或改 API。**

> ⚠️ **类型定义不完整（已知债务，不影响运行时）**：`src/utils/typing.d.ts` 的 `MapEdge` 接口**未声明** `loadSecurity`/`freeSecurity`/`allowVehicleGroups`(复数)/`maxLoadSpeed` 等后端实际返回的字段，且其 `allowVehicleGroup`(单数) 为过时死字段。后端 `getMapInfo` → `mapJson.edges` 实际返回的就是 `allowVehicleGroups`(复数，数组)/`loadSecurity`/`freeSecurity`（已由真实地图数据核实）；`mountGraphEdges`（`graph.ts:63`）的解构只排除 `id,sx,sy,cx,cy,dx,dy,ex,ey,isBackEdge`，其余全部经 `...rest` 保留进 `data`。评估数据链路时**以真实响应为准，勿以 `typing.d.ts` 为准**。

### 1.3 属性值的判定条件

| 属性 | 字段 | 有值判定 |
|------|------|----------|
| 载货避障 | `data.loadSecurity` | `!!data.loadSecurity`（truthy 即有值，为避障策略 ID） |
| 空载避障 | `data.freeSecurity` | `!!data.freeSecurity`（truthy 即有值，为避障策略 ID） |
| 车辆分组 | `data.allowVehicleGroups` | `Array.isArray(...) && length > 0`（非空数组即有值） |

> 注：`loadSecurity`/`freeSecurity` 的值为避障策略 ID（正整数，真实数据从 1 起）。`!!` 判定对 `0` 不健壮——本方案假设后端策略 ID 不取 `0`（当前成立）；若后续可能出现 `0`，需改为 `data?.loadSecurity != null`。

---

## 2. 核心函数修改：`getEdgeStrokeColor`

### 2.1 新增类型

`src/plugins/konva/path/edgeHighlightColors.ts` 新增：

```ts
/**
 * 路径属性着色开关状态
 * 每个字段对应一个独立开关：true = 该属性着色可见，false = 隐藏
 */
export interface EdgeColorVisible {
    /** 载货避障着色是否可见 */
    loadSecurity: boolean;
    /** 空载避障着色是否可见 */
    freeSecurity: boolean;
    /** 车辆分组着色是否可见 */
    allowVehicleGroups: boolean;
}
```

### 2.2 函数签名变更

```ts
/**
 * 根据边的 data 属性 + 开关状态计算描边颜色。
 * 优先级（仅在被开启的属性中比较）：allowVehicleGroups > loadSecurity > freeSecurity。
 * 某属性开关关闭时，即使 data 中有该属性也跳过（D3）。
 */
export const getEdgeStrokeColor = (
    data: Record<string, unknown>,
    defaultStroke: string,
    enabled: EdgeColorVisible,
): string => {
    if (
        enabled.allowVehicleGroups &&
        Array.isArray(data?.allowVehicleGroups) &&
        data.allowVehicleGroups.length > 0
    ) {
        return edgeHighlightColors.allowVehicleGroups;
    }
    if (enabled.loadSecurity && data?.loadSecurity) {
        return edgeHighlightColors.loadSecurity;
    }
    if (enabled.freeSecurity && data?.freeSecurity) {
        return edgeHighlightColors.freeSecurity;
    }
    return defaultStroke;
};
```

> ⚠️ **Breaking change**：第三个参数 `enabled` 为**必传**（不设默认值）。所有调用方必须显式传入开关状态——这确保不会因遗漏而意外显示颜色。默认关闭语义由各画布的初始 attr / prop 值 `{ loadSecurity: false, freeSecurity: false, allowVehicleGroups: false }` 保证。

---

## 3. 各画布实现方案

### 3.1 MapNestModify（命令式 → stage attr）

**状态传递**：`overlayVisible` 的 3 个新字段 → `useEffect` 写入 stage attr → `edgeSceneFunc` 运行时读取。

#### 3.1.1 constants.ts 新增 attr key

`src/plugins/konva/runtime/constants.ts`：

```ts
export const MAP_NEST_STAGE_ATTR = {
    visualScale: "visualScale",
    labelVisible: "labelVisible",
    isDark: "isDark",
    /** 路径属性着色开关状态（EdgeColorVisible） */
    edgeColorVisible: "edgeColorVisible",
} as const;
```

#### 3.1.2 GraphStage 写入 stage attr

`src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/index.tsx`，仿现有 `labelVisible` 的 `useEffect`（`:143`），新增：

```ts
/**
 * 路径属性着色开关变化时，写入 stage attr 并重绘。
 * edgeSceneFunc 运行时通过 stage.getAttr 读取。
 */
useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.setAttr(MAP_NEST_STAGE_ATTR.edgeColorVisible, {
        loadSecurity: overlayVisible.loadSecurityColor,
        freeSecurity: overlayVisible.freeSecurityColor,
        allowVehicleGroups: overlayVisible.allowVehicleGroupsColor,
    });
    stage.batchDraw();
}, [
    overlayVisible.loadSecurityColor,
    overlayVisible.freeSecurityColor,
    overlayVisible.allowVehicleGroupsColor,
]);
```

同时在**地图加载初始化块**（`:378` 附近的 `stageRef.current.setAttr(...)` 区域）补写初始 attr：

```ts
stageRef.current.setAttr(MAP_NEST_STAGE_ATTR.edgeColorVisible, {
    loadSecurity: overlayVisible.loadSecurityColor,
    freeSecurity: overlayVisible.freeSecurityColor,
    allowVehicleGroups: overlayVisible.allowVehicleGroupsColor,
});
```

#### 3.1.3 edgeSceneFunc 读取并传入

`src/plugins/konva/path/edgeDrawFuncs.ts`，`edgeSceneFunc` 内（`:42`）：

```ts
// 读取路径属性着色开关状态（默认全 false = 不着色）
const edgeColorVisible = stage?.getAttr(MAP_NEST_STAGE_ATTR.edgeColorVisible)
    ?? { loadSecurity: false, freeSecurity: false, allowVehicleGroups: false };
// ...
context.strokeStyle = getEdgeStrokeColor(data, stroke, edgeColorVisible);
```

> `stage` 变量在 `:23` 已存在（`const stage = shape.getStage();`），直接复用。

> **AddEdge 预览**：AddEdge 的已提交边预览也使用 `edgeSceneFunc`（`GraphStage/ActionLayer/AddEdge/index.tsx:185`），自动继承开关门控，无需额外改动。绘制中的实时预览边（`:233` 的内联 sceneFunc，`:239` 用 `forwardPath/reversePath.stroke`）为新边、无属性，始终用默认 stroke，不受影响。

---

### 3.2 Overlook（声明式 → stage attr）

**状态传递**：与 MapNestModify 同——`overlayVisible` → `useEffect` 写入 stage attr → 内联 sceneFunc 运行时读取。

> 选择 stage attr 而非 prop：Overlook 的 EdgesLayer sceneFunc 已通过 `stage.getAttr(MAP_NEST_STAGE_ATTR.visualScale)` 读 stage attr（`:51`），新增一个同源 attr 读取复用了既有 idiom。注意 EdgesLayer 目前仅通过 `edgeLabelVisible` prop（`Overlook/ForceGraph/GraphStage/index.tsx:386`）接收标签开关、并不接收完整 `overlayVisible`——若着色改走 prop，需为其新增 overlayVisible 通道且开关切换会触发 Shape 重渲染；走 stage attr 则只 `batchDraw` 让 sceneFunc 重绘、不动 props，改动更内聚。

#### 3.2.1 GraphStage 写入 stage attr

`src/pages/Overlook/ForceGraph/GraphStage/index.tsx`，新增 `useEffect`：

> 说明：Overlook 此前**没有**「`overlayVisible` → `useEffect` → `stage.setAttr`」桥接——其 stage attr 仅 `visualScale`，由 `scaleXChange` 事件驱动；标签开关走 `edgeLabelVisible` prop。本项为 Overlook 首次引入该桥接模式，与 MapNestModify 的 `labelVisible` useEffect（`GraphStage:143`）同构，不涉及新概念。

```ts
useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.setAttr(MAP_NEST_STAGE_ATTR.edgeColorVisible, {
        loadSecurity: overlayVisible.loadSecurityColor,
        freeSecurity: overlayVisible.freeSecurityColor,
        allowVehicleGroups: overlayVisible.allowVehicleGroupsColor,
    });
    stage.batchDraw();
}, [
    overlayVisible.loadSecurityColor,
    overlayVisible.freeSecurityColor,
    overlayVisible.allowVehicleGroupsColor,
]);
```

同时在**换图重置块**（`:283` 附近的 `stageRef.current.setAttr(MAP_NEST_STAGE_ATTR.visualScale, 1)` 区域）补写初始 attr。

#### 3.2.2 EdgesLayer sceneFunc 新增着色调用

`src/pages/Overlook/ForceGraph/GraphStage/EdgesLayer/index.tsx`，内联 sceneFunc（`:48`）：

```ts
sceneFunc={(context, shape) => {
    const stage = shape.getStage();
    const visualScale = stage?.getAttr(MAP_NEST_STAGE_ATTR.visualScale) ?? 1;
    // 新增：读取路径属性着色开关状态（默认全 false = 不着色）
    const edgeColorVisible = stage?.getAttr(MAP_NEST_STAGE_ATTR.edgeColorVisible)
        ?? { loadSecurity: false, freeSecurity: false, allowVehicleGroups: false };
    // ⚠️ 现有代码（:52-55）将 data 解构为字段、未保留 data 对象引用，
    //    而 getEdgeStrokeColor 需要完整 data 对象（读 data.loadSecurity 等），
    //    故需调整为：先保留 data 引用，再从中解构字段。
    const { attrs: { shapeStyle: { labelFill, stroke, lineWidth } } } = shape;
    const { data } = shape.attrs;
    const { sx, sy, cx = null, cy = null, dx = null, dy = null, ex, ey, name, labelX, labelY, arrowPoints, isBackEdge, userDefinedProperties } = data;
    // ...
    // 将原来的 context.strokeStyle = stroke（:73）改为：
    context.strokeStyle = getEdgeStrokeColor(data, stroke, edgeColorVisible);
    // ...
}}
```

> ⚠️ 需在文件顶部新增 `import { getEdgeStrokeColor } from "@/plugins/konva/path/edgeHighlightColors"`（`MAP_NEST_STAGE_ATTR` 已导入）。

> ⚠️ 上述示例仅展示需调整的两处（保留 `data` 引用 + 替换 `strokeStyle`）。Overlook EdgesLayer 现有的 `scaledLineWidth = lineWidth * visualScale`（`:57`）与 `context.lineWidth = scaledLineWidth`（`:74`）**保持不变**——实际只改 `:73` 的 `context.strokeStyle = stroke` 这一行，其余渲染逻辑（含标签让位、设备图标）一律不动。

---

### 3.3 RecordPlayback（声明式 → prop 闭包）

**状态传递**：`overlayVisible`（含新增 3 个 Color 字段）经 KonvaRender 已有的 prop 通路下传 → MapEdgeLayer 组件体内从其派生 `edgeColorVisible` → 内联 sceneFunc 闭包直读。**不新增 prop、不改 KonvaRender**。

> 选择闭包直读 overlayVisible 而非 stage attr：RecordPlayback 的 MapEdgeLayer sceneFunc 已通过闭包读 `overlayVisible.edgeLabel` / `visualScale`（prop），不读 stage attr（与另两个画布的关键差异，见 [SPEC_record_playback_visual_scale.md]）。新增字段沿用同一 idiom，最小改动。

#### 3.3.1 KonvaRender 无需改动

`src/pages/RecordPlayback/components/KonvaRender/index.tsx` 已在 `:310` 将 `overlayVisible` 整体下传给 `MapEdgeLayer`：

```tsx
<MapEdgeLayer
    mountEdges={mountEdges}
    overlayVisible={overlayVisible}   // 已存在，新增的 3 个 Color 字段随之携带
    visualScale={visualScale}
/>
```

新增的 `loadSecurityColor` / `freeSecurityColor` / `allowVehicleGroupsColor` 字段随 `overlayVisible` 自然下传，**无需新增 prop、无需 useMemo 派生**。这与 MapEdgeLayer 现有「闭包直读 `overlayVisible.edgeLabel`」（`:57`）的模式完全一致，遵循最小改动原则。

#### 3.3.2 MapEdgeLayer 组件体内派生 + sceneFunc 着色

`src/pages/RecordPlayback/components/KonvaRender/MapEdgeLayer/index.tsx`：

**不改 interface**（不加 `edgeColorVisible` prop）。在组件体内从 `overlayVisible` 派生 `edgeColorVisible`，与现有闭包直读 `overlayVisible.edgeLabel`（`:57`）同模式：

```ts
// interface 维持 { mountEdges, overlayVisible, visualScale }，不加新 prop
const MapEdgeLayer = ({ mountEdges, overlayVisible, visualScale }: MapEdgeLayerProps) => {
    // 从 overlayVisible 派生着色开关对象（per-render 构造一次，供 sceneFunc 闭包读取）
    const edgeColorVisible: EdgeColorVisible = {
        loadSecurity: overlayVisible.loadSecurityColor,
        freeSecurity: overlayVisible.freeSecurityColor,
        allowVehicleGroups: overlayVisible.allowVehicleGroupsColor,
    };
    return ( /* ... */ );
};
```

内联 sceneFunc 内将 `context.strokeStyle = stroke`（`:54`）改为。**注意与 §3.2.2 同样的 `data` 引用问题**——现有代码 `:33-36` 将 data 解构为字段、未保留对象引用，需调整为先保留 `data` 再解构字段：

```ts
// 调整解构：保留 data 对象引用（getEdgeStrokeColor 需完整 data）
const { attrs: { shapeStyle: { labelFill, stroke, lineWidth } } } = shape;
const { data } = shape.attrs;
const { sx, sy, cx = null, cy = null, dx = null, dy = null, ex, ey, name, labelX, labelY, arrowPoints, isBackEdge, userDefinedProperties } = data;
// ...
context.strokeStyle = getEdgeStrokeColor(data, stroke, edgeColorVisible);
```

> ⚠️ 需在文件顶部新增 `import { getEdgeStrokeColor, type EdgeColorVisible } from "@/plugins/konva/path/edgeHighlightColors"`。

---

## 4. 可见性控制（D4, D5, D7）

### 4.1 OverlayVisible 类型扩展

`src/types/OverLook/index.d.ts`，在 `OverlayVisible` 接口末尾新增：

```ts
export interface OverlayVisible {
    // ... 现有字段 ...
    /** 载货避障着色是否可见（默认 false） */
    loadSecurityColor: boolean;
    /** 空载避障着色是否可见（默认 false） */
    freeSecurityColor: boolean;
    /** 车辆分组着色是否可见（默认 false） */
    allowVehicleGroupsColor: boolean;
}
```

### 4.2 初始状态补齐（3 处）

以下 3 处 `useState<OverlayVisible>` 初值均补 3 个字段 `: false`：

| 文件 | 位置 |
|------|------|
| `src/pages/MapThrough/MapNestModify/NestGraph/index.tsx` | `:63` |
| `src/pages/Overlook/ForceGraph/index.tsx` | `:31` |
| `src/pages/RecordPlayback/index.tsx` | `:21` |

### 4.3 MapNestModify DisplayElements（`:33` 区域）

`src/pages/MapThrough/MapNestModify/NestGraph/GraphMenu/DisplayElements/index.tsx`：

**初始 `checkedValues`** 追加 3 项（勾选 = 隐藏，D4/D5）：

```ts
const [checkedValues, setCheckedValues] = useState<string[]>([
    "edgeLabel", "hiddenGrid", "hiddenAngle", "actions", "device",
    // 新增：3 个着色项默认勾选（= 隐藏）
    "loadSecurityColor", "freeSecurityColor", "allowVehicleGroupsColor",
]);
```

**items 数组** 追加 3 项（D8：直接追加，无分组）：

```ts
{
    label: "隐藏载货避障着色",
    value: "loadSecurityColor"
},
{
    label: "隐藏空载避障着色",
    value: "freeSecurityColor"
},
{
    label: "隐藏车辆分组着色",
    value: "allowVehicleGroupsColor"
}
```

**`onChecboxChange`** 追加 3 个映射（与现有同构：勾选 = `!some(...)` = false = 隐藏）。⚠️ 该回调用**对象字面量整体重建** `overlayVisible`（非 `...prev`），3 个新映射必须一并写进该字面量，否则切换任一 checkbox 都会让 `overlayVisible` 丢失这三个字段（变为 `undefined`）；Overlook DisplayElements（§4.4）同理：

```ts
loadSecurityColor: !checkedValues.some(v => v === "loadSecurityColor"),
freeSecurityColor: !checkedValues.some(v => v === "freeSecurityColor"),
allowVehicleGroupsColor: !checkedValues.some(v => v === "allowVehicleGroupsColor"),
```

### 4.4 Overlook DisplayElements（`:33` 区域）

`src/pages/Overlook/ForceGraph/GraphMenu/DisplayElements/index.tsx`：追加 3 个着色项的改法与 §4.3 同构（items / checkedValues / onChange 各加 3 项）。注意两文件现状本就略有差异（本文件无 `hiddenAngle` / `angle` 项、checkedValues 初值不同），但该差异与本次新增无关，照 §4.3 同样追加即可。

### 4.5 RecordPlayback TopBar（`:271` 区域）

`src/pages/RecordPlayback/components/TopBar/index.tsx`，`displayMenuItems` 数组追加 3 个 Checkbox 项：

> 现有 `displayMenuItems` 的 key 为 `'1'`–`'6'`（`:271-338`：nodeLabel/edgeLabel/traffic/robot/device/actions），新增 3 项用 `'7'`/`'8'`/`'9'` 不冲突，已核实。注意 RecordPlayback TopBar 现有项不含 grid/angle 开关（与两个 DisplayElements 不同），与本次新增无关。

```tsx
{
    key: '7',
    label: (
        <Checkbox
            checked={!overlayVisible.loadSecurityColor}
            onChange={() => setOverlayVisible({ ...overlayVisible, loadSecurityColor: !overlayVisible.loadSecurityColor })}
        >
            隐藏载货避障着色
        </Checkbox>
    ),
},
// 同理新增 key='8' freeSecurityColor、key='9' allowVehicleGroupsColor
```

---

## 5. 边界情况

| 场景 | 处理 |
|------|------|
| 三个开关全关（默认） | `getEdgeStrokeColor` 返回 `defaultStroke`——所有边显示原始颜色，无任何属性着色 |
| 仅开一个开关，边有该属性 | 显示该属性颜色 |
| 仅开 loadSecurity 开关，边同时有 loadSecurity + allowVehicleGroups | 显示青色（allowVehicleGroups 开关关闭→跳过，D3） |
| 多个开关打开，边有多个属性 | 按优先级取最高（D2），只显示一种颜色 |
| 边无任何属性 | 无论开关状态，始终返回 `defaultStroke` |
| `loadSecurity` / `freeSecurity` 为 `null`（用户 clear） | `!!null === false` → 不着色 |
| `allowVehicleGroups` 为空数组 `[]` | `length > 0` 为 false → 不着色 |
| 边被选中 | 选中态通过 `lineWidth * selectedState.lineWidth` 加粗体现，与着色正交（D10），两者共存 |
| AddEdge 绘制中的实时预览 | 内联 sceneFunc 用默认 stroke，新边无属性，不受影响 |
| AddEdge 已提交边预览 | 使用 `edgeSceneFunc`，自动继承开关门控 |
| 地图切换 | stage attr 随 `useEffect` 重写为新 `overlayVisible` 值（MapNestModify/Overlook）；prop 随 React 重渲染更新（RecordPlayback） |
| 暗黑主题 | 着色颜色为固定 hex 常量，不随主题变化（与现有实现一致） |
| 属性面板 label 色块 | 始终显示（D12），作为图例不随开关联动 |

---

## 6. 涉及文件清单

### 修改（共 14 文件）

| 文件 | 改动 |
|------|------|
| `src/plugins/konva/path/edgeHighlightColors.ts` | 新增 `EdgeColorVisible` 类型；`getEdgeStrokeColor` 增第三参数 `enabled` |
| `src/plugins/konva/runtime/constants.ts` | `MAP_NEST_STAGE_ATTR` 增 `edgeColorVisible` key |
| `src/plugins/konva/path/edgeDrawFuncs.ts` | `edgeSceneFunc` 读 stage attr 并传入 `getEdgeStrokeColor` |
| `src/types/OverLook/index.d.ts` | `OverlayVisible` 增 3 个 `Color` 字段 |
| `src/pages/MapThrough/MapNestModify/NestGraph/index.tsx` | overlayVisible 初值增 3 字段 `: false` |
| `src/pages/MapThrough/MapNestModify/NestGraph/GraphMenu/DisplayElements/index.tsx` | items / checkedValues / onChange 各增 3 项 |
| `src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/index.tsx` | 新增 edgeColorVisible stage attr 写入 useEffect + 地图加载初始化 |
| `src/pages/Overlook/ForceGraph/index.tsx` | overlayVisible 初值增 3 字段 `: false` |
| `src/pages/Overlook/ForceGraph/GraphMenu/DisplayElements/index.tsx` | items / checkedValues / onChange 各增 3 项 |
| `src/pages/Overlook/ForceGraph/GraphStage/index.tsx` | 新增 edgeColorVisible stage attr 写入 useEffect + 换图初始化 |
| `src/pages/Overlook/ForceGraph/GraphStage/EdgesLayer/index.tsx` | sceneFunc 读 stage attr、保留 data 引用、调用 `getEdgeStrokeColor` 替换 `stroke` |
| `src/pages/RecordPlayback/index.tsx` | overlayVisible 初值增 3 字段 `: false` |
| `src/pages/RecordPlayback/components/TopBar/index.tsx` | displayMenuItems 增 3 个 Checkbox 项 |
| `src/pages/RecordPlayback/components/KonvaRender/MapEdgeLayer/index.tsx` | 组件体内从 overlayVisible 派生 `edgeColorVisible`、保留 data 引用、sceneFunc 调用 `getEdgeStrokeColor` 替换 `stroke` |

### 不修改

- `src/plugins/konva/path/edgeHighlightColors.ts` 的 `edgeHighlightColors` 颜色常量对象（值不变）
- 属性面板 `LoadSecurity` / `FreeSecurity` / `AllowVehicleGroups` 组件（色块图例不变，D12）
- `src/api/*`（数据链路无需改动）
- `src/utils/graph.ts` 的 `mountGraphEdges`（`...rest` 已保留属性字段）
- `ActionLayer/AddEdge`（继承 edgeSceneFunc，自动门控）
- `src/pages/RecordPlayback/components/KonvaRender/index.tsx`（`overlayVisible` 已下传 MapEdgeLayer，新增字段随之携带，无需改动，见 §3.3.1）

---

## 7. 不在范围内

- 沿路径分段多色展示（D2 保持优先级单色，不做多色共存）。
- 着色时加粗线宽 / 发光等额外视觉强调（D9 仅改颜色）。
- 选中边临时着色作为编辑反馈（D6 不需要额外反馈）。
- 着色开关持久化到 localStorage（与现有 overlayVisible 一致，均不持久化，刷新回到默认）。
- 着色颜色的暗黑主题适配（颜色为固定常量，不随主题变化）。
- 展示菜单 i18n（现有 DisplayElements / TopBar 的 checkbox 标签均为硬编码中文，本期保持一致）。
- 图例 / 色块标记在展示菜单中显示（D8 直接追加无分组）。

---

## 8. 验收清单

- [ ] `OverlayVisible` 新增 3 个字段，3 处初值均补 `: false`，TypeScript 编译无错误。
- [ ] `getEdgeStrokeColor` 第三参数 `enabled` 为必传，所有调用方均已传入。
- [ ] **MapNestModify**：默认状态下所有边显示原始颜色（无属性着色）；取消勾选「隐藏载货避障着色」后，有 `loadSecurity` 的边变青色；同时取消多个着色项时按优先级只显示最高色。
- [ ] **MapNestModify**：选中有着色属性的边时，线宽加粗 + 颜色共存（D10）。
- [ ] **Overlook**：默认无着色；开关打开后有属性的边显示对应颜色；与 MapNestModify 行为一致。
- [ ] **RecordPlayback**：默认无着色；开关打开后有属性的边显示对应颜色；与 MapNestModify 行为一致。
- [ ] 三个画布各自的展示菜单均有 3 个独立 checkbox，标签分别为「隐藏载货避障着色」「隐藏空载避障着色」「隐藏车辆分组着色」，默认勾选。
- [ ] 仅打开 1 个开关时，只显示该属性的颜色（即使边有更高优先级属性，D3）。
- [ ] 边无属性时，无论开关状态始终显示原始颜色。
- [ ] 属性面板 label 旁色块始终显示（D12），不随开关联动。
- [ ] 地图切换后，着色开关状态正确延续（不重置为默认）。
- [ ] AddEdge 已提交边预览遵循开关状态；绘制中预览不受影响。

---

## 9. 风险与权衡

- **`getEdgeStrokeColor` 签名 breaking change**：第三参数改为必传（无默认值），确保不会因遗漏调用方面意外显示颜色。受影响调用方仅 3 处（edgeDrawFuncs + Overlook EdgesLayer + RecordPlayback MapEdgeLayer），均在本次改动范围内。
- **Overlook 新增 stage attr 读取**：Overlook 的 EdgesLayer sceneFunc 已通过 stage attr 读 visualScale，新增 edgeColorVisible attr 读取是同模式延伸，不引入新的架构模式。`batchDraw` 确保 sceneFunc 重绘时读到新值。
- **RecordPlayback re-render 由 overlayVisible 驱动**：开关切换使 `overlayVisible` 产生新引用，MapEdgeLayer（memo）随之 re-render——这与现有 `edgeLabel` 等 toggle 完全同源，无额外 prop、无额外 memo 开销。
- **菜单项膨胀**：MapNestModify 展示菜单从 7 项增至 10 项，Checkbox.Group 在 220px 宽下拉中纵向排列，高度可接受（用户访谈确认 D8 不分组）。
- **优先级在 per-attribute toggles 下的行为**（D3）：当高优先级属性开关关闭时，跳过该属性继续检查低优先级——这是 per-attribute 控制的核心价值（用户可选择性隔离查看某一类属性），但也意味着「同时开多个开关 + 多属性边」时仍只看到最高优先级色（D2）。这是访谈中确认的设计取舍。
