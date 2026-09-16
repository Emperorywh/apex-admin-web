# SPEC — 数据统计计算方式提示（metric calculation hint）

> 为 RealtimeDashboard、TaskStatisticsReport、FaultAlert 三个看板页面的所有 KPI 卡片和图表标题增加 ? 图标，hover / 键盘聚焦时以 Tooltip 展示该数值的计算公式与口径说明。

---

## §1 背景与目标

三个看板页面存在大量前端二次汇总的计算指标（如完成率、利用率、故障次数），用户无法从界面上直观得知每个数字的计算方式。本规格定义一套统一的计算方式提示机制，让用户 hover ? 图标即可查看公式、口径、统计窗口、空值原因和环比基线等关键信息。

**不在范围内：**
- 表格列头不加 ? 图标（如故障明细表的「持续时间」「状态」等，含义相对直观）
- 图表内部数据点的 ECharts tooltip 不额外追加计算口径信息（保持图表原有交互不变）

---

## §2 覆盖范围

### 2.1 页面

| 页面 | 路径 |
|---|---|
| 实时看板 | `src/pages/AnalyzeVisual/RealtimeDashboard/` |
| 任务统计报表 | `src/pages/AnalyzeVisual/TaskStatisticsReport/` |
| 故障与告警报表 | `src/pages/AnalyzeVisual/FaultAlert/` |

### 2.2 元素清单

每个页面的 **全部 KPI 卡片** 和 **全部图表标题** 都需要加 ? 图标，无一例外。

#### RealtimeDashboard（8 KPI + 3 图表）

| 类型 | 名称 | 备注 |
|---|---|---|
| KPI | 今日任务总数 | |
| KPI | 今日任务完成率 | |
| KPI | 在线 AGV / 总 AGV | 复合展示 |
| KPI | 故障 AGV 数 | |
| KPI | 今日已完成任务平均耗时 | |
| KPI | 今日行驶总里程 | 恒为 null |
| KPI | AGV 综合利用率 | |
| KPI | 当前任务积压 | |
| 图表 | AGV 状态分布 | 环形饼图 |
| 图表 | 今日任务完成趋势 | 双折线对比 |
| 图表 | 实时告警 | 滚动列表 |

#### TaskStatisticsReport（4 KPI + 4 图表）

| 类型 | 名称 | 备注 |
|---|---|---|
| KPI | 总任务数 | |
| KPI | 完成率 | 复合展示（完成数 · 百分比） |
| KPI | 失败 / 取消 | 复合展示（两数值） |
| KPI | 平均执行时长 | |
| 图表 | 任务量趋势 | 堆叠柱图 |
| 图表 | 任务执行时长分布 | 分桶柱图 |
| 图表 | AGV 利用率排行 | 横向柱图 |
| 图表 | 利用率趋势 | 折线图 |

#### FaultAlert（2 KPI + 2 图表）

| 类型 | 名称 | 备注 |
|---|---|---|
| KPI | 故障次数 | |
| KPI | 未关闭告警数 | |
| 图表 | 故障趋势 | 柱+折线 |
| 图表 | 单机故障排行 TOP10 | 横向柱图 |

---

## §3 UI/UX 设计

### 3.1 共享组件：InfoHint

创建一个可复用的 `InfoHint` 组件，封装 `QuestionCircleOutlined` + Ant Design `Tooltip`。

**文件位置：** `src/pages/AnalyzeVisual/DashboardShared/components/InfoHint/index.tsx`

**Props：**

```typescript
interface InfoHintProps {
    /** Tooltip 内容（已通过 t() 本地化的 ReactNode） */
    content: ReactNode;
}
```

**行为与样式：**
- 图标：`<QuestionCircleOutlined />`，12px（与 KPI 标签字号一致），`colorTextTertiary` 色
- Tooltip 组件：
  - `placement="bottom"`
  - `overlayInnerStyle={{ maxWidth: 300 }}`（固定最大宽度 300px，长文案自动换行）
  - `overlayStyle={{ maxWidth: 300 }}`（防止箭头偏移时撞出视口）
  - `mouseEnterDelay={0.2}`（避免鼠标快速划过时闪烁）
- 无障碍：
  - 图标外层包裹 `<span tabIndex={0} role="button" aria-label={...}>`，键盘 Tab 可聚焦
  - 聚焦时（`onFocus`）手动控制 Tooltip `open` 状态为 `true`，失焦（`onBlur`）为 `false`，使键盘用户也能查看提示
  - 鼠标 hover 由 Tooltip 原生处理，聚焦 / 失焦由受控 `open` 处理，两者叠加不冲突

**示例渲染：**

```
📋 今日任务总数  ❓
                 └─ QuestionCircleOutlined
```

hover / 聚焦后：

```
┌────────────────────────┐
│ 今日任务总数 = 今日各小 │
│ 时 created 之和。       │
│                        │
│ 环比基线为昨日同时刻    │
│ （截至当前小时）。      │
└────────────────────────┘
```

### 3.2 KpiCard 集成

在 `KpiCard` 组件增加一个可选 prop：

```typescript
interface KpiCardProps {
    // ... 现有 props
    /** 计算方式提示内容（已本地化）；不传则不显示 ? 图标 */
    hint?: ReactNode;
}
```

**图标位置：** 标签行右侧，紧贴标签文字，与标签在同一 `flex` 行内：

```
┌──────────────────────────┐
│ 📋 今日任务总数  ❓      │
│   142                    │
│   ↑ 5.2%                 │
└──────────────────────────┘
```

在现有标签 `<span>` 之后、同一 `div` 内追加 `{hint && <InfoHint content={hint} />}`。

### 3.3 ChartPanel 集成

在 `ChartPanel` 组件增加一个可选 prop：

```typescript
interface ChartPanelProps {
    // ... 现有 props
    /** 标题旁的计算方式提示内容（已本地化）；不传则不显示 ? 图标 */
    hint?: ReactNode;
}
```

**图标位置：** 标题行右侧，紧贴标题文字：

```
┌──────────────────────────────────────────┐
│ 任务量趋势  ❓                           │
│ ┌──────────────────────────────────────┐ │
│ │         ECharts 图表区域              │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

在现有 `<span>{title}</span>` 之后追加 `{hint && <InfoHint content={hint} />}`。

---

## §4 Tooltip 内容规范

### 4.1 内容格式

每个 Tooltip 内容由以下部分组成，用空行（`\n\n`）换行分段，**不使用粗体标题**：

1. **公式**（必有）：数学表达式，变量名使用接口字段名或业务术语
2. **自然语言说明**（必有）：对公式的通俗解释
3. **统计窗口 / 口径补充**（按需）：如「近 7 天」「终态口径」「缺失天按 0 补齐」等
4. **空值原因**（仅恒为 null 的指标）：如「接口未提供该字段，暂不可用」
5. **环比基线说明**（仅有环比的指标）：如「环比基线为昨日同时刻（截至当前小时）」

**排版规则：**
- 公式中的字段名用英文原文（如 `created`、`runningCount`），便于用户对照接口文档
- 自然语言说明使用业务用户可理解的语言（如「创建口径」「终态口径」）
- 各段之间空行分隔，不使用 `**粗体**` 或标题
- 多条口径补充可在同一段内用句号分隔，不另起段

### 4.2 动态值

涉及 TimeRangePicker 控制时间区间的图表（AGV 利用率排行、利用率趋势），Tooltip 中的统计窗口描述使用**天数**（而非具体日期），通过 `t()` 插值动态插入：

- 示例：`t("利用率为近 {days} 天各车辆有效状态时长之和 / 区间总秒数。", { days })`
- `days` 由组件根据当前 TimeRangePicker 值实时计算：`end.diff(start, "day") + 1`
- 初始默认为 7 天（`TASK_STATISTICS_REPORT_DAYS`）

固定窗口的图表（任务统计近 7 天、故障统计近 14 天）直接写「近 7 天」「近 14 天」，无需动态计算。

### 4.3 复合 KPI

复合展示的 KPI（如「完成率」显示「120 · 85.7%」）合并为单个 Tooltip，内部分段说明每个子值。不拆分为多个 ? 图标。

---

## §5 全量 Tooltip 文案清单

### 5.1 RealtimeDashboard

#### KPI 文案

| KPI | Tooltip 内容（zh-CN 原文） |
|---|---|
| 今日任务总数 | `今日任务总数 = 今日各小时 created 之和（创建口径）。\n\n环比基线为昨日同时刻（截至当前小时）的 created 之和，确保公平对比。` |
| 今日任务完成率 | `完成率 = 今日 ΣcreatedSucceededCount / 今日 Σcreated × 100%。\n\n即今日创建的订单中已完成的比例。\n\n环比基线为昨日同时刻。` |
| 在线 AGV / 总 AGV | `在线 AGV = running + idle + charging + fault（不含 offline）。\n\n总 AGV = 全部注册车辆数。\n\n快照直读，无环比。` |
| 故障 AGV 数 | `当前处于故障状态（fault）的车辆数。\n\n快照直读，无环比。` |
| 今日已完成任务平均耗时 | `平均耗时 = 今日 ΣcreatedSucceededDurationSeconds / ΣcreatedSucceededCount × 1000（ms）。\n\n即今日创建并已完成的订单的平均执行时长。\n\n环比基线为昨日同时刻。` |
| 今日行驶总里程 | `接口未提供行驶里程字段，暂不可用。\n\n该指标恒显示 "--"。` |
| AGV 综合利用率 | `利用率 = runningCount / onlineVehicleCount × 100%。\n\n在线车辆中正在运行的车辆占比。接口无历史忙闲时长，取瞬时快照近似值。\n\n无环比。` |
| 当前任务积压 | `当前排队中的订单数（queueOrderCount）。\n\n快照直读，无环比。` |

#### 图表文案

| 图表 | Tooltip 内容（zh-CN 原文） |
|---|---|
| AGV 状态分布 | `五类状态的车辆数快照：运行（running）、空闲（idle）、充电（charging）、故障（fault）、离线（offline）。\n\n中心显示在线数 = running + idle + charging + fault（不含离线）。` |
| 今日任务完成趋势 | `今日 vs 昨日按小时对比的完成订单数（succeeded 口径）。\n\n横轴截至当前小时。昨日数据取与今日相同进度的小时数做同时刻对比。` |
| 实时告警 | `展示当前未关闭告警（isClosed = false），最多 100 条。\n\n持续时长 = 当前时刻 - 发生时间，每 5 秒随轮询实时更新，非接口下发。` |

### 5.2 TaskStatisticsReport

#### KPI 文案

| KPI | Tooltip 内容（zh-CN 原文） |
|---|---|
| 总任务数 | `总任务数 = completed + failed + canceled（终态口径，近 7 天各天之和）。` |
| 完成率 | `完成率 = 完成数 / 总任务数 × 100%。\n\n完成数：近 7 天各天 completed 之和（终态口径）。\n总任务数 = 完成 + 失败 + 取消。` |
| 失败 / 取消 | `失败数：近 7 天各天 failed 之和。\n取消数：近 7 天各天 cancelled 之和。\n\n终态口径。` |
| 平均执行时长 | `平均耗时 = 近 7 天 ΣcreatedSucceededDurationSeconds / ΣcreatedSucceededCount × 1000（ms）。\n\n创建并已完成的订单的平均执行时长。` |

#### 图表文案

| 图表 | Tooltip 内容（zh-CN 原文） |
|---|---|
| 任务量趋势 | `近 7 天按天堆叠柱图，分完成 / 失败 / 取消三类（终态口径）。\n\n缺失天按 0 补齐。` |
| 任务执行时长分布 | `按固定时长分桶统计订单数：<1min / 1-2min / 2-3min / 3-5min / 5-10min / >10min。\n\n接口仅有分桶计数，无原始耗时样本，P50 / P90 不可计算。` |
| AGV 利用率排行 | `利用率为近 {days} 天各车辆有效状态时长之和 / 区间总秒数。\n\n区间终点超过当前时刻时，分母只算到当前时刻（不计入未来时间）。\n\n有效状态 = 执行作业（EXECUTING_WORK）+ 执行充电（EXECUTING_CHARGE）+ 执行停靠（EXECUTING_PARK）。` |
| 利用率趋势 | `每天利用率 = 当天有效状态时长之和 / 当天计入统计的秒数。\n\n整天在区间内按 86400 秒计；首末非整天只算区间覆盖部分；今天只算到当前时刻（不计入未来时间）。\n\n有效状态同利用率排行。缺失天按 0 补齐。\n\n统计窗口为近 {days} 天（由上方时间选择器控制）。` |

### 5.3 FaultAlert

#### KPI 文案

| KPI | Tooltip 内容（zh-CN 原文） |
|---|---|
| 故障次数 | `近 14 天故障次数 = 各天 (closedCount + unclosedCount) 之和。\n\n按告警发生时间（startTime）所在自然日归天。` |
| 未关闭告警数 | `近 14 天未关闭告警数 = 各天 unclosedCount 之和。\n\n窗口前发生且仍未关闭的告警不计入（接口无此数据）。` |

#### 图表文案

| 图表 | Tooltip 内容（zh-CN 原文） |
|---|---|
| 故障趋势 | `近 14 天按天柱状图 + 频率折线。\n\n每天次数 = closedCount + unclosedCount。频率（次 / 天）= 当天次数（日桶覆盖 1 天）。缺失天按 0 补齐。` |
| 单机故障排行 TOP10 | `指定日期（今天）故障次数最多的前 10 辆 AGV。\n\n接口仅支持指定单日排行，不支持区间聚合。` |

---

## §6 i18n 策略

### 6.1 Key 命名

沿用项目现有约定（中文原文作为 key），为每条 Tooltip 文案定义稳定 i18n key。由于文案较长，使用**短中文短语 + "·计算方式"**后缀作为 key，而非完整文案：

```
// zh-CN.json 示例
{
  "今日任务总数·计算方式": "今日任务总数 = 今日各小时 created 之和（创建口径）。\n\n环比基线为昨日同时刻（截至当前小时）的 created 之和，确保公平对比。",
  ...
}
```

### 6.2 新增 key 清单

共需新增 **21 条** i18n key（8 实时 KPI + 3 实时图表 + 4 任务 KPI + 4 任务图表 + 2 故障 KPI + 2 故障图表 = 23，其中实时「今日行驶总里程」和「在线 AGV / 总 AGV」各 1 条 = 21 不重复段）。

精确清单：按 §5 各表中的每一行对应一个 key。

### 6.3 文件同步

1. `src/locales/zh-CN.json` — 新增全部 key，值 = 中文原文
2. `src/locales/en-US.json` — 新增全部 key，值 = 英文翻译
3. `zh-TW / ja-JP / ko-KR` — 以中文回退，可后续补充翻译

### 6.4 动态插值 key

含 `{days}` 插值的 key（AGV 利用率排行、利用率趋势），使用 `t("...{days}...", { days })` 调用。

---

## §7 实现计划

### 7.1 新增文件

| 文件 | 说明 |
|---|---|
| `src/pages/AnalyzeVisual/DashboardShared/components/InfoHint/index.tsx` | 共享 ? 图标 + Tooltip 组件 |

### 7.2 修改文件

| 文件 | 改动内容 |
|---|---|
| `src/pages/AnalyzeVisual/DashboardShared/components/KpiCard/index.tsx` | 增加 `hint?: ReactNode` 可选 prop，标签行渲染 InfoHint |
| `src/pages/AnalyzeVisual/DashboardShared/components/ChartPanel/index.tsx` | 增加 `hint?: ReactNode` 可选 prop，标题行渲染 InfoHint |
| `src/pages/AnalyzeVisual/RealtimeDashboard/RealtimeDashboard.tsx` | 为 8 个 KpiCard 传入 hint；为 3 个 ChartPanel 传入 hint |
| `src/pages/AnalyzeVisual/TaskStatisticsReport/TaskStatistics.tsx` | 为 4 个 KpiCard 传入 hint；为 4 个 ChartPanel 传入 hint（含动态 days 插值） |
| `src/pages/AnalyzeVisual/FaultAlert/FaultAlert.tsx` | 为 2 个 KpiCard 传入 hint；为 2 个 ChartPanel 传入 hint |
| `src/locales/zh-CN.json` | 新增 21 条计算方式 key |
| `src/locales/en-US.json` | 新增对应英文翻译 |

### 7.3 实现步骤

1. **创建 InfoHint 组件**
   - 实现 `QuestionCircleOutlined` + `Tooltip`（placement: bottom, maxWidth: 300）
   - 实现键盘无障碍（tabIndex, role, onFocus/onBlur 受控 open）
   - 实现中文注释

2. **修改 KpiCard**
   - 增加 `hint?: ReactNode` prop
   - 在标签 flex 行末尾条件渲染 `{hint && <InfoHint content={hint} />}`

3. **修改 ChartPanel**
   - 增加 `hint?: ReactNode` prop
   - 在标题 span 后条件渲染 `{hint && <InfoHint content={hint} />}`

4. **新增 i18n key**
   - zh-CN.json 和 en-US.json 同步添加 21 条 key

5. **RealtimeDashboard 接入**
   - 为每个 KpiCard 传入 `hint={t("xxx·计算方式")}`
   - 为每个 ChartPanel 传入 `hint={t("xxx·计算方式")}`
   - 注意「在线 AGV / 总 AGV」和「今日行驶总里程」使用各自的 key

6. **TaskStatisticsReport 接入**
   - 为 KpiCard 和 ChartPanel 传入 hint
   - AGV 利用率排行和利用率趋势：实时计算 `days` 并使用插值 `t("...{days}...", { days })`

7. **FaultAlert 接入**
   - 为 2 个 KpiCard 和 2 个 ChartPanel 传入 hint

### 7.4 不改动的文件

- `HttpDashboardRepository.ts` — 计算逻辑不变，只改展示层
- `kpiDefinitions.ts` — formula 文案在组件层组装，不改 MetricDefinition 结构（遵循最小化修改原则）
- `kpiViewModel.ts` — 展示模型不变
- `policy.ts` — 不新增策略常量

---

## §8 边界情况

| 场景 | 处理 |
|---|---|
| KPI 值为 "--"（null） | ? 图标照常显示，Tooltip 仍展示计算公式 + 空值原因（如适用） |
| KPI loading 骨架态 | ? 图标不显示（KpiCard loading 分支不渲染标签行） |
| TimeRangePicker 未选完整区间 | 利用率图表不请求，? 图标仍显示，days 取上一次有效值或默认 7 |
| Tooltip 内容超出 maxWidth | 自动换行，Tooltip 高度自适应 |
| 页面右侧边缘的 KpiCard | Tooltip placement=bottom + autoAdjustOverflow 自动左偏 |

---

## §9 设计决策记录

| 决策 | 选择 | 理由 |
|---|---|---|
| 覆盖范围 | KPI + 图表标题 | 图表口径比 KPI 更不直观；表格列头含义自明 |
| 文案形式 | 公式 + 自然语言 | 公式精确 + 自然语言易懂，互补 |
| UI 组件 | Tooltip（非 Popover） | 轻量无遮挡，maxWidth 300px 足够 |
| 图标位置 | 标签/标题文字右侧 | 与现有布局兼容，关联性强 |
| 复合 KPI | 合并为一个 Tooltip | 避免多图标拥挤 |
| 动态窗口 | 天数描述（非日期） | 简洁，避免 Tooltip 中塞入具体日期 |
| 空值解释 | 解释原因 | 让用户知道是系统限制非数据异常 |
| 环比基线 | 需要说明 | 「昨日同时刻」口径不直观 |
| 文案管理 | i18n key | 复用现有国际化体系 |
| 组件封装 | 共享 InfoHint | KpiCard 和 ChartPanel 复用同一组件 |
| 无障碍 | 完整键盘支持 | tabIndex + 受控 open，符合 WCAG |
| Tooltip 位置 | bottom | 不遮挡 KPI 值和图表标题 |
| Tooltip 排版 | 换行分段无标题 | 保持轻量 |
| MetricDefinition 不改结构 | 组件层组装 hint | 遵循最小化修改原则 |
