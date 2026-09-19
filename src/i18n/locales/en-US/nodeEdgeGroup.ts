/**
 * en-US · nodeEdgeGroup 命名空间（P11 多地图点边组合页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译，逐条沿用（列表列/搜索/穿梭框/操作反馈）；
 * 删除确认对象/影响说明、失效关联识别与阻止保存提示为样板升级补译（按旧真译
 * 风格）；公共词与 P10 crossMap 分片对齐（确定=Confirm、查询=Query）。
 */

export default {
  // 列表列与筛选
  '组合名称': 'Group Name',
  '组合Key': 'Group Key',
  '包含组合': 'Included Groups',
  '更新时间': 'Updated',
  '操作': 'Action',
  '根据组合名称查询': 'Search by group name',
  '查询': 'Query',
  // 工具行
  '新增组合': 'Add Group',
  // 行操作与删除确认
  '编辑': 'Edit',
  '删除': 'Delete',
  '删除多地图点边组合': 'Delete Multi-map Node-Edge Group',
  '删除影响：该多地图点边组合将被永久删除，组合内的点边组合引用同时解除，且不可恢复':
    'Impact: this multi-map node-edge group will be permanently deleted; references to its node-edge groups are released together and cannot be recovered',
  '删除多地图点边组合成功': 'Multi-map node-edge group deleted successfully',
  '删除多地图点边组合出错：{{msg}}': 'Error deleting multi-map node-edge group: {{msg}}',
  // 明细子表（展开行）
  '点边组合名称': 'Node-Edge Group Name',
  '所属地图': 'Belonging Map',
  '节点数量': 'Node Count',
  '边数量': 'Edge Count',
  // 新增/编辑弹窗
  '创建多地图点边组合': 'Create Multi-map Node-Edge Group',
  '编辑多地图点边组合': 'Edit Multi-map Node-Edge Group',
  '请输入组合名称': 'Please enter the group name',
  '点边组合': 'Point-Edge Combination',
  '请选择点边组合': 'Please select point-edge combination',
  '至少选择一个点边组合': 'Please select at least one node-edge group',
  '请输入点边组合名称': 'Please enter the node-edge group name',
  '可选点边组合': 'Available Node-Edge Groups',
  '已选点边组合': 'Selected Node-Edge Groups',
  '加入': 'Add',
  '移除': 'Remove',
  '已不可用': 'Unavailable',
  // 失效关联识别并阻止保存（P11 专项验收）
  '组合内 {{count}} 个点边组合已失效，请先在列表中移除后再保存':
    '{{count}} node-edge group(s) in this combination are no longer available; remove them from the list before saving',
  '已选 {{count}} 个点边组合已删除或当前不可见，已保留原标识；保存被暂停，移除后才能保存':
    '{{count}} selected node-edge group(s) have been deleted or are currently invisible; original identifiers are kept — saving is paused until they are removed',
  // 弹窗按钮
  '清空': 'Clear',
  '取消': 'Cancel',
  '确定': 'Confirm',
  // 提交结果
  '创建多地图点边组合成功': 'Multi-map node-edge group created successfully',
  '创建多地图点边组合出错：{{msg}}': 'Error creating multi-map node-edge group: {{msg}}',
  '更新多地图点边组合成功': 'Multi-map node-edge group updated successfully',
  '更新多地图点边组合出错：{{msg}}': 'Error updating multi-map node-edge group: {{msg}}',
}
