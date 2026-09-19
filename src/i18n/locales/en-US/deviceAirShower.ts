/**
 * en-US · deviceAirShower 命名空间（P18 风淋门页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 无有效译文（旧仓库页面 key 即简中），按 B1 基线补译；
 * 「风淋门」沿菜单既定译名 Air Shower Door(s)，「前门/后门」与 deviceElevator
 * 分片对齐（Front Door/Rear Door），开/关门命令沿用 deviceAutoDoor 分片风格。
 */

export default {
  // 列表列（列头文案同旧版逐列：设备名称在前）
  '设备名称': 'Device Name',
  '设备标识': 'Device ID',
  '设备状态': 'Device Status',
  '风淋状态': 'Air Shower Status',
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
  '编辑': 'Edit',
  '删除': 'Delete',
  '操作项': 'Actions',
  '风淋门状态': 'Air Shower Door Status',
  '在线状态': 'Online State',
  '故障': 'Fault',
  '是': 'Yes',
  '否': 'No',
  '前门状态': 'Front Door State',
  '后门状态': 'Rear Door State',
  '状态查询中…': 'Querying status…',
  '暂未查询到风淋门状态': 'Status not queried yet',
  '风淋门状态为空': 'Air shower door status is empty',
  '查询风淋门状态出错': 'Failed to query air shower door status',
  // 删除确认与反馈
  '删除风淋门': 'Delete Air Shower Door',
  '删除影响：风淋门将从系统移除，请确认无任务或调度配置正在引用该风淋门':
    'Impact: the air shower door will be removed from the system. Please make sure no task or dispatch configuration is referencing it',
  '删除风淋门成功': 'Air shower door deleted successfully',
  '删除风淋门出错': 'Failed to delete air shower door',
  // 新增/编辑弹窗（label「设备驱动」「ip地址」为旧版表单原样）
  '新增风淋门': 'Add Air Shower Door',
  '编辑风淋门': 'Edit Air Shower Door',
  '请输入设备名称': 'Please enter device name',
  '设备驱动': 'Device Driver',
  '请选择设备驱动': 'Please select device driver',
  'ip地址': 'IP Address',
  '请输入ip地址': 'Please enter IP address',
  '请输入端口': 'Please enter port',
  '请输入设备配置': 'Please enter device config',
  '设备配置json解析出错': 'Failed to parse device config JSON',
  '新增风淋门成功': 'Air shower door added successfully',
  '新增风淋门出错': 'Failed to add air shower door',
  '编辑风淋门成功': 'Air shower door updated successfully',
  '编辑风淋门出错': 'Failed to update air shower door',
  // 通用按钮（页面分片自带，与 P14–P17 设备族同形态）
  '清空': 'Clear',
  '确定': 'Confirm',
  '取消': 'Cancel',
  // 操作项菜单与控制命令弹窗（旧实现可达命令仅开门/关门，均需选择门类型）
  '开门': 'Open Door',
  '关门': 'Close Door',
  '风淋门开门': 'Open Air Shower Door',
  '风淋门关门': 'Close Air Shower Door',
  '开门类型': 'Open-door Type',
  '关门类型': 'Close-door Type',
  '请选择开门类型': 'Please select the door type to open',
  '请选择关门类型': 'Please select the door type to close',
  '请选择(开/关)门类型': 'Please select the door type',
  '前门': 'Front Door',
  '后门': 'Rear Door',
  // 命令确认与受理反馈（提交 ≠ 完成，结果以「状态」查询为准）
  '开门影响：将向风淋门发送开门命令（{{door}}），执行结果以「状态」查询为准':
    'Impact: an open-door command will be sent to the air shower door ({{door}}). The execution result is subject to the "Status" query',
  '关门影响：将向风淋门发送关门命令（{{door}}），执行结果以「状态」查询为准':
    'Impact: a close-door command will be sent to the air shower door ({{door}}). The execution result is subject to the "Status" query',
  '已发送风淋门开门命令，执行结果以「状态」查询为准':
    'Open-door command sent to the air shower door. The execution result is subject to the "Status" query',
  '已发送风淋门关门命令，执行结果以「状态」查询为准':
    'Close-door command sent to the air shower door. The execution result is subject to the "Status" query',
  '风淋门开门出错': 'Failed to open air shower door',
  '风淋门关门出错': 'Failed to close air shower door',
}
