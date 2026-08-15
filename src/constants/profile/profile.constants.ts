/**
 * 个人中心业务域常量（规格 §6.3/§14.2）：资料与密码接口。
 * profile service、资料表单与修改密码表单一律引用本文件；
 * 路径前缀虽为 /auth，但资源归属个人中心（auth 域仅保留登录/刷新/登出）。
 */

/** 个人中心接口路径模板（规格 §6.3） */
export const PROFILE_ENDPOINTS = {
  /** 启动闸门与个人中心共用：GET → ProfileData */
  GET_PROFILE: '/auth/profile',
  /** 编辑资料：body { displayName, email, phone? } → User */
  UPDATE_PROFILE: '/auth/profile',
  /** 修改密码：body { oldPassword, newPassword } → null；新旧密码均需满足密码策略 */
  CHANGE_PASSWORD: '/auth/password',
} as const

/**
 * 个人中心页面 i18n 命名空间（规格 §12）：
 * 路由 meta.i18nNamespaces 声明该值，en-US 资源文件为
 * src/i18n/locales/en-US/profile.ts（文件名即命名空间）。
 */
export const PROFILE_I18N_NAMESPACE = 'profile'
