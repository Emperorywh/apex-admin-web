/**
 * en-US · tripartite-traffic 命名空间（P19 三方交管页私有文案；key 为简体中文
 * 文案）。旧系统 en-US 资源对本页 key 有真译的逐条沿用（列头/按钮/校验/反馈）；
 * 失败反馈统一为「……失败：{{msg}}」插值形态（旧版为文案+message 裸拼接，语
 * 义等价）；「删除影响」「通信模拟测试说明」为确认层升级新增文案按旧真译风格
 * 补译（P31/P32 同款）；「点边组合」术语与 nodeEdgeGroup（P11）对齐。
 */

export default {
  // 工具栏
  '请输入区域编号查询': 'Search by area code',
  '新增三方交管': 'Add Third-party Traffic',
  // 列表列
  '区域编号': 'Area Code',
  '点边组合': 'Point-Edge Combination',
  '当前占用系统': 'Currently Occupied System',
  '是否外部系统作为仲裁方': 'External System as Arbiter',
  '操作': 'Action',
  // 布尔映射
  '是': 'Yes',
  '否': 'No',
  // 行操作与检测菜单（旧真译：检测=Test）
  '检测': 'Test',
  '申请': 'Apply',
  '释放': 'Release',
  '编辑': 'Edit',
  '删除': 'Delete',
  // 通用按钮
  '确定': 'Confirm',
  '取消': 'Cancel',
  // 删除确认（confirmCommand 升级文案）
  '删除三方交管': 'Delete Third-party Traffic',
  '删除影响：该区域的三方交管配置将被永久删除，仲裁方对应区域的协同关系随之解除':
    'Deleting the third-party traffic configuration for this area is permanent, and the arbitration coordination for the corresponding area will be released.',
  // 通信模拟测试确认层（专项验收：标识目标与仿真语义）
  '通信模拟测试说明：将向三方仲裁系统发送{{action}}仿真请求（系统编号 rxx），验证协同链路；以真实返回结果为准':
    'Communication simulation: a simulated {{action}} request (system code rxx) will be sent to the third-party arbitration system to verify the coordination link. The real response is the authoritative result.',
  // 新增 / 编辑弹窗
  '编辑三方交管': 'Edit Third-party Traffic',
  '请输入区域编号': 'Please enter area code',
  '请输入点边组合': 'Please enter point-edge combination',
  '请选择点边组合': 'Please select point-edge combination',
  '必须添加一个URL地址': 'At least one URL address is required',
  'Key为必填项': 'Key is required',
  'value为必填项': 'Value is required',
  '扩展key': 'Extension Key',
  '扩展value': 'Extension Value',
  '新增扩展参数': 'Add Extension Param',
  // 操作反馈（成功 / 失败+原因插值）
  '新增三方交管成功': 'Third-party traffic added successfully',
  '新增三方交管失败：{{msg}}': 'Failed to add third-party traffic: {{msg}}',
  '编辑三方交管成功': 'Third-party traffic updated successfully',
  '编辑三方交管失败：{{msg}}': 'Failed to update third-party traffic: {{msg}}',
  '删除三方交管成功': 'Third-party traffic deleted successfully',
  '删除三方交管失败：{{msg}}': 'Failed to delete third-party traffic: {{msg}}',
  '三方交管测试成功': 'Third-party traffic test successful',
  '三方交管测试失败：{{msg}}': 'Third-party traffic test failed: {{msg}}',
  '查询三方交管点边组合失败：{{msg}}': 'Failed to query point-edge combinations: {{msg}}',
}
