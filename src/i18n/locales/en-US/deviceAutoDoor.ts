/**
 * en-US · deviceAutoDoor 命名空间（P15 自动门页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译，逐条沿用（列表列/表单/控制命令/反馈），
 * 插值统一改 {{var}} 双花括号；命令确认影响说明与占用车辆清单为
 * 样板升级补译（按旧真译风格）；「在线/离线/操作」等公共词与其他分片对齐。
 */

export default {
  // 列表列（列头文案同旧版：驱动/启用状态）
  '设备名称': 'Device Name',
  '设备标识': 'Device ID',
  '驱动': 'Driver',
  '启用状态': 'Enabled Status',
  'IP地址': 'IP Address',
  '端口': 'Port',
  '设备配置': 'Device Config',
  '网络状态': 'Network Status',
  '操作': 'Action',
  // 状态/网络枚举（未知枚举不经此表，显示协议原值）
  '启用': 'Enabled',
  '禁用': 'Disabled',
  '在线': 'Online',
  '离线': 'Offline',
  '配置内容': 'Configuration',
  // 工具行
  '根据(名称/标识)查询': 'Search by Name/ID',
  '新增设备': 'Add Device',
  // 行操作与状态 Popover
  '状态': 'Status',
  '操作项': 'Actions',
  '编辑': 'Edit',
  '删除': 'Delete',
  '自动门状态': 'Auto Door Status',
  '门状态': 'Door State',
  '状态查询中…': 'Querying status…',
  '暂未查询到自动门状态': 'Status not queried yet',
  '自动门状态为空': 'Auto door status is empty',
  // 操作项菜单与命令确认（提交 ≠ 完成，结果以「状态」查询为准）
  '开门': 'Open Door',
  '关门': 'Close Door',
  '清除占用自动门车辆': 'Clear Occupying Auto Door Vehicle',
  '开门影响：将向自动门发送开门命令，执行结果以「状态」查询为准':
    'Impact: an open-door command will be sent to the auto door. The execution result is subject to the "Status" query',
  '关门影响：将向自动门发送关门命令，执行结果以「状态」查询为准':
    'Impact: a close-door command will be sent to the auto door. The execution result is subject to the "Status" query',
  '已发送自动门开门命令，执行结果以「状态」查询为准':
    'Open-door command sent. The execution result is subject to the "Status" query',
  '已发送自动门关门命令，执行结果以「状态」查询为准':
    'Close-door command sent. The execution result is subject to the "Status" query',
  '自动门开门出错': 'Failed to open auto door',
  '自动门关门出错': 'Failed to close auto door',
  '清除影响：将解除车辆对该自动门的占用，被释放车辆恢复调度，执行结果以「状态」查询为准':
    'Impact: the vehicle occupying this auto door will be released and resume scheduling. The execution result is subject to the "Status" query',
  '清除影响：将解除车辆对该自动门的占用（当前占用：{{vehicles}}），被释放车辆恢复调度，执行结果以「状态」查询为准':
    'Impact: the vehicle occupying this auto door will be released (currently occupied by: {{vehicles}}) and resume scheduling. The execution result is subject to the "Status" query',
  '{{count}} 台车辆：{{names}} 等': '{{count}} vehicles: {{names}}, etc.',
  '清除占用自动门车辆成功': 'Occupying auto door vehicle cleared successfully',
  '清除占用自动门车辆出错': 'Failed to clear occupying auto door vehicle',
  '查询自动门状态出错': 'Failed to query auto door status',
  // 删除确认与反馈
  '删除自动门': 'Delete Auto Door',
  '删除影响：自动门将从系统移除，请确认无任务、地图关联或调度配置正在引用该自动门':
    'Impact: the auto door will be removed from the system. Please make sure no task, map association or dispatch configuration is referencing it',
  '删除自动门成功': 'Auto door deleted successfully',
  '删除自动门出错': 'Failed to delete auto door',
  // 新增/编辑弹窗（label「设备驱动」「ip地址」为旧版表单原样）
  '添加自动门': 'Add Auto Door',
  '编辑自动门': 'Edit Auto Door',
  '设备驱动': 'Device Driver',
  '请选择设备驱动': 'Please select device driver',
  'ip地址': 'IP Address',
  '请输入ip地址': 'Please enter IP address',
  '请输入端口': 'Please enter port',
  '是否启用': 'Enabled',
  '请选择是否启用': 'Please select enabled status',
  '请输入设备配置': 'Please enter device config',
  '设备配置json解析出错': 'Failed to parse device config JSON',
  '请输入设备名称': 'Please enter device name',
  '添加自动门成功': 'Auto door added successfully',
  '添加自动门出错': 'Failed to add auto door',
  '更新自动门成功': 'Auto door updated successfully',
  '更新自动门出错': 'Failed to update auto door',
  // 通用按钮（页面分片自带，与 P14 deviceElevator 同形态）
  '清空': 'Clear',
  '确定': 'Confirm',
  '取消': 'Cancel',
}
