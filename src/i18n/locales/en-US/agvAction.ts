/**
 * en-US · agvAction 命名空间（P23 车辆动作页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译，逐条沿用（列表列/搜索/弹窗字段/参数行/
 * 操作反馈）；删除确认标题与影响说明、错误 msg 插值为样板升级补译（按旧真译
 * 风格）；公共词与 P22 obstacleTemplate 分片对齐（确定=Confirm、查询=Query、
 * 清空=Clear）。
 */

export default {
  // 列表列与筛选
  '查询车辆动作': 'Query AGV Actions',
  '查询': 'Query',
  '动作类型': 'Action Type',
  '动作描述': 'Description',
  '阻塞类型': 'Block Type',
  '动作参数': 'Parameters',
  '操作': 'Action',
  // 工具行
  '新增动作': 'Add Action',
  // 行操作与删除确认
  '编辑': 'Edit',
  '删除': 'Delete',
  '删除车辆动作': 'Delete AGV Action',
  '删除影响：该动作将被永久删除，且不可恢复':
    'Impact: this action will be permanently deleted and cannot be recovered',
  '删除动作成功': 'Action deleted successfully',
  '删除动作出错：{{msg}}': 'Error deleting action: {{msg}}',
  // 新增/编辑弹窗
  '编辑动作': 'Edit Action',
  '请输入动作类型!': 'Please enter action type!',
  '请输入动作类型': 'Please enter action type',
  '请输入动作描述!': 'Please enter action description!',
  '请输入动作描述': 'Please enter action description',
  '请选择阻塞类型!': 'Please select blocking type!',
  '请选择阻塞类型': 'Please select blocking type',
  '请输入动作名': 'Please enter action name',
  '请输入动作值': 'Please enter action value',
  '动作名': 'Action Name',
  '动作值': 'Action Value',
  '添加动作参数': 'Add Action Parameter',
  // 弹窗按钮
  '清空': 'Clear',
  '取消': 'Cancel',
  '确定': 'Confirm',
  // 提交结果
  '添加动作成功': 'Action added successfully',
  '添加动作出错：{{msg}}': 'Error adding action: {{msg}}',
  '编辑动作成功': 'Action edited successfully',
  '编辑动作出错：{{msg}}': 'Error editing action: {{msg}}',
}
