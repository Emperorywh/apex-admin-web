/**
 * en-US · dashboard 命名空间（P34 合并业务首页/实时看板）。
 * 旧系统 en 资源真译逐条沿用（KPI 标签/面板标题/状态词/告警级别/空态/口径说明）；
 * 口径说明按 P34 单段中文 key 重组（原多段落以句号衔接），译文语义与旧一致。
 * 模板仪表盘遗留 key（今日任务/执行中/最新告警等）随 mock 一并退役，不再保留。
 */

export default {
  // KPI 标签
  '今日任务总数': "Today's Tasks",
  '今日任务完成率': "Today's Completion Rate",
  '在线 AGV / 总 AGV': 'Online / Total AGV',
  '故障 AGV 数': 'Faulty AGVs',
  '今日已完成任务平均耗时': 'Avg. Completed Task Duration Today',
  '今日平均每小时完成任务数': 'Avg. Completed Tasks per Hour Today',
  'AGV 综合利用率': 'Fleet Utilization',
  '当前任务积压': 'Current Backlog',
  // 口径提示（aria 与 Tooltip 共用）
  '查看统计口径': 'View calculation details',
  '今日任务总数·计算方式':
    "Today's task total = sum of hourly created counts today (creation basis). The comparison baseline is the created count of yesterday up to the same hour (00:00 to the current hour).",
  '今日任务完成率·计算方式':
    "Completion rate = today's ΣcreatedSucceededCount ÷ today's Σcreated × 100% (the proportion of today's created orders that have been completed). The baseline is yesterday at the same hours.",
  '在线 AGV / 总 AGV·计算方式':
    'Online AGV = running + idle + charging + fault (excluding offline). Total AGV = all registered vehicles. Snapshot read, no period-over-period.',
  '故障 AGV 数·计算方式':
    'Number of vehicles currently in fault state. Snapshot read, no period-over-period.',
  '今日已完成任务平均耗时·计算方式':
    "Average duration = today's ΣcreatedSucceededDurationSeconds ÷ ΣcreatedSucceededCount × 1000 (ms), i.e. the average execution time of orders created and completed today. The baseline is yesterday at the same hours.",
  '今日平均每小时完成任务数·计算方式':
    "Average completed tasks per hour = today's Σsucceeded ÷ hours elapsed (from 00:00 up to and including the current hour, completion basis, same as the trend chart). The baseline is yesterday at the same hours.",
  'AGV 综合利用率·计算方式':
    'Fleet utilization = runningCount ÷ onlineVehicleCount × 100% (the API has no historical busy/idle duration, so the proportion of online vehicles currently running is used as an instantaneous approximation). No period-over-period.',
  '当前任务积压·计算方式':
    'Number of orders currently queued and not yet started (snapshot read, no period-over-period).',
  // 面板标题与口径
  'AGV 状态分布': 'AGV Status Distribution',
  'AGV 状态分布·计算方式':
    'Snapshot counts across five vehicle states: running, idle, charging, fault, offline. The center number is the online count (running + idle + charging + fault, excluding offline).',
  '今日任务完成趋势': "Today's Task Completion Trend",
  '今日任务完成趋势·计算方式':
    "Today vs yesterday hourly comparison of completed orders (completion basis). The horizontal axis only shows hours up to the current hour, and yesterday's data uses the same hour progress for a fair comparison.",
  '实时告警': 'Realtime Alerts',
  '实时告警·计算方式':
    'Shows currently unclosed alerts (isClosed = false), up to 100 entries. Duration = current time − occurrence time, recomputed on each ~5s poll, not from the API.',
  // 图表文案
  '运行': 'Running',
  '空闲': 'Idle',
  '充电': 'Charging',
  '故障': 'Fault',
  '离线': 'Offline',
  '严重': 'Critical',
  '重要': 'Major',
  '台': 'unit(s)',
  '个': 'item(s)',
  '在线 AGV（台）': 'Online AGV',
  '任务数量（个）': 'Task Count',
  '今日': 'Today',
  '昨日': 'Yesterday',
  // 空态
  '暂无数据': 'No data',
  '暂无未关闭告警': 'No open alerts',
}
