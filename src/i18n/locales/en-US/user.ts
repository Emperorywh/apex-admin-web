/**
 * en-US user 命名空间资源（规格 §12）：用户管理页面、UserForm 与分配角色 Drawer 文案。
 * 中文文案即 key（本文件不维护 zh-CN 资源，缺 key 返回 key 本身）；
 * 命名空间名与文件名一致，经路由 meta.i18nNamespaces 声明后按需加载；
 * 通用文案在命名空间内自持（与 dashboard 命名空间同一取舍，单一命名空间调用）。
 */
const user: Record<string, string> = {
  // 查询工具栏
  全部状态: 'All Statuses',
  排序字段: 'Sort Field',
  排序方向: 'Sort Direction',
  升序: 'Ascending',
  降序: 'Descending',
  重置: 'Reset',
  '搜索用户名、显示名称或邮箱': 'Search by username, display name, or email',
  新增用户: 'New User',
  // 表格列
  用户名: 'Username',
  显示名称: 'Display Name',
  邮箱: 'Email',
  手机号: 'Phone',
  最近登录: 'Last Login',
  状态: 'Status',
  创建时间: 'Created At',
  操作: 'Actions',
  编辑: 'Edit',
  删除: 'Delete',
  分配角色: 'Assign Roles',
  // 语境差异（固定 context 名，规格 §12）：status 为状态标签、button 为动作按钮
  启用_status: 'Enabled',
  启用_button: 'Enable',
  禁用_status: 'Disabled',
  禁用_button: 'Disable',
  启用成功: 'Enabled successfully',
  禁用成功: 'Disabled successfully',
  // 表单字段
  密码: 'Password',
  请输入用户名: 'Please enter a username',
  请输入密码: 'Please enter a password',
  请输入显示名称: 'Please enter a display name',
  '密码长度需在 {{min}}-{{max}} 位之间':
    'Password must be {{min}}-{{max}} characters long',
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
  '保存失败，请稍后重试': 'Save failed. Please try again later.',
  删除成功: 'Deleted successfully',
  目标用户: 'Target user',
}

export default user
