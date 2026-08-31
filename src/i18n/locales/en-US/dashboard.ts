/**
 * en-US dashboard 命名空间资源（规格 §12）：Dashboard 页面（AGV 调度概览）的
 * 统计卡与图表面板文案，含图表数据项（状态/区域/任务类型）的翻译。
 * 中文文案即 key（本文件不维护 zh-CN 资源，缺 key 返回 key 本身）；
 * 命名空间名与文件名一致，经路由 meta.i18nNamespaces 声明后按需加载。
 */
const dashboard: Record<string, string> = {
  // 统计卡（标题与数值单位后缀）
  在线AGV: 'AGVs Online',
  今日任务: "Today's Tasks",
  平均任务时长: 'Avg. Task Duration',
  今日异常: 'Alarms Today',
  台: 'units',
  单: 'tasks',
  分钟: 'min',
  次: 'times',
  // 环比文案（SPEC_UI2 §8 统计卡）
  '较昨日 {{diff}}': '{{diff}} vs yesterday',
  '较昨日 {{diff}}%': '{{diff}}% vs yesterday',
  '在线率 {{percent}}%': '{{percent}}% online',
  // 图表面板标题
  任务吞吐趋势: 'Task Throughput',
  AGV状态分布: 'AGV Status Distribution',
  区域任务量分布: 'Task Load by Area',
  AGV利用率排行: 'AGV Utilization Ranking',
  任务类型分布: 'Task Type Distribution',
  区域时段任务热力: 'Area × Time-Slot Heatmap',
  任务完成率: 'Task Completion Rate',
  // 图表系列名
  下发任务: 'Dispatched',
  完成任务: 'Completed',
  // AGV 状态（数据项翻译）
  运行中: 'Running',
  待命: 'Standby',
  充电中: 'Charging',
  故障: 'Fault',
  离线: 'Offline',
  // 任务类型（数据项翻译）
  搬运: 'Transport',
  入库: 'Inbound',
  出库: 'Outbound',
  盘点: 'Stocktaking',
  充电回桩: 'Charge Return',
  // 区域（数据项翻译）
  立体库A区: 'Stereo Warehouse A',
  立体库B区: 'Stereo Warehouse B',
  产线一线: 'Production Line 1',
  产线二线: 'Production Line 2',
  包装区: 'Packing Zone',
  出货月台: 'Shipping Dock',
}

export default dashboard
