/**
 * en-US · deviceChargePile 命名空间（P16 充电桩页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译，逐条沿用（列表列/表单/命令反馈/状态词），
 * 命令确认影响说明与受理语义提示为样板升级补译（按旧真译风格，提交 ≠ 完成）；
 * 「配置内容/操作项」等公共词与 deviceElevator/deviceAutoDoor 分片对齐。
 */

export default {
  // 列表列（列头文案同旧版逐列：设备标识在前）
  '设备标识': 'Device ID',
  '设备名称': 'Device Name',
  '设备状态': 'Device Status',
  '关联的驱动': 'Associated Driver',
  '设备的IP地址': 'Device IP Address',
  '设备的端口号': 'Device Port',
  '设备配置信息': 'Device Config',
  '充电桩状态': 'Charging Station Status',
  '操作': 'Action',
  // 设备状态/充电桩状态词（未知枚举不经此表，显示协议原值）
  '启用': 'Enabled',
  '禁用': 'Disabled',
  '错误': 'Error',
  '空闲': 'Idle',
  '充电中': 'Charging',
  '充满': 'Full',
  '离线': 'Offline',
  '配置内容': 'Configuration',
  // 工具行
  '请输入设备名称查询': 'Search by device name',
  '新增充电桩': 'Add Charging Station',
  // 行操作
  '操作项': 'Actions',
  '开始充电': 'Start Charging',
  '停止充电': 'Stop Charging',
  '编辑': 'Edit',
  '删除': 'Delete',
  // 命令确认与反馈（提交 ≠ 完成，充电桩状态的更新以列表「充电桩状态」列为准）
  '开始充电影响：将向充电桩发送开始充电命令，充电桩状态的更新以列表「充电桩状态」列为准':
    'Impact: a start-charging command will be sent to the charging station. The charging station status update is subject to the "Charging Station Status" column in the list',
  '停止充电影响：将向充电桩发送停止充电命令，充电桩状态的更新以列表「充电桩状态」列为准':
    'Impact: a stop-charging command will be sent to the charging station. The charging station status update is subject to the "Charging Station Status" column in the list',
  '已发送开始充电命令，充电桩状态的更新以列表「充电桩状态」列为准':
    'Start-charging command sent. The charging station status update is subject to the "Charging Station Status" column in the list',
  '已发送停止充电命令，充电桩状态的更新以列表「充电桩状态」列为准':
    'Stop-charging command sent. The charging station status update is subject to the "Charging Station Status" column in the list',
  '开始充电出错': 'Failed to start charging',
  '停止充电出错': 'Failed to stop charging',
  // 删除确认与反馈
  '删除充电桩': 'Delete Charging Station',
  '删除影响：充电桩将从系统移除，请确认无任务或调度配置正在引用该充电桩':
    'Impact: the charging station will be removed from the system. Please make sure no task or dispatch configuration is referencing it',
  '删除当前充电桩成功': 'Charging station deleted successfully',
  '删除当前充电桩出错': 'Failed to delete charging station',
  // 新增/编辑弹窗（label 同旧版表单原样：设备IP地址/设备端口号）
  '新增充电桩成功': 'Charging station added successfully',
  '新增充电桩出错': 'Failed to add charging station',
  '编辑充电桩': 'Edit Charging Station',
  '编辑充电桩成功': 'Charging station updated successfully',
  '编辑充电桩出错': 'Failed to update charging station',
  '设备驱动': 'Device Driver',
  '请选择设备驱动': 'Please select device driver',
  '是否启用': 'Enabled',
  '请选择是否启用': 'Please select enabled status',
  '设备IP地址': 'Device IP Address',
  '请输入设备IP地址': 'Please enter device IP address',
  '请输入正确的IP地址': 'Please enter a valid IP address',
  '设备端口号': 'Device Port',
  '请输入设备端口号': 'Please enter device port',
  '设备配置': 'Device Config',
  '请输入设备配置': 'Please enter device config',
  '解析设备配置json出错': 'Failed to parse device config JSON',
  '请输入设备名称': 'Please enter device name',
  // 通用按钮（页面分片自带，与 P14/P15 同形态）
  '清空': 'Clear',
  '确定': 'Confirm',
  '取消': 'Cancel',
}
