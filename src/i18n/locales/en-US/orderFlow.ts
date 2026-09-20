/**
 * en-US · orderFlow 命名空间（P21 工艺管理页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有全量真译，逐条沿用（列表列/弹窗/Cron 构建
 * 器六 Tab/操作反馈）；删除外的确认框标题与影响说明、插值错误形态（{{msg}}）、
 * 失效模板拦截、查询按钮为样板升级补译（按旧真译风格）；工艺/模板术语与
 * menu（Process Management）、orderTemplate（Task/Template）分片对齐。
 */

export default {
  // 列表列与筛选
  '搜索工艺': 'Search Process',
  '查询': 'Query',
  '工艺名称': 'Process Name',
  '工艺标识': 'Process ID',
  '时间表达式': 'Cron Expression',
  '循环次数': 'Loop Count',
  '执行方式': 'Execution Mode',
  '操作': 'Action',
  // 工具行
  '创建工艺': 'Create Process',
  // 行操作与控制命令（确认框标题/影响说明为 confirmCommand 升级补译；结果与
  // 错误为旧真译沿用+插值形态修正）
  '重发': 'Resend',
  '暂停': 'Pause',
  '继续': 'Continue',
  '取消': 'Cancel',
  '{{operation}}工艺：{{name}}': '{{operation}} Process: {{name}}',
  '{{operation}}子工艺：{{name}}': '{{operation}} Sub-process: {{name}}',
  '{{operation}}影响：将向调度系统发送「{{operation}}」命令，执行结果以列表刷新结果为准':
    '{{operation}} impact: a "{{operation}}" command will be sent to the dispatch system; check the refreshed list for the actual result',
  '当前任务操作成功': 'Current task operation successful',
  '当前任务操作出错：{{msg}}': 'Error operating current task: {{msg}}',
  // 展开行子表（子工艺）
  '订单模版名称': 'Order Template Name',
  '订单模版标识': 'Order Template ID',
  '工艺状态': 'Process Status',
  '执行中': 'Processing',
  '已暂停': 'Paused',
  '异常': 'Error',
  '已取消': 'Cancelled',
  '失败': 'Failed',
  '已完成': 'Completed',
  '并行触发': 'Parallel trigger',
  '串行触发': 'Sequential trigger',
  // 弹窗标题与字段
  '请输入工艺名称': 'Please enter process name',
  '请输入时间表达式': 'Please enter cron expression',
  '请选择时间表达式': 'Please select cron expression',
  '请输入符合规则的正则表达式': 'Please enter a valid regex',
  '模板集合': 'Templates',
  '请选择任务集合': 'Please select task set',
  '待选工艺': 'Available',
  '已选工艺': 'Selected',
  '添加': 'Add',
  '撤回': 'Undo',
  '搜索': 'Search',
  '已不可用': 'No longer available',
  '模板集合中 {{count}} 个模板已失效，请先在列表中移除后再保存':
    '{{count}} templates in the selection are no longer available; remove them before saving',
  '请输入循环次数': 'Please enter loop count',
  '任务成功的触发次数，-1表示无限循环': 'Trigger count (-1 for infinite loop)',
  '触发方式': 'Trigger Mode',
  '请选择触发方式': 'Please select trigger mode',
  '并行触发:时间周期到达马上创建任务，串行触发:等待上个任务终止再创建任务':
    'Parallel: create task on cycle; Serial: wait for previous task to finish',
  '创建任务分组成功': 'Task group created successfully',
  '创建任务分组出错：{{msg}}': 'Error creating task group: {{msg}}',
  // Cron 构建器（六 Tab 与各模式控件）
  '表达式': 'Expression',
  '每秒': 'Every second',
  '每分': 'Every minute',
  '每小时': 'Every hour',
  '每天': 'Every day',
  '每月': 'Every month',
  '每周': 'Every week',
  '不指定': 'Unspecified',
  '秒': 'second',
  '分': 'minute',
  '时': 'Hour',
  '小时': 'hour',
  '日': 'day',
  '月': 'month',
  '周': 'week',
  '从': 'From',
  '到': 'To',
  '起始值': 'Start Value',
  '结束值': 'End Value',
  '间隔值': 'Interval',
  '指定': 'Specify',
  '每{{text}}执行一次': 'Execute once every {{text}}',
  '{{text}}开始，每': 'start from {{text}}, every',
  '{{text}}执行一次': 'every {{text}}',
  '第': 'No.',
  '周，的星期': 'Weekday',
  '周几': 'Day of Week',
  '本月最后一个星期': 'Last week of month',
  '请输入周几': 'Please enter day of week',
}
