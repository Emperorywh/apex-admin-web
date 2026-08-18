/**
 * 个人中心业务域常量（规格 §12）：i18n 命名空间。
 * 资料与密码接口路径（/auth/profile、/auth/password）由 auth service 在调用点内联
 * （规格 §14.3 v1.8）；路径前缀虽为 /auth，但资源归属个人中心（auth 域仅登录/刷新/登出）。
 */

/**
 * 个人中心页面 i18n 命名空间（规格 §12）：
 * 路由 meta.i18nNamespaces 声明该值，en-US 资源文件为
 * src/i18n/locales/en-US/profile.ts（文件名即命名空间）。
 */
export const PROFILE_I18N_NAMESPACE = 'profile'
