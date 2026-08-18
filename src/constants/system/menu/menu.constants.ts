/**
 * 菜单管理业务域常量（对齐真实后端 menu 模块）：
 * 菜单类型枚举的唯一所有者。
 * 菜单页面、feature 组件/Hook 与 menu service 一律引用本文件；
 * 接口路径由 menu service 在调用点内联（规格 §14.3 v1.8）。
 * 菜单管理只维护后端菜单数据，不动态改变前端静态路由。
 */

/**
 * 菜单节点类型枚举（后端 MenuType StrEnum）：
 * directory 组织层级、page 对应前端路由组件、link 外部 URL；
 * 后端无 button 类型（按钮权限由 RBAC 权限点体系承担，不挂在菜单上）。
 */
export const MENU_TYPES = {
  DIRECTORY: 'directory',
  PAGE: 'page',
  LINK: 'link',
} as const

/** 菜单节点类型联合类型：由 MENU_TYPES 推导 */
export type MenuType = (typeof MENU_TYPES)[keyof typeof MENU_TYPES]

/**
 * 菜单管理页面 i18n 命名空间（规格 §12）。
 * 基础命名空间 menu 已被路由标题/面包屑占用，菜单管理域使用 systemMenu 区分；
 * en-US 资源文件为 src/i18n/locales/en-US/systemMenu.ts（文件名即命名空间）。
 */
export const MENU_I18N_NAMESPACE = 'systemMenu'
