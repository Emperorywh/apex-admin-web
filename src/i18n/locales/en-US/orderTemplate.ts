/**
 * en-US · orderTemplate 命名空间（P20 任务工艺页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有 58 键全量真译，逐条沿用（列表列/搜索/弹窗
 * 三态/嵌套表单字段/操作反馈）；删除确认标题与影响说明、插值错误形态
 * （{{msg}}）、查询按钮为样板升级补译（按旧真译风格）；动作/地图/站点术语
 * 与 P23 agvAction、P10 crossMap 分片对齐。
 */

export default {
  // 列表列与筛选
  '搜索任务': 'Search Tasks',
  '查询': 'Query',
  '任务名称': 'Task Name',
  '任务标识': 'Task ID',
  '指定车辆（组）': 'Vehicle (Group)',
  '操作': 'Action',
  // 工具行
  '创建任务': 'Create Task',
  // 行操作与删除确认（confirmCommand 升级：标题/影响为补译；结果与错误为
  // 旧真译沿用+插值形态修正）
  '复制': 'Copy',
  '编辑': 'Edit',
  '删除': 'Delete',
  '删除任务': 'Delete Task',
  '删除影响：该任务模板及其子任务配置将被永久删除，不可恢复':
    'Impact: this task template and its subtask configuration will be permanently deleted and cannot be recovered',
  '删除任务成功': 'Task deleted successfully',
  '删除任务出错：{{msg}}': 'Error deleting task: {{msg}}',
  // 弹窗标题与字段（三层嵌套：模板 → 子任务 → 动作 → 参数）
  '编辑任务': 'Edit Task',
  '复制任务': 'Copy Task',
  '模板名称': 'Template Name',
  '请输入模板名称': 'Please enter template name',
  '指定车辆': 'Assign Vehicle',
  '请选择指定车辆': 'Please select a vehicle',
  '请选择订单指定车辆': 'Please select a vehicle for the order',
  '指定车辆分组': 'Assign Vehicle Group',
  '请选择车辆分组': 'Please select a vehicle group',
  '子任务 {index}': 'Subtask {index}',
  '地图名称': 'Map Name',
  '请选择地图': 'Please select a map',
  '站点名称': 'Station Name',
  '请选择站点': 'Please select a station',
  '动作 {index}': 'Action {index}',
  '动作类型': 'Action Type',
  '请输入动作类型!': 'Please enter action type!',
  '请输入动作类型': 'Please enter action type',
  '动作描述': 'Description',
  '请输入动作描述!': 'Please enter action description!',
  '请输入动作描述': 'Please enter action description',
  '阻塞类型': 'Block Type',
  '请选择阻塞类型!': 'Please select blocking type!',
  '请选择阻塞类型': 'Please select blocking type',
  '动作名': 'Action Name',
  '请输入动作名': 'Please enter action name',
  '动作值': 'Action Value',
  '请输入动作值': 'Please enter action value',
  '添加子任务动作参数': 'Add Subtask Action Param',
  '添加子任务动作': 'Add Subtask Action',
  '添加子任务': 'Add Subtask',
  '子任务不能为空': 'Subtasks cannot be empty',
  // 弹窗操作与反馈（插值形态为样板升级，旧真译沿用）
  '确定': 'Confirm',
  '取消': 'Cancel',
  '创建任务成功': 'Task created successfully',
  '创建任务出错：{{msg}}': 'Error creating task: {{msg}}',
  '更新任务成功': 'Task updated successfully',
  '更新任务出错：{{msg}}': 'Error updating task: {{msg}}',
  '查询跨地图节点出错': 'Error querying cross-map nodes',
  // 展开行子表
  '地图ID': 'Map ID',
  '站点ID': 'Station ID',
  '动作参数': 'Parameters',
}
