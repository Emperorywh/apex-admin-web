/**
 * en-US role 命名空间资源（规格 §12）：角色管理页面、RoleForm 与分配权限 Drawer 文案，
 * 以及权限树节点标题（后端返回的中文文案即 key，Drawer 内经 t() 解析，规格 §14.1）。
 * 中文文案即 key（本文件不维护 zh-CN 资源，缺 key 返回 key 本身）；
 * 命名空间名与文件名一致，经路由 meta.i18nNamespaces 声明后按需加载；
 * 通用文案在命名空间内自持（与 user 命名空间同一取舍，单一命名空间调用）。
 */
const role: Record<string, string> = {
  // 查询工具栏
  搜索角色标识或名称: 'Search role code or name',
  '默认排序（创建时间倒序）': 'Default sort (created time, newest first)',
  排序方向: 'Sort Direction',
  升序: 'Ascending',
  降序: 'Descending',
  重置: 'Reset',
  新增角色: 'New Role',
  // 表格列
  角色标识: 'Role Code',
  角色名称: 'Role Name',
  描述: 'Description',
  状态: 'Status',
  创建时间: 'Created At',
  操作: 'Actions',
  编辑: 'Edit',
  删除: 'Delete',
  分配权限: 'Assign Permissions',
  内置: 'Built-in',
  // 语境差异（固定 context 名，规格 §12）
  启用_status: 'Enabled',
  禁用_status: 'Disabled',
  // 表单字段
  编辑角色: 'Edit Role',
  请输入角色标识: 'Please enter a role code',
  请输入角色名称: 'Please enter a role name',
  请输入描述: 'Please enter a description',
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
  '权限分配失败，请稍后重试': 'Failed to assign permissions. Please try again later.',
  加载中: 'Loading',
  // 权限树节点标题（demo 权限树 fixture 的 title 值，规格 §14.1）
  仪表盘: 'Dashboard',
  系统管理: 'System',
  演示: 'Demo',
  用户管理: 'User Management',
  角色管理: 'Role Management',
  菜单管理: 'Menu Management',
  多级菜单: 'Nested Menu',
  查看: 'View',
  查询: 'List',
  新增: 'Create',
  分配角色: 'Assign Roles',
}

export default role
