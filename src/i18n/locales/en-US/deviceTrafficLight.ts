/**
 * en-US · deviceTrafficLight 命名空间（P17 交通灯页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译，逐条沿用（列表列/表单/测试与增删反馈），
 * 命令确认标题/影响说明为样板升级补译（按旧真译风格，A21 测试=设备控制操作）；
 * 「交通灯」沿用 menu 分片既定译名 Traffic Light。
 */

export default {
  // 列表列（列头文案同旧版逐列：设备标识在前）
  '设备标识': 'Device ID',
  '设备名称': 'Device Name',
  '请求地址': 'Request URL',
  '请求参数': 'Request Params',
  '响应成功表达式': 'Response Success Expression',
  '同步等待响应': 'Sync Wait Response',
  '创建时间': 'Created',
  '操作': 'Action',
  // 同步等待响应两态（false 是明确状态非缺失）
  '是': 'Yes',
  '否': 'No',
  // 工具行
  '请输入交通灯名称或唯一key查询': 'Enter traffic light name or unique key to search',
  '新增交通灯': 'Add Traffic Light',
  // 行操作
  '测试': 'Test',
  '编辑': 'Edit',
  '删除': 'Delete',
  // 测试确认与反馈（A21：向现场设备发起真实连通性请求；失败透传后端诊断信息）
  '测试交通灯': 'Test Traffic Light',
  '测试影响：将向该交通灯设备发起一次连通性测试请求，测试结果以本页反馈消息为准':
    'Impact: a connectivity test request will be sent to the traffic light device. The test result is shown in the feedback message on this page',
  '交通灯测试成功，连通性正常': 'Traffic light test successful, connectivity normal',
  '交通灯测试出错': 'Traffic light test error',
  // 删除确认与反馈
  '删除交通灯': 'Delete Traffic Light',
  '删除影响：交通灯将从系统移除，请确认无任务或调度配置正在引用该交通灯':
    'Impact: the traffic light will be removed from the system. Please make sure no task or dispatch configuration is referencing it',
  '删除交通灯成功': 'Traffic light deleted successfully',
  '删除交通灯出错': 'Failed to delete traffic light',
  // 新增/编辑弹窗（label 同旧版表单原样：到点通知对应 syncWaitResponse）
  '新增交通灯成功': 'Traffic light added successfully',
  '新增交通灯出错': 'Failed to add traffic light',
  '编辑交通灯': 'Edit Traffic Light',
  '编辑交通灯成功': 'Traffic light updated successfully',
  '编辑交通灯出错': 'Failed to update traffic light',
  '交通灯名称': 'Traffic Light Name',
  '请输入交通灯名称': 'Please enter traffic light name',
  '设备驱动': 'Device Driver',
  '请选择设备驱动': 'Please select device driver',
  '请输入请求地址': 'Please enter request URL',
  '请输入JSON格式请求参数': 'Enter JSON request params',
  '请求参数JSON格式不正确': 'Request param JSON format is invalid',
  '请输入响应成功表达式': 'Please enter response success expression',
  '到点通知': 'Arrival Notification',
  '请选择是否同步等待响应': 'Please select whether to sync wait for response',
  // 通用按钮（页面分片自带，与 P14–P16 同形态）
  '清空': 'Clear',
  '确定': 'Confirm',
  '取消': 'Cancel',
}
