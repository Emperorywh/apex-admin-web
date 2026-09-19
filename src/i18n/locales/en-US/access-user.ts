/**
 * en-US · access-user 命名空间（P31 用户管理页私有文案；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译的逐条沿用（列头/按钮/校验/反馈）；
 * 「{password}」占位改为 i18next 的 {{password}} 插值形态（P25 沉淀）；
 * 失败反馈统一为「……失败：{{msg}}」插值形态（旧版为文案+message 裸拼接，
 * 语义等价）。「删除影响」为 confirmCommand 升级新增文案按旧真译风格补译。
 */

export default {
  // 工具栏
  '查询用户': 'Search User',
  '新增用户': 'Add User',
  // 列表列
  '用户名': 'Username',
  '状态': 'Status',
  '创建时间': 'Created',
  '更新时间': 'Updated',
  '操作': 'Action',
  // 状态 Switch / Tag
  '启用': 'Enabled',
  '禁用': 'Disabled',
  // 行操作
  '重置密码': 'Reset Password',
  '确定重置该用户密码?': "Are you sure to reset this user's password?",
  '分配角色': 'Assign Roles',
  '删除': 'Delete',
  '确定': 'Confirm',
  '取消': 'Cancel',
  // 删除确认（confirmCommand 升级文案）
  '删除用户': 'Delete User',
  '删除影响：该用户将被永久删除，且不可恢复':
    'Deleting this user is permanent and cannot be undone.',
  // 操作反馈（成功 / 失败+原因插值）
  '修改状态成功': 'Status updated successfully',
  '修改状态失败：{{msg}}': 'Failed to update status: {{msg}}',
  '重置密码成功，新密码为：{{password}}':
    'Password reset successfully. The new password is: {{password}}',
  '重置密码失败：{{msg}}': 'Failed to reset password: {{msg}}',
  '删除用户成功': 'User deleted successfully',
  '删除用户失败：{{msg}}': 'Failed to delete user: {{msg}}',
  '新增用户成功': 'User created successfully',
  '新增用户失败：{{msg}}': 'Failed to create user: {{msg}}',
  '分配角色成功': 'Roles assigned successfully',
  '分配角色失败：{{msg}}': 'Failed to assign roles: {{msg}}',
  '查询角色列表失败：{{msg}}': 'Failed to query role list: {{msg}}',
  // 新增用户弹窗校验
  '请输入用户名': 'Please enter username',
  '用户名只能包含字母、数字、下划线，长度4-16位':
    'Username can only contain letters, numbers, underscores; 4-16 characters',
  '密码': 'Password',
  '请输入密码': 'Please enter password',
  '密码必须包含字母和数字，长度4-16位':
    'Password must contain both letters and numbers, 4-16 characters',
  '确认密码': 'Confirm Password',
  '请再次输入密码': 'Please enter the password again',
  '两次输入的密码不一致': 'The two passwords do not match',
} as const
