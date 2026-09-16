# SPEC：节点 / 路径动作角标展示

> 状态：已定稿（访谈完成）　|　日期：2026-06-27　|　分支：v1_dev
>
> 目标：在 AGV 地图的**节点和路径**上，依据 `actions` 数组渲染「动作角标」（染色圆 + 内嵌数量），覆盖地图编辑、调度监控、录制回放三个画布。
>
> 关系：与 [SPEC_edge_third_party_device.md](./SPEC_edge_third_party_device.md) 同源（同为叠加在节点/路径上的命令式/声明式装饰图层），复用其引入的 `visualScale` / `isDark` / `OverlayVisible` / `enableOptimize` 等基础设施。**动作与设备的本质区别见 §0.1**。

---

## 0. 决策汇总（访谈结论速查）

| # | 议题 | 决策 |
|---|------|------|
| D1 | 展示形式 | **染色圆 + 内嵌数量**的通用徽章；**不按 `actionType` 区分**（`actionType` 为动态自由文本，无固定图标库）。「动作」语义靠「位置 + hover 详情」承载 |
| D2 | 展示范围 | 三个画布全做：MapNestModify（命令式）、Overlook（声明式）、RecordPlayback（声明式） |
| D3 | 多动作聚合 | 折叠为**数量角标**，圆心显示动作总数（**1 个也显示「1」，统一**），不逐个展开 |
| D4 | blockingType 编码 | **三色全区分**：HARD 红 / SOFT 黄 / NONE 中性灰 |
| D5 | 角标染色策略 | 取该元素所有动作里**最严重**的 blockingType（优先级 HARD > SOFT > NONE）染色；圆心数字仍为总数 |
| D6 | 节点位置 | 节点**右上角**（通知红点位） |
| D7 | 路径位置 | 路径标签点 `labelX/labelY` **「中点下方」** + 正反沿**法线方向**错开 |
| D8 | 角标朝向 | **不旋转**（圆形对称 + 数字须正立可读），区别于设备图标「跟随切线旋转」 |
| D9 | 详情交互 | **hover 弹 HTML overlay tooltip**；点击角标不响应 |
| D10 | tooltip 内容 | **每动作一卡**：`actionType`（粗体）+ 阻塞色点 + `actionDescription` + `actionParameters`（key:value 表） |
| D11 | tooltip 实现 | **HTML overlay 浮层**（监听角标 `mouseenter`/`mouseleave`，**定位固定贴角标锚点**、不跟随鼠标；三画布各接一套鼠标事件，共用同一个 React 组件） |
| D12 | 点击区域 | 角标 `listening=true` **仅用于捕获 hover**，命中区域经 `hitFunc` 限定为圆形本体；点击角标无反应，**不影响节点/路径选中**（点元素本体照常选中） |
| D13 | 双向路径 | 正反边**各画一个角标**，沿法线方向错开（正向一侧、反向另一侧），**不合并** |
| D14 | 可见性 | `OverlayVisible` 新增独立 **`actions`** 开关，**默认 false**（默认不显示，用户按需开启） |
| D15 | 性能 | `enableOptimize`（缩放小 / 元素多）时**不渲染角标**，与标签 / 设备图标一致 |
| D16 | 布局防冲突 | 统一 **`ACTION_OFFSET` 常量族**，与设备 / 标签偏移解耦（不动态避让，避免抖动） |
| D17 | i18n | `blockingType` **显原文枚举** `NONE/SOFT/HARD`；字段标签 / 开关名走 `t()`；`actionType` / `actionDescription`（用户输入）不译 |
| D18 | 暗黑主题 | **复用设备规格引入的 `isDark` 机制**（`MAP_NEST_STAGE_ATTR` 的 `theme/isDark` + 三画布 `useLocalStorageState("theme")`）；三色提供明 / 暗两套色值 |
| D19 | 选中联动 | 节点 / 路径被选中时其角标**联动高亮**（加描边 / 提升亮度），与设备图标 D19 一致 |
| D20 | 数据流 | 命令式 `shape.data` 经 `…rest` + 编辑面板主动写入 → **必然含 `actions`**；声明式 edge 经 `mountGraphEdges` 的 `…rest` 保留；声明式 **node 待实现阶段确认** |
| D21 | 复制元素 | `actions` 在 `…rest` 内，随节点 / 路径自动复制（CopyModal 无需额外处理） |
| D22 | 零动作 | `actions` 为空数组 / `undefined` / `null` → **不绘制** |
| D23 | 命令式刷新 | ActionLayer 为**命令式装饰图层**，必须在拖动节点/路径、改 `actions` 属性、改 `name` 等编辑点调用 `refreshActionBadges`（同设备 `refreshDeviceIcons` 教训） |

---

### 0.1 动作 vs 设备：为什么不能照搬设备图标的「辨识度图形」思路

| 维度 | 设备（已实现） | 动作（本规格） |
|------|----------------|----------------|
| 类型来源 | 4 种**固定**枚举（elevator/autoDoor/airShowerDoor/trafficLight） | `actionType` 是**用户/系统动态配置的自由文本**（如 `BBBB`、`AAAAA`），无法穷举 |
| 图标可行性 | 可为每种画辨识度矢量图形 | **不可**——无固定图标库，只能用通用徽章 |
| 数量 | 每条边最多 1 个设备 | 一个节点/路径可有**多个**动作（数组） |
| 载体 | 仅路径 | **节点 + 路径** |
| 核心信息 | 「是什么设备」 | 「**有几个动作** + **最严重的阻塞等级**」，具体动作靠 hover |

> 结论：动作走「**数量徽章 + 阻塞色 + hover 详情**」路线，而非设备「**辨识度图标**」路线。

---

## 1. 数据基础

### 1.1 字段来源

节点（`MapNode`）与路径（`MapEdge`）均有 `actions?: ActionType[]`（`src/utils/typing.d.ts:40/76`）：

```ts
interface ActionType {
  actionType: string;            // 动作类型，用户/系统动态配置的自由文本（不译）
  actionDescription: string;     // 动作描述，用户输入（不译）
  blockingType: string;          // 阻塞类型："NONE" | "SOFT" | "HARD"
  actionParameters: { key: string; value: string }[];  // 动作参数键值对
}
```

- `blockingType` 三值语义：`NONE`（不阻塞）/ `SOFT`（软阻塞）/ `HARD`（硬阻塞，必须等执行完）。
- 严重度优先级：**HARD > SOFT > NONE**（D5 染色依据）。

### 1.2 数据流确认（已核实源码）

- **MapNestModify（命令式）**：
  - 节点 shape：`createShapeConfig.ts:43` `data: { ...rest, type, angle, arrowPoints }`，`...rest` 来自 `createShapeConfig.ts:24` `const { id, x, y, type, angle, ...rest } = node`（`createNodeShapeConfig` 内）→ **`actions` 在 `...rest` 内**。
  - 路径 shape：`createShapeConfig.ts:91` `data: { ...rest, id, sx, sy, ... }`，`...rest` 来自 `createShapeConfig.ts:65`（`createEdgeShapeConfig` 内）→ **`actions` 在 `...rest` 内**。
  - 双保险：动作编辑面板 `Actions/index.tsx:27` 还主动 `shape.setAttrs({ data: { ...data, actions } })` 写回 shape.data。
  - ✅ **结论：命令式画布 shape.data 必然携带 `actions`，数据链路完全通畅**（比设备规格更确定）。
- **Overlook / RecordPlayback（声明式）**：
  - edge：`mountGraphEdges`（`graph.ts:84`）的 `...rest` 展开 → **edge 的 `actions` 保留**（与设备规格结论一致）。
  - node：`mountGraphNodes`（`graph.ts:21`）同样在 `data: { ...rest, type, angle, arrowPoints }`（`graph.ts:42-47`）展开 → **node 的 `actions` 也保留**。Overlook `NodesLayer`（`NodesLayer/index.tsx:22`）与 RecordPlayback（`KonvaRender/index.tsx:94`）均调用 `mountGraphNodes`，链路已确认通畅，无需补字段。
- **类型提示**：`MapNode.actions` / `MapEdge.actions` 类型为可选数组，TS 层直接访问安全；无需像 `userDefinedProperties` 那样做类型断言。

---

## 2. 动作摘要识别规则（D3, D5）

新增纯函数 `resolveActionSummary(actions): ActionSummary | null`：

```ts
/** 动作角标摘要：数量 + 最严重阻塞等级 */
type ActionSummary = {
  count: number;                       // 动作总数
  severity: "HARD" | "SOFT" | "NONE";  // 最严重 blockingType（HARD > SOFT > NONE）
};
```

1. `actions` 为 `null` / `undefined` / 空数组 → 返回 `null`（不绘制，D22）。
2. 否则 `count = actions.length`；`severity` = `actions` 中存在的最高优先级 blockingType（HARD > SOFT > NONE）。
3. ⚠️ 容错：单个 action 缺 `blockingType` 或值非法时，按 `NONE` 参与比较（不抛错）。

> 该函数与渲染机制无关，三画布共用；命令式 / 声明式均通过它得到 `{count, severity}` 后再绘制角标。

---

## 3. 角标视觉规格

### 3.1 位置

- **节点（D6）**：锚点 = 节点圆心 `(x, y)` 右上角偏移。
  - canvas 坐标（y 已取反）：`anchorX = x + ACTION_NODE_OFFSET_X`，`anchorY = y − ACTION_NODE_OFFSET_Y`（右上 = x+ / y−）。
  - 默认 `ACTION_NODE_OFFSET ≈ nodeStyle.radius(0.1) × 2.2`，使角标贴在节点圆轮廓的右上外侧（通知红点位）。
- **路径（D7）**：锚点 = 路径标签点 `(labelX, labelY)`（直接复用 `createEdgeShapeConfig` / `mountGraphEdges` 已计算值；直线 t=1/3、贝塞尔 t=2/3，与设备规格同源），再叠加：
  1. 「中点下方」向下偏移 `ACTION_EDGE_OFFSET_Y`（canvas 下 = y+）；
  2. 正反沿法线方向错开（见 3.4）。

### 3.2 朝向（D8）

- 角标为**圆形 + 数字**，**不旋转**，数字始终保持正立可读。
- ⚠️ **区别于设备图标**：设备图标跟随路径切线旋转（设备规格 D10）；动作角标**不跟随**，即便挂在路径上也保持水平。这样多动作数字、tooltip 命中区域都稳定。

### 3.3 尺寸与缩放

- 基准半径 `R = ACTION_BASE_RADIUS`（地图米，参考值 `0.16`，作为「通知徽章」**小于设备图标** `DEVICE_BASE_RADIUS`（代码实值 `0.4`，见 `src/plugins/konva/devices/deviceIconSceneFunc.ts:38`），避免喧宾夺主）。
- 实际绘制半径 `R * visualScale`（MapNestModify）/ `R * edgeScale`（Overlook/Playback）。
- 圆心数字字号随 `R` 自适应；两位及以上数字时圆略微加宽或数字缩字（保证不出圆）。
- 与节点、路径线宽、设备图标共用同一套自适应倍率，视觉协调。

### 3.4 双向路径（D7, D13）

- 每条有动作的边各自绘制一个角标（**不去重、不合并**）。
- 沿法线方向偏移：`isBackEdge=false`（正向）→ 法线 `+n` 侧；`isBackEdge=true`（反向）→ 法线 `−n` 侧；偏移量 `ACTION_EDGE_NORMAL_OFFSET = R * 1.1 * scale`（与设备规格 `DEVICE_NORMAL_OFFSET_RATIO` 对齐）。
- 法线方向由路径切线 ±90° 得到；切线计算**复用设备规格新增的 `computeEdgeTangentAngle`**（`src/utils/math.ts`，直线直接算、贝塞尔用 `getBezierTangent(points, 2/3)`）。
- ⚠️ 注意：角标本身不旋转（D8），但**位置**仍需用到切线/法线来决定正反错开方向。

### 3.5 配色与暗黑主题（D4, D5, D18）

复用设备规格的 `isDark` 取色模式（`useLocalStorageState<"defaultAlgorithm"|"darkAlgorithm">("theme")`，`isDark = localTheme === "darkAlgorithm"`；命令式写 stage attr，声明式 props 下传）。

| severity（最严重 blockingType） | 亮色 | 暗色 | 语义 |
|------|------|------|------|
| HARD | `#E53935` | `#EF5350` | 硬阻塞，警示红 |
| SOFT | `#FB8C00` | `#FFA726` | 软阻塞，黄 |
| NONE | `#9E9E9E` | `#BDBDBD` | 不阻塞，中性灰 |

- 圆内数字统一白色 `#FFFFFF`，保证三色底上都可读。
- 描边：亮色 `rgba(255,255,255,0.85)` / 暗色 `rgba(0,0,0,0.45)`，与设备图标一致，保证在彩色路径/节点上可辨。
- 选中联动（D19）：被选中的节点/路径，其角标外加一圈高亮环 `rgba(255,235,59,0.55)`（与设备图标选中态一致）。

> **依赖说明**：D18 复用设备规格**已落地**的 `isDark` 基础设施（`MAP_NEST_STAGE_ATTR` 的 `isDark` key、三画布各自 `useLocalStorageState("theme")`、`@/plugins/konva/devices` 模块均已合入），动作直接复用，不重复造轮子。

---

## 4. Tooltip 规格（D9–D11）

### 4.1 触发与定位

- 角标 `listening=true`，监听 `mouseenter` / `mouseleave`（**定位以锚点为准，不监听 mousemove**——鼠标在角标内移动不改变浮层位置）。
- hover 任一角标 → 在画布上方渲染**单个** HTML overlay 浮层（鼠标移出隐藏）；同一时刻只显示一个 tooltip。
- 定位：**固定贴角标锚点**——把角标锚点的**画布坐标**转换为**屏幕坐标**（stage 容器 `getBoundingClientRect()` + 当前 stage 的缩放/平移变换 `stage.scale()` / `stage.position()` 反算），浮层 `position: absolute` 贴近锚点右上方；溢出视口时翻转到下方/左侧。浮层位置不随鼠标移动。

### 4.2 内容结构（D10）

每个动作渲染为一张小卡，纵向堆叠：

```
┌─────────────────────────────┐
│ 🔴 BBBB                     │  ← actionType（粗体）+ 阻塞色点（按该动作自身 blockingType）
│ bbb                         │  ← actionDescription
│ ─────────────────────────── │
│ b : b                       │  ← actionParameters：key : value 逐行列出
└─────────────────────────────┘
```

- 顶部标题区：`actionType`（粗体）+ 一个**按该动作自身 blockingType 染色**的小圆点（注意：这里每动作按各自 blockingType 着色，**不是**角标的「最严重」色；让用户在详情里看到每个动作的真实等级）。
- `actionDescription`：常规字重，超长自动换行。
- `actionParameters`：`key : value` 表格/列表形式；无参数则不渲染该区。
- 动作多时浮层纵向增长，加 `max-height` + 滚动条。

### 4.3 实现方式（D11）

- 新增**通用 React 组件** `ActionTooltip`（接收当前 hover 的 `actions` 列表），三画布共用。
- 三画布各自接入鼠标事件 → 维护 `hoveredTarget`（含 actions + 屏幕坐标）状态 → 渲染 `<ActionTooltip>`。
- ⚠️ 命令式画布（MapNestModify）：角标是 `Konva.Shape`，需在其 `onMouseEnter` / `onMouseLeave` 里回调 React 层设置 hover 状态（hover 携带该角标的 `actions` + 锚点屏幕坐标；浮层位置取锚点，不取鼠标坐标）。
- ⚠️ 声明式画布（Overlook/Playback）：角标是 `<Shape>`，直接绑 React 事件。
- 浮层用 antd `Card` / `Popover` 风格，保持与项目 UI 一致。

### 4.4 i18n（D17）

- `blockingType` 直接显示原文枚举 `NONE/SOFT/HARD`（不翻译）。
- 卡片内字段**无标签**（`actionType`/`actionDescription`/参数自带语义，不需「动作类型：」前缀），因此 tooltip 内**几乎无 i18n 文本**。
- 唯一需 `t()` 的是 §5 可见性开关名称「动作」及其 tooltip 提示——补 zh-CN/en-US/ja-JP/ko-KR/zh-TW 五语言 key。

---

## 5. 各画布实现方案

### 5.0 公共：动作插件模块（新增）

```
src/plugins/konva/actions/
├── index.ts                  // ActionSummary 类型 + resolveActionSummary 纯函数 + 导出
├── actionStyles.ts           // severity 明/暗两套配色（actionStyles.light / .dark）
├── actionBadgeSceneFunc.ts   // 角标绘制函数（染色圆 + 内嵌数字 + 可选选中高亮环）
└── ActionTooltip.tsx         // HTML overlay 详情浮层组件（三画布共用）
```

- `actionBadgeSceneFunc` 与 `deviceIconSceneFunc` 同构：内部完成「平移到锚点 → （路径）法线偏移 → 绘制圆 + 数字」，**不做 rotate**（D8）。Shape 自身无需 x/y/rotation，`visualScale` 变化时只更新 `data.scale`。
- 角标 Shape 配 **`hitFunc`**：命中区域限定为角标圆形本体（半径 `R * scale`），使点击只命中徽章本身、不扩大到 bounding box，从而不影响下层路径/节点选中（D12）。
- `shape.getAttrs().data` 需含：`count`、`severity`、`anchorX`、`anchorY`、`isBackEdge`（仅路径）、`elementType`（"node"|"edge"，决定是否用法线偏移）、`scale`、`isDark`、`isSelected?`。

### 5.1 MapNestModify（命令式）

- **新增 Layer** `src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/ActionLayer/index.tsx`：
  - 仿设备 `DeviceLayer`（命令式 `new Konva.Shape`），在 `nodes` / `edges` 变化时重建。
  - 遍历节点 + 边，对 `resolveActionSummary(data.actions) !== null` 的元素各创建一个 `Konva.Shape`，`sceneFunc = actionBadgeSceneFunc`，`listening = true`（D12，用于 hover）。
  - 节点角标按 §3.1 右上角定位；路径角标按 §3.1/§3.4 中点下方 + 法线错开定位。
  - 半径、`isDark` 从 stage attr 读取（`visualScale` / `isDark`）。
  - 绑定 `onMouseMove` / `onMouseLeave` → 回调设置 hover 状态 → 渲染 `<ActionTooltip>`。
- **GraphStage**（`NestGraph/GraphStage/index.tsx`）：在 `<DeviceLayer>` 之后、`<NodesLayer>` 之前（或与 DeviceLayer 同层顺序）挂载 `<ActionLayer nodes={nodes} edges={edges} visible={overlayVisible.actions} />`。
- **命令式刷新（D23，关键）**：ActionLayer 为命令式装饰图层，**必须在以下编辑点调用 `refreshActionBadges`**（同设备 `refreshDeviceIcons` 教训）：
  - 拖动节点 / 路径控制点（角标跟随位置）；
  - 修改 `actions` 属性（编辑面板写入后角标数量/颜色更新）；
  - 修改 `name` 等可能影响标签点/布局的属性；
  - `visualScale` / `isDark` 变化。
  - ⚠️ 若存在 `isDark` effect，注意其与刷新的执行时序（先写 stage attr 再 batchDraw）。
- **选中联动（D19）**：监听 `selectShapes`，命中该元素时给角标 Shape 打 `isSelected`，sceneFunc 内画高亮环。

### 5.2 Overlook（声明式）

- **新增 Layer** `src/pages/Overlook/ForceGraph/GraphStage/ActionLayer/index.tsx`：
  - 仿设备 DeviceLayer（声明式 `<Shape>` + `sceneFunc`），`listening={true}`。
  - 数据源同 Overlook NodesLayer / EdgesLayer（`mountGraphEdges` 结果已含 actions；节点链路见 §1.2 ⚠️）。
  - `enableOptimize` 时**不渲染**（D15，与标签 / 设备一致）。
  - `<Shape>` 绑 React `onMouseMove` / `onMouseLeave` → `<ActionTooltip>`。
- **GraphStage**：挂载 `<ActionLayer nodes={nodes} edges={edges} visible={overlayVisible.actions} enableOptimize={enableOptimize} isDark={isDark} />`。

### 5.3 RecordPlayback（声明式）

- **新增 Layer** `src/pages/RecordPlayback/components/KonvaRender/ActionLayer/index.tsx`：与 Overlook 同构。
- 挂载于 `KonvaRender` 内 `MapEdgeLayer` / 节点层之后。
- 受回放 `overlayVisible.actions` 控制（复用同一开关）。

---

## 6. 可见性控制（D14, D15）

- 在 `OverlayVisible`（`src/types/OverLook/index.d.ts:21`）新增字段：
  ```ts
  /** 是否显示节点/路径上的动作角标 */
  actions: boolean;
  ```
- 全量补齐所有 `OverlayVisible` 初始化处默认值 `actions: false`（grep `overlayVisible` 初值 / `useState<OverlayVisible>` 定位；至少含 `RecordPlayback/index.tsx`、`MapNestModify/NestGraph/index.tsx`、`Overlook/ForceGraph/index.tsx`，与设备规格 D13 同批位置）。**默认关闭**：动作角标默认不显示，用户按需在显隐面板打开。
- 工具栏 / 显隐面板新增「动作」开关项（与 grid/nodeLabel/edgeLabel/robot/angle/device 并列），名称走 `t()`（D17）。
- 性能（D15）：Overlook / RecordPlayback 的 `enableOptimize=true` 时 ActionLayer 整体不渲染。

---

## 7. 交互（D9, D12）

| 画布 | 行为 |
|------|------|
| MapNestModify | 角标 `listening=true` 仅供 hover 弹 tooltip；角标命中区域用 `hitFunc` 限定为**圆形本体**（节点位于右上外侧、路径位于法线一侧，均不在元素本体或 `hitStrokeWidth` 上），点击角标无反应且**不影响节点/路径正常选中**（点元素本体照常选中）。 |
| Overlook | 角标 `listening=true`，hover 弹 tooltip；Layer 其余元素 `listening=false` 不受影响。 |
| RecordPlayback | 同 Overlook。 |

> **点击区域取舍（D12）**：角标需 `listening=true` 以 hover，但命中区域经 `hitFunc` 限定为角标圆形本体；角标位置（节点右上外侧 / 路径法线一侧）不与元素本体或 `hitStrokeWidth` 重叠，因此**不影响节点/路径正常选中**——点击元素本体照常选中，点击角标圆形本身无反应。本期不做「点击角标=选中归属元素」联动。

---

## 8. 边界情况

| 场景 | 处理 |
|------|------|
| `actions` 为 `null` / `undefined` / `[]` | 不绘制（`resolveActionSummary` 返回 `null`，D22） |
| 动作缺 `blockingType` 或值非法 | 按 `NONE` 参与严重度比较，不抛错 |
| 同一元素多个动作、阻塞等级混合 | 角标按最严重染色（D5），圆心显总数；tooltip 内每动作按各自 blockingType 显色点（§4.2） |
| 双向边中点重合 | 正反沿法线方向错开（D13），不合并、不叠放 |
| `actionType` / `actionDescription` 超长（maxLength 64） | 角标只显数字不受影响；tooltip 内自动换行 |
| `actionParameters` 为空 / 缺 key/value | tooltip 卡片不渲染参数区（复用 `transformActionsAttr` 已有的过滤逻辑） |
| 路径极短，角标与节点/设备图标重叠 | 仍绘制（接受重叠）；后续可加「长度阈值」隐藏，本期不做 |
| 地图整体旋转（stage.rotation） | 不影响——角标不旋转（D8），位置随 stage 变换矩阵自动跟随 |
| 复制元素（CopyModal） | `actions` 在 `…rest` 内，随节点/路径自动复制（D21） |
| 暗黑主题切换 | 更新 stage `isDark` attr 并重绘（命令式）/ 重传 props（声明式），复用设备规格机制 |
| `overlayVisible.actions=false` 或 `enableOptimize` | ActionLayer 不渲染 |
| 声明式画布节点 actions 链路 | 已确认：`mountGraphNodes` 经 `…rest` 保留 actions（§1.2），无需补字段 |

---

## 9. 涉及文件清单

### 新增
- `src/plugins/konva/actions/index.ts`
- `src/plugins/konva/actions/actionStyles.ts`
- `src/plugins/konva/actions/actionBadgeSceneFunc.ts`
- `src/plugins/konva/actions/ActionTooltip.tsx`
- `src/pages/MapThrough/MapNestModify/NestGraph/GraphStage/ActionLayer/index.tsx`
- `src/pages/Overlook/ForceGraph/GraphStage/ActionLayer/index.tsx`
- `src/pages/RecordPlayback/components/KonvaRender/ActionLayer/index.tsx`

### 修改
- `src/utils/math.ts`：`computeEdgeTangentAngle`（设备规格已新增，直接复用）
- `src/types/OverLook/index.d.ts`：`OverlayVisible` 增 `actions`
- `OverlayVisible` 所有初值处（`RecordPlayback/index.tsx` / `MapNestModify/NestGraph/index.tsx` / `Overlook/ForceGraph/index.tsx`）：补 `actions: false`
- 显隐开关 UI（工具栏/面板）：新增「动作」开关（名称 `t()`）
- `src/locales/{zh-CN,en-US,ja-JP,ko-KR,zh-TW}.json`：新增「动作」开关 i18n key
- `src/plugins/konva/runtime/constants.ts`：`MAP_NEST_STAGE_ATTR` 的 `isDark`（设备规格已新增，复用）
- 三处 `GraphStage` / `KonvaRender`：挂载 ActionLayer、传 `isDark`、接入 hover → ActionTooltip（三个画布的 `useLocalStorageState("theme")` 设备规格已引入，复用）

### 不修改
- `src/api/*`（数据流无需改动）
- 动作编辑面板 `Actions/index.tsx`（编辑能力已具备，本期只做展示）
- WebSocket provider（本期不接实时状态）
- `src/constants` 的 `blockingOptions`（D17 显原文枚举，不新增翻译常量）

---

## 10. 不在范围内

- 按 `actionType` 区分图标（D1，actionType 为动态自由文本，不做图标映射）。
- 实时动作执行状态展示（如「正在执行/已完成」）。
- 点击角标选中归属元素（D12 备选，本期不做）。
- tooltip 内编辑动作（只读详情，编辑仍走属性面板 `Actions`）。
- 角标自身跟随路径旋转（D8 不旋转）。

---

## 11. 验收清单

- [ ] 三画布均能为有动作的节点 / 路径渲染角标（染色圆 + 内嵌数字）。
- [ ] 角标颜色 = 该元素最严重 blockingType（HARD 红 / SOFT 黄 / NONE 灰），圆心数字 = 动作总数。
- [ ] 节点角标在右上角；路径角标在中点下方、正反沿法线错开不重叠。
- [ ] 角标不旋转，数字始终正立；缩放时随 `visualScale` 自适应。
- [ ] hover 角标弹出 HTML tooltip，每动作一卡（类型 + 阻塞色点 + 描述 + 参数表）。
- [ ] `blockingType` 显原文枚举；开关名正确走多语言。
- [ ] `overlayVisible.actions` 开关可独立控制显隐；`enableOptimize` 时角标不渲染。
- [ ] MapNestModify 中拖动节点/路径、改 actions 属性后角标正确刷新（D23）。
- [ ] 节点/路径选中时角标联动高亮。
- [ ] 零动作元素不绘制；动作缺 blockingType 不报错。
- [ ] CopyModal 复制节点/路径后 actions 存在、角标正常显示。
- [ ] 明/暗主题切换后角标颜色正确刷新。
- [ ] 双向路径正反各一角标，错开不重叠。

---

## 12. 风险与权衡

- **HTML overlay tooltip 的坐标转换**：三画布需各自把画布坐标转屏幕坐标（含 stage 缩放/平移），是主要新增复杂度。建议抽一个 `stageToScreen(stage, canvasX, canvasY)` 工具三画布共用；注意 stage 容器滚动/缩放变化时浮层跟随。
- **`listening=true` 的体验代价（D12）**：角标拦截点击，点击角标「无反应」可能困扰用户。备选方案：点击角标触发归属元素选中（命令式调选中逻辑 / 声明式 onSelect），但需桥接三画布各自的选中机制，本期暂不做，留作后续优化。
- **命令式刷新接入点（D23）**：与设备 `refreshDeviceIcons` 同一教训——漏接任一编辑点（拖动/改属性/改 name/缩放/主题）都会导致角标位置或内容滞后。建议复用设备图层已有的刷新调用点，在其旁并列调用 `refreshActionBadges`。
- ~~声明式 node actions 链路未确认~~ **（已核实消除）**：`mountGraphNodes` 经 `…rest` 保留 actions（§1.2），edge / node 链路均已与设备规格同源确认，无不确定性。
- **角标与设备图标/标签的三方布局**：路径上可能同时存在 name 标签（中点，设备规格已让位上移）、设备图标（法线侧）、动作角标（中点下方 + 法线错开）。采用统一 `ACTION_OFFSET` 常量族解耦（D16），但实测时需确认三者不重叠，必要时微调常量。
- **暗黑主题复用设备规格基础设施**：D18 复用设备规格**已落地**的 `isDark` 机制（`MAP_NEST_STAGE_ATTR.isDark` + 三画布 `useLocalStorageState("theme")` + `devices` 模块均已合入）。动作零额外主题成本，直接复用。
- **tooltip 浮层性能**：同一时刻只渲染一个浮层，性能无压力。
- **角标 `listening=true` 的性能开销**：大地图下每个有动作的节点/边挂一个 `listening=true` 的 Shape 会增加事件节点数；声明式画布由 `enableOptimize` 隐藏缓解，**命令式画布（MapNestModify）本期暂不考虑**该开销——若大地图场景出现性能问题，后续再优化（如按视口裁剪 / hit 区域收窄）。
