/**
 * en-US · crossMap 命名空间（P10 跨地图关联页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译，逐条沿用；插值语法按本项目
 * i18next 默认双花括号（旧项目为单花括号拼接，值侧同步改写）；
 * 样板升级新增文案（删除确认对象/影响、按行站点加载状态等）按旧真译风格
 * 补译；公共词与 P09 mapList 分片对齐（确定=Confirm 与旧页面真译一致）。
 */

export default {
  // 列表列与筛选
  '跨地图名称': 'Cross-Map Name',
  '设备名称': 'Device Name',
  '设备标识': 'Device ID',
  '操作': 'Action',
  '根据名称查询': 'Search by Name',
  '查询': 'Query',
  // 工具行
  '新增关联': 'Add Association',
  // 行操作与删除确认
  '编辑': 'Edit',
  '删除': 'Delete',
  '删除地图关联': 'Delete Map Association',
  '删除影响：该跨地图关联将被永久删除，关联的电梯与地图站点关系同时解除，且不可恢复':
    'Impact: this cross-map association will be permanently deleted; the elevator-to-map-station relationships are released together and cannot be recovered',
  '删除地图关联成功': 'Map association deleted successfully',
  '删除地图关联出错：{{msg}}': 'Error deleting map association: {{msg}}',
  // 关联行子表（展开行；地图名称/节点名称复用弹窗词条）
  '地图名称': 'Map Name',
  '地图ID': 'Map ID',
  '节点名称': 'Node Name',
  '节点ID': 'Node ID',
  // 新增/编辑弹窗（跨地图名称/地图名称/节点名称复用列表与子表词条）
  '创建跨地图关联': 'Create Cross-Map Association',
  '编辑跨地图关联': 'Edit Cross-Map Association',
  '请输入跨地图名称': 'Please enter cross-map name',
  '跨地图电梯': 'Cross-Map Elevator',
  '请选择跨地图电梯': 'Please select cross-map elevator',
  '至少关联两张地图': 'At least two maps must be associated',
  '地图 {{index}}': 'Map {{index}}',
  '请选择地图名称': 'Please select map name',
  '不能重复选择相同的地图': 'Cannot select the same map more than once',
  '请选择节点名称': 'Please select node name',
  '+ 添加关联地图': '+ Add Associated Map',
  '清空': 'Clear',
  '取消': 'Cancel',
  '确定': 'Confirm',
  // 提交结果
  '创建关联地图成功': 'Associated map created successfully',
  '创建关联地图出错：{{msg}}': 'Error creating associated map: {{msg}}',
  '编辑跨地图关联成功': 'Cross-map association edited successfully',
  '编辑跨地图关联出错：{{msg}}': 'Error editing cross-map association: {{msg}}',
}
