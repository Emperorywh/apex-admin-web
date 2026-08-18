/**
 * 菜单管理四接口（规格 §14.3）：GET /menus/tree 与 create/update/delete。
 * 每个函数显式声明入参与 Promise<T> 返回类型，经封装的 request<T>() 完成类型解包；
 * 接口路径在请求调用点直接内联（规格 §14.3 v1.8）。
 * send 参数默认真实 request 传输；菜单树由页面 Hook 注入 usePageRequest() 的
 * 页签作用域请求函数（规格 §7.4-6），写操作默认走全局传输。
 */
import { request } from '@/services/request/request'
import type { SendRequest } from '@/services/request/request.types'
import type {
  MenuMutationResponseDto,
  MenuTreeResponseDto,
  MenuWriteRequestDto,
} from './menu.service.types'

/**
 * 写操作可调选项（规格 §7.4-3）：
 * 表单自行呈现错误（字段映射或页面级）的调用方传 silent: true 关闭全局提示，
 * 避免同一错误既弹全局提示又在表单内重复出现；默认走全局统一提示。
 */
export interface MenuWriteOptions {
  silent?: boolean
}

/** 以真实菜单 ID 替换 endpoint 模板中的 :id 占位符 */
function fillMenuId(endpoint: string, menuId: string): string {
  return endpoint.replace(':id', encodeURIComponent(menuId))
}

/**
 * 菜单树：GET /menus/tree（规格 §14.3：不分页，兄弟节点按 sort asc、id asc 稳定排序；
 * 菜单管理只维护后端菜单数据，不动态改变前端静态路由）。
 */
export function getMenuTree(send: SendRequest = request): Promise<MenuTreeResponseDto> {
  return send<MenuTreeResponseDto>({
    url: '/menus/tree',
    method: 'get',
  })
}

/** 创建菜单：POST /menus（写入契约见 MenuWriteRequestDto 的按类型条件约束） */
export function createMenu(
  dto: MenuWriteRequestDto,
  options: MenuWriteOptions = {},
): Promise<MenuMutationResponseDto> {
  return request<MenuMutationResponseDto>({
    url: '/menus',
    method: 'post',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}

/** 编辑菜单：PUT /menus/:id（请求体与创建同构，规格 §14.3） */
export function updateMenu(
  menuId: string,
  dto: MenuWriteRequestDto,
  options: MenuWriteOptions = {},
): Promise<MenuMutationResponseDto> {
  return request<MenuMutationResponseDto>({
    url: fillMenuId('/menus/:id', menuId),
    method: 'put',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}

/** 删除菜单：DELETE /menus/:id；存在子节点时返回 RESOURCE_CONFLICT，响应 data 固定为 null */
export function deleteMenu(menuId: string): Promise<null> {
  return request<null>({
    url: fillMenuId('/menus/:id', menuId),
    method: 'delete',
  })
}
