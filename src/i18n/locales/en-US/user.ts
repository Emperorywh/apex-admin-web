/**
 * en-US user 命名空间资源（规格 §12）：用户管理页面、UserForm 与分配角色 Drawer 文案。
 * 中文文案即 key（本文件不维护 zh-CN 资源，缺 key 返回 key 本身）；
 * 命名空间名与文件名一致，经路由 meta.i18nNamespaces 声明后按需加载；
 * 通用文案在命名空间内自持（与 dashboard 命名空间同一取舍，单一命名空间调用）。
 */
const user: Record<string, string> = {
  // 查询工具栏
  搜索用户名或显示名称: 'Search username or display name',
  默认排序: 'Default Sort',
  '默认排序（创建时间倒序）': 'Default sort (created time, newest first)',
  排序方向: 'Sort Direction',
  升序: 'Ascending',
  降序: 'Descending',
  重置: 'Reset',
  新增用户: 'New User',
  // 表格列
  用户名: 'Username',
  显示名称: 'Display Name',
  邮箱: 'Email',
  手机号: 'Phone',
  状态: 'Status',
  创建时间: 'Created At',
  操作: 'Actions',
  编辑: 'Edit',
  删除: 'Delete',
  分配角色: 'Assign Roles',
  // 语境差异（固定 context 名，规格 §12）
  启用_status: 'Enabled',
  禁用_status: 'Disabled',
  // 表单字段
  密码: 'Password',
  角色: 'Roles',
  请输入用户名: 'Please enter a username',
  请输入密码: 'Please enter a password',
  请输入显示名称: 'Please enter a display name',
  请输入邮箱: 'Please enter an email address',
  请选择角色: 'Please select roles',
  '密码最少 {{min}} 位且必须同时包含字母和数字':
    'Password must be at least {{min}} characters and contain both letters and numbers',
  邮箱格式不正确: 'Invalid email address format',
  选填: 'Optional',
  取消: 'Cancel',
  保存: 'Save',
  // Drawer 与操作反馈
  编辑用户: 'Edit User',
  '确定要删除用户「{{name}}」吗？删除后不可恢复。':
    'Are you sure you want to delete user "{{name}}"? This cannot be undone.',
  删除用户: 'Delete User',
  确认删除: 'Confirm Delete',
  创建用户成功: 'User created successfully',
  保存成功: 'Saved successfully',
  删除成功: 'Deleted successfully',
  目标用户: 'Target user',
  角色分配失败: 'Failed to assign roles',
  '角色分配失败，请稍后重试': 'Failed to assign roles. Please try again later.',
}

export default user
