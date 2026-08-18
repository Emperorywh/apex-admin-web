/**
 * 菜单管理业务域实体（对齐真实后端 menu MenuTreeResponse / MenuResponse）。
 * 被 pages/features/services 跨层共享的权威定义；
 * 请求/响应 DTO 随 service 任务放入 menu.service.types.ts，不得复制本文件接口。
 */

/** 菜单类型稳定编码（后端 MenuType StrEnum：directory / page / link，无 button） */
export type MenuType = 'directory' | 'page' | 'link'

/** 菜单状态稳定编码（后端 MenuStatus StrEnum：active / disabled） */
export type MenuStatus = 'active' | 'disabled'

/**
 * 菜单实体（管理端树与详情共用形状）：
 * - title 是显示标题，name 是前端路由名称（后端两个独立字段，勿混淆）；
 * - 菜单与权限点是两套体系，实体不携带权限码；
 * - children 由后端保证非空数组（叶子为 []），已按 sortOrder 排序；
 * - 菜单管理只维护后端菜单数据，不动态改变前端静态路由。
 */
export interface MenuItem {
  id: string
  parentId: string | null
  menuType: MenuType
  title: string
  name: string | null
  path: string | null
  component: string | null
  icon: string | null
  sortOrder: number
  visible: boolean
  status: MenuStatus
  children: MenuItem[]
  createdAt: string
  updatedAt: string
}
