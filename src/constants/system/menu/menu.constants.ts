/**
 * 菜单管理业务域常量（规格 §14.1/§14.3）：endpoint 与菜单类型枚举。
 * 菜单页面、feature 组件/Hook、menu service 与 demo adapter 一律引用本文件。
 * 菜单管理只演示后端菜单数据维护，不动态改变前端静态路由。
 */

/** 菜单接口路径模板（规格 §14.3）；:id 由 service 以真实菜单 ID 替换 */
export const MENU_ENDPOINTS = {
  /** 菜单树：不分页，兄弟节点按 sort asc、id asc 稳定排序 */
  TREE: '/menus/tree',
  /** 创建菜单：directory 不得设 routeId，page 必须设 routeId，button 必须设 permCode */
  CREATE: '/menus',
  /** 编辑菜单：与创建同构 */
  UPDATE: '/menus/:id',
  /** 删除菜单：存在子节点时返回 RESOURCE_CONFLICT */
  DELETE: '/menus/:id',
} as const

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
