# SPEC：调度监控 / 录制回放展示独占区与三方交管区域高亮

> 状态：已定稿（访谈完成，四轮）　|　日期：2026-09-09　|　分支：1.0.0
>
> 修订：2026-09-09 严格审核后修正——§4.1 聚焦函数拆分（新增 getAreaFocusPosition 纯计算）、
> §4.4 聚焦坐标口径与公式纠错、D7 边箭头表述、§6 文件清单补 memoFn.ts / playbackTypings、
> isLoading 期间聚焦跳过、§2.1 类型摘录与 playbackTypings 可选性。
>
> 目标：在**调度监控**（`src/pages/Overlook`）与**录制回放**（`src/pages/RecordPlayback`）两个画布上展示地图资源的独占区（`SINGLE_VEHICLE`）与三方交管区（`TRIPARTITE_TRAFFIC`），用户可按区域控制高亮（染色），视觉语义与编辑器一致。
>
> 关系：复用 [SPEC_area_highlight_member_reconcile.md](SPEC_area_highlight_member_reconcile.md) 确立的高亮语义（`highlightColorMap` 混色模型）与 [SPEC_edge_attribute_color_toggle.md](SPEC_edge_attribute_color_toggle.md) 确立的两页开关/状态传递惯例（Overlook stage attr、RecordPlayback prop 闭包）。**编辑器（MapNestModify）代码本次不改动**。

---

## 0. 决策汇总（访谈结论速查）

| # | 议题 | 决策 |
|---|------|------|
| D1 | 面板形态 | **轻量 Popover 面板**——两页各加一个「区域」入口，点开 Popover：按类型分两组的只读区域列表，行 = 色点 + 名称 + 成员数 + 高亮勾选 |
| D2 | 高亮保留 | **面板收起后高亮保留**——面板只是开关载体，与编辑器「关抽屉清空高亮」不同；取消高亮随时可再开面板操作 |
| D3 | 相机聚焦 | **Overlook 勾选时平移聚焦到区域**（同编辑器）；**RecordPlayback 锁定车辆（跟随中）时跳过聚焦**，仅高亮，未锁定时才平移 |
| D4 | 着色机制 | **声明式渲染时派生**——不改 shape attrs；高亮颜色索引随 props 下传，sceneFunc 每次绘制时查表覆盖颜色。天然抗「回放页每次查询卸载重建 KonvaRender」「Overlook 换图重建 shape」 |
| D5 | 颜色优先级 | **区域高亮 > 属性着色**——路径同时在区域内且命中避障/分组属性着色时，显示区域混色；属性着色开关行为不变 |
| D6 | 代码复用 | **抽共享模块**——调色板、getAreaColor、类型过滤、shapeId→混色索引、聚焦工具收进 `src/utils/areaHighlight.ts`；编辑器两份 Drawer 代码不动（后续可选去重） |
| D7 | 视觉语义 | **同编辑器：节点 fill + 路径 stroke + 标签 labelFill 三处混色覆盖**（节点 stroke 不动 → 节点朝向箭头保持原色；边公共箭头与路径共用同一 stroke，随高亮一起变色——与编辑器 edgeSceneFunc 行为一致，非遗漏） |
| D8 | 回放数据版本 | **接受局限 + 提示**——普通查询用 getMapInfo（当前配置），历史回放用 getImportMapInfo（导入快照），不做事刻对齐；回放页面板内固定文案提示「区域为当前地图配置，可能与录制时刻不一致」 |
| D9 | 换图后状态 | **换图 / 重新查询时清空高亮集合**——两页区域列表随新地图刷新，不同地图 areaId 互不相通 |
| D10 | 默认态与持久化 | **默认全部不高亮、不记忆**——与现有 overlayVisible 所有开关不持久化的惯例一致，刷新回干净视图 |
| D11 | 概念定位 | **与「隐藏所有交管信息」完全独立**——该开关控制实时交管路径（申请中/已锁定多边形），本功能展示的是地图区域配置，互不影响、不受其门控 |
| D12 | 回放页入口 | **TopBar 右侧视图工具组新增独立图标按钮**，点击弹出区域 Popover |
| D13 | 面板分组 | **按类型分两组**（独占区 / 三方交管），与数据结构和编辑器两抽屉心智模型一致 |
| D14 | 脏数据容错 | **静默容错**——成员 id 引用不到 shape、区域成员为空均静默跳过，不告警不提示 |
| D15 | 暗黑主题 | **固定调色板不适配**——与编辑器行为一致，跨页面颜色一致性优先 |

### 0.1 面板行内控件（实现细节，沿用惯例）

- 高亮开关用 **Checkbox**（与编辑器 CollapseExtra 的高亮勾选一致），不引入 Switch 新控件。
- Popover 宽约 264px，两组各自小标题 + 列表；区域多时列表内部滚动（max-height 约 50vh）。

---

## 1. 背景与目标

### 1.1 现有能力（编辑器）

MapNestModify 编辑器的「区域」下拉 → 两个配置抽屉（`ExclusiveDrawer` / `TrafficDrawer`），支持增删区域、编辑名称、增删成员（`NodeEdgeGroup.nodeIds` / `edgeIds`），并提供**高亮**：把区域成员在画布上染色（节点 fill、路径 stroke、标签 labelFill），多区域叠加时 `blendColors` RGB 均值混色。颜色由 areaId 哈希在两套各自独立的调色板中取得（独占区 / 三方交管调色板不同，有意区分）。

编辑器高亮是**命令式**实现：写 shape attrs（`highlightColorMap` / `originalColors` / 改写 `shapeStyle`）+ `batchDraw`，共享工具在 `src/utils/areaHighlight.ts`。

### 1.2 问题

监控侧两个页面完全看不到区域配置：

1. **调度监控**：值班人员看不到哪些站点 / 路径属于独占区或三方交管区，难以理解车辆为什么在某些路径前等待、排队。
2. **录制回放**：复盘事故 / 异常时看不到区域边界，无法直观判断「这辆车当时是不是被三方交管挡住了」。

### 1.3 目标

- 两个页面新增只读的**区域面板**（Popover），展示当前地图的全部独占区与三方交管区。
- 每个区域可独立勾选高亮；多选混色语义与编辑器一致。
- 高亮是纯查看能力：不提供任何编辑入口。

---

## 2. 现状回顾（实现基线，已核实源码）

### 2.1 数据链路

- 区域数据是地图资源的一部分：`getMapInfo({ mapId })` → `res.data.mapJson.nodeEdgeGroups: NodeEdgeGroup[]`。
  - `NodeEdgeGroup = { id, name, edgeIds: string[], nodeIds: string[], userDefinedProperties?: { nodeEdgeGroupType } }`（`userDefinedProperties` 实际声明为可选索引签名，见 `src/types/MapNestModify/index.d.ts`；`nodeEdgeGroupType` 为运行时由编辑器写入的字段）；
  - `nodeEdgeGroupType`: `"SINGLE_VEHICLE"`（独占区）| `"TRIPARTITE_TRAFFIC"`（三方交管）。
- **Overlook**：`GraphStage/index.tsx` 的加载 effect 调 `getMapInfo`，目前只解构 `{ nodes, edges }`——`nodeEdgeGroups` 就在同一个 `mapJson` 里，无需新增请求。
- **RecordPlayback**：
  - 普通查询：`TopBar.handleQuery / handleMapChange` 调 `getMapInfo` → `setMapData(res.data)`；
  - 历史回放：`TopBar.handleHistorySelect` 调 `getImportMapInfo({ id })` → `setMapData(...)`（地图快照来自导入文件）；
  - `mapData.mapJson` 在 `KonvaRender` 中解构 `{ nodes, edges }`；`PlaybackTypings` 的 `MapJson` 已声明 `nodeEdgeGroups` 字段。
- ⚠️ **类型债务（同 edge_attribute_color_toggle §1.2 的处理方式）**：`src/utils/typing.d.ts` 的 `MapJson` 未声明 `nodeEdgeGroups`。后端实际返回该字段（编辑器已在消费）。评估数据链路以真实响应为准；本次顺带在该接口补上可选类型声明（运行时无影响）。另：`src/types/playbackTypings/index.d.ts` 的 `MapJson.nodeEdgeGroups` 现为**非可选**声明，与「旧导入文件可能缺该字段」（§5）不符，本次顺带改为可选（运行时无影响）。

### 2.2 两个监控页的渲染基线（与编辑器的关键差异）

| 维度 | Overlook | RecordPlayback | 编辑器（参照） |
|------|----------|----------------|----------------|
| 渲染方式 | 声明式 react-konva（`NodesLayer` / `EdgesLayer`） | 声明式 react-konva（`MapNodeLayer` / `MapEdgeLayer`） | 命令式创建 shape |
| sceneFunc 取色 | 直读 `shape.attrs.shapeStyle`；边 stroke 经 `getEdgeStrokeColor(data, stroke, edgeColorVisible)`（stage attr 门控） | 同左（`edgeColorVisible` 由组件体内从 `overlayVisible` 派生，闭包直读） | 直读 `shapeStyle` |
| shape id | `id={node.id}` / `id={edge.id}`，`enableSelect="node"/"edge"`，`Layer listening={false}` | 同左 | 同左 |
| 开关状态惯例 | `overlayVisible` state → `useEffect` 写 stage attr（`edgeColorVisible` 先例） | `overlayVisible` prop 逐层下传，闭包直读 | 组件内 state |
| **stage 生命周期** | 换图时 `setNodes/setEdges` 重建全部 shape | **每次查询 `isLoading` 期间整个 `KonvaRender` 卸载**（`!isLoading && mapData && <KonvaRender/>`），重建 Stage | 常驻 |
| 相机 | stage 自持变换（draggable / wheel / fit） | `scale` / `position` 为受控 React state；有「锁定车辆」跟随 lerp 动画；`RotateMap` 可设 rotation | stage 自持变换 |

> ⚠️ 上述两条**stage 生命周期**特征是 D4（声明式派生）的直接依据：命令式写在 shape 上的高亮在回放页每次查询后必然丢失，需要额外「重建后重放」同步代码；声明式查表则天然随重建恢复。

### 2.3 易混淆概念

两页「展示」菜单 / TopBar 眼睛菜单里已有「**隐藏所有交管信息**」（`overlayVisible.traffic`）开关，控制的是 `RobotLayer/TrafficGroup` 渲染的**系统实时交管路径**（申请中 / 已锁定的多边形，来自运行时状态）。它与本次要展示的「三方交管**区域配置**」（静态地图资源）是两个东西。本次不改动该开关，新功能完全独立（D11）。

---

## 3. 需求详述

### 3.1 用户故事

> 作为调度值班员（Overlook），我希望：
> - 打开「区域」面板，看到当前地图有哪些独占区、三方交管区，各含多少节点 / 路径；
> - 勾选某个区域 → 画布上它的成员立即染色，画布平移到该区域，我能一眼看出边界；
> - 收起面板后染色仍在，方便我边看车辆边对照区域；取消勾选立即褪色。

> 作为复盘人员（RecordPlayback），我希望：
> - 回放时打开「区域」面板，勾选可疑区域，对照车辆轨迹判断它当时是否处于独占区 / 三方交管区；
> - 锁定车辆跟随时勾选区域，镜头不要突然跳走；
> - 面板能提醒我：区域显示的是当前配置，未必是录制时刻的配置。

### 3.2 功能边界

- **只读**：不提供新增 / 改名 / 增删成员入口。
- **不改编辑器**：MapNestModify 的交互、保存、撤销行为零变化。
- **不持久化**：高亮勾选不写 localStorage。
- **导出 / 导入链路零感知**：导出录制文件内容不受高亮影响；导入流程不需要改动（面板数据随 `getImportMapInfo` 自然获得）。

---

## 4. 技术实现方案

### 4.1 共享模块：扩展 `src/utils/areaHighlight.ts`（D6）

在现有文件（`blendColors` / `removeAreaHighlightFromShape`）内追加**纯函数**，不改动既有两个导出：

```ts
import type { NodeEdgeGroup } from "@/types/MapNestModify";

/** 独占区调色板（值与 ExclusiveDrawer.AREA_COLORS 一致，后续可选让 Drawer 改为引用此处） */
export const EXCLUSIVE_AREA_COLORS: string[] = [ /* 12 色，拷贝自 ExclusiveDrawer */ ];
/** 三方交管调色板（值与 TrafficDrawer.AREA_COLORS 一致） */
export const TRAFFIC_AREA_COLORS: string[] = [ /* 12 色，拷贝自 TrafficDrawer */ ];

/**
 * 按 areaId 哈希取色（h*31+c 累积 >>> 0，取模调色板长度）。
 * 与两个 Drawer 内的 getAreaColor 实现逐行一致，保证同一区域跨页面颜色相同。
 */
export function getAreaColor(id: string, palette: string[]): string;

/**
 * 按 nodeEdgeGroupType 把 nodeEdgeGroups 拆成两组。
 * 容错：groups 为 undefined/null 返回两组空数组；缺 userDefinedProperties 或
 * nodeEdgeGroupType 未知的分组被忽略（不归入任何一组）。
 */
export function splitNodeEdgeGroups(groups?: NodeEdgeGroup[]): {
    exclusiveGroups: NodeEdgeGroup[];
    trafficGroups: NodeEdgeGroup[];
};

/**
 * 声明式高亮的核心：构建 shapeId → 混色 的索引。
 * 仅统计「高亮中」区域的成员；同一 shape 属于多个高亮区域时 blendColors 均值混色（对齐编辑器 D2 语义）。
 * 引用不到的成员 id 不进索引（D14 静默容错——索引本就不校验 shape 存在性，查不到即不亮）。
 */
export function buildAreaColorIndex(
    groups: NodeEdgeGroup[],
    highlightedIds: Set<string>,
): Map<string, string>;

/**
 * 计算聚焦某区域时 stage 应处的 position（纯计算，不改 stage 状态）。
 * 遍历顺序与编辑器一致（nodeIds → edgeIds），取第一个 stage.findOne 命中的成员 shape；
 * 坐标取 shape.attrs.x / attrs.y（mountGraphNodes 已做 y: -y 翻转，此即 shape attrs 口径），
 * 边 shape 无 x/y 属性，回退 data.labelX / labelY（编辑器 ExclusiveDrawer 既有兜底，两处同口径）；
 * 经 calcStagePosition（传入 stage.rotation()，兼容 translate/rotate/scale）换算为
 * 「成员居中于画布中心」的 stage position。
 * 区域无任何可见成员（stage 未挂载 / 成员 id 全部引用不到）返回 null，调用方跳过聚焦。
 */
export function getAreaFocusPosition(
    stage: Konva.Stage,
    group: NodeEdgeGroup,
): { x: number; y: number } | null;

/**
 * Overlook 用聚焦（D3）：getAreaFocusPosition + stage.to({ duration: 0.3 }) 平移。
 * 返回是否实际聚焦（无可见成员返回 false）。
 * 编辑器 Drawer 不改（其内联实现保持原样）。
 */
export function focusStageToArea(stage: Konva.Stage, group: NodeEdgeGroup): boolean;

/** RecordPlayback 用受控变体（§4.4）：getAreaFocusPosition 后 setPosition(pos)，不调 stage.to。 */
```

设计要点：

- **调色板拷贝而非搬运**：两个 Drawer 内的 `AREA_COLORS` / `getAreaColor` 保持原样（触碰编辑器已验证代码的回归风险不为本次取），共享模块持有同值副本。**哈希算法与调色板值一致 ⇒ 同一 areaId 在编辑器与监控页必然同色**，这是跨页面视觉一致性的关键。后续可另开小改动让 Drawer 引用共享模块去重（不在本次范围）。
- `buildAreaColorIndex` 是纯函数且输出不可变约定（每次新建 Map），供调用方 `useMemo`。

### 4.2 高亮覆盖规则（D5 / D7，两页 sceneFunc 同构）

节点（NodesLayer / MapNodeLayer 的 sceneFunc）：

```ts
// sceneFunc 内，取色后：
const areaColor = areaColorIndex.get(shape.id());          // Map<shapeId, 混色>
const fill = areaColor ?? fill;                            // 节点圆填充
const labelFill = areaColor ?? labelFill;                  // 标签填充（仍受 nodeLabelVisible 门控）
// stroke 不动（对齐编辑器：节点 stroke 不参与高亮；节点朝向箭头以 stroke 绘制，随其保持原色）
```

路径（EdgesLayer / MapEdgeLayer 的 sceneFunc）：

```ts
const areaColor = areaColorIndex.get(shape.id());
// 区域高亮 > 属性着色（D5）：命中区域高亮时短路，不再走 getEdgeStrokeColor
const strokeStyle = areaColor ?? getEdgeStrokeColor(data, stroke, edgeColorVisible);
context.strokeStyle = strokeStyle;
// 注意：边公共箭头与路径画在同一条 stroke 路径中（arrowPoints moveTo/lineTo 后统一 stroke），
// 覆盖 strokeStyle 后边箭头随高亮一起变色——与编辑器 edgeSceneFunc 行为一致（D7），非遗漏
// 标签 labelFill 同节点规则覆盖（仍受 edgeLabelVisible 门控）
```

> 覆盖发生在 sceneFunc **读值之后、绘制之前**，不写回 `shapeStyle` attrs——`mountNodes` / `mountEdges` 的原始数据保持纯净，无需 `originalColors` 备份 / 还原机制（整套对账逻辑在监控页不存在）。

### 4.3 调度监控（Overlook）

数据与状态流：

```
GraphStage(加载 getMapInfo)
  ├─ 新增 props { areaGroups, highlightedAreaIds }（ForceGraph 下发）+ onNodeEdgeGroupsLoaded 回调
  ├─ 数据到达时 onNodeEdgeGroupsLoaded(groups) 上抛 ──→ ForceGraph（区域数据唯一持有方）
  │        ForceGraph: setAreaGroups(groups) + setHighlightedAreaIds(空)（换图清空，D9）
  │        （GraphStage 不自持 nodeEdgeGroups 副本，避免双份状态；onNodeEdgeGroupsLoaded
  │          与下述 onToggleHighlight 均用 useCallback 稳定引用）
  │        ⚠️ propsForceGraphIsEqual（src/utils/memoFn.ts）逐字段追加上述两个 prop 的判断
  │           （文件头注释既有约定），漏加则勾选高亮被 memo 拦截、静默失效（TS 不报错）
  └─ useMemo: areaColorIndex = buildAreaColorIndex(areaGroups, highlightedAreaIds)
       ├─→ NodesLayer 新 prop areaColorIndex
       └─→ EdgesLayer 新 prop areaColorIndex
ForceGraph
  ├─ state { areaGroups, highlightedAreaIds } + onToggleHighlight(id, checked)（实现在 ForceGraph）
  └─→ GraphMenu 新 props { stage（已有）, areaGroups(exclusive+traffic), highlightedAreaIds, onToggleHighlight }
```

- **面板入口**：`GraphMenu` 菜单新增一项（icon 建议 `BlockOutlined`，label「区域」），点击开合 Popover（`onMouseEnter/Leave` 悬停开合与其它项一致）。
- **勾选回调**（`onToggleHighlight(id, checked)`，实现在 ForceGraph——它持有高亮集合，GraphMenu 只透传）：
  1. 更新 `highlightedAreaIds`（Set 不可变更新）；
  2. `checked === true` 时调 `focusStageToArea(stage, group)` 聚焦（D3，Overlook 无条件聚焦）。
- 高亮集合变化 → `areaColorIndex` 重算 → 两层 memo 因新 prop 重渲染 → Konva 重绘。无需手动 `batchDraw`（react-konva 的 applyNodeProps 对任意 prop 变化都会 setAttrs + 重绘，已核实 18.2.10 源码）。

### 4.4 录制回放（RecordPlayback）

数据与状态流：

```
index.tsx
  ├─ mapData.mapJson.nodeEdgeGroups → useMemo + splitNodeEdgeGroups → { exclusiveGroups, trafficGroups }
  ├─ state highlightedAreaIds
  ├─ useEffect [mapData]: setHighlightedAreaIds(空)（重新查询/切换地图/历史回放都会 setMapData 新引用 → 清空，D9）
  ├─ onToggleHighlight(id, checked)（实现在 index.tsx）：
  │     1. 更新 highlightedAreaIds
  │     2. checked && !selectedVehicle 时聚焦（D3）——focusStageToArea 的受控变体：
  │        const pos = getAreaFocusPosition(stage, group);  // 共享纯计算，含 rotation
  │        pos && setPosition(pos);                          // 不调 stage.to
  │        ⚠️ 坐标口径：getAreaFocusPosition 取 shape attrs（mountGraphNodes 已 y: -y 翻转）。
  │           不可仿照跟随动画手写 y: h/2 + wy*scale——那是 KonvaRender followTargetRef
  │           用帧数据未翻转坐标（agvPosition）的口径，与 attrs 口径差一个符号，
  │           混用会聚焦到 y 轴镜像位置
  │        ⚠️ 不做动画：scale/position 是受控 state，stage.to 会与 React 重渲染和
  │           锁定跟随 lerp 动画互相拉扯；一步到位最稳
  │        ⚠️ isLoading 期间 KonvaRender 卸载、stage 已销毁：getAreaFocusPosition 返回
  │           null 自动跳过（index.tsx 的 stage state 仅在 mapData 为 null 时清空，
  │           查询中仍持旧实例，不得对其调用 stage.to）
  ├─ TopBar 新 props：exclusiveGroups / trafficGroups / highlightedAreaIds / onToggleHighlight
  └─ KonvaRender 新 prop：highlightedAreaIds（nodeEdgeGroups 直接自 mapData.mapJson 解构，不新增冗余 prop）
       └─ useMemo: areaColorIndex → MapNodeLayer / MapEdgeLayer 新 prop areaColorIndex
```

- **面板入口**（D12）：TopBar 右侧视图工具组（眼睛 / 放大 / 缩小 / RotateMap / 全屏之间）新增图标按钮 + Popover，**必须 `getPopupContainer={getPopupContainer}`**（TopBar 既有 prop）——原生全屏时挂在 body 的弹层不可见，这是既有惯例非新约定。
- **版本提示**（D8）：Popover 底部固定一行次要文案：`区域为当前地图配置，可能与录制时刻不一致`。
- **isLoading 期间**：KonvaRender 卸载、面板仍可操作（勾选只改集合）；重建后 sceneFunc 按新 props 绘制，高亮自动恢复——声明式方案的核心收益。
- **锁定车辆跟随**（D3）：`selectedVehicle` 非空（跟随中）时勾选跳过聚焦；未锁定时聚焦一次平移，不启用持续跟随语义。

### 4.5 共享面板组件：`src/components/AreaHighlightPanel`（新增）

两页面板 UI 完全一致，抽为共享组件：

```tsx
interface AreaHighlightPanelProps {
    exclusiveGroups: NodeEdgeGroup[];
    trafficGroups: NodeEdgeGroup[];
    highlightedIds: Set<string>;
    onToggle: (areaId: string, checked: boolean) => void;
    /** 底部提示（RecordPlayback 传版本提示文案，Overlook 不传） */
    footerHint?: React.ReactNode;
}
```

结构（Popover 内容，宽约 264px）：

```
┌──────────────────────────────────┐
│ 独占区                            │
│ ● 独占区1   12节点/8路径   [✓]高亮 │
│ ● 独占区2    3节点/0路径   [ ]高亮 │
│ 三方交管                          │
│ ● 三方交管区域1  0节点/15路径 [ ]  │
│ ────────────────────────────────│
│ ⓘ 区域为当前地图配置，可能与录制时刻 │
│   不一致                          │  ← 仅回放页
└──────────────────────────────────┘
```

- 色点颜色 = `getAreaColor(area.id, 对应调色板)`，与画布染色一致，天然图例。
- 成员数格式 `N节点/M路径`。
- 空态：两组均为空时显示「当前地图未配置区域」。
- 单组为空时该组标题不渲染。

---

## 5. 边界与异常

| 场景 | 行为 |
|------|------|
| 地图未配置任何区域（`nodeEdgeGroups` 为空 / undefined） | 面板显示空态文案；入口按钮不禁用（点开看到空态比无响应好） |
| 区域成员为空（0 节点 0 路径） | 可勾选、计数显示 0/0，画布无变化（D14 静默） |
| 成员 id 引用不到当前地图 shape（脏数据） | 索引查不到该 shape，静默跳过（D14）；聚焦时跳过不存在的成员找下一个 |
| 同一节点 / 路径属多个高亮区域 | `blendColors` 均值混色（对齐编辑器 D2 语义） |
| 独占区 + 三方交管同时高亮同一 shape | 正常混色——索引按 areaId 无关类型，跨类型天然叠加 |
| 勾选高亮 + 路径属性着色同时命中 | 显示区域混色，属性着色被短路（D5）；关闭该区域高亮后属性着色立即恢复可见 |
| Overlook 切换地图 | 区域列表刷新 + 高亮集合清空（D9）；面板开着也无残留 |
| RecordPlayback 重新查询 / 切换地图 / 选择历史回放 | 同上（三者都会 `setMapData` 新引用） |
| 历史回放的导入文件缺 `nodeEdgeGroups`（旧文件） | `splitNodeEdgeGroups(undefined)` → 空数组 → 面板空态，无报错 |
| RecordPlayback 查询中（isLoading，KonvaRender 已卸载） | 面板可勾选；聚焦因 stage 不可用被跳过（getAreaFocusPosition 返回 null）；重建后高亮随 props 自动生效 |
| 锁定车辆跟随时勾选区域 | 仅染色，不平移（D3）；取消锁定后再勾选其它区域可聚焦 |
| RecordPlayback 处于旋转状态（RotateMap，rotation ≠ 0）时勾选聚焦 | getAreaFocusPosition 经 calcStagePosition 计入 rotation，落点正确；不可手写无旋转公式 |
| 聚焦目标第一个可见成员是路径（边 shape 无 attrs.x/y） | 坐标回退 data.labelX / labelY（编辑器同口径） |
| Overlook 画布全屏（pageFullscreen） / 回放页原生全屏 | 回放页 Popover 经 `getPopupContainer` 挂画布容器正常显示；Overlook 伪全屏不动 DOM，默认挂载即可用 |
| 路径 / 节点标签被隐藏（edgeLabel / nodeLabel 关） | labelFill 覆盖随标签一起不渲染，无副作用 |
| 高亮状态与 `overlayVisible.traffic`（实时交管） | 互不影响（D11） |
| 暗黑主题 | 调色板固定 hex，不随主题变化（D15） |
| 刷新页面 | 高亮全关（D10 不持久化） |

---

## 6. 涉及文件清单

### 新增（2 个）

| 文件 | 内容 |
|------|------|
| `src/components/AreaHighlightPanel/index.tsx` | 共享只读区域面板（§4.5） |
| `src/components/AreaHighlightPanel/index.less`（如需） | 面板样式；若纯行内样式可省略 |

### 修改（14 个）

| 文件 | 改动 |
|------|------|
| `src/utils/areaHighlight.ts` | 追加调色板常量、`getAreaColor(id, palette)`、`splitNodeEdgeGroups`、`buildAreaColorIndex`、`getAreaFocusPosition`、`focusStageToArea`（§4.1）；既有两个导出不动 |
| `src/utils/typing.d.ts` | `MapJson` 补可选声明 `nodeEdgeGroups?: import("@/types/MapNestModify").NodeEdgeGroup[]`（类型债务，运行时无影响） |
| `src/types/playbackTypings/index.d.ts` | `MapJson.nodeEdgeGroups` 由非可选改为可选 `nodeEdgeGroups?: NodeEdgeGroup[]`（对齐「旧导入文件可能缺字段」，运行时无影响） |
| `src/utils/memoFn.ts` | `propsForceGraphIsEqual` 逐字段追加 `areaGroups` / `highlightedAreaIds` 判断（GraphStage 新 props；漏加则勾选高亮静默失效，§9） |
| `src/pages/Overlook/ForceGraph/GraphStage/index.tsx` | 新增 `areaGroups` / `highlightedAreaIds` props 与 `onNodeEdgeGroupsLoaded` 回调；useMemo 构建 `areaColorIndex` 下发两层（不自持区域数据副本） |
| `src/pages/Overlook/ForceGraph/GraphStage/NodesLayer/index.tsx` | 新 prop `areaColorIndex`；sceneFunc 内 fill / labelFill 覆盖（§4.2） |
| `src/pages/Overlook/ForceGraph/GraphStage/EdgesLayer/index.tsx` | 同上；strokeStyle 改为 `areaColor ?? getEdgeStrokeColor(...)` |
| `src/pages/Overlook/ForceGraph/index.tsx` | 区域数据唯一持有方：新增 `areaGroups` / `highlightedAreaIds` state 与勾选回调 `onToggleHighlight`（含聚焦）；接收 GraphStage 上抛 + 下发 GraphMenu / GraphStage |
| `src/pages/Overlook/ForceGraph/GraphMenu/index.tsx` | 菜单新增「区域」项 + Popover 挂 `AreaHighlightPanel` |
| `src/pages/RecordPlayback/index.tsx` | 提取分组数据、`highlightedAreaIds` state、`[mapData]` 清空、勾选回调（受控聚焦 + 锁定 / stage 可用判断）；下发 TopBar / KonvaRender |
| `src/pages/RecordPlayback/components/TopBar/index.tsx` | 右侧工具组新增图标按钮 + Popover（`getPopupContainer`），挂 `AreaHighlightPanel`（含版本提示 footerHint） |
| `src/pages/RecordPlayback/components/KonvaRender/index.tsx` | 新 prop `highlightedAreaIds`；`nodeEdgeGroups` 直接自 `mapData.mapJson` 解构（不新增冗余 prop）；useMemo 构建 `areaColorIndex` 下发两层 |
| `src/pages/RecordPlayback/components/KonvaRender/MapNodeLayer/index.tsx` | 新 prop `areaColorIndex`；sceneFunc 覆盖 fill / labelFill |
| `src/pages/RecordPlayback/components/KonvaRender/MapEdgeLayer/index.tsx` | 同 Overlook EdgesLayer |

### 不修改

- `src/pages/MapThrough/**`（编辑器全部，包括两个 Drawer 的调色板 / `getAreaColor` / 高亮逻辑）
- `src/api/*`（数据链路已通，无新请求）
- `src/utils/graph.ts`（`mountGraphNodes` / `mountGraphEdges` 不变——高亮不写 shape attrs）
- `src/types/OverLook`（`OverlayVisible` **不加字段**——区域高亮不是 overlay，是独立 state，避免塞进「隐藏 = 勾选」语义的既有模型）
- 展示菜单 / 眼睛菜单的既有项（含「隐藏所有交管信息」，D11）

> 注：Overlook 的 `overlayVisible` 走 stage attr 是因为它控制的是**绘制行为**；区域高亮走 React props 是因为它控制的是**数据派生**（索引 → props → 重渲染），两者管道不同，不应混用。

---

## 7. 验收清单

### Overlook

- [ ] 菜单出现「区域」入口，点开 Popover 显示独占区 / 三方交管两组列表，色点、名称、成员数正确。
- [ ] 勾选区域 → 成员节点 fill / 路径 stroke / 可见标签 labelFill 立即染色，画布 0.3s 平移到该区域；取消勾选立即恢复原色。
- [ ] 多选混色：同一 shape 属多个高亮区域时显示均值混色，与编辑器高亮同一区域颜色一致。
- [ ] 路径属性着色开关打开 + 勾选区域：被区域覆盖的路径显示区域色，其它有属性路径仍显示属性色；取消区域高亮后属性色恢复。
- [ ] 收起 Popover 后高亮保留；切图后列表刷新、高亮清空。
- [ ] 无区域地图：面板显示空态文案，画布无异常。
- [ ] `overlayVisible.traffic` 开关与区域高亮互不影响。
- [ ] `propsForceGraphIsEqual` 已包含 `areaGroups` / `highlightedAreaIds` 判断，勾选高亮能穿透 GraphStage 的 memo（防静默失效）。

### RecordPlayback

- [ ] TopBar 出现区域图标按钮，Popover 正常弹出；进入浏览器原生全屏后弹层仍可见。
- [ ] 勾选区域 → 染色生效；未锁定车辆时画布平移到区域；锁定车辆跟随时勾选不平移、跟随动画不受影响。
- [ ] 面板底部显示「区域为当前地图配置，可能与录制时刻不一致」。
- [ ] 重新查询 / 切换地图 / 选择历史回放后高亮清空、列表随新地图刷新。
- [ ] 查询加载中（KonvaRender 卸载）勾选不报错、聚焦被跳过；加载完成后高亮正确显示。
- [ ] RotateMap 旋转地图（rotation ≠ 0）后勾选区域，聚焦落点位于区域内（非镜像 / 偏移位置）。
- [ ] 历史回放选择旧导入文件（无 nodeEdgeGroups）时面板空态、无报错。
- [ ] 播放 / 拖动进度 / seek 全程染色稳定（帧更新不影响区域索引）。

### 通用

- [ ] 同一地图同一区域，编辑器高亮颜色与监控页一致（哈希 + 调色板同值）。
- [ ] 暗黑主题下功能正常，颜色不随主题变化。
- [ ] 刷新页面后高亮全关。
- [ ] 编辑器（MapNestModify）全部既有行为回归无变化。
- [ ] TypeScript 编译无错误（含 `MapJson` 类型补充）。

---

## 8. 不在范围内

- 编辑器代码去重（Drawer 改引共享调色板 / `getAreaColor`）——行为不变的独立小改动，后续可选。
- 区域成员的实时动态展示（如当前哪些车辆在区域内）——需要运行时车辆位置与区域求交，另立需求。
- 回放时刻区域快照（D8）——需后端在录制元数据 / 帧数据中携带版本化区域，另立需求。
- 高亮状态持久化（D10）、区域列表搜索 / 排序、导出录制文件携带区域信息。
- 「隐藏所有交管信息」改名或概念合并（D11 保持现状）。
- 展示菜单 / 眼睛菜单 i18n（既有文案均硬编码中文，保持一致）。

---

## 9. 风险与权衡

- **声明式 vs 命令式的取舍（D4）**：放弃与编辑器共用命令式高亮路径，换来「重建免同步」与两页同构。代价是共享模块中高亮语义存在两套实现形态（编辑器 attrs 对账 / 监控页索引派生）——`blendColors` 与混色语义是共享的锚点，跨页面颜色一致性由「同哈希 + 同调色板」保证。
- **调色板副本漂移风险（D6）**：共享模块与两个 Drawer 各持一份同值调色板，后续改色若只改一处会导致跨页面颜色不一致。缓解：共享模块与 Drawer 的 `AREA_COLORS` 处加注释互指；后续去重后风险消除。
- **GraphStage memo 比较函数**：GraphStage 新增 `areaGroups` / `highlightedAreaIds` props 后，若漏改 `src/utils/memoFn.ts` 的 `propsForceGraphIsEqual`（逐字段比较），勾选将不触发重渲染（静默失效，且 TypeScript 不报错）。已列入涉及文件清单与验收清单。
- **回放页聚焦不做动画**：受控 state + 跟随 lerp 两者并存，`stage.to` 动画会与 React 重渲染互相覆盖。一步到位牺牲过渡体验换确定性，访谈确认接受。聚焦换算复用 `calcStagePosition` 并传入 `stage.rotation()`，与跟随动画的手写 `+agvPosition.y` 公式（帧数据未翻转坐标口径）刻意区分，避免 y 轴镜像落点；代价是两套口径并存需靠 `getAreaFocusPosition` 统一收口——跟随动画本身不计 rotation 属既有局限，不在本次范围。
- **`buildAreaColorIndex` 重算频率**：仅勾选 / 数据变化时 O(全部高亮成员) 重算，sceneFunc 绘制期 O(1) 查表；大地图多区域勾选一次的开销与编辑器命令式上色同量级，非连续高频路径。
- **版本局限的用户沟通（D8）**：以面板常驻文案替代技术对齐，把「配置可能不一致」的判断权留给用户。若后续事故复盘对区域时点有强诉求，走「后端提供时刻快照」另立需求。
