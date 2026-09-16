# SPEC：路径三方设备图标展示

> 状态：已定稿（访谈完成）　|　日期：2026-06-27　|　分支：v1_master_new
>
> 目标：在 AGV 地图的路径上，依据 `userDefinedProperties.deviceType` 渲染三方设备图标（电梯 / 自动门 / 风淋门 / 交通灯），覆盖地图编辑、调度监控、录制回放三个画布。

---

## 0. 决策汇总（访谈结论速查）

| # | 议题 | 决策 |
|---|------|------|
| D1 | 展示范围 | 三个画布全做：MapNestModify（命令式）、Overlook（声明式）、RecordPlayback（声明式） |
| D2 | 设备类型识别 | **仅按 `userDefinedProperties.deviceType` 判断**，不读 `applyDeviceOperationType` |
| D3 | 实时状态 | 本期静态展示，但代码预留实时 `state` 接口，便于后续接 WebSocket |
| D4 | 图标位置 | 路径**标签点** `labelX/labelY`（直线 t=1/3、贝塞尔 t=2/3，**非几何中点**） |
| D5 | 双向路径 | 正向、反向**各画一个图标**，沿路径法线方向错开（正向一侧、反向另一侧），避免重叠 |
| D6 | 视觉形式 | **canvas 矢量简笔图标**（与节点 `sceneFunc` 风格一致） |
| D7 | 尺寸缩放 | 跟随 `visualScale` 自适应缩放（与节点、路径粗细一致） |
| D8 | 编辑交互 | 纯展示 `listening=false`，点击穿透选中下层路径（Overlook/Playback 的 Layer 本就 `listening=false`） |
| D9 | 标签冲突 | **标签让位**：有设备的边，`name` 标签自动上移，中点留给图标 |
| D10 | 图标朝向 | **跟随路径切线方向旋转** |
| D11 | 充电桩 | 不做（`chargePile` 绑在 charge 节点，非路径设备，本期不涉及） |
| D12 | 未知类型 | **通用占位图标**（灰底方块 + 问号） |
| D13 | 可见性 | 在 `OverlayVisible` 新增独立 `device` 开关 |
| D14 | Tooltip | 不需要（纯图形，无 i18n 负担） |
| D15 | 暗黑主题 | 适配，采用项目现有 `localTheme === "darkAlgorithm"` 模式 + 明/暗两套硬编码色值 |
| D16 | 配色 | 语义色：电梯蓝 / 自动门绿 / 风淋门紫 / 交通灯红黄绿 / 占位灰 |
| D17 | 交通灯编辑器配置 | 仅展示支持，**不补 `deviceTypes` 常量**（编辑器属性面板不加该项） |
| D18 | 图标尺寸 | 略大于节点：基准半径 `0.1 × 1.2 = 0.12`（地图坐标系，米） |
| D19 | 选中联动 | 路径被选中/高亮时，其设备图标联动高亮（描边/变色） |
| D20 | 复制元素 | `CopyModal` 复制路径时设备属性随 `userDefinedProperties`（在 `...rest`）自动带走，无需额外处理 |

---

## 1. 数据基础

### 1.1 字段来源

设备信息位于 `MapEdge.userDefinedProperties`：

```ts
userDefinedProperties: {
  deviceType: "elevator" | "autoDoor" | "airShowerDoor" | "trafficLight" | string;
  deviceKey?: string;
  applyDeviceOperationType?: string;   // 如 OUTER_CALL / OPEN_DOOR / OPEN_FONT_DOOR / OPEN_BACK_DOOR / SHOWER（见 constants/mapThrough.ts；本期不读此字段）
  releaseDeviceOperationType?: string;
}
```

### 1.2 数据流确认（已核实源码）

- **MapNestModify**：`getMapInfo` → `mapJson.edges`，字段完整。
- **Overlook**：`getMapInfo` → `edges`，与编辑器同源（`Overlook/ForceGraph/GraphStage/index.tsx`）。
- **RecordPlayback**：回放地图数据。
- **关键事实**：声明式画布的 `mountGraphEdges`（`src/utils/graph.ts:59`）在 `data` 中使用 `...rest` 展开（`graph.ts:84`），**运行时完整保留了 `userDefinedProperties` 与 `applyDeviceOperationType`**。MountLine 的 `data` 类型为 `Record<string, unknown>`（`typing.d.ts:122`）。
- ⚠️ **类型提示**：`MapEdge.userDefinedProperties` 在 `src/types/typing.d.ts:34` 的类型声明为 `null`（运行时是对象），TS 层访问 `deviceType` 需类型断言/收窄。
- ⚠️ **命令式画布待验证**：MapNestModify 的设备图标走 `edgeSceneFunc` 的 `shape.getAttrs().data`（`edgeDrawFuncs.ts:26`）。`mountGraphEdges` 的 `...rest` 只覆盖声明式画布；命令式建 Shape 时塞入的 `data` 是否含 `userDefinedProperties`，需在实现阶段确认（必要时在建 Shape 处补字段）。

> ✅ 结论：声明式画布（Overlook / RecordPlayback）无需改动数据获取链路，设备字段在渲染层即可读到；命令式画布（MapNestModify）需按上一条确认 shape data。

---

## 2. 设备类型识别规则（D2）

新增纯函数 `resolveDeviceType(userDefinedProperties): DeviceIconType | null`，**只读 `userDefinedProperties.deviceType`，不读 `applyDeviceOperationType`**：

1. `deviceType` 命中已知值 → 对应图标：
   - `elevator` → `elevator`
   - `autoDoor` → `autoDoor`
   - `airShowerDoor` → `airShowerDoor`
   - `trafficLight` → `trafficLight`
2. `deviceType` 有值但不在上述四种内 → `unknown`（占位图标）。
3. `userDefinedProperties` 为 `null` / 空 / 无 `deviceType` → `null`（不绘制）。

> 注意（D17）：识别逻辑支持 `trafficLight`，但**不修改 `constants/mapThrough.ts` 的 `deviceTypes` 下拉常量**——编辑器属性面板仍只能配三种；交通灯数据视为来自后端/导入，仅做展示识别。

`DeviceIconType = "elevator" | "autoDoor" | "airShowerDoor" | "trafficLight" | "unknown"`。

---

## 3. 图标视觉规格

### 3.1 位置（D4）

- 锚点 = 路径**标签点**（注意：非几何中点），**直接复用** `createEdgeShapeConfig` / `mountGraphEdges` 已计算的 `labelX, labelY`。其中直线来自 `computeLinePoint(points)`（默认 **t=1/3**，`math.ts:144`），贝塞尔来自 `computeBezierLabelPoint(points)`（默认 **t=2/3**，`math.ts:118`）。
- 在锚点基础上沿**路径法线方向**叠加正/反向偏移（见 3.6）。

### 3.2 旋转（D10）

图标整体绕锚点旋转，角度 = 路径在**锚点处**的切线方向（**切线与锚点必须用同一个 t**，否则朝向与位置错位）：

- 直线：`angle = atan2(sy - ey, ex - sx)`（注意 canvas 坐标 y 已取反，`sy/ey` 为地图原值）。
- 贝塞尔曲线：切线必须在锚点对应的 t（即 `computeBezierLabelPoint` 的默认 **t=2/3**）处取。**直接复用现成的 `getBezierTangent(points, t)`**（`math.ts:31`，公式为 `3·(1−t)²·(P1−P0) + 6·(1−t)·t·(P2−P1) + 3·t²·(P3−P2)`，`computeCubicArrowPoints` 已采用同一套「点 + 切线」算法）。
  - ⚠️ **不要用 `3·(P3 − P2)`**——那是 t=1（终点）处的切线，与 t=2/3 的锚点不匹配，会导致图标朝向偏转。

> 实现建议：在 `src/utils/math.ts`（已有文件，非目录）新增 `computeEdgeTangentAngle(sx,sy,cx,cy,dx,dy,ex,ey)`：直线直接算，贝塞尔调用 `getBezierTangent(points, 2/3)`，供三画布复用。法线方向由切线 ±90° 得到。

### 3.3 尺寸（D7, D18）

- 基准半径 `R = 0.12`（地图米，= 节点 `nodeStyle.radius(0.1) × 1.2`）。
- 实际绘制半径 `R * visualScale`（MapNestModify）/ `R * edgeScale`（Overlook/Playback 的 `mountGraphEdges` 第二参，默认 1）。
- 与节点、路径线宽共用同一套自适应倍率，视觉协调。

### 3.4 配色与暗黑主题（D15, D16）

采用项目既有模式：`useLocalStorageState<"defaultAlgorithm"|"darkAlgorithm">("theme")`，`isDark = localTheme === "darkAlgorithm"`（参考 `src/pages/AnalyzeVisual/OrderStatistics/QuantityStatistics/index.tsx:55`）。

> ⚠️ **注意（新引入工作量）**：Overlook / MapNestModify / RecordPlayback 三个画布目前**没有任何暗黑主题逻辑**（grep `darkAlgorithm`/`isDark` 在这三个画布目录零命中），该模式仅存在于 AnalyzeVisual 统计页与 ActionsRender。因此对画布而言属于全新引入：三个画布各自需 `useLocalStorageState("theme")` 取值 → 命令式写 stage attr、声明式作 props 下传。

| 设备 | 亮色 | 暗色 |
|------|------|------|
| 电梯 elevator | `#1976D2` | `#64B5F6` |
| 自动门 autoDoor | `#43A047` | `#81C784` |
| 风淋门 airShowerDoor | `#8E24AA` | `#BA68C8` |
| 交通灯 trafficLight | 红`#E53935`/黄`#FB8C00`/绿`#43A047`（明暗通用） | 同左 |
| 占位 unknown | `#9E9E9E` | `#BDBDBD` |

描边统一 `#FFFFFF`（亮）/ `#000000`（暗）半透明，保证在路径上可辨。

> **命令式画布取色方式（D15 细则）**：sceneFunc 内不能读 CSS 变量。方案：把当前 `isDark` 写入 stage 自定义 attr（与 `visualScale`/`labelVisible` 同机制），sceneFunc 通过 `shape.getStage()?.getAttr(...)` 读取；主题切换时更新该 attr 并 `batchDraw()`。声明式画布通过 props 传入 `isDark`。⚠️ 需在 `MAP_NEST_STAGE_ATTR`（`src/plugins/konva/runtime/constants.ts`）**新增 `theme`/`isDark` key**——当前仅有 `visualScale`/`labelVisible` 两项。

### 3.5 矢量图形设计（D6）

每个图标以**原点为中心**、半径 `R` 范围内绘制（便于 `translate → rotate → scale`），用 canvas path：

- **电梯**：圆角方框 + 框内上下双箭头（表示升降）。
- **自动门**：门框（顶部门楣横梁）+ 双扇门片 + 每扇门片上各一个朝外的张开箭头（左门片朝左、右门片朝右，表示两扇门向两侧滑开）。
- **风淋门**：门框（顶部门楣横梁）+ 双扇门片（参考自动门门形）+ 两扇门片上各一组波浪风线（表示风淋气流）。外轮廓与自动门同为横向扁矩形，靠紫色配色与波浪风线标识区分两者。
- **交通灯**：竖向圆角框 + 上中下三个圆（红/黄/绿），不随状态变化（本期静态）。
- **占位 unknown**：圆角方框 + 中央 `?`。

> 绘制细节（具体路径坐标）在实现阶段细化；本规格只锁定语义与配色。新增 `src/plugins/konva/devices/deviceIconSceneFunc.ts` 统一实现，三画布复用。

### 3.6 双向路径（D5）

- 每条配了设备的边各自绘制一个图标（**不去重**）。
- 沿法线方向偏移：`isBackEdge=false`（正向）→ 法线 `+n` 侧；`isBackEdge=true`（反向）→ 法线 `−n` 侧。
- 偏移量 `offset = R * 1.1 * visualScale`，保证正反两图标在视觉上分离。
- 反向图标旋转角度 = 反向切线（与反向路径方向一致）。

### 3.7 与路径标签的关系（D9 标签让位）

- 有设备的边：`name` 标签绘制位置由 `(labelX, labelY)` 上移到 `(labelX, labelY − offset)`（与图标错开），避免与图标重叠。
- 实现点：
  - **MapNestModify**：`edgeSceneFunc`（`edgeDrawFuncs.ts`）绘制标签前判断 `resolveDeviceType(data) !== null`，命中则 `labelY` 减偏移；或在 `createEdgeShapeConfig` 预计算一个 `deviceLabelY`。
  - **Overlook/Playback**：各自内联 sceneFunc 同样处理。
- 无设备的边：标签位置不变。

---

## 4. 各画布实现方案

### 4.0 公共：设备插件模块（新增）

```
src/plugins/konva/devices/
├── index.ts                       // deviceStyles 导出 + DeviceIconType 类型 + resolveDeviceType
├── deviceStyles.ts                // 明/暗两套配色（deviceStyles.light / deviceStyles.dark）
├── deviceIconSceneFunc.ts         // 图标绘制函数（接收 type, R, colors, isDark, state?）
└── deviceIconHitFunc.ts           // 占位（本期 listening=false，可不实现 hit）
```

与 `src/plugins/konva/nodes/` 结构对齐，便于维护。

### 4.1 MapNestModify（命令式）

- **新增 Layer** `src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/DeviceLayer/index.tsx`：
  - 仿 `EdgesLayer`（命令式 `new Konva.Shape`），在 `edges` 变化时重建。
  - 遍历 edges，对 `resolveDeviceType !== null` 的边创建一个 `Konva.Shape`，`sceneFunc = deviceIconSceneFunc`，`listening = false`，`enableSelect` 不设（不参与选中）。
  - 位置/旋转/法线偏移按 §3 计算，半径读 stage `visualScale`。
  - `isDark` 从 stage attr 读取。
- **GraphStage**（`NestGraph/GraphStage/index.tsx`）：在 `<EdgesLayer>` 之后、`<NodesLayer>` 之前挂载 `<DeviceLayer edges={edges} visible={overlayVisible.device} />`。
- **标签让位**：改 `edgeSceneFunc` / `createEdgeShapeConfig`（§3.7）。
- **选中联动（D19）**：DeviceLayer 监听选中集合 `selectShapes`，命中该 edge 时给图标 Shape 打 `state="selected"`，sceneFunc 内据此加粗描边/提升亮度。因图标 `listening=false`，选中状态由上层 `selectShapes` 驱动（命令式 `setAttrs` + `batchDraw`）。

### 4.2 Overlook（声明式）

- **新增 Layer** `src/pages/Overlook/ForceGraph/GraphStage/DeviceLayer/index.tsx`：
  - 仿 `EdgesLayer`（声明式 `<Shape>` + 内联/引用 sceneFunc），`listening={false}`。
  - 数据源同 Overlook EdgesLayer（`mountGraphEdges` 结果已含设备字段）。
  - `enableOptimize` 时不渲染（与标签一致，性能优化）。
- **GraphStage**：挂载 `<DeviceLayer edges={edges} visible={overlayVisible.device} enableOptimize={enableOptimize} isDark={isDark} />`。
- **标签让位**：Overlook EdgesLayer 内联 sceneFunc 按 §3.7 调整。

### 4.3 RecordPlayback（声明式）

- **新增 Layer** `src/pages/RecordPlayback/components/KonvaRender/DeviceLayer/index.tsx`：与 Overlook 同构。
- 挂载于 `KonvaRender` 内 `MapEdgeLayer` 之后。
- 受回放 `overlayVisible.device` 控制（复用同一开关）。
- **标签让位**：`MapEdgeLayer` 内联 sceneFunc 按 §3.7 调整。

---

## 5. 可见性控制（D13）

- 在 `OverlayVisible`（`src/types/OverLook/index.d.ts:21`）新增字段：
  ```ts
  /** 是否显示路径上的三方设备图标 */
  device: boolean;
  ```
- 全量补齐所有 `OverlayVisible` 初始化处默认值 `device: true`（需 grep `overlayVisible` 初值 / `useState<OverlayVisible>` 定位，MapNestModify 与 Overlook 共用此类型）。
- 工具栏/显隐面板新增「三方设备」开关项（与 grid/nodeLabel/edgeLabel/robot/angle 并列）。

---

## 6. 交互（D8, D14）

| 画布 | 行为 |
|------|------|
| MapNestModify | 图标 `listening=false`，鼠标点击穿透到下层路径 Shape，照常选中 edge → 属性面板显示 `ThirdDevice` 配置。无 tooltip。 |
| Overlook | Layer `listening=false`，纯展示。无 tooltip。 |
| RecordPlayback | Layer `listening=false`，纯展示。无 tooltip。 |

> 图标 `listening=false` 同时避免遮挡路径的 hit 区域（路径 `hitStrokeWidth` 不受影响）。

---

## 7. 实时状态接口预留（D3）

`deviceIconSceneFunc` 签名预留 `state` 参数：

```ts
type DeviceState = {
  status?: "idle" | "active" | "error";   // 如门开/关、电梯到达
  phase?: "red" | "green" | "yellow";      // 交通灯当前灯色
};

export const deviceIconSceneFunc = (
  context: Context,
  shape: Konva.Shape,
  state?: DeviceState     // 本期恒为 undefined → 绘制静态图标
) => { ... }
```

- 本期所有调用处传 `undefined`，绘制静态语义色图标。
- 后续接 WebSocket 设备状态通道时，只需把状态写入 Shape 的 `data.deviceState`（命令式）或 props（声明式），无需改绘制函数主体。

---

## 8. 边界情况

| 场景 | 处理 |
|------|------|
| `userDefinedProperties` 为 `null` | 不绘制图标（`resolveDeviceType` 返回 `null`） |
| 未知 `deviceType`（不在四种已知类型内） | 绘制通用占位图标（D12） |
| 路径极短，图标与节点/箭头重叠 | 仍绘制（接受重叠）；如视觉不可接受，后续可加「长度阈值」隐藏，本期不做 |
| 同一节点连多条设备路径 | 各路径中点不同，图标自然分散；不做额外避让 |
| 地图整体旋转（stage.rotation） | 不影响——旋转作用于 stage 变换矩阵，sceneFunc 内坐标为 stage 内部坐标，图标跟随路径切线即可 |
| 复制元素（CopyModal） | `userDefinedProperties` 在 `...rest` 内，随路径自动复制（D20，已核实 `createEdgeShapeConfig` 被 CopyModal 复用） |
| 暗黑主题切换 | 更新 stage `isDark` attr 并重绘（命令式）/ 重传 props（声明式） |
| `overlayVisible.device=false` | DeviceLayer `visible=false`，不渲染 |
| 贝塞尔曲线路径 | 锚点用 `computeBezierLabelPoint`（t=2/3），切线用 `getBezierTangent(points, 2/3)`，与现有 `computeCubicArrowPoints` 同源（§3.2） |

---

## 9. 涉及文件清单

### 新增
- `src/plugins/konva/devices/index.ts`
- `src/plugins/konva/devices/deviceStyles.ts`
- `src/plugins/konva/devices/deviceIconSceneFunc.ts`
- `src/plugins/konva/devices/deviceIconHitFunc.ts`（可选）
- `src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/DeviceLayer/index.tsx`
- `src/pages/Overlook/ForceGraph/GraphStage/DeviceLayer/index.tsx`
- `src/pages/RecordPlayback/components/KonvaRender/DeviceLayer/index.tsx`

### 修改
- `src/utils/math.ts`：新增 `computeEdgeTangentAngle`（贝塞尔分支复用 `getBezierTangent`）
- `src/types/OverLook/index.d.ts`：`OverlayVisible` 增 `device`
- `OverlayVisible` 所有初值处（`RecordPlayback/index.tsx:21` / `MapNestModify/NestGraph/index.tsx:63` / `Overlook/ForceGraph/index.tsx:31`）：补 `device: true`
- 显隐开关 UI（工具栏/面板）：新增「三方设备」开关
- `src/plugins/konva/runtime/constants.ts`：`MAP_NEST_STAGE_ATTR` 新增 `theme`/`isDark` key
- `src/plugins/konva/path/edgeDrawFuncs.ts`（`edgeSceneFunc`）：标签让位
- `src/plugins/konva/shapeFuncs/createShapeConfig.ts`：标签让位预计算（可选）
- `Overlook/.../EdgesLayer/index.tsx` 内联 sceneFunc：标签让位
- `RecordPlayback/.../MapEdgeLayer/index.tsx` 内联 sceneFunc：标签让位
- 三处 `GraphStage`/`KonvaRender`：挂载 DeviceLayer、传 `isDark`（含三个画布新引入的 `useLocalStorageState("theme")` 取值）

### 不修改
- `src/constants/mapThrough.ts`（`deviceTypes` 不加 trafficLight，D17）
- `src/api/*`（数据流无需改动）
- WebSocket provider（本期不接实时状态）

---

## 10. 不在范围内

- 充电桩 `chargePile`（节点设备）的图标展示（D11）。
- 设备实时状态展示（仅预留接口，D3）。
- 编辑器配置交通灯（D17）。
- Tooltip / 设备详情弹窗（D14）。
- 图标独立选中/拖拽（D8）。

---

## 11. 验收清单

- [ ] 三画布均能渲染 4 种设备 + 占位图标，配色与暗黑主题正确。
- [ ] 双向路径正反各一图标，沿法线错开不重叠。
- [ ] 图标跟随路径切线旋转；缩放时随 `visualScale` 自适应。
- [ ] 有设备的边，`name` 标签上移让位，不与图标重叠。
- [ ] `overlayVisible.device` 开关可独立控制显隐。
- [ ] MapNestModify 中点击图标穿透选中路径，属性面板显示设备配置。
- [ ] 路径选中时图标联动高亮。
- [ ] 未知 deviceType 显示占位图标；`userDefinedProperties` 为 null 时不绘制。
- [ ] CopyModal 复制路径后设备属性存在、图标正常显示。
- [ ] 明/暗主题切换后图标颜色正确刷新。
- [ ] 贝塞尔曲线路径上图标位置与朝向正确。

---

## 12. 风险与权衡

- **矢量图标绘制工作量**：4 种 + 占位共 5 个 canvas 矢量图形需手工调试，是主要工作量。可先用最简几何（方框+字符）占位跑通链路，再逐个精细化。
- **命令式 vs 声明式双轨**：三画布两套渲染机制，设备绘制函数必须做成与机制无关的纯函数（仅依赖 context + 参数），避免逻辑分叉。
- **标签让位改动面**：三处 sceneFunc 都要改，注意保持一致的偏移量常量，建议抽到 `devices` 模块导出 `DEVICE_LABEL_OFFSET`。
- **暗黑主题重绘**：命令式画布切换主题需主动 `batchDraw`，注意与现有 `applyVisualScaleToAllShapes` 等 stage attr 更新机制协调，避免遗漏重绘。
- **预留接口的取舍**：`state` 参数本期不接数据，存在「预留但未验证」风险；接入 WebSocket 时需补端到端联调。
- **暗黑主题为新引入工作量**：三个画布当前无任何主题逻辑（见 §3.4 注），D15「采用项目现有 localTheme 模式」对画布而言是全新引入（各自 `useLocalStorageState("theme")` + 命令式写 stage attr / 声明式 props），需在排期中单列；命令式画布还需扩展 `MAP_NEST_STAGE_ATTR` 并在切换时 `batchDraw`，注意与 `applyVisualScaleToAllShapes` 协调避免漏绘。
