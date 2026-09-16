# SPEC：车辆状态图例（画布右下角）

> 适用页面：调度监控 `src/pages/Overlook`、地图编辑器 `src/pages/MapThrough/MapNestModify`、录制回放 `src/pages/RecordPlayback`
> 参考实现：`c:\code\config\src\pages\TaskManagement\components\OrderFlowProgressModal\components\MapPanel\MapLegend.tsx`
> RecordPlayback 的 RobotLayer 直接复用 Overlook 的 RobotGroup 且共用同一 `transformTrafficInfo`，颜色逻辑三页完全一致，图例组件三页通用。

---

## 1. 背景与目标

三个画布（Overlook 监控、MapNestModify 编辑器、RecordPlayback 回放）都会渲染车辆，车体颜色表达车辆状态。但颜色语义只存在于代码里，用户看到一台紫色、粉色或黄色的车时，无从得知它代表什么状态。

**目标**：在三个画布右下角各放一个**车辆状态图例**，默认收起、点击展开，完整解释画布上所有与车辆相关的可见颜色与标识，让现场用户/操作员无需培训即可读懂车辆状态。三页共用同一图例组件。

---

## 2. 决策摘要（访谈结论）

| 维度 | 决策 |
|---|---|
| 展示范围 | **Overlook + 地图编辑器 + RecordPlayback** 三个画布（回放页复用 Overlook 的 RobotGroup + 同一 `transformTrafficInfo`，颜色逻辑零差异） |
| 图例条目 | **14 行 3 组**：状态 8 行 + 告警覆盖色 2 行 + 装饰标识 4 行 |
| 离线/断连 | **合并一行**「离线/连接中断」（画布上 CONNECTIONBROKEN 与 OFFLINE 同渲染为灰色 `#98A2B2`） |
| PAUSED 暂停色 | **不包含**。`robotProperty.robotFill.PAUSED`（青 `#38D2D2`）已定义但画布颜色映射从不使用（`src/utils/graph.ts:215` 只看 connectionState/vehicleProcStatus），图例只列画布真实会渲染的颜色 |
| 告警覆盖色 | **两行都加**（定位告警粉 / 错误告警黄），因为它们会盖掉车体状态色，普通状态条目无法解释 |
| 交互形式 | **默认收起，不记忆**。收起态为「车辆图例」文字按钮 + 箭头；刷新/切页后回到收起 |
| 开关形态 | **文字按钮**（参考实现同款），不用纯图标按钮 |
| 色块样式 | 状态条目：**填充+描边双色块**（贴近画布观感；异常 ERROR 填充 `#590016` 近黑，暗色主题下靠亮粉描边 `#F43563` 辨识）；装饰条目：**深灰底衬**（载货线/充电箭头为白色，白色面板上不可见） |
| 分组方式 | 三组之间用**细分隔线**，不加组标题（控制面板高度） |
| 实时计数 | **不做**（静态图例）。做计数需扩展 Overlook 车辆上报通道（现仅含 agvKey/agvName）并为编辑器新建通道 |
| 悬停联动高亮 | **不做**。需打通图例与 RobotLayer 渲染，改动面大，留作后续迭代 |
| 车辆图层隐藏时 | 图例**保持显示**（图例是颜色说明，与图层显隐无关） |
| 告警条目命名 | **定位告警 / 错误告警**（与代码 `localizationWarning` / `errorWarning` 对应） |

---

## 3. 现状梳理（车辆颜色逻辑）

### 3.1 颜色唯一来源

`src/utils/graph.ts` `transformTrafficInfo()`（三画布共用：Overlook 与编辑器由 WebSocket 推送驱动，RecordPlayback 由回放帧驱动，215–218 行）：

```ts
robotFill:   connectionState !== "ONLINE" ? robotProperty.robotFill.OFFLINE   : robotProperty.robotFill[vehicleProcStatus],
strokeStyle: connectionState !== "ONLINE" ? robotProperty.strokeStyle.OFFLINE : robotProperty.strokeStyle[vehicleProcStatus],
pathFill:    robotProperty.pathFill.OFFLINE,  // 恒白
vehicleProcStatus: connectionState !== "ONLINE" ? connectionState : vehicleProcStatus,
```

- 断连（OFFLINE / CONNECTIONBROKEN）时**统一渲染离线灰**，状态字段下传 connectionState。
- `paused` 字段下传但**不参与颜色计算**——暂停车仍显示其业务状态色。

### 3.2 色表（`src/plugins/konva/nodes/robot.ts`）

| 状态 | 填充 robotFill | 描边 strokeStyle | 画布是否可出现 |
|---|---|---|---|
| IDLE 空闲 | `#4299E1` | `#9BC8EC` | ✅ |
| TRAFFIC 交管 | `#9F7AEA` | `#C6B2EC` | ✅ |
| PROCESSING 执行中 | `#48BB78` | `#B1E5C7` | ✅ |
| CHARGE 充电 | `#C8C81A` | `#E7E700` | ✅ |
| AVOID 避障 | `#FBC02D` | `#CEB065` | ✅ |
| ERROR 异常 | `#590016` | `#F43563` | ✅ |
| BRAKE 抱闸 | `#FF0000` | `#EFB745` | ✅ |
| OFFLINE 离线（含 CONNECTIONBROKEN） | `#98A2B2` | `#98A2B2` | ✅ |
| PAUSED 暂停 | `#38D2D2` | `#1AC9C9` | ❌ 定义未用，不进图例 |

### 3.3 告警覆盖色（`src/hooks/useWarningBlink.ts` + sceneFunc）

sceneFunc 中的优先级链：`locWarningVisible ? 粉 : errorWarningVisible ? 黄 : robotFill`

| 告警 | 颜色 | 触发条件 |
|---|---|---|
| 定位告警 | `#FF1493` | `localizationScore < robotProperty.localizationWarning.threshold`（0.6） |
| 错误告警 | `#FFD600` | `errorEntryList` 存在 `errorLevel === "WARNING"` 条目，且当前状态**不在**高优先级列表（CHARGE/AVOID/ERROR/BRAKE/OFFLINE/CONNECTIONBROKEN） |

Overlook 与编辑器的 XcGroup/XpGroup 均使用同一 `useWarningBlink`；RecordPlayback 复用 Overlook 的 RobotGroup，告警逻辑三页完全一致。

### 3.4 装饰标识（sceneFunc 内绘制）

| 标识 | 颜色 | 触发条件 |
|---|---|---|
| 任务蓝点 | `#1677FF`（`robotProperty.order.fill`） | `orderTaskKey` 非空 |
| 载货线 | 白色（`robotProperty.load.stroke`） | `loaded === true` |
| 充电三角 | 白色（`pathFill`，恒白） | `vehicleProcStatus === "CHARGE"`（非充电时同位置为 L 形方向指示线） |
| 车头标记线 | `#FFFF00` | 恒有 |

---

## 4. 功能详述

### 4.1 图例条目（14 行，3 组，顺序即展示顺序）

**组 1 · 车辆状态**（色块 = 填充 + 描边双色，同画布结构）：

| # | 文案 key | fill | stroke |
|---|---|---|---|
| 1 | 空闲 | `#4299E1` | `#9BC8EC` |
| 2 | 交管 | `#9F7AEA` | `#C6B2EC` |
| 3 | 执行中 | `#48BB78` | `#B1E5C7` |
| 4 | 充电 | `#C8C81A` | `#E7E700` |
| 5 | 避障 | `#FBC02D` | `#CEB065` |
| 6 | 异常 | `#590016` | `#F43563` |
| 7 | 抱闸 | `#FF0000` | `#EFB745` |
| 8 | 离线/连接中断 | `#98A2B2` | `#98A2B2` |

**组 2 · 告警覆盖**（色块 = 纯色块，覆盖色无描边概念）：

| # | 文案 key | fill |
|---|---|---|
| 9 | 定位告警 | `#FF1493` |
| 10 | 错误告警 | `#FFD600` |

**组 3 · 装饰标识**（色块 = 深灰底衬上画对应图形）：

| # | 文案 key | 图形 |
|---|---|---|
| 11 | 有任务 | 蓝色圆点 `#1677FF`（无底衬） |
| 12 | 载货 | 深灰底衬 + 白色横线 |
| 13 | 充电标识 | 深灰底衬 + 白色实心三角 |
| 14 | 车头方向 | 深灰底衬 + 黄色竖线 `#FFFF00` |

### 4.2 交互行为

- **默认收起**：收起态只显示「车辆图例」文字按钮（右箭头图标）。
- 点击按钮 → 面板向**上**展开（按钮固定在右下角，面板在其上方），箭头变为向下；再次点击收起。
- **不持久化**：展开状态仅存在组件 state，刷新/切页后回到收起。
- 图例为纯静态展示：无实时计数、无悬停联动高亮、条目不可点击。
- 车辆图层被「显示元素」关闭（`overlayVisible.robot === false`）时，图例**保持显示**。
- 图例上的鼠标事件（click / mousedown / contextmenu / wheel）**不穿透**到画布：在图例上右键不得打开画布右键菜单，拖拽不得平移画布（对容器做事件阻断）。

### 4.3 位置与层级

- `position: absolute; right: 8px; bottom: 8px; z-index: 10`（与 GraphBar 同级；三画布右下角均已确认空闲：Overlook/编辑器 GraphBar 在左下、菜单在右上，回放页 ControlPanel 在画布下方的文档流中）。
- Overlook 的 Tooltip 为 `position: fixed; z-index: 110`，可短暂覆盖图例——可接受（瞬态浮层）。
- 编辑器右键菜单（ContextMenu，跟随鼠标的瞬态浮层）同理可覆盖图例。
- Overlook 右侧 PanelTabs 分栏拖拽改变画布宽度时，图例在容器内 absolute 自适应，无需额外处理。

---

## 5. UI 设计

### 5.1 布局示意

```
收起态（右下角）：
                                          ┌──────────────┐
                                          │ ▸ 车辆图例    │
                                          └──────────────┘

展开态（面板在按钮上方，向上生长）：
                              ┌──────────────────┐
                              │ ▪ 空闲            │
                              │ ▪ 交管            │
                              │ ▪ 执行中          │
                              │ ▪ 充电            │
                              │ ▪ 避障            │
                              │ ▪ 异常            │
                              │ ▪ 抱闸            │
                              │ ▪ 离线/连接中断    │
                              │ ─────────────── │
                              │ ▪ 定位告警        │
                              │ ▪ 错误告警        │
                              │ ─────────────── │
                              │ ● 有任务          │
                              │ ▬ 载货            │
                              │ ◀ 充电标识        │
                              │ ▎车头方向        │
                              └──────────────────┘
                                          ┌──────────────┐
                                          │ ▾ 车辆图例    │
                                          └──────────────┘
```

### 5.2 样式规格

| 项 | 规格 |
|---|---|
| 容器 | `display: flex; flex-direction: column; align-items: flex-end; gap: 4px` |
| 面板 | 圆角 6px、边框 1px、阴影 `0 2px 8px rgba(0,0,0,.08)`、内边距 `8px 10px`，行间距 4px |
| 面板高度兜底 | `max-height: calc(100% - 16px); overflow: auto`（画布过矮时可滚动） |
| 状态色块 | 10×10px、圆角 2px、`background: fill; border: 2px solid stroke; box-sizing: border-box` |
| 告警色块 | 10×10px、圆角 2px、纯色填充、无边框 |
| 装饰色块 | 10×10px、圆角 2px、深灰底衬（建议 `#37474F`，与 `robotProperty.textFill` 同色系），内部图形用 CSS/伪元素绘制（横线/三角/竖线/圆点） |
| 分隔线 | 1px、横向通栏、颜色随主题 |
| 文案 | 12px、`white-space: nowrap`，颜色随主题 |
| 按钮 | antd `Button type="text" size="small"` + `RightOutlined`/`DownOutlined`，背景透明（实装后评审调整：带底色在画布上太突兀） |
| **暗黑主题** | 面板底色/边框/文字一律使用 AntD CSS 变量（`var(--ant-color-bg-container)`、`var(--ant-color-border-secondary)`、`var(--ant-color-text)` 等），与 `GraphBar/index.less` 中 `svg { fill: var(--ant-color-text) }` 的既有做法一致；不写死白色 |

### 5.3 i18n 文案

遵循项目国际化规范：常量中保留中文原文，组件层 `t()` 转换。

已存在 key（直接复用）：`空闲`、`交管`、`执行中`、`充电`、`避障`、`异常`、`抱闸`、`载货`。

需新增 key（同步加入 `zh-CN.json` 值=原文、`en-US.json` 值=译文；zh-TW/ja-JP/ko-KR 以中文回退，后续补译）：

| key（中文原文） | en-US 译文 |
|---|---|
| 车辆图例 | Vehicle Legend |
| 离线/连接中断 | Offline / Disconnected |
| 定位告警 | Localization Warning |
| 错误告警 | Error Warning |
| 有任务 | Has Task |
| 充电标识 | Charging Marker |
| 车头方向 | Heading |

---

## 6. 技术方案

### 6.1 新增文件

| 文件 | 说明 |
|---|---|
| `src/components/VehicleStatusLegend/index.tsx` | 共享图例组件（memo，无 props；内部 `useState<boolean>` 管展开态） |
| `src/components/VehicleStatusLegend/index.less` | 样式（含暗黑主题变量） |
| `src/constants/vehicleLegend/index.ts` | 图例数据常量 |

### 6.2 数据常量设计（`src/constants/vehicleLegend/index.ts`）

**关键原则：颜色不复制字面量，直接 import `robotProperty` 取值**——保证画布改色时图例自动跟随，消除两套色表漂移风险。

```ts
import { robotProperty } from "@/plugins/konva/nodes/robot";

// 三组结构：status（fill+stroke 双色块）/ warning（纯色块）/ decoration（图形示意）
export const VEHICLE_LEGEND_GROUPS = [
  {
    key: "status",
    items: [
      { label: "空闲",   fill: robotProperty.robotFill.IDLE,       stroke: robotProperty.strokeStyle.IDLE },
      // ... 8 行，顺序见 §4.1
      { label: "离线/连接中断", fill: robotProperty.robotFill.OFFLINE, stroke: robotProperty.strokeStyle.OFFLINE },
    ],
  },
  {
    key: "warning",
    items: [
      { label: "定位告警", fill: robotProperty.localizationWarning.fill },
      { label: "错误告警", fill: robotProperty.errorWarning.fill },
    ],
  },
  {
    key: "decoration",
    items: [
      { label: "有任务",   glyph: "dot",      color: robotProperty.order.fill },
      { label: "载货",     glyph: "line",     color: robotProperty.load.stroke },
      { label: "充电标识", glyph: "triangle", color: "#FFF" },
      { label: "车头方向", glyph: "headline", color: "#FFFF00" },
    ],
  },
];
```

（以上为示意结构，实施时可微调；组件层对 `label` 统一 `t(label)`。）

### 6.3 嵌入点（各加一行，无其他改动）

1. `src/pages/Overlook/ForceGraph/index.tsx`：在 `<GraphBar />` 旁（`styles.force_graph` 容器内）渲染 `<VehicleStatusLegend />`。
2. `src/pages/MapThrough/MapNestModify/NestGraph/index.tsx`：在 `<GraphBar />` 旁（`styles.nest_graph` 容器内）渲染 `<VehicleStatusLegend />`。
3. `src/pages/RecordPlayback/index.tsx`：在 `styles.spinContainer` 容器内、与 `<KonvaRender />` **同条件**（`!isLoading && mapData`）渲染 `<VehicleStatusLegend />`——未查询/无地图数据/加载中时画布不存在，图例一并隐藏，避免悬浮在 Empty 占位上。

三个容器均为 `position: relative`（RecordPlayback 的 `spinContainer` 见 `index.less:16`），图例 absolute 定位即生效。回放页 ControlPanel（播放控制条）在文档流中位于画布**下方**、不覆盖画布，右下角无冲突；VehicleInformation 为 `position: fixed; z-index: 110` 瞬态浮层，可短暂覆盖图例，可接受。组件零 props、零数据依赖，**不触碰** GraphStage / KonvaRender / RobotLayer / graph.ts 任何现有逻辑。

### 6.4 复用而非移植的说明

参考项目（config）的 `MapLegend` + `robotStyles.ts` 是其仓库的独立色表；本仓库**不复制**该色表，而是直接消费 `robotProperty`（§6.2），仅借鉴其 UI 形态（右下角折叠式）。

### 6.5 代码规范

- 新增/修改代码添加多行简体中文注释（组件头部 `@description`、关键逻辑块）。
- 双引号、分号、尾逗号（pre-commit 强制）。
- 常量中的中文 label 不删除不改写，组件层 `t()` 转换（constants i18n 规格）。

---

## 7. 边界情况

| 场景 | 行为 |
|---|---|
| 暗黑主题 | 面板/文字/边框用 AntD CSS 变量；异常条目靠双色块描边 `#F43563` 保持可辨识 |
| 白色装饰图形不可见 | 载货线/充电三角用深灰底衬（决策已定） |
| 画布过矮（Overlook 分栏拖高面板后） | 面板 `max-height` + 内部滚动，不溢出画布 |
| Tooltip / 右键菜单覆盖图例 | 允许（均为瞬态浮层，z-index 高于图例） |
| 车辆图层隐藏 | 图例保持显示（决策已定） |
| WS 断流 / 无任何车辆 | 图例为静态说明，照常可用 |
| 图例上的右键/拖拽/滚轮 | 事件阻断，不触发画布平移/缩放/右键菜单 |
| 暂停车辆 | 画布显示其业务状态色，图例不含 PAUSED 条目（与画布一致，决策已定） |
| 回放页未查询 / 无地图数据 / 加载中 | 图例随画布一起不渲染（同条件挂载），不悬浮在 Empty 占位上 |
| 回放帧缺 localizationScore / errorEntryList 字段 | RobotRect 对应字段为 undefined/空，`useWarningBlink` 自然不触发告警色，图例无需区分数据源 |
| 高优先级状态 + WARNING 告警 | 画布不显示黄色覆盖（`HIGH_PRIORITY_STATUSES` 短路），图例无需表达此抑制规则（属细节逻辑，图例只解释颜色含义） |

---

## 8. 风险与权衡

| 风险/权衡 | 说明与对策 |
|---|---|
| 图例与画布颜色漂移 | **单一数据源**：常量直接 import `robotProperty`，画布改色图例自动跟随 |
| 14 行面板偏高 | 默认收起；三组仅用细分隔线不加标题；`max-height` 兜底 |
| `getVehicleStatusText` 不走 i18n | 该函数返回中文枚举值，图例**不复用**它，直接 `t("空闲")` 等已有 key |
| 告警色触发条件的语义简化 | 图例只写「定位告警/错误告警」，不展开阈值 0.6 / WARNING 级 / 高优先级抑制等细节（用户只需知道"这个颜色是告警"） |
| 装饰「充电标识」与状态「充电」语义重叠 | 接受：一个是车体色、一个是白色三角图形，分列两行如实反映画布 |
| 后续扩展 | 悬停高亮、实时计数为已知留白，数据结构（分组数组）已为加行预留 |

---

## 9. 验收标准

1. Overlook、地图编辑器、RecordPlayback 三个画布右下角均出现「车辆图例」按钮，默认收起；回放页在未查询/加载中时不显示图例。
2. 展开后显示 14 行 3 组（状态 8 / 告警 2 / 标识 4），组间有分隔线，顺序与 §4.1 一致。
3. 每个色块颜色与画布实际渲染颜色一致（含离线/断连同灰、告警两色、四种装饰）。
4. 暗色与亮色主题下面板均可读，异常（近黑填充）条目在暗色下靠描边可辨识。
5. 刷新页面后图例回到收起态（不持久化）。
6. 关闭「显示元素」中的车辆图层后图例仍在。
7. 在图例上右键/拖拽/滚轮不影响画布。
8. 切换语言（中/英）后图例标题与全部条目文案正确切换。
9. 画布渲染逻辑零改动（graph.ts / RobotLayer / KonvaRender / useWarningBlink  diff 为空）。
