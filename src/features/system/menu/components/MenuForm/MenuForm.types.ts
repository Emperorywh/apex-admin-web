/**
 * MenuForm 私有类型（规格 §3.4/§14.3）：
 * 表单模式、表单值与提交载荷只被本组件与菜单管理页消费，紧邻实现共置；
 * 写入契约 DTO 的权威定义位于 menu.service.types.ts，此处仅引用。
 */
import type { MenuWriteRequestDto } from '@/services/system/menu/menu.service.types'
import type { MenuItem } from '@/types/system/menu/menu.types'

/** 表单模式：创建与编辑共用同一写入契约（规格 §14.3：创建/编辑菜单同构） */
export type MenuFormMode = 'create' | 'edit'

/**
 * 表单值：routeId/path 仅 page 类型渲染，permCode 仅 button 类型渲染
 * （条件字段 preserve=false，类型切换即清除，规格 §14.3 按类型条件约束）。
 */
export interface MenuFormValues {
  parentId: string | null
  type: MenuItem['type']
  name: string
  routeId?: string
  path?: string
  permCode?: string
  sort: number
  visible: boolean
  status: MenuItem['status']
}

/** 提交载荷：按模式区分的写入契约 DTO（页面据此调用对应 service 函数） */
export type MenuFormSubmitPayload =
  | { mode: 'create'; dto: MenuWriteRequestDto }
  | { mode: 'edit'; dto: MenuWriteRequestDto }
