/**
 * en-US · report-order 命名空间（P33 任务统计页私有文案）。
 *
 * 旧真译沿用（C:\code\dd\src\locales\en-US.json 同名 key）；
 * 口径说明为本任务新增（key 为完整简中文案，zh-CN key 即文案）。
 * 筛选标签/枚举 label（开始时间/任务类型/工作任务等）
 * 复用 orderRecord 命名空间既有译文（useTranslation fallback，路由 meta 已声明）。
 */

export default {
  // 页签与图表标题
  '任务数量统计': 'Task Quantity Statistics',
  '任务效率统计': 'Task Efficiency Statistics',
  // 时间占位（label 走 orderRecord 的「开始时间/结束时间」）
  '请选择开始时间': 'Please select start time',
  '请选择结束时间': 'Please select end time',
  // 数量图系列名
  '任务数量': 'Task Count',
  // 效率图 x 轴类目 / y 轴名 / 系列名
  '平均总时间': 'Avg Total Time',
  '平均执行时间': 'Avg Execution Time',
  '平均等待时间': 'Avg Waiting Time',
  '时间（秒）': 'Time (s)',
  '时间': 'Time',
  // 秒转时长单元词（旧真译沿用：英文拼接效果与旧系统一致，已登记观察项）
  '时': 'Hour',
  '分': 'minute',
  '秒': 'second',
  '0秒': '0s',
  // 统计口径说明（参考旧 SPEC_metric_calculation_hint 文案规范：公式+自然语言）
  '查看统计口径': 'View calculation details',
  '任务数量 = 所选条件下各任务状态的任务数量，图表按状态分组求和展示；数据由订单数量统计接口按任务类型 × 任务状态维度返回，未知状态按协议原值显示。':
    'Task count = the number of tasks per task state under the selected filters, aggregated by state in the chart; data comes from the order quantity statistics API (one row per task type × task state). Unknown states are displayed with their raw protocol values.',
  '三个柱值分别为各任务类型平均总时间、平均执行时间、平均等待时间（秒）之和（接口字段 orderAverageTime / orderAverageExecutionTime / orderAverageWaitTime）；口径为各类型平均值合计，与旧系统一致，不等于全部订单的整体平均。':
    'Each bar = the sum over task types of Average Total Time / Average Execution Time / Average Waiting Time in seconds (fields orderAverageTime / orderAverageExecutionTime / orderAverageWaitTime). The metric is the sum of per-type averages, consistent with the legacy system; it is not the overall average of all orders.',
} as const
