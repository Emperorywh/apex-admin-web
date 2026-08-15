/**
 * en-US profile 命名空间资源（规格 §12）：个人中心页面文案（资料编辑与修改密码表单）。
 * 中文文案即 key；通用字段词（用户名/显示名称等）与 user 命名空间保持同一译法。
 */
const profile: Record<string, string> = {
  基本资料: 'Basic Profile',
  修改密码: 'Change Password',
  用户名: 'Username',
  显示名称: 'Display Name',
  邮箱: 'Email',
  手机号: 'Phone',
  选填: 'Optional',
  保存: 'Save',
  请输入显示名称: 'Please enter a display name',
  请输入邮箱: 'Please enter an email',
  邮箱格式不正确: 'Invalid email format',
  资料已更新: 'Profile updated',
  原密码: 'Current Password',
  新密码: 'New Password',
  确认新密码: 'Confirm New Password',
  请输入原密码: 'Please enter the current password',
  请输入新密码: 'Please enter the new password',
  请再次输入新密码: 'Please re-enter the new password',
  '密码最少 {{min}} 位且必须同时包含字母和数字':
    'Password must be at least {{min}} characters and contain both letters and numbers',
  两次输入的密码不一致: 'The two passwords do not match',
  原密码不正确: 'Current password is incorrect',
  密码修改成功: 'Password changed',
}

export default profile
