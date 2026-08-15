/**
 * 菜单管理业务域实体（规格 §14.1）。
 * 被 pages/features/services/store 跨层共享的权威定义；
 * 请求/响应 DTO 随 service 任务放入 menu.service.types.ts，不得复制本文件接口。
 */

/**
 * 菜单管理页面演示后端菜单数据维护，不动态改变前端静态路由。
 * page 类型可用 routeId 对应静态定义；button 类型只展示权限资源关系。
 */
export interface MenuItem {
  id: string
  parentId: string | null
  type: 'directory' | 'page' | 'button'
  name: string
  routeId?: string
  path?: string
  permCode?: string
  sort: number
  visible: boolean
  status: 'enabled' | 'disabled'
  children?: MenuItem[]
}
