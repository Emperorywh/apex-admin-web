/**
 * en-US · nodeMapping 命名空间（P07 节点映射页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译，逐条沿用；插值语法按本项目
 * i18next 默认双花括号（旧项目为单花括号，值侧同步改写）。
 */

export default {
  // 列表列与筛选
  '映射名称': 'Mapping Name',
  '关联AGV数': 'AGV Count',
  '映射地图': 'Mapped Maps',
  '映射点数': 'Point Count',
  '创建时间': 'Created',
  '操作': 'Action',
  '查询': 'Query',
  '重置': 'Reset',
  // 工具行
  '新增节点映射': 'Add Node Mapping',
  '编辑': 'Edit',
  '删除': 'Delete',
  // 删除确认
  '删除节点映射': 'Delete Node Mapping',
  '删除影响：节点映射将从系统移除，绑定该映射的车辆将无法再按其点位执行任务':
    'Impact: the node mapping will be removed from the system; vehicles bound to it can no longer execute tasks by its points',
  '删除节点映射成功': 'Node mapping deleted successfully',
  '删除节点映射失败': 'Failed to delete node mapping',
  // 新增/编辑弹窗
  '编辑节点映射': 'Edit Node Mapping',
  '请输入映射名称': 'Please enter mapping name',
  '关联AGV': 'Associated AGVs',
  '请选择关联AGV': 'Please select associated AGVs',
  '节点映射': 'Node Mapping',
  '请选择地图': 'Please select a map',
  '搜索节点名称/ID': 'Search node name/ID',
  '只看未填完整': 'Incomplete only',
  '期望点位数量': 'Expected Point Count',
  '获取建议': 'Get Suggestions',
  '清空映射行': 'Clear Mapping Rows',
  '确定清空该地图组的全部映射行？': 'Clear all mapping rows in this map group?',
  '清空': 'Clear',
  '删除地图组': 'Remove Map Group',
  '显示 {{shown}} / {{total}} 行': 'Showing {{shown}} / {{total}} rows',
  '共 {{total}} 行': '{{total}} rows in total',
  '未填完整 {{count}} 行': '{{count}} incomplete rows',
  '地图节点': 'Map Node',
  '请选择地图节点': 'Please select a map node',
  '映射点X': 'Mapping X',
  '映射点Y': 'Mapping Y',
  '添加映射行': 'Add Mapping Row',
  '添加地图': 'Add Map',
  // 组校验
  '请至少添加一个地图组': 'Please add at least one map group',
  '每个地图组都需要选择地图': 'Each map group requires a map',
  '每个地图组至少需要一行映射': 'Each map group requires at least one mapping row',
  '存在未填写完整的映射行，已为你过滤显示':
    'Some mapping rows are incomplete; they have been filtered for you',
  // 获取建议
  '获取建议成功': 'Suggestions retrieved successfully',
  '获取建议失败': 'Failed to get suggestions',
  '获取地图节点失败': 'Failed to get map nodes',
  // 提交结果
  '新增节点映射成功': 'Node mapping added successfully',
  '新增节点映射失败': 'Failed to add node mapping',
  '编辑节点映射成功': 'Node mapping updated successfully',
  '编辑节点映射失败': 'Failed to update node mapping',
  // 通用按钮
  '确定': 'Confirm',
  '取消': 'Cancel',
  // 草稿清空
  '清空草稿': 'Clear Draft',
  '确定清空全部草稿（含映射名称、关联AGV与全部地图组）？':
    'Clear the entire draft (mapping name, associated AGVs and all map groups)?',
  '已清空草稿': 'Draft cleared',
  // 地图选点二级弹窗
  '地图选点': 'Pick from Map',
  '当前行': 'Current row',
  '已不在地图上': 'No longer on the map',
  '已选': 'Selected',
} as const
