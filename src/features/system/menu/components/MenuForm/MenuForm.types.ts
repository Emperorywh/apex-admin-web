/**
 * MenuForm 私有类型（规格 §3.4）：
 * 表单模式、表单值与提交载荷只被本组件与菜单管理页消费，紧邻实现共置；
 * 纯前端模式下写入载荷由本文件收敛（原 menu service DTO 已随请求层移除）。
 */
import type { MenuItem, MenuType } from '@/types/system/menu/menu.types'

/** 表单模式：创建与编辑共用一套字段；编辑模式下 menuType 禁改（与原后端契约一致） */
export type MenuFormMode = 'create' | 'edit'

/**
 * 表单值：name/path/component 仅 page/link 类型相关字段条件渲染
 * （条件字段 preserve=false，类型切换即清除）。
 */
export interface MenuFormValues {
  parentId: string | null
  menuType: MenuType
  title: string
  name?: string
  path?: string
  component?: string
  icon?: string
  sortOrder: number
  visible: boolean
}

/**
 * 提交载荷：创建/编辑统一形状（menuType 编辑模式下等于原值）；
 * parentId/sortOrder 直接随载荷提交，由页面在内存树中插入或原地更新并按需移动层级。
 */
export interface MenuFormSubmitPayload {
  parentId: string | null
  menuType: MenuType
  title: string
  name?: string
  path?: string
  component?: string
  icon?: string
  sortOrder: number
  visible: boolean
}

/** 编辑目标菜单的表单回显数据（可空字段回显统一为空串） */
export function toMenuFormValues(menu: MenuItem): MenuFormValues {
  return {
    parentId: menu.parentId,
    menuType: menu.menuType,
    title: menu.title,
    name: menu.name ?? '',
    path: menu.path ?? '',
    component: menu.component ?? '',
    icon: menu.icon ?? '',
    sortOrder: menu.sortOrder,
    visible: menu.visible,
  }
}
