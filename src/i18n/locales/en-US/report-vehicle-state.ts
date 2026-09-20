/**
 * en-US · report-vehicle-state 命名空间（P37 车辆状态统计页私有文案）。
 *
 * 旧真译沿用（C:\code\dd\src\locales\en-US.json 同名 key，旧 VehicleStatus 页
 * 既有词条全部保留）；计算方式说明沿用旧 en-US 完整译文。术语与
 * orderRecord/terminology 对齐（任务=Task、车辆=Vehicle、查询=Query）；
 * 旧列名「AGV」按项目术语表收敛为「Vehicle」（差异登记 tasks/P37.md）。
 */

export default {
  // 查询工具栏
  '开始时间': 'Start Time',
  '结束时间': 'End Time',
  '全部状态': 'All Statuses',
  '按小时维度': 'By hour',
  '按小时维度统计时，时间范围不能超过 24 小时':
    'When grouping by hour, the time range cannot exceed 24 hours',
  '查询': 'Query',
  '重置': 'Reset',
  '请选择完整的时间范围': 'Please select a complete time range',
  '已加载 {{count}} 条记录': '{{count}} records loaded',
  '查看统计口径': 'View calculation details',
  // KPI 卡（标签沿用旧真译）
  '任务执行利用率': 'Work Utilization',
  '平均交管时长': 'Avg. Traffic Hold Duration',
  '平均执行时长': 'Avg. Execution Duration',
  '平均故障时长': 'Avg. Fault Duration',
  // 计算方式说明（旧 en-US 完整译文沿用）
  '任务执行利用率·计算方式':
    'Utilization = Σ EXECUTING_WORK duration of all vehicles ÷ selected time range in seconds × 100%.\n\nThe denominator is not multiplied by the vehicle count, so with multiple vehicles the result may exceed 100% (approx. the average number of vehicles executing tasks simultaneously).\n\nWhen the range end is later than now, the denominator is capped at the current time (future time not counted).',
  '平均交管时长·计算方式':
    'Traffic Hold (TRAFFIC) total duration ÷ number of vehicles.\n\nVehicles without this state count as 0 in the average.',
  '平均执行时长（车辆状态）·计算方式':
    'EXECUTING_WORK total duration ÷ number of vehicles.\n\nVehicles without this state count as 0 in the average.',
  '平均故障时长·计算方式':
    'ERROR total duration ÷ number of vehicles.\n\nVehicles without this state count as 0 in the average. The card is highlighted with a red border when greater than 0.',
  '覆盖 {{vehicles}} 辆车 · 执行作业 {{duration}}':
    'Covers {{vehicles}} vehicles · executing {{duration}}',
  '覆盖 {{vehicles}} 辆车': 'Covers {{vehicles}} vehicles',
  // 图表（标题/口径说明沿用旧真译）
  '车辆 × 状态 时长堆叠': 'Vehicle × State Duration (Stacked)',
  '车辆 × 状态 时长堆叠·计算方式':
    'One stacked bar per vehicle by state (hours). All vehicles are shown initially.\n\nDrag the slider handles to zoom or its middle area to pan. You can also hold Ctrl and scroll to zoom. Hover over a bar for the full vehicle name and state durations; click a legend item to toggle that state.\n\nState order follows the report state enum; colors are fixed semantic state colors.',
  '车辆状态时长堆叠柱图': 'Stacked bar chart of vehicle state durations',
  '时长（小时）': 'Duration (hours)',
  '暂无数据': 'No data',
  // 状态枚举文案（固定语义顺序，沿用旧真译）
  '在线': 'Online',
  '离线': 'Offline',
  '空闲': 'Idle',
  '执行作业': 'Working',
  '执行充电': 'Charging Task',
  '执行停靠': 'Parking Task',
  '交管等待': 'Traffic Hold',
  '暂停': 'Pause',
  '避让': 'Avoiding',
  '制动': 'Braking',
  '告警': 'Alert',
  '异常': 'Error',
  '充电中': 'Charging',
  // 明细表
  '状态时长明细': 'State Duration Details',
  '全部车辆': 'All Vehicles',
  '车辆名称': 'Vehicle Name',
  '状态': 'Status',
  '时长': 'Duration',
  '占该车总时长': '% of Vehicle Total',
}
