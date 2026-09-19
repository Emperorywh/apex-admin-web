/**
 * en-US · obstacleTemplate 命名空间（P22 避障模板页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译，逐条沿用（列表列/搜索/穿梭框/参数配置/
 * 操作反馈/14 个模板名）；删除确认标题与影响说明、错误 msg 插值、无法识别参数
 * 提示为样板升级补译（按旧真译风格）；公共词与 P11 nodeEdgeGroup 分片对齐
 * （确定=Confirm、查询=Query、清空=Clear）。
 */

export default {
  // 列表列与筛选
  '避障名称': 'Obstacle Name',
  '操作': 'Action',
  '输入避障策略名称查询': 'Search obstacle strategy name',
  '查询': 'Query',
  // 工具行
  '新增避障': 'Add Obstacle',
  // 行操作与删除确认
  '编辑': 'Edit',
  '删除': 'Delete',
  '删除避障模板': 'Delete Obstacle Avoidance Template',
  '删除影响：该避障模板将被永久删除，且不可恢复':
    'Impact: this obstacle avoidance template will be permanently deleted and cannot be recovered',
  '删除避障数据成功': 'Obstacle data deleted successfully',
  '删除避障数据出错：{{msg}}': 'Error deleting obstacle data: {{msg}}',
  // 明细子表（展开行）
  '避障参数名称': 'Obstacle Param Name',
  '避障参数类型': 'Obstacle Param Type',
  '是否启用避障参数': 'Enable Obstacle Param',
  '启用': 'Enabled',
  '未启用': 'Disabled',
  // 新增/编辑弹窗
  '新增避障模板': 'Add Obstacle Template',
  '编辑避障模板': 'Edit Obstacle Template',
  '请输入避障名称': 'Please enter obstacle name',
  '选择模板': 'Select Template',
  '可选模板': 'Available',
  '已选模板': 'Selected',
  '添加': 'Add',
  '移除': 'Remove',
  '搜索模板名称': 'Search Template Name',
  '参数配置': 'Parameters',
  '是否启用': 'Enabled',
  '请选择避障参数类型': 'Please select obstacle param type',
  '请输入自定义名称': 'Please enter custom name',
  '默认': 'Default',
  '自定义{{index}}': 'Custom {{index}}',
  '请至少选择一项避障模板': 'Please select at least one template',
  '请为"{{name}}"选择避障参数类型': 'Please select obstacle param type for "{{name}}"',
  // 无法识别参数可见化（P22 专项「未知值按契约处理」）
  '{{count}} 条避障参数无法识别所属模板，保存后这些参数不会保留':
    '{{count}} obstacle parameter(s) cannot be matched to a template and will not be kept after saving',
  // 弹窗按钮
  '清空': 'Clear',
  '取消': 'Cancel',
  '确定': 'Confirm',
  // 提交结果
  '创建避障数据成功': 'Obstacle data created successfully',
  '创建避障数据出错：{{msg}}': 'Error creating obstacle data: {{msg}}',
  '更新避障数据成功': 'Obstacle data updated successfully',
  '更新避障数据出错：{{msg}}': 'Error updating obstacle data: {{msg}}',
  // 预置模板名（旧真译沿用）
  '前方导航激光': 'Front Nav Laser',
  '后方导航激光': 'Rear Nav Laser',
  '前方避障激光': 'Front Obstacle Laser',
  '后方避障激光': 'Rear Obstacle Laser',
  '左侧避障激光': 'Left Obstacle Laser',
  '左中避障激光': 'Left Middle Obstacle Laser',
  '右侧避障激光': 'Right Obstacle Laser',
  '右中避障激光': 'Right Middle Obstacle Laser',
  '前方避障相机': 'Front Obstacle Camera',
  '后方避障相机': 'Rear Obstacle Camera',
  '左侧避障相机': 'Left Obstacle Camera',
  '右侧避障相机': 'Right Obstacle Camera',
  '后右方叉尖避障': 'Rear Right Fork Tip Obstacle',
  '后左方叉尖避障': 'Rear Left Fork Tip Obstacle',
}
