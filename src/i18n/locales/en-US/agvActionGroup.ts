/**
 * en-US · agvActionGroup 命名空间（P24 动作分组页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译，逐条沿用（列表列/搜索/弹窗字段/操作
 * 反馈）；删除确认标题与影响说明、失效动作识别、错误 msg 插值为样板升级补译
 * （按旧真译风格）；公共词与 P22/P23 分片对齐（确定=Confirm、查询=Query）。
 */

export default {
  // 列表列与筛选
  '查询车辆动作分组': 'Query AGV Action Groups',
  '查询': 'Query',
  '动作组名称': 'Action Group Name',
  '动作组动作': 'Group Actions',
  '操作': 'Action',
  // 工具行
  '新增分组': 'Add Group',
  // 行操作与删除确认
  '编辑': 'Edit',
  '删除': 'Delete',
  '删除车辆动作组': 'Delete AGV Action Group',
  '删除影响：该动作组将被永久删除，组配置不可恢复':
    'Impact: this action group will be permanently deleted and cannot be recovered',
  '删除车辆动作组成功': 'AGV action group deleted successfully',
  '删除车辆动作组出错：{{msg}}': 'Error deleting AGV action group: {{msg}}',
  // 拖拽重排反馈
  '编辑动作组成功': 'Action group edited successfully',
  '编辑动作组出错：{{msg}}': 'Error editing action group: {{msg}}',
  // 新增/编辑弹窗
  '新增车辆动作分组': 'Add AGV Action Group',
  '编辑车辆动作分组': 'Edit AGV Action Group',
  '请输入动作组名称!': 'Please enter action group name!',
  '请输入动作组名称': 'Please enter action group name',
  '请选择动作组动作!': 'Please select group action!',
  '请选择动作组动作': 'Please select group action',
  '新增动作组成功': 'Action group added successfully',
  '新增动作组出错：{{msg}}': 'Error adding action group: {{msg}}',
  // 失效动作识别（P24 专项：保留原标识并阻止错误保存）
  '动作 #{{id}}（已失效）': 'Action #{{id}} (unavailable)',
  '组内 {{count}} 个动作已失效（已被删除），请先移除后再保存':
    '{{count}} action(s) in the group are no longer available (deleted). Remove them before saving',
  // 弹窗按钮
  '确定': 'Confirm',
  '取消': 'Cancel',
}
