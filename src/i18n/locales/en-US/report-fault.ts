/**
 * en-US · report-fault 命名空间（P36 故障告警页私有文案）。
 *
 * 旧真译沿用（C:\code\dd\src\locales\en-US.json 同名 key）；旧资源缺失或
 * 简体复制词条的 key 按 B1 基线补译。术语与 orderRecord/terminology 对齐
 * （任务=Task、车辆=Vehicle、查询=Query）；计算方式说明为本任务新增
 * （key 为完整简中文案，zh-CN key 即文案）。旧列名「AGV」按项目术语表收敛为
 * 「车辆」（差异登记 tasks/P36.md）。
 */

export default {
  // KPI 卡
  '故障次数': 'Fault Count',
  '未关闭告警数': 'Open Alert Count',
  '告警关闭率': 'Alert Closure Rate',
  '平均告警时长': 'Avg Alert Duration',
  // 计算方式说明（本任务新增口径文案）
  '故障次数·计算方式':
    'Sum of daily (closed + unclosed) alarm counts within the statistics window, grouped by the calendar day when the alarm occurred; alarms that occurred before the window and remain unclosed are not included (no day-attribution data from the API).',
  '未关闭告警数·计算方式':
    'Sum of daily unclosed alarm counts within the statistics window, grouped by the calendar day when the alarm occurred; alarms that occurred before the window and remain unclosed are not included.',
  '告警关闭率·计算方式':
    'Closed count ÷ (closed + unclosed), aggregated over the window; when there is no alarm in the window the denominator is 0 and "--" is shown (not computable, distinct from a real 0).',
  '平均告警时长·计算方式':
    'Total alarm duration ÷ (closed + unclosed); unclosed alarms count with the duration accumulated by the API, so this is the average alarm duration rather than a strict MTTR. Shows "--" when there is no alarm in the window (not computable).',
  '查看统计口径': 'View calculation details',
  // 图表
  '故障趋势': 'Fault Trend',
  '故障趋势·计算方式':
    'Daily fault counts grouped by the calendar day when alarms occurred; days without data may be omitted by the API and are filled with 0. A day bucket covers 1 day, so frequency (times/day) equals the daily fault count.',
  '故障次数（次）': 'Fault Count',
  '故障频率（次/天）': 'Fault Frequency (times/day)',
  '单机故障排行·计算方式':
    'Top 10 vehicles by alarm count on the last day of the statistics window (the date shown in the title); the API only supports single-day ranking, not window aggregation.',
  '单机故障排行 TOP10（{{date}}）': 'Top 10 Vehicles by Faults ({{date}})',
  '暂无数据': 'No data',
  // 明细卡
  '故障明细': 'Fault Details',
  // 筛选区
  '告警级别': 'Alarm Level',
  '全部级别': 'All Levels',
  '严重': 'Critical',
  '重要': 'Major',
  '告警类型': 'Alarm Type',
  '全部类型': 'All Types',
  '告警来源': 'Alarm Source',
  '全部来源': 'All Sources',
  '车辆': 'Vehicle',
  '设备': 'Device',
  '服务器': 'Server',
  '关闭状态': 'Closure Status',
  '全部状态': 'All Statuses',
  '未处理': 'Open',
  '已关闭': 'Closed',
  '告警码': 'Alarm Code',
  '请输入告警码': 'Enter alarm code',
  '查询': 'Query',
  '重置': 'Reset',
  '更多筛选': 'More Filters',
  '收起筛选': 'Fewer Filters',
  '来源标识': 'Source Key',
  '请输入来源标识': 'Enter source key',
  '来源名称': 'Source Name',
  '请输入来源名称': 'Enter source name',
  '关联任务': 'Related Task',
  '请输入关联任务': 'Enter related task',
  '发生时间': 'Occurred At',
  '恢复时间': 'Recovered At',
  '开始时间': 'Start Time',
  '结束时间': 'End Time',
  // 表格列（旧真译沿用；「AGV」列名收敛为「车辆」）
  '事件 ID': 'Event ID',
  '级别': 'Level',
  '类型': 'Type',
  '描述': 'Description',
  '持续时间': 'Duration',
  '状态': 'Status',
  // 行展开详情
  '任务名称': 'Task Name',
  '上层任务': 'Parent Task',
  '错误类型': 'Error Type',
  '描述原文': 'Original Description',
  '描述译文': 'Localized Description',
  '处理建议': 'Suggestion',
  '异常关联': 'Error References',
  '扩展信息': 'Extra Info',
}
