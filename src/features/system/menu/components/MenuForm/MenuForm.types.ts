/**
 * MenuForm 私有类型（规格 §3.4，对齐真实后端写入契约）：
 * 表单模式、表单值与提交载荷只被本组件与菜单管理页消费，紧邻实现共置；
 * 写入契约 DTO 的权威定义位于 menu.service.types.ts，此处仅引用。
 */
import type {
  MenuCreateRequestDto,
  MenuHierarchyRequestDto,
  MenuUpdateRequestDto,
} from '@/services/system/menu/menu.service.types'
import type { MenuType } from '@/types/system/menu/menu.types'

/** 表单模式：创建与编辑共用一套表单字段，但提交契约不同构（编辑不含 menuType，层级走独立端点） */
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

/** 提交载荷：创建为单一写入契约；编辑 = 基本信息契约 + 可选层级调整（parentId/sortOrder 变化时非空） */
export type MenuFormSubmitPayload =
  | { mode: 'create'; dto: MenuCreateRequestDto }
  | { mode: 'edit'; dto: MenuUpdateRequestDto; hierarchy: MenuHierarchyRequestDto | null }
