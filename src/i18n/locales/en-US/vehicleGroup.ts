/**
 * en-US · vehicleGroup 命名空间（P04 车辆分组页）。
 *
 * 旧系统 en-US 真译全部沿用（列表列/搜索框/新增编辑弹窗/穿梭框/操作反馈）；
 * 旧系统缺失的 key（删除确认/影响说明/失效关联标注/清空按钮等）为本次补译。
 */

export default {
  // 列表列
  '分组名称': 'Group Name',
  '标识': 'ID',
  '创建时间': 'Created',
  '操作': 'Action',
  '编辑': 'Edit',
  '删除': 'Delete',
  // 搜索与工具行
  '根据(名称/标识)查询': 'Search by Name/ID',
  '新增分组': 'Add Group',
  // 删除确认（确认框固定附注由 commandConfirm 公共文案承担）
  '删除车辆分组': 'Delete Vehicle Group',
  '删除影响：车辆分组将从系统移除，请确认无调度配置正在引用该分组': 'Impact: the vehicle group will be removed from the system. Make sure no dispatch configuration still references it',
  '删除车辆分组成功': 'Vehicle group deleted successfully',
  '删除车辆分组出错': 'Error deleting vehicle group',
  // 新增/编辑弹窗
  '新增车辆分组': 'Add Vehicle Group',
  '编辑车辆分组': 'Edit Vehicle Group',
  '清空': 'Clear',
  '确定': 'Confirm',
  '取消': 'Cancel',
  '请输入分组名称': 'Please enter group name',
  '选择车辆': 'Select Vehicle',
  '根据名称搜索': 'Search by Name',
  '车辆列表': 'Vehicle List',
  '已添加': 'Added',
  '添加': 'Add',
  '撤回': 'Undo',
  '添加车辆组成功': 'Vehicle group added successfully',
  '添加车辆组出错': 'Error adding vehicle group',
  '更新车辆组成功': 'Vehicle group updated successfully',
  '更新车辆组出错': 'Error updating vehicle group',
  // 失效关联（保留原标识 + 不可用说明，保存按原样提交）
  '已不可用': 'Unavailable',
  '组内 {{count}} 辆车已删除或当前不可见，已保留原标识；保存将原样提交，移除请在此操作': '{{count}} vehicle(s) in the group have been deleted or are currently not visible. Original IDs are kept and will be submitted as-is; remove them here if needed',
}
