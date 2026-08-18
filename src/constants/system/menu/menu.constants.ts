/**
 * 菜单管理业务域常量（规格 §14.1/§14.3）：菜单类型枚举与可识别 routeId 全集。
 * 菜单页面、feature 组件/Hook、menu service 与 demo adapter 一律引用本文件；
 * 接口路径由 menu service 在调用点内联（规格 §14.3 v1.8）。
 * 菜单管理只演示后端菜单数据维护，不动态改变前端静态路由。
 */

/**
 * 菜单节点类型枚举（规格 §14.1 MenuItem.type）。
 * directory/page/button 的字段约束见各 endpoint 注释与写入契约。
 */
export const MENU_TYPES = {
  DIRECTORY: 'directory',
  PAGE: 'page',
  BUTTON: 'button',
} as const

/** 菜单节点类型联合类型：由 MENU_TYPES 推导 */
export type MenuType = (typeof MENU_TYPES)[keyof typeof MENU_TYPES]

/**
 * page 类型菜单可选的 routeId 全集（规格 §14.3「可识别 routeId」，v1.10）。
 * 业务路由 id 已内联于 src/router/definitions.tsx（route.constants 只保留框架核心路由），
 * 且依赖方向禁止本文件反向导入 router，故改为菜单域显式白名单：只收录真正挂载页面
 * 组件的路由 id，与 definitions.tsx 的页面叶子镜像——新增页面需在菜单管理中作为
 * page 关联时同步本清单。菜单表单的 routeId 校验与 demo adapter 的写入校验共用
 * 同一判定，不在调用点各写一份白名单。
 */
export const MENU_PAGE_ROUTE_IDS: readonly string[] = [
  'dashboard',
  'system-user',
  'system-role',
  'system-menu',
  'profile',
  'demo-nested-level1',
  'demo-nested-level2',
  'demo-nested-level3',
]

/**
 * 菜单管理页面 i18n 命名空间（规格 §12）。
 * 基础命名空间 menu 已被路由标题/面包屑占用，菜单管理域使用 systemMenu 区分；
 * en-US 资源文件为 src/i18n/locales/en-US/systemMenu.ts（文件名即命名空间）。
 */
export const MENU_I18N_NAMESPACE = 'systemMenu'
