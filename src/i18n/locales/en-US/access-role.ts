/**
 * en-US · access-role 命名空间（P32 角色管理页私有文案；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译的逐条沿用（列头/按钮/校验/反馈/三态全
 * 选词）；失败反馈统一为「……失败：{{msg}}」插值形态（旧版为文案+message 裸
 * 拼接，语义等价）；「删除影响」为 confirmCommand 升级新增文案按旧真译风格
 * 补译（P31 同款）；术语与 access-user 对齐（角色 Role / 权限 Permission）。
 */

export default {
  // 工具栏
  '查询角色': 'Search Role',
  '新增角色': 'Add Role',
  // 列表列
  '角色编码': 'Role Code',
  '角色名称': 'Role Name',
  '状态': 'Status',
  '创建时间': 'Created',
  '更新时间': 'Updated',
  '操作': 'Action',
  // 状态文案
  '启用': 'Enabled',
  '禁用': 'Disabled',
  // 行操作
  '编辑': 'Edit',
  '分配权限': 'Assign Permissions',
  '删除': 'Delete',
  '确定': 'Confirm',
  '取消': 'Cancel',
  // 删除确认（confirmCommand 升级文案）
  '删除角色': 'Delete Role',
  '删除影响：该角色将被永久删除且不可恢复，关联用户将失去对应权限':
    'Deleting this role is permanent and cannot be undone. Users with this role will lose the corresponding permissions.',
  // 新增 / 编辑弹窗
  '角色状态': 'Role Status',
  '请输入角色编码': 'Please enter role code',
  '请输入角色名称': 'Please enter role name',
  '请选择角色状态': 'Please select role status',
  '编辑角色': 'Edit Role',
  // 分配权限弹窗（三态勾选）
  '全选': 'Select All',
  '取消全选': 'Unselect All',
  // 操作反馈（成功 / 失败+原因插值）
  '新增角色成功': 'Role added successfully',
  '新增角色失败：{{msg}}': 'Failed to add role: {{msg}}',
  '编辑角色成功': 'Role updated successfully',
  '编辑角色失败：{{msg}}': 'Failed to update role: {{msg}}',
  '删除角色成功': 'Role deleted successfully',
  '删除角色失败：{{msg}}': 'Failed to delete role: {{msg}}',
  '分配权限成功': 'Permissions assigned successfully',
  '分配权限失败：{{msg}}': 'Failed to assign permissions: {{msg}}',
  '查询权限资源失败：{{msg}}': 'Failed to query permission resources: {{msg}}',
} as const
