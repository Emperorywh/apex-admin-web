/**
 * en-US · deviceElevator 命名空间（P14 电梯页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译，逐条沿用（列表列/表单/控制命令/反馈），
 * 插值统一改 {{var}} 双花括号；命令确认影响说明与 G06 内呼禁用说明为
 * 样板升级补译（按旧真译风格）；「在线/离线/操作」等公共词与其他分片对齐。
 */

export default {
  // 列表列
  '设备名称': 'Device Name',
  '设备标识': 'Device ID',
  '楼层': 'Floor',
  '设备状态': 'Device Status',
  '设备驱动': 'Device Driver',
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
  '电梯状态': 'Elevator Status',
  '在线状态': 'Online State',
  '当前楼层': 'Current Floor',
  '运行状态': 'Running State',
  '前电梯门状态': 'Front Elevator Door State',
  '后电梯门状态': 'Back Elevator Door State',
  '占用电梯的车辆': 'Vehicle Occupying Elevator',
  '状态查询中…': 'Querying status…',
  '暂未查询到电梯状态': 'Status not queried yet',
  '电梯状态为空': 'Elevator status is empty',
  // 操作项菜单（含 G06 内呼禁用入口与说明）
  '呼叫电梯': 'Call Elevator',
  '电梯开门': 'Open Elevator Door',
  '电梯关门': 'Close Elevator Door',
  '清除占用电梯车辆': 'Clear Occupying Elevator Vehicle',
  '电梯上楼（内呼）': 'Elevator Go Up (Inner Call)',
  '内呼接口暂不可用：后端尚未提供该接口契约，开放时间待后端确认':
    'Inner call is unavailable: the backend has not provided this API contract yet; availability awaits backend confirmation',
  // 删除确认与反馈
  '删除电梯': 'Delete Elevator',
  '删除影响：电梯将从系统移除，请确认无地图关联、任务或调度配置正在引用该电梯':
    'Impact: the elevator will be removed from the system. Please make sure no map association, task or dispatch configuration is referencing it',
  '删除电梯成功': 'Elevator deleted successfully',
  '删除电梯出错': 'Failed to delete elevator',
  // 控制命令确认（提交 ≠ 完成，结果以「状态」查询为准）
  '呼叫影响：将向电梯发送呼叫命令（当前楼层 {{floor}}），电梯是否响应以「状态」查询为准':
    'Impact: a call command (current floor {{floor}}) will be sent to the elevator. Whether it responds is subject to the "Status" query',
  '开门影响：将向电梯发送开门命令（{{door}}），执行结果以「状态」查询为准':
    'Impact: an open-door command ({{door}}) will be sent to the elevator. The execution result is subject to the "Status" query',
  '关门影响：将向电梯发送关门命令（{{door}}），执行结果以「状态」查询为准':
    'Impact: a close-door command ({{door}}) will be sent to the elevator. The execution result is subject to the "Status" query',
  '清除影响：将解除车辆对该电梯的占用，被释放车辆恢复调度，执行结果以「状态」查询为准':
    'Impact: the vehicle occupying this elevator will be released and resume scheduling. The execution result is subject to the "Status" query',
  '已发送呼叫电梯命令，执行结果以「状态」查询为准':
    'Call command sent. The execution result is subject to the "Status" query',
  '已发送电梯开门命令，执行结果以「状态」查询为准':
    'Open-door command sent. The execution result is subject to the "Status" query',
  '已发送电梯关门命令，执行结果以「状态」查询为准':
    'Close-door command sent. The execution result is subject to the "Status" query',
  '呼叫电梯出错': 'Failed to call elevator',
  '电梯开门出错': 'Failed to open elevator door',
  '电梯关门出错': 'Failed to close elevator door',
  '清除占用电梯车辆成功': 'Occupying elevator vehicle cleared successfully',
  '清除占用电梯车辆出错': 'Failed to clear occupying elevator vehicle',
  '查询电梯的状态出错': 'Failed to query elevator status',
  // 新增/编辑弹窗
  '新增电梯': 'Add Elevator',
  '编辑电梯': 'Edit Elevator',
  '驱动名称': 'Driver Name',
  '请选择驱动': 'Please select driver',
  '请输入驱动名称': 'Please enter driver name',
  '电梯楼层': 'Elevator Floor',
  '请输入电梯楼层': 'Please enter elevator floor',
  '请输入ip地址': 'Please enter IP address',
  '是否启用': 'Enabled',
  '请选择是否启用': 'Please select enabled status',
  '请输入设备配置': 'Please enter device config',
  '解析json格式出错': 'Failed to parse JSON format',
  '请输入设备名称': 'Please enter device name',
  '新增电梯成功': 'Elevator added successfully',
  '新增电梯出错': 'Failed to add elevator',
  '更新电梯成功': 'Elevator updated successfully',
  '更新电梯出错': 'Failed to update elevator',
  // 控制命令弹窗
  '电梯操作': 'Elevator Operation',
  '请输入电梯当前楼层': 'Please enter elevator current floor',
  '请输入当前楼层': 'Please enter current floor',
  '目标电梯门': 'Target Elevator Door',
  '请选择要操作的电梯门': 'Please select elevator door to operate',
  '前门': 'Front Door',
  '后门': 'Rear Door',
  // 通用按钮（页面分片自带，与 P06 carrierType 同形态）
  '清空': 'Clear',
  '确定': 'Confirm',
  '取消': 'Cancel',
}
