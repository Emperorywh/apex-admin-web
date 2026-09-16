# SPEC：数据统计报表（实时看板 + 任务/效率/故障 四个独立路由页面）

> 版本：3.1
> 适用页面：`src/pages/AnalyzeVisual/{DashboardShared,RealtimeDashboard,TaskStatisticsReport,EfficiencyAnalysis,FaultAlert}`
> 原型参考：`public/prototype-agv-stats.html`
> 技术栈：Umi Max + React 18 + Ant Design 5.26 + ECharts 6 + ahooks 3

---

## 1. 背景与目标

将原型中的实时运行看板、任务统计报表、效率分析报表、故障与告警报表落地为 `AnalyzeVisual` 下的四个独立路由页面，共享领域层放在 `DashboardShared`。先由可复现的 mock 数据驱动，后续通过稳定的数据源接口替换为真实后端实现。

### 1.1 目标

1. 四个独立路由页面：实时看板（`RealtimeDashboard`）、任务统计报表（`TaskStatisticsReport`）、效率分析（`EfficiencyAnalysis`）、故障告警（`FaultAlert`）；共享层为 `DashboardShared`。原 Tabs 壳已废弃，各页面通过独立路由和菜单权限各自挂载。
2. 实时看板按 5 秒轮询瞬时数据；页面不可见时暂停，返回可见状态后立即刷新。
3. 报表接口均按固定天数统计（任务统计近 7 天、故障告警近 14 天），不支持任意起止日期查询；报表页面不提供时间区间选择，组件挂载时请求一次。
4. 图表运行时、面板、KPI 卡片和时间区间值对象可复用；业务数据、指标公式和展示语义保持分层。
5. 支持亮色/暗色主题、中英双语、菜单权限、空态、错误态、响应式布局和基础无障碍。
6. mock 与真实 HTTP 实现遵循同一领域数据源接口，页面和业务组件不直接依赖 mock 或传输层响应壳。

### 1.2 非目标

- 不实现实时告警关闭、确认、详情等操作。
- 不实现服务端分页；任务和故障明细在本阶段均为前端筛选、排序、分页。
- 不实现效率分析中的吞吐量趋势和等待时长分布图。
- 不重构现有 `QuantityStatistics`；公共能力是否迁移另立任务评审，不以“顺手修改”扩大本次范围。
- 不兼容旧 Dashboard 数据结构、旧 mock 或 deprecated Tabs 属性。

---

## 2. 核心决策

| 维度 | 决策 |
|---|---|
| 页面布局 | 4 个独立路由页面；均无工具栏、无 Tab 壳 |
| 查询状态 | 报表接口按固定天数统计、无时间区间参数；报表组件挂载时请求一次，无区间查询状态 |
| 统计窗口 | 任务统计固定近 7 天、故障告警固定近 14 天、实时看板今天 + 昨天；不支持任意起止日期 |
| 数据粒度 | 报表趋势桶恒为自然日，页面固定按 day 粒度渲染 |
| 实时轮询 | 5 秒；请求完成后开始计算下一次间隔；页面隐藏时暂停，恢复后立即请求 |
| 路由生命周期 | 各页面为独立路由，挂载时构建、卸载时释放；不再有 Tab 保活/销毁策略 |
| 图表封装 | Dashboard 特性内注册 ECharts；通用 `useECharts` 只负责实例生命周期与 option 应用 |
| 图表更新 | Dashboard 图表统一 `notMerge: true`，避免序列缩短、主题切换时残留旧 option |
| 主题来源 | 使用 Ant Design `theme.useToken()`，不复制一套硬编码主题色 |
| 数据边界 | UI → 领域数据源接口；mock/HTTP 为适配器；传输层 `{code,message,data}` 不进入组件 |
| mock | 固定种子、注入时钟、显式场景；默认不随机失败、不调用 `Math.random()` |
| 表格 | 先筛选、再稳定排序、最后分页；筛选或 pageSize 改变后回到第 1 页 |
| 权限 | 新增 `PERM.STATISTICS_DASHBOARD_VIEW`，值为 `statistics:dashboard:view`；前端路由、菜单树和后端权限树同时交付 |
| 国际化 | 完整支持项目已开放的 `zh-CN`、`en-US`、`zh-TW`、`ja-JP`、`ko-KR`；禁止缺失 key 回退 |
| 无障碍 | 注册并在每张图的 option 中启用 ECharts ARIA；空态/错误态使用语义化状态节点 |

---

## 3. 现状与约束

### 3.1 路由与权限

`.umirc.ts` 已将原 `/analyze-visual/dashboard` 拆为四个独立路由：`/analyze-visual/dashboard-realtime`、`/analyze-visual/dashboard-task`、`/analyze-visual/dashboard-efficiency`、`/analyze-visual/dashboard-fault`；各路由 `component` 分别指向 `./AnalyzeVisual/{RealtimeDashboard,TaskStatisticsReport,EfficiencyAnalysis,FaultAlert}`。`MENU_TREE` 的 `STATISTICS_MANAGE.children` 已加入四个对应节点。

本次必须同步修改：

1. `src/constants/permission.ts` 的 `PERM`。
2. `.umirc.ts` 的 Dashboard 子路由。
3. `MENU_TREE` 中 `STATISTICS_MANAGE.children`。
4. 后端权限树和默认角色授权数据。

只改前三项会导致普通用户无法从后端获得新权限，不视为权限功能完成。

### 3.2 技术版本约束

- 当前根依赖实际安装 Ant Design 5.26。四个页面为独立路由，不再使用 Tabs 组件。
- ECharts 使用 `echarts/core` 按需引入。官方推荐的是按需注册，不要求提升到全局应用入口。
- 项目当前主题切换最终会刷新页面，但 Dashboard 仍以 Ant Design token 作为唯一视觉颜色来源，避免依赖刷新这一隐式行为。
- 项目没有现成测试脚本；本功能需要补充最小的 Vitest + React Testing Library 测试入口，测试配置不得顺带格式化现有代码。

### 3.3 时间与语言约束

- mock 阶段业务时区固定为 `Asia/Shanghai`。
- 日期参数使用 `YYYY-MM-DD`，表示业务时区中的自然日。
- 事件时间使用带偏移量的 ISO 8601，例如 `2026-08-05T14:32:15+08:00`。
- 数字、百分比和日期时间分别通过 `Intl.NumberFormat`、`Intl.DateTimeFormat` 格式化。
- 持续时长由独立 `formatDuration(milliseconds, locale)` 纯函数格式化，不依赖未注册的 `dayjs.duration`。
- `app.tsx` 的 Ant Design locale 映射和日期组件 locale 必须补齐全部 5 种语言；不得让日/韩/繁中界面混入简中组件文案。

---

## 4. 页面结构与状态流

### 4.1 页面结构

每个页面都是独立路由，均无工具栏、直接渲染内容区：

```text
实时看板路由（/analyze-visual/dashboard-realtime）：
┌──────────────────────────────────────────────────────┐
│ 实时看板内容（8 KPI + 2 图表 + 告警列表 + 最近任务表）│
└──────────────────────────────────────────────────────┘

报表路由（任务统计报表 / 效率分析 / 故障告警）：
┌──────────────────────────────────────────────────────┐
│ 当前报表内容（KPI + 图表 + 可选明细表）               │
└──────────────────────────────────────────────────────┘
```

报表接口均按固定天数统计、不支持任意起止日期，原报表区间工具栏（`ReportRangeToolbar`）与报表组合壳（`ReportPageShell`）已移除；实时看板曾有的刷新工具栏（`RealtimeRefreshToolbar`，倒计时/手动刷新）亦已移除。路由入口只负责 ECharts 特性注册与页面布局容器，数据请求由页面组件直接调用 `dashboardRepository` 单例（§7.3）。

### 4.2 报表请求策略

报表接口均按固定天数统计（days 从当前往前推，不支持任意起止日期），页面不提供时间区间选择：

- 报表组件挂载时请求一次，无区间切换触发的重新请求。
- 表格翻页 / 筛选 / 排序只作用于已加载数据或明细分页链路，不触发整张报表重新请求（§7.4）。
- 故障明细分页查询默认不携带时间参数，时间条件由明细筛选区显式指定。

### 4.3 实时轮询状态流

实时看板路由入口组件（`/analyze-visual/dashboard-realtime` 的 `index.tsx`）直接持有实时请求、数据与轮询定时器，通过 props 传给纯展示组件 `RealtimeDashboard`；不使用 context / Provider。

- 挂载后立即请求一次；每次请求完成后计时 5 秒再发起下一次（请求期间不计时）。
- `document.hidden === true` 时不调度下一次轮询；页面重新可见时立即刷新一次。
- 失败后清空本次快照并按空数据降级（不展示错误态，仅留受控日志）；后续轮询继续。

---

## 5. 业务功能

### 5.1 实时运行看板

展示当前快照以及今日累计指标，不受报表时间选择器影响。

#### KPI（2 行 × 4）

1. 今日任务总数。
2. 今日任务完成率。
3. 在线 AGV / 总 AGV。
4. 故障 AGV 数。
5. 今日已完成任务平均耗时。
6. 今日行驶总里程。
7. AGV 综合利用率。
8. 当前任务积压。

#### 内容面板（2 × 2）

| 面板 | 类型 | 内容 |
|---|---|---|
| AGV 状态分布 | 环形饼图 | 运行、空闲、充电、故障、离线；中心显示在线数 |
| 今日任务完成趋势 | 双折线 | 今日与昨日按小时对比；只展示截至当前小时的数据 |
| 实时告警 | 列表 | 级别、AGV、描述、发生时间、持续时间 |
| 最近完成任务 | 表 | 任务 ID、AGV、类型、起终点、耗时、状态 |

实时列表只展示未关闭告警。数据更新使用稳定 `id` 合并；已有项目保持相对顺序，新项目插入顶部。

实时告警已对接真实接口 `pageSystemAlarmRecords`（`isClosed=false` 仅未关闭，取前 100 条，与看板聚合并行请求、失败独立降级为空列表）；未关闭告警接口不下发 `durationSeconds`，持续时长按当前时刻与 `startTime` 现算；描述取 `errorModel.errorDescription` + 多语言译文，展示走当前语言 → zh_CN → en_US → 原文回退链（与故障明细表同口径）。

### 5.2 任务统计报表

#### KPI

- 总任务数。
- 完成数和完成率。
- 失败数与取消数。
- 已完成任务平均执行时长。

#### 图表

| 面板 | 类型 | 内容 |
|---|---|---|
| 任务量趋势 | 堆叠柱 | 完成、失败、取消；X 轴使用自适应时间桶 |
| 任务执行时长分布 | 柱状 | `<1m`、`1–2m`、`2–3m`、`3–5m`、`5–10m`、`>10m` |
| 任务类型占比 | 环形饼图 | 搬运、拣选、补货、盘点 |

时长分布的 P50/P90 从原始已完成任务时长计算。标线落在包含该值的区间桶上，标签显示精确格式化时长；无已完成任务时不显示标线。

#### 明细表

任务 ID、AGV、类型、起点、终点、创建时间、耗时、距离、状态。支持 pageSize 10/20/50、类型/状态筛选以及耗时/距离/创建时间排序。

### 5.3 效率分析报表

#### KPI

- 车队加权平均利用率。
- 车队空跑率。
- 平均小时吞吐量。
- 已完成任务平均等待时长。

#### 图表

| 面板 | 类型 | 内容 |
|---|---|---|
| AGV 利用率排行 | 横向柱 | 降序；`<50%` 红、`50%–<70%` 黄、`≥70%` 绿 |
| 利用率与空跑率趋势 | 双 Y 轴折线 | 左轴利用率，右轴空跑率，均为 0–100% |

### 5.4 故障与告警报表

#### KPI

- 选定区间故障次数。
- 选定区间内发生且当前仍未关闭的告警数。
- 告警关闭率：`ΣclosedCount / Σ(closedCount + unclosedCount)`（窗口级，与故障次数同归天口径）。
- 平均告警时长：`ΣtotalDurationSeconds / Σ(closedCount + unclosedCount)`（未关闭告警时长按接口累计口径计入，非严格 MTTR）。
- MTBF（小时）/ MTTR（分钟）：真实接口不提供车辆运行时长与恢复耗时样本，恒为 `null`，页面不展示。

#### 图表

| 面板 | 类型 | 内容 |
|---|---|---|
| 故障趋势 | 柱+折线 | 故障次数 + 归一化故障频率（次/天） |
| 故障类型分布 | 环形饼图 | 传感器、电池、通信、机械、软件 |
| 单机故障排行 TOP10 | 横向柱 | 按次数降序，次数相同按 AGV ID 升序 |
| 告警级别分布 | 堆叠柱 | 严重、重要、一般、提示 |

#### 明细表

事件 ID、级别、类型、AGV、描述、发生时间、恢复时间、持续时间、状态。服务端分页，支持级别/类型/来源/状态/告警码/订单/发生与恢复时间范围筛选；接口无排序参数，持续时间/发生时间排序仅作用于当前页。未恢复事件的恢复时间显示 `--`，排序时视为最大持续时间。

---

## 6. 指标公式与时间桶

### 6.1 通用空值规则

- 分母为 0、样本为空或指标在业务上不可计算时，领域值返回 `null`，UI 展示 `--`。
- `0` 是有效值，不得通过真假判断误转为 `--`。
- 百分比领域值统一使用 `0–1` 小数，展示层格式化为百分比。
- 持续时间统一使用毫秒，距离统一使用米；展示层再转换为分钟、小时、千米。
- 车辆状态五类互斥且数量之和等于总 AGV 数；在线数为运行、空闲、充电、故障四类之和，离线不计入在线。
- 当前任务积压指快照时刻已创建但尚未开始执行的任务数量。

### 6.2 任务指标

- 报表任务只统计在区间内进入终态的任务，终态为完成、失败、取消。
- `总任务数 = 完成数 + 失败数 + 取消数`。
- `完成率 = 完成数 / 总任务数`。
- `平均执行时长 = 已完成任务执行时长总和 / 已完成任务数`。
- 今日实时 KPI 使用业务时区从今日 00:00 到当前时刻的数据，公式相同。
- P50/P90 使用升序样本的 nearest-rank：索引为 `ceil(p × n) - 1`。

### 6.3 效率指标

- 单车利用率：`执行任务时间 / 可用时间`。
- 车队利用率：`所有车辆执行任务时间总和 / 所有车辆可用时间总和`，不是单车百分比简单平均。
- 空跑率：`空载行驶距离 / 总行驶距离`。
- 平均小时吞吐量：`区间完成任务数 / 区间自然小时数`；自然小时数为 `calendarDays × 24`。
- 平均等待时长：已完成任务从可执行到首次开始执行的等待时长平均值。

### 6.4 故障指标

- 故障次数：区间内发生的故障事件数量。
- 告警关闭率：`ΣclosedCount / Σ(closedCount + unclosedCount)`（按 startTime 归天）；窗口内无故障时返回 `null`。
- 平均告警时长：`ΣtotalDurationSeconds / Σ(closedCount + unclosedCount)`；分子分母同按 startTime 归天，未关闭告警的时长按接口累计口径计入；窗口内无故障时返回 `null`。
- MTBF：`区间内所有车辆可用运行小时总和 / 故障次数`；故障次数为 0 时返回 `null`。
- MTTR：区间内已恢复故障的恢复耗时平均值；未恢复故障不进入 MTTR；无已恢复故障时返回 `null`。
- 时间桶故障频率：`桶内故障次数 / 桶实际覆盖天数`。小时桶按实际小时数除以 24，周首尾不足整周时按实际覆盖天数计算。

### 6.5 时间区间与粒度

报表页面移除区间工具栏后，本节类型与函数仅用于 mock 数据生成（固定近 7 天默认区间）与趋势桶标签，不再有用户可提交的区间输入。

`calendarDays` 是包含首尾的自然日数量：

```ts
const MILLISECONDS_PER_DAY = 86_400_000;
const HOURLY_MAX_CALENDAR_DAYS = 2;
const DAILY_MAX_CALENDAR_DAYS = 45;
const MAX_CALENDAR_DAYS = 90;

export type DateRangeErrorCode =
    | "INCOMPLETE_RANGE"
    | "INVALID_FORMAT"
    | "INVALID_CALENDAR_DATE"
    | "REVERSED_RANGE"
    | "FUTURE_END_DATE"
    | "RANGE_TOO_LARGE";

/**
 * 日期区间校验错误只携带稳定错误码。
 * 展示层根据错误码读取当前语言文案，不直接展示内部异常消息。
 */
export class DateRangeError extends Error {
    constructor(readonly code: DateRangeErrorCode) {
        super(code);
    }
}

/**
 * 将 YYYY-MM-DD 转换为与运行环境时区无关的自然日序号。
 * UTC 仅用于日期序号运算，不代表业务事件采用 UTC 时区。
 */
function toEpochDay(value: string): number {
    const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!matched) throw new DateRangeError("INVALID_FORMAT");

    const year = Number(matched[1]);
    const month = Number(matched[2]);
    const day = Number(matched[3]);
    const timestamp = Date.UTC(year, month - 1, day);
    const parsed = new Date(timestamp);

    if (
        parsed.getUTCFullYear() !== year
        || parsed.getUTCMonth() !== month - 1
        || parsed.getUTCDate() !== day
    ) {
        throw new DateRangeError("INVALID_CALENDAR_DATE");
    }
    return timestamp / MILLISECONDS_PER_DAY;
}

/**
 * 计算包含首尾的自然日数量。
 * 该函数是时间粒度和最大区间校验的唯一口径。
 */
export function getCalendarDays(startDate: string, endDate: string): number {
    return toEpochDay(endDate) - toEpochDay(startDate) + 1;
}

/**
 * 根据包含首尾的自然日数量选择趋势图粒度。
 * 1–2 日按小时，3–45 日按天，46–90 日按 ISO 周。
 */
export function getTimeGranularity(calendarDays: number): TimeGranularity {
    if (calendarDays < 1) throw new DateRangeError("REVERSED_RANGE");
    if (calendarDays > MAX_CALENDAR_DAYS) throw new DateRangeError("RANGE_TOO_LARGE");
    if (calendarDays <= HOURLY_MAX_CALENDAR_DAYS) return "hour";
    if (calendarDays <= DAILY_MAX_CALENDAR_DAYS) return "day";
    return "week";
}
```

规则：

- 小时桶：按业务时区整点切分，标签 `MM-DD HH:00`。
- 天桶：按自然日切分，标签 `YYYY-MM-DD`。
- 周桶：周一至周日，标签 `YYYY-Www`，区间首尾允许部分周。
- `businessTime.ts` 集中初始化 `dayjs/plugin/utc`、`dayjs/plugin/timezone`、`dayjs/plugin/isoWeek`；其他 Dashboard 模块只调用该模块导出的纯函数。
- 任何聚合点都必须带 `bucketStart`、`bucketEnd`，图表不得从 label 反推时间。
- `createDateRange` 保留完整校验：区间不完整、开始晚于结束、结束晚于今天、`calendarDays > 90` 均抛出稳定错误码（当前仅 mock 默认区间构造经过此校验）。

---

## 7. 数据契约与分层

### 7.1 共享领域类型

```ts
/**
 * Dashboard 领域层共享类型。
 * 所有时间和单位在领域层保持稳定，不携带 React 节点或视觉色调。
 */
export type TimeGranularity = "hour" | "day" | "week";
export type TaskStatus = "completed" | "failed" | "canceled";
export type TaskType = "transport" | "picking" | "replenishment" | "inventory";
export type AlertLevel = "critical" | "major" | "minor" | "info";
export type FaultType = "sensor" | "battery" | "communication" | "mechanical" | "software";
export type VehicleStatus = "running" | "idle" | "charging" | "fault" | "offline";
export type FaultStatus = "open" | "recovering" | "closed";

export interface DateRange {
    startDate: string;
    endDate: string;
    calendarDays: number;
    granularity: TimeGranularity;
}

export interface CategoryValue<TKey extends string> {
    key: TKey;
    value: number;
}

export interface LocalizedMessage {
    key: string;
    values?: Record<string, string | number>;
}

export interface ComparableMetric {
    current: number | null;
    baseline: number | null;
}
```

`ComparableMetric` 不包含 `tone`、颜色或已格式化字符串。指标的“越高越好/越低越好”由展示层的指标定义表决定，mock 和 HTTP 数据不得控制视觉语义。

### 7.2 完整领域数据结构

```ts
/**
 * 实时看板一次轮询返回的完整快照。
 * snapshotAt 必须包含时区偏移，用于判断数据新鲜度。
 */
export interface RealtimeDashboardData {
    snapshotAt: string;
    kpis: RealtimeKpis;
    vehicleStatus: VehicleStatusItem[];
    todayTaskTrend: HourlyComparisonPoint[];
    openAlerts: RealtimeAlertItem[];
    recentCompletedTasks: RecentTaskItem[];
}

export interface RealtimeKpis {
    todayTaskTotal: ComparableMetric;
    todayCompletionRate: ComparableMetric;
    onlineVehicleCount: number;
    totalVehicleCount: number;
    faultVehicleCount: ComparableMetric;
    averageCompletedDurationMs: ComparableMetric;
    todayDistanceMeters: ComparableMetric;
    fleetUtilization: ComparableMetric;
    backlogCount: ComparableMetric;
}

export interface VehicleStatusItem {
    status: VehicleStatus;
    count: number;
}

export interface HourlyComparisonPoint {
    bucketStart: string;
    bucketEnd: string;
    todayCompleted: number;
    yesterdayCompleted: number;
}

export interface RealtimeAlertItem {
    id: string;
    level: AlertLevel;
    vehicleId: string;
    /** errorDescription 原文 + 多语言译文（FaultDescription），展示走译文回退链 */
    description: FaultDescription;
    occurredAt: string;
    /** 未关闭告警接口不下发时长，按 当前时刻 - startTime 现算；无法计算为 null */
    durationMs: number | null;
}

export interface RecentTaskItem {
    id: string;
    vehicleId: string;
    type: TaskType;
    startPoint: string;
    endPoint: string;
    durationMs: number;
    completedAt: string;
    status: "completed";
}

/**
 * 任务统计返回完整报表和全部明细。
 * 本阶段前端负责明细筛选、排序和分页。
 */
export interface TaskStatisticsData {
    kpis: TaskStatisticsKpis;
    volumeTrend: TaskVolumePoint[];
    durationDistribution: DurationBucket[];
    durationPercentiles: { p50Ms: number | null; p90Ms: number | null };
    typeDistribution: CategoryValue<TaskType>[];
    rows: TaskDetailRow[];
}

export interface TaskStatisticsKpis {
    totalCount: number;
    completedCount: number;
    failedCount: number;
    canceledCount: number;
    completionRate: number | null;
    averageCompletedDurationMs: number | null;
}

export interface TaskVolumePoint {
    bucketStart: string;
    bucketEnd: string;
    completedCount: number;
    failedCount: number;
    canceledCount: number;
}

export type DurationBucketKey = "lt1m" | "m1To2" | "m2To3" | "m3To5" | "m5To10" | "gte10m";

export interface DurationBucket {
    bucket: DurationBucketKey;
    count: number;
}

export interface TaskDetailRow {
    id: string;
    vehicleId: string;
    type: TaskType;
    startPoint: string;
    endPoint: string;
    createdAt: string;
    finishedAt: string;
    durationMs: number;
    distanceMeters: number;
    status: TaskStatus;
}

/**
 * 效率分析领域数据。
 * 所有比例均为 0–1 小数，展示层负责百分比格式化。
 */
export interface EfficiencyAnalysisData {
    kpis: EfficiencyKpis;
    vehicleRanking: VehicleUtilizationItem[];
    trend: EfficiencyTrendPoint[];
}

export interface EfficiencyKpis {
    fleetUtilization: number | null;
    emptyRunRatio: number | null;
    averageHourlyThroughput: number | null;
    averageWaitingDurationMs: number | null;
}

export interface VehicleUtilizationItem {
    vehicleId: string;
    activeDurationMs: number;
    availableDurationMs: number;
    utilization: number | null;
}

export interface EfficiencyTrendPoint {
    bucketStart: string;
    bucketEnd: string;
    utilization: number | null;
    emptyRunRatio: number | null;
}

/**
 * 故障告警领域数据。
 * 未恢复事件的 recoveredAt 和 durationMs 为 null。
 */
export interface FaultAlertData {
    generatedAt: string;
    kpis: FaultAlertKpis;
    trend: FaultTrendPoint[];
    typeDistribution: CategoryValue<FaultType>[];
    vehicleRanking: VehicleFaultRankItem[];
    alertLevelTrend: AlertLevelPoint[];
    rows: FaultDetailRow[];
}

export interface FaultAlertKpis {
    faultCount: number;
    mtbfHours: number | null;
    mttrMinutes: number | null;
    openAlertCount: number;
}

export interface FaultTrendPoint {
    bucketStart: string;
    bucketEnd: string;
    faultCount: number;
    frequencyPerDay: number | null;
}

export interface VehicleFaultRankItem {
    vehicleId: string;
    faultCount: number;
}

export interface AlertLevelPoint {
    bucketStart: string;
    bucketEnd: string;
    criticalCount: number;
    majorCount: number;
    minorCount: number;
    infoCount: number;
}

export interface FaultDetailRow {
    id: string;
    level: AlertLevel;
    type: FaultType;
    vehicleId: string;
    description: LocalizedMessage;
    occurredAt: string;
    recoveredAt: string | null;
    durationMs: number | null;
    status: FaultStatus;
}
```

约束：

- 上述接口覆盖 §5 的每一列、系列和 KPI；实现不得再创建语义重复的平行 DTO。
- `LocalizedMessage` 只承载稳定翻译 key 和插值参数。HTTP 适配器负责把后端错误的未知 key 转换为领域错误，不允许把未受控 HTML 当作描述展示。
- 所有集合使用稳定 `id/key`；不得用数组索引作为 React key。
- 不得用 `any`、`Record<string, unknown>` 或组件内临时对象绕过契约。

### 7.3 数据源端口

```ts
/**
 * Dashboard 唯一数据访问端口。
 * 页面组件只依赖领域数据，不感知 mock、HTTP 响应码或字段映射。
 */
export interface DashboardRepository {
    fetchRealtime(): Promise<RealtimeDashboardData>;
    // 报表接口均按固定天数统计（不支持任意起止日期），页面不提供时间区间选择，故无 range 参数
    fetchTaskStatistics(): Promise<TaskStatisticsData>;
    fetchEfficiencyAnalysis(): Promise<EfficiencyAnalysisData>;
    fetchFaultAlert(): Promise<FaultAlertData>;
}
```

- `MockDashboardRepository` 和未来 `HttpDashboardRepository` 分别实现该端口。
- HTTP 适配器独立处理 `{code,message,data}`、字段转换、单位转换和业务错误；非成功业务码必须 reject 为统一 `DashboardDataError`。
- 当前 HTTP 成功约定为 `code === 200 && message === "success"`；该判断只存在于 HTTP 适配器，领域层和组件不得重复判断。
- 页面组件直接 import `HttpDashboardRepository` 的模块级单例 `dashboardRepository`（实现无内部状态，4 个页面共享同一实例）；不允许从组件直接 import mock。
- 本阶段不定义未使用的 `PageParams`、`handled`、`MarkPoint` 等预留能力。

```ts
/**
 * 数据访问错误只向 UI 暴露稳定错误码。
 * 原始后端 message 仅用于受控日志，不直接作为用户可见文案。
 */
export type DashboardDataErrorCode =
    | "NETWORK_ERROR"
    | "BUSINESS_ERROR"
    | "INVALID_RESPONSE"
    | "MOCK_ERROR";

export class DashboardDataError extends Error {
    constructor(readonly code: DashboardDataErrorCode, readonly cause?: unknown) {
        super(code);
    }
}
```

### 7.4 表格派生顺序

表格原始 `rows` 保持不可变，使用纯 selector 派生：

1. 按列筛选。
2. 使用稳定排序；值相同时按行 ID 升序保证确定性。
3. 根据 `current/pageSize` 截取当前页。

筛选条件或 pageSize 改变时将 `current` 重置为 1；仅翻页不得重新请求报表。

---

## 8. 模块结构

```text
src/pages/AnalyzeVisual/
├── DashboardShared/                  # 四个页面共享的领域层（原 Dashboard/shared）
│   ├── index.less                    # 页面网格与响应式布局（.dashboard-page）
│   ├── components/
│   │   ├── KpiCard/                  # 纯展示 KPI 卡片
│   │   └── ChartPanel/               # 图表面板壳（Card + 标题 + 空态/错误态）
│   ├── echarts/
│   │   ├── registry.ts               # 特性内按需注册 ECharts
│   │   ├── useECharts.ts             # 实例生命周期 + option 应用
│   │   └── useChartTheme.ts          # 从 Ant Design token 派生图表主题
│   ├── model/
│   │   ├── types.ts                  # 共享领域类型（§7.1）
│   │   ├── businessTime.ts           # 业务时区、自然日边界与 ISO 周桶
│   │   ├── dateRange.ts              # DateRange 校验与创建
│   │   ├── formatters.ts             # Intl 数字/百分比/日期/持续时长格式化
│   │   ├── kpiViewModel.ts           # KPI 展示模型纯函数
│   │   ├── enumLabels.ts             # 枚举到 i18n key 的映射
│   │   ├── policy.ts                 # 轮询、区间、阈值等业务策略常量
│   │   └── tableSelectors.ts         # 表格筛选→排序→分页派生
│   └── data/
│       ├── DashboardRepository.ts    # 数据源端口接口（§7.3）
│       ├── HttpDashboardRepository.ts # HTTP 适配器 + 模块级单例 dashboardRepository
│       ├── MockDashboardRepository.ts # mock 适配器
│       └── mockGenerators/           # 按业务域拆分的 mock 生成器
│           ├── _prng.ts
│           ├── _scenario.ts
│           ├── realtime.ts
│           ├── taskStatistics.ts
│           ├── efficiency.ts
│           └── faultAlert.ts
├── RealtimeDashboard/                # 实时看板（独立路由 /analyze-visual/dashboard-realtime）
│   ├── index.tsx                     # 页面入口（ECharts 注册 + 轮询数据请求）
│   ├── RealtimeDashboard.tsx         # 纯展示组件（props 接收数据）
│   ├── model/
│   │   ├── types.ts
│   │   └── kpiDefinitions.ts
│   └── charts/
│       ├── VehicleStatusPie.tsx
│       └── TodayTaskTrendLine.tsx
├── TaskStatisticsReport/             # 任务统计报表（独立路由 /analyze-visual/dashboard-task）
│   ├── index.tsx                     # 页面入口（ECharts 注册 + 布局容器）
│   ├── TaskStatistics.tsx
│   ├── model/
│   │   ├── types.ts
│   │   └── selectors.ts
│   └── charts/
│       ├── TaskVolumeStackedBar.tsx
│       ├── DurationDistributionBar.tsx
│       └── TaskTypePie.tsx
├── EfficiencyAnalysis/               # 效率分析（独立路由 /analyze-visual/dashboard-efficiency）
│   ├── index.tsx                     # 页面入口（ECharts 注册 + 布局容器）
│   ├── EfficiencyAnalysis.tsx
│   ├── model/
│   │   └── types.ts
│   └── charts/
│       ├── VehicleUtilizationBar.tsx
│       └── EfficiencyTrendLine.tsx
└── FaultAlert/                       # 故障告警（独立路由 /analyze-visual/dashboard-fault）
    ├── index.tsx                     # 页面入口（ECharts 注册 + 布局容器）
    ├── FaultAlert.tsx
    ├── model/
    │   ├── types.ts
    │   └── selectors.ts
    └── charts/
        ├── FaultTrendBarLine.tsx
        ├── FaultTypePie.tsx
        ├── VehicleFaultRankBar.tsx
        └── AlertLevelStackedBar.tsx
```

边界规则：

- 业务域之间不得互相 import 内部文件。
- `DashboardShared` 只能放两个及以上业务域实际复用的稳定能力。
- 图表组件留在所属业务域，禁止建立一个不断增长的全局 `charts/` 平铺目录。
- mock 生成器按业务域拆分；repository 只负责组合，不形成巨型 `dashboard.ts`。
- 路由入口只负责 ECharts 注册与页面布局容器，不处理图表 option、表格派生或业务公式；实时路由入口额外持有轮询数据请求，报表数据请求在报表组件内完成。
- `REALTIME_POLL_INTERVAL_MS`、粒度边界、利用率颜色阈值和滚动速度统一定义在 `DashboardShared/model/policy.ts`，禁止散落魔法数字。
- 业务时区换算和 ISO 周切桶只允许由 `DashboardShared/model/businessTime.ts` 提供；组件、mock 生成器和图表不得各自调用本地时区 API 推导边界。

---

## 9. ECharts 技术方案

### 9.1 特性内按需注册

`DashboardShared/echarts/registry.ts` 只注册本规格实际使用的图表和组件：

```ts
/**
 * Dashboard 特性所需的 ECharts 最小注册集合。
 * 本模块只由页面路由入口导入（当前由 RealtimeDashboard/index.tsx 引入），不提升到全局 app.tsx。
 */
import * as echarts from "echarts/core";
import {
    AriaComponent,
    GraphicComponent,
    GridComponent,
    LegendComponent,
    MarkLineComponent,
    TooltipComponent,
} from "echarts/components";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
    AriaComponent,
    GraphicComponent,
    GridComponent,
    LegendComponent,
    MarkLineComponent,
    TooltipComponent,
    BarChart,
    LineChart,
    PieChart,
    LabelLayout,
    CanvasRenderer,
]);

export { echarts };
```

如果实施时 option 新增了组件，必须同步补注册并补测试；不得以“预留”为由注册当前未使用能力。

### 9.2 `useECharts` 生命周期

hook 接收已经由业务图表通过 `useMemo` 构建的精确 `ComposeOption`。主题色由 `useChartTheme()` 从 Ant Design token 派生，locale 变化参与 option 的 `useMemo` 依赖。

规范性伪代码：

```ts
/**
 * 管理 ECharts 实例、尺寸观察和销毁。
 * 容器尺寸为 0 时延迟初始化，首次成功初始化后显式触发 option 应用。
 */
export function useECharts<TOption extends EChartsCoreOption>(option: TOption) {
    const chartRef = useRef<EChartsType | null>(null);
    // 生命周期绑定真实容器节点（回调 ref + state），而非组件挂载：
    // 空数据时业务图表以 <Empty/> 替换容器 div，节点卸载即销毁实例、重建即重新初始化
    const [container, setContainer] = useState<HTMLDivElement | null>(null);
    const [readyRevision, markReady] = useReducer((value) => value + 1, 0);

    useLayoutEffect(() => {
        if (!container) return;

        let resizeFrame = 0;
        let disposed = false;

        /**
         * 只有容器拥有有效尺寸时才创建实例。
         * 创建完成后通知 option effect，避免首次 effect 早于异步初始化导致空图。
         */
        const ensureChart = () => {
            if (disposed || chartRef.current) return;
            if (container.clientWidth === 0 || container.clientHeight === 0) return;
            chartRef.current = echarts.init(container);
            markReady();
        };

        ensureChart();
        const observer = new ResizeObserver(() => {
            ensureChart();
            window.cancelAnimationFrame(resizeFrame);
            resizeFrame = window.requestAnimationFrame(() => {
                const chart = chartRef.current;
                if (chart && !chart.isDisposed()) chart.resize();
            });
        });
        observer.observe(container);

        return () => {
            disposed = true;
            window.cancelAnimationFrame(resizeFrame);
            observer.disconnect();
            const chart = chartRef.current;
            if (chart && !chart.isDisposed()) chart.dispose();
            chartRef.current = null;
        };
    }, [container]);

    useEffect(() => {
        const chart = chartRef.current;
        if (!chart || chart.isDisposed()) return;
        chart.setOption(option, { notMerge: true });
    }, [option, readyRevision]);

    // 回调 ref：setState 身份稳定，消费方 <div ref={...}> 用法不变
    return setContainer;
}
```

硬性要求：

- `ResizeObserver` 和所有 rAF 必须在 React effect 的实际 cleanup 中清理。
- 实例生命周期必须绑定容器 DOM 节点（回调 ref），而非组件挂载：业务图表空数据时会以 `<Empty/>` 替换容器 div，节点替换后必须在新节点重新初始化，否则 setOption 会渲染进已脱离文档的旧节点，导致图表永久空白。
- 首次初始化后必须可靠执行一次 `setOption`。
- 每个图表使用精确 `ComposeOption`，hook 泛型不得退化为 `Record<string, unknown>`。
- 不把不稳定的 `t` 函数直接作为无意义依赖；使用 `locale` 和 memoized option 驱动更新。
- 每张图的 option 包含 `aria: { enabled: true, label: { description }, decal: { show: true } }`，并在 `ComposeOption` 中加入 `AriaComponentOption`。

### 9.3 主题与无障碍

- `useChartTheme` 使用 `theme.useToken()` 输出文字、分割线、边框、提示框和系列色。
- 禁止在 Dashboard 中硬编码白色背景或复制另一套明暗主题常量。
- 图表容器设置 `role="img"`；可访问名称由本地化的 `aria.label.description` 提供，避免外层再写一份互相冲突的 `aria-label`。
- 空态使用 `role="status"`，错误态使用 `role="alert"`，重试按钮可键盘操作。
- 检测 `prefers-reduced-motion`；命中时关闭图表动画。

---

## 10. KPI 与展示模型

领域数据只提供数值。展示层的 `MetricDefinition` 决定标签、单位、格式和变化方向语义：

```ts
/**
 * KPI 展示定义属于 UI 层，不由 mock 或后端返回。
 * polarity 用于判断数值上升应显示正向、负向还是中性色。
 */
export interface MetricDefinition {
    labelKey: string;
    format: "integer" | "percentage" | "duration" | "distance-km" | "decimal-hours" | "decimal-minutes";
    polarity: "higher-is-better" | "lower-is-better" | "neutral";
}
```

`buildKpiViewModel(metric, definition, locale)` 是纯函数，负责：

- 计算方向和变化幅度。
- 根据 polarity 生成 good/bad/neutral tone。
- 处理 baseline 为 0、current 为 0 和 null。
- 按 format 把领域层毫秒、米和 0–1 比例转换为本地化展示值。
- 输出本地化字符串后交给纯展示 `KpiCard`。

`KpiCard` 不读取业务枚举、不计算公式、不访问 repository。

实时 KPI 的 polarity 固定如下，不由 mock 或后端覆盖：

| 指标 | polarity |
|---|---|
| 今日任务总数 | neutral |
| 今日任务完成率 | higher-is-better |
| 在线 AGV / 总 AGV | neutral |
| 故障 AGV 数 | lower-is-better |
| 平均任务耗时 | lower-is-better |
| 今日行驶总里程 | neutral |
| AGV 综合利用率 | higher-is-better |
| 当前任务积压 | lower-is-better |

### 10.1 KPI 卡片视觉规范

| 项 | 规范 |
|---|---|
| 容器 | Ant Design `Card`；背景、边框、阴影、圆角全部来自 token |
| 标签 | 12px，`token.colorTextSecondary`，前置 Ant Design Icon |
| 主值 | 28px、字重 700；单位 16px、次要文字色 |
| 环比 | 12px；good/bad/neutral 分别映射成功色、错误色、次要文字色 |
| 强调 | danger 使用 3px 错误色左边框，warn 使用 3px 警告色左边框 |
| loading | 保留卡片固定高度，使用 Skeleton，禁止加载时网格跳动 |

### 10.2 图表与表格面板

- `ChartPanel` 使用 Ant Design `Card`，标题由 React 渲染，不注册或使用 ECharts `TitleComponent`。
- 默认图表高度 280px，面板最小高度 320px；横向排行可根据数据量提高高度。
- 图表空态和错误态覆盖图表区域，但保留面板标题和固定高度。
- 表格使用 `size="small"`；完成/关闭为成功色，失败/故障为错误色，取消为次要色，处理中为警告色。
- 图表和表格均不得直接使用原型中的 emoji。

### 10.3 图标映射

只使用当前 `@ant-design/icons` 中实际存在的图标：

| 语义 | 图标 |
|---|---|
| 实时看板 | `DashboardOutlined` |
| 任务统计 | `UnorderedListOutlined` |
| 效率分析 | `ThunderboltOutlined` |
| 故障告警 | `ToolOutlined` / `WarningOutlined` |
| AGV | `CarOutlined` |
| 耗时 | `ClockCircleOutlined` |
| 里程 | `NodeIndexOutlined` |
| 利用率 | `LineChartOutlined` |
| 任务积压 | `InboxOutlined` |
| 刷新 | `ReloadOutlined` |

图标只表达稳定语义，不允许业务域自行复制另一套图标映射。

---

## 11. mock 方案

### 11.1 可复现性

- 使用显式注入的 `Clock` 获取当前时间。
- 统计报表种子由 `reportType + startDate + endDate` 哈希产生。
- 实时快照种子额外包含 `floor(clock.now / 5000)`，因此同一 5 秒桶内结果稳定、跨桶可变化。
- 生成器使用项目内独立 seeded PRNG，不调用全局 `Math.random()`。
- 相同输入、时钟和场景必须得到深度相等的数据。
- 今日任务数、完成数、里程等累计指标由固定日计划截取到 `clock.now` 计算，同一业务日内不得随轮询倒退；车辆状态、积压和未关闭告警等瞬时指标允许变化。
- `ComparableMetric.baseline` 表示昨日同一时刻采用同一公式得到的值，不使用任意随机数伪造环比。

### 11.2 错误和空态场景

默认场景永不随机失败。通过开发期显式配置选择：

```ts
/**
 * mock 场景由构造方注入（如 HttpDashboardRepository 内部的 mock 委托）。
 * 测试和人工联调可稳定复现成功、空数据、业务错误和慢请求。
 */
export type MockScenario =
    | { mode: "success"; latencyMs: number }
    | { mode: "empty"; latencyMs: number }
    | { mode: "error"; latencyMs: number; errorCode: DashboardDataErrorCode };
```

不在生产 UI 中暴露 mock 场景开关。

---

## 12. 页面生命周期、表格与滚动行为

### 12.1 独立路由生命周期

四个页面各自为独立路由，不再使用 Tabs 壳。每个页面在路由挂载时构建（创建 ECharts 实例、初始化轮询 / 发起报表请求），在路由卸载时释放（dispose 图表、清除定时器、重置表格筛选/排序/分页）。

不新增 `KeepAliveTab`，不使用 `destroyOnHidden` / `destroyInactiveTabPane` 等 Tabs 属性。

报表页面已无区间查询状态。离开报表路由后，其筛选、排序和分页等局部状态随组件销毁并重置；重新进入该路由时按固定统计窗口重新请求，不恢复旧表格交互状态。

### 12.3 响应式

支持最小 1024px 宽桌面视口：

| 视口宽度 | KPI | 图表网格 |
|---|---|---|
| `≥1440px` | 4 列 | 2 列 |
| `1024–1439px` | 2 列 | 2 列，空间不足时单列 |

表格允许横向滚动。不得通过固定宽度造成页面级横向溢出。

---

## 13. 权限接入

前端：

```ts
/**
 * 四个独立路由页面各自的菜单权限码。
 * 常量值必须与后端权限树节点完全一致。
 */
STATISTICS_DASHBOARD_REALTIME_VIEW: "statistics:dashboard-realtime:view",
STATISTICS_DASHBOARD_TASK_VIEW: "statistics:dashboard-task:view",
STATISTICS_DASHBOARD_EFFICIENCY_VIEW: "statistics:dashboard-efficiency:view",
STATISTICS_DASHBOARD_FAULT_VIEW: "statistics:dashboard-fault:view",
```

1. `.umirc.ts` 四个路由分别设置 `access: PERM.STATISTICS_DASHBOARD_{REALTIME,TASK,EFFICIENCY,FAULT}_VIEW`，`component` 分别指向 `./AnalyzeVisual/{RealtimeDashboard,TaskStatisticsReport,EfficiencyAnalysis,FaultAlert}`。
2. `MENU_TREE` 的 `STATISTICS_MANAGE.children` 按菜单展示顺序加入四个节点。
3. 验证 `MENU_ROUTE_ORDER` 自动包含这四条路径，`expandWithAncestors` 能补齐父权限。

后端/部署：

1. 权限树增加同 code 的 MENU 节点，父节点为 `statistics:manage`。
2. 明确哪些系统默认角色获得该权限。
3. 登录接口返回的新权限树必须覆盖授权和未授权两种验收账号。

---

## 14. 国际化与格式化

- 新 key 必须同步写入 `zh-CN.json`、`en-US.json`、`zh-TW.json`、`ja-JP.json`、`ko-KR.json`，每个文件提供对应语言的真实译文。
- Tab、KPI、图例、轴标签、tooltip、表头、筛选项、单位、空态、错误态、按钮和 ARIA 描述全部走 `t()`。
- 业务枚举保存稳定 code；展示层根据 code 查找翻译 key，不把后端中文当枚举值。
- 图表 option 以 `locale`、数据和主题 token 为 `useMemo` 依赖。
- 新增 Dashboard key 缺失时视为构建/测试失败，不增加运行时中文 fallback。
- `app.tsx` 同步补齐 5 种 Ant Design locale 与日期 locale 映射，语言切换后组件内置文案必须一致。
- 数值和时间不得用字符串拼接实现千分位或本地化日期。

---

## 15. 错误、空态与边界行为

| 场景 | 行为 |
|---|---|
| 首次加载 | 保持布局骨架，KPI 和面板显示 loading |
| 报表请求失败 | 不展示错误摘要：KPI 显示 `--`、图表与表格显示空数据态，仅留受控日志（故障明细分页链路除外，仍显示错误摘要并提供重试） |
| 实时轮询失败 | 清空当前快照，按空数据态展示（不显示错误态，仅留受控日志）；自动轮询继续 |
| 空数据 | KPI 为 `--`，图表显示“暂无数据”，表格使用 Ant Empty |
| 页面隐藏 | 实时轮询暂停 |
| 页面恢复可见 | 立即刷新实时数据，完成后重新计时 5 秒轮询间隔 |
| 主题切换 | option 全量替换，无旧系列、旧颜色残留 |
| 语言切换 | 5 种语言的文案、数字、日期、tooltip 与 ARIA 描述同时更新 |
| 未恢复故障 | 恢复时间和可完成恢复耗时为 null；UI 显示 `--` |

---

## 16. 测试策略

### 16.1 纯函数单元测试

- `getCalendarDays`：1、2、3、45、46、90、91 日及跨月、跨年。
- `createDateRange`：空值、逆序、未来日期、90 日边界。
- ISO 周桶：跨年、首尾部分周、实际覆盖天数。
- KPI 公式：零分母、空样本、current/baseline 为 0。
- P50/P90：1 个、偶数、奇数样本。
- 表格 selector：筛选 → 稳定排序 → 分页顺序及重置页码。
- 格式化：5 种语言的数字、百分比、日期、持续时间。
- locale 完整性：Dashboard 新增 key 在 5 个语言文件中集合完全一致且值非空。
- seeded mock：相同输入深度相等，不同时间桶实时数据可变化。

### 16.2 hook/组件测试

- `useECharts` 首次初始化后调用一次 `setOption`。
- 卸载时取消 rAF、disconnect observer、dispose chart。
- 容器初始 0 尺寸后变为可见时能初始化并渲染。
- 各页面为独立路由，离开时卸载并释放图表实例。
- 报表组件挂载时只请求一次，无区间编辑交互。
- 页面 hidden/visible 的轮询暂停与恢复、失败清空行为。
- ARIA、空态、错误态和 reduced-motion 行为。

### 16.3 集成测试

- 有/无 Dashboard 权限的菜单和路由访问。
- 4 个独立路由页面的数据请求和主题、语言切换。
- 任务与故障表格的筛选、排序、分页组合。

---

## 17. 性能基线

本规格共有 11 张 ECharts 图表：实时 2、任务 3、效率 2、故障 4。四个页面为独立路由，同一时刻只有一个页面挂载，最大同时挂载为故障告警的 4 张。

测试条件：

- production build，Chrome 当前稳定版，1920×1080。
- DevTools 4× CPU throttling；数据量：趋势最多 48 点，任务/故障明细各 1000 行，实时列表各 100 条。
- mock 延迟固定 300ms，并计入端到端性能结果；测试期间不得改成 0 或随机延迟。

验收指标：

1. 页面路由内容可交互时间 P95 `< 2s`。
2. 已有数据时进入报表路由的可交互时间 P95 `< 500ms`。
3. 单次实时轮询更新不产生 `>50ms` 的主线程 Long Task。
4. 连续运行 10 分钟后 ECharts 实例、ResizeObserver 和定时器数量稳定，无单调增长。

---

## 18. 验收标准

1. 四个页面权限（`STATISTICS_DASHBOARD_{REALTIME,TASK,EFFICIENCY,FAULT}_VIEW`）在前端路由、`MENU_TREE`、后端权限树和默认角色中一致；授权用户可见，未授权用户不可见且不可直接访问。
2. 四个独立路由页面，均无工具栏。
3. 报表组件挂载时请求一次；任务统计固定近 7 天、故障告警固定近 14 天，无区间查询交互。
4. 报表趋势桶恒为自然日，页面固定按 day 粒度渲染。
5. 实时看板包含 8 个 KPI、2 张图表、告警列表和最近任务表，5 秒轮询，隐藏暂停、恢复立即刷新。
6. 每个页面为独立路由，离开时销毁并释放图表和表格状态，重新进入时按固定统计窗口重新请求。
7. 任务统计包含 4 KPI、3 张图表和明细表；P50/P90 来自原始完成任务样本。
8. 效率分析包含 4 KPI 和 2 张图表，指标符合 §6.3 的加权和归一化公式。
9. 故障告警包含 4 KPI、4 张图表和明细表；关闭率、平均告警时长与 MTBF/MTTR、部分周频率符合 §6.4。
10. 表格严格按筛选、稳定排序、分页顺序派生；仅分页不重新请求。
11. 组件只依赖 `DashboardRepository` 返回的领域数据，不直接 import mock，不处理 `{code,message,data}`。
12. 默认 mock 可复现且不随机失败；错误/空数据通过显式 `MockScenario` 稳定复现。
13. ECharts 只在 Dashboard 特性内注册实际使用能力；首次渲染有 option，卸载无 observer/rAF/实例泄漏。
14. 每张图启用 `aria.enabled`，支持 reduced-motion；空态和错误态具有正确语义节点。
15. 5 种语言切换覆盖全部可见文案、数字、日期、tooltip 和 ARIA 描述；不存在缺失 key 或运行时简中 fallback。
16. 在 1024px 及以上视口无页面级横向溢出，表格可独立横向滚动。
17. §16 的单元、hook/组件和集成测试通过，§17 性能基线达到要求。

---

## 19. 实施前检查清单

- [ ] 四个领域的数据叶子接口已补全，无 `any` 和隐式单位。
- [ ] 指标公式、空值规则、时间桶规则只有一个实现来源。
- [ ] 页面壳、领域组件、数据源适配器之间没有跨层 import。
- [ ] 未引入 deprecated、fallback、预留字段或未使用的 ECharts 注册项。
- [ ] mock 成功、空态、错误态均可确定性复现。
- [ ] 新增代码包含多行简体中文注释，且未主动格式化无关代码。
- [ ] 修改没有增加跨域耦合、重复逻辑或巨型文件。
- [ ] 测试和性能验收口径可重复执行。
