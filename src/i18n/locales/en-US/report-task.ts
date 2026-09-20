/**
 * en-US · report-task 命名空间（P35 任务统计报表页私有文案）。
 *
 * 旧真译沿用（C:\code\dd\src\locales\en-US.json 同名 key）；旧插值占位
 * {days}（React Intl 形态）已按 i18next 纪律改写为 {{days}}；口径说明类 key
 * 一律使用完整简中文案（含 {{days}} 占位）——zh-CN key 即文案，短 key 在
 * 默认语言下会原样显示且插值无法应用（P33/P35 实测沉淀）。
 * 术语与 orderRecord/terminology 对齐（任务=Task、车辆=Vehicle、查询=Query）；
 * 每日明细区域为本任务新增。
 */

export default {
  // KPI 卡
  '总任务数': 'Total Tasks',
  '完成率': 'Completion Rate',
  '失败 / 取消': 'Failed / Canceled',
  '平均执行时长': 'Avg. Execution Duration',
  // 口径说明（旧真译沿用；key 为完整简中文案，插值 {{days}}）
  '总任务数 = 完成任务数 + 失败任务数 + 取消任务数（按最终状态统计，近 {{days}} 天各天之和）。':
    'Total tasks = completed + failed + canceled (terminal-state basis, sum over the last {{days}} days).',
  '完成率 = 完成任务数 ÷ 总任务数 × 100%。\n\n完成任务数：近 {{days}} 天各天完成任务数之和（按最终状态统计）。\n总任务数 = 完成任务数 + 失败任务数 + 取消任务数。':
    'Completion rate = completed / total tasks × 100%.\n\nCompleted: sum of daily completed over the last {{days}} days (terminal-state basis).\nTotal tasks = completed + failed + canceled.',
  '失败任务数：近 {{days}} 天各天失败任务数之和。\n取消任务数：近 {{days}} 天各天取消任务数之和。\n\n按最终状态统计。':
    'Failed: sum of daily failed over the last {{days}} days.\nCanceled: sum of daily canceled over the last {{days}} days.\n\nTerminal-state basis.',
  '平均耗时（毫秒）= 近 {{days}} 天创建且已完成的订单执行总时长（秒）÷ 同期创建且已完成的订单总数 × 1000。\n\n统计区间内创建并已完成的订单的平均执行时长。':
    'Average duration = last {{days}} days ΣcreatedSucceededDurationSeconds / ΣcreatedSucceededCount × 1000 (ms).\n\nAverage execution time of orders created and completed.',
  '查看统计口径': 'View calculation details',
  // 任务量趋势
  '任务量趋势': 'Task Volume Trend',
  '近 {{days}} 天按天堆叠柱图，分完成 / 失败 / 取消三类（终态口径）。\n\n缺失天按 0 补齐。':
    'Stacked bar chart by day for the last {{days}} days, split into completed / failed / canceled (terminal-state basis).\n\nMissing days are filled with 0.',
  '任务量趋势堆叠柱图': 'Task volume trend stacked bar chart',
  '完成': 'Completed',
  '失败': 'Failed',
  '取消': 'Cancel',
  '任务数量（个）': 'Task Count',
  // 任务执行时长分布
  '任务执行时长分布': 'Task Duration Distribution',
  '按固定时长分桶统计订单数：小于 1 分钟 / 1-2 分钟 / 2-3 分钟 / 3-5 分钟 / 5-10 分钟 / 大于 10 分钟。\n\n接口仅有分桶计数，无原始耗时样本，第 50 百分位耗时（中位数）和第 90 百分位耗时不可计算。':
    'Order counts bucketed by fixed duration intervals: <1min / 1-2min / 2-3min / 3-5min / 5-10min / >10min.\n\nThe API only provides bucket counts without raw duration samples; P50 / P90 cannot be calculated.',
  '任务执行时长分布柱图': 'Task duration distribution bar chart',
  '<1m': '<1m',
  '1–2m': '1–2m',
  '2–3m': '2–3m',
  '3–5m': '3–5m',
  '5–10m': '5–10m',
  '>10m': '>10m',
  // 车辆利用率排行
  'AGV 利用率排行': 'AGV Utilization Ranking',
  '利用率为近 {{days}} 天各车辆有效状态时长之和 ÷ 区间总秒数。\n\n区间终点超过当前时刻时，分母只算到当前时刻（不计入未来时间）。\n\n有效状态 = 执行作业 + 执行充电 + 执行停靠。':
    "Utilization = sum of each vehicle's effective-state duration over the last {{days}} days / total seconds in the interval.\n\nWhen the interval ends beyond the current time, the denominator only counts up to now (future time is excluded).\n\nEffective states = EXECUTING_WORK + EXECUTING_CHARGE + EXECUTING_PARK.",
  'AGV 利用率排行横向柱图': 'AGV utilization ranking horizontal bar chart',
  '利用率': 'Utilization',
  // 利用率趋势
  '利用率趋势': 'Utilization Trend',
  '每天利用率 = 当天有效状态总时长 /（当天计入统计的秒数 × 当天车辆数）。\n\n整天在区间内按 86400 秒计；首末非整天只算区间覆盖部分；今天只算到当前时刻（不计入未来时间）。\n\n有效状态同利用率排行，车辆数取当天参与统计的车辆数量。缺失天按 0 补齐；已有记录但车辆数为零、缺失或无效时不显示利用率。\n\n统计窗口为近 {{days}} 天（由上方时间选择器控制）。':
    'Daily utilization = total effective-state duration for the day / (seconds actually counted for that day × vehicle count for that day).\n\nA full day inside the interval counts 86400 seconds; partial first/last days count only the covered part; today counts only up to the current time (future time is excluded).\n\nEffective states are the same as the utilization ranking. Vehicle count is the number of vehicles included in that day\'s statistics. Missing days are filled with 0; records with a zero, missing, or invalid vehicle count have no utilization value.\n\nThe window is the last {{days}} days (controlled by the time picker above).',
  '利用率趋势折线图': 'Utilization Trend Line Chart',
  '利用率（%）': 'Utilization (%)',
  // 统计工具栏
  '全部车辆': 'All Vehicles',
  '开始时间': 'Start Time',
  '结束时间': 'End Time',
  '查询': 'Query',
  '今天': 'Today',
  '近3天': 'Last 3 Days',
  '近7天': 'Last 7 Days',
  '近15天': 'Last 15 Days',
  '近30天': 'Last 30 Days',
  // 每日明细（本任务新增区域；与任务量趋势同源）
  '每日明细': 'Daily Summary',
  '统计窗口内每个自然日一行，与任务量趋势同源；缺失记录的天按 0 补齐。平均执行时长为当天创建且已完成的订单口径，分母为 0 时留白（不可计算）。':
    'One row per calendar day in the statistics window, sharing the same source as the task volume trend; days without records are filled with 0. Average execution duration uses orders created and completed on that day; blank when the denominator is 0 (not computable).',
  '日期': 'Date',
  '创建数': 'Created',
  '完成数': 'Completed',
  '失败数': 'Failed',
  '取消数': 'Canceled',
  // 空态
  '暂无数据': 'No data',
} as const
