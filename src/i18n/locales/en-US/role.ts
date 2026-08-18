/**
 * en-US role 命名空间资源（规格 §12）：角色管理页面、RoleForm 与查看权限 Drawer 文案。
 * 中文文案即 key（本文件不维护 zh-CN 资源，缺 key 返回 key 本身）；
 * 命名空间名与文件名一致，经路由 meta.i18nNamespaces 声明后按需加载；
 * 通用文案在命名空间内自持（与 user 命名空间同一取舍，单一命名空间调用）。
 */
const role: Record<string, string> = {
  // 查询工具栏
  全部状态: 'All Statuses',
  排序字段: 'Sort Field',
  排序方向: 'Sort Direction',
  升序: 'Ascending',
  降序: 'Descending',
  重置: 'Reset',
  新增角色: 'New Role',
  // 表格列
  角色标识: 'Role Code',
  角色名称: 'Role Name',
  描述: 'Description',
  排序值: 'Sort Order',
  状态: 'Status',
  创建时间: 'Created At',
  操作: 'Actions',
  编辑: 'Edit',
  删除: 'Delete',
  查看权限: 'View Permissions',
  内置: 'Built-in',
  // 语境差异（固定 context 名，规格 §12）
  启用_status: 'Enabled',
  启用_button: 'Enable',
  禁用_status: 'Disabled',
  禁用_button: 'Disable',
  启用成功: 'Enabled successfully',
  禁用成功: 'Disabled successfully',
  // 表单字段
  编辑角色: 'Edit Role',
  请输入角色标识: 'Please enter a role code',
  '角色标识须为小写字母、数字或下划线，且以字母开头':
    'The role code must start with a letter and contain only lowercase letters, digits, or underscores',
  请输入角色名称: 'Please enter a role name',
  请输入描述: 'Please enter a description',
  请输入排序值: 'Please enter a sort value',
  选填: 'Optional',
  取消: 'Cancel',
  保存: 'Save',
  // Drawer 与操作反馈
  删除角色: 'Delete Role',
  '确定要删除角色「{{name}}」吗？删除后不可恢复。':
    'Are you sure you want to delete role "{{name}}"? This cannot be undone.',
  确认删除: 'Confirm Delete',
  创建角色成功: 'Role created successfully',
  保存成功: 'Saved successfully',
  删除成功: 'Deleted successfully',
  目标角色: 'Target role',
  成员数: 'Members',
  暂无权限: 'No permissions assigned',
  关闭: 'Close',
  '权限加载失败，请关闭后重试': 'Failed to load permissions. Please close and try again.',
}

export default role
