/**
 * 菜单管理接口（对齐真实后端 menu 模块）：GET /menus/tree 与 create/update/hierarchy/enable/disable/delete。
 * 每个函数显式声明入参与 Promise<T> 返回类型，经封装的 request<T>() 完成类型解包；
 * 接口路径在请求调用点直接内联（规格 §14.3 v1.8）。
 * send 参数默认真实 request 传输；菜单树由页面 Hook 注入 usePageRequest() 的
 * 页签作用域请求函数（规格 §7.4-6），写操作默认走全局传输。
 */
import { request } from '@/services/request/request'
import type { SendRequest } from '@/services/request/request.types'
import type {
  MenuCreateRequestDto,
  MenuHierarchyRequestDto,
  MenuMutationResponseDto,
  MenuTreeResponseDto,
  MenuUpdateRequestDto,
} from './menu.service.types'

/**
 * 写操作可调选项（规格 §7.4-3）：
 * 表单自行呈现错误（字段映射或页面级）的调用方传 silent: true 关闭全局提示，
 * 避免同一错误既弹全局提示又在表单内重复出现；默认走全局统一提示。
 */
export interface MenuWriteOptions {
  silent?: boolean
}

/** 以真实菜单 ID 替换 endpoint 模板中的 :menuId 占位符 */
function fillMenuId(endpoint: string, menuId: string): string {
  return endpoint.replace(':menuId', encodeURIComponent(menuId))
}

/**
 * 菜单树：GET /menus/tree（管理端需要看到全部：显式 include_disabled=true，
 * 含不可见与禁用菜单，兄弟节点按 sortOrder asc 稳定排序；
 * 菜单管理只维护后端菜单数据，不动态改变前端静态路由）。
 */
export function getMenuTree(send: SendRequest = request): Promise<MenuTreeResponseDto> {
  return send<MenuTreeResponseDto>({
    url: '/menus/tree',
    method: 'get',
    params: { include_disabled: true },
  })
}

/** 创建菜单：POST /menus（201 + Location；写入契约见 MenuCreateRequestDto；父菜单无效返回 400） */
export function createMenu(
  dto: MenuCreateRequestDto,
  options: MenuWriteOptions = {},
): Promise<MenuMutationResponseDto> {
  return request<MenuMutationResponseDto>({
    url: '/menus',
    method: 'post',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}

/** 编辑菜单：PUT /menus/:menuId（请求体与创建不同构：不含 parentId/menuType/sortOrder） */
export function updateMenu(
  menuId: string,
  dto: MenuUpdateRequestDto,
  options: MenuWriteOptions = {},
): Promise<MenuMutationResponseDto> {
  return request<MenuMutationResponseDto>({
    url: fillMenuId('/menus/:menuId', menuId),
    method: 'put',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}

/** 调整层级与排序：PUT /menus/:menuId/hierarchy（null 父级表示设为根；成环返回 409） */
export function adjustMenuHierarchy(
  menuId: string,
  dto: MenuHierarchyRequestDto,
  options: MenuWriteOptions = {},
): Promise<MenuMutationResponseDto> {
  return request<MenuMutationResponseDto>({
    url: fillMenuId('/menus/:menuId/hierarchy', menuId),
    method: 'put',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}

/** 启用菜单：POST /menus/:menuId/enable */
export function enableMenu(menuId: string): Promise<MenuMutationResponseDto> {
  return request<MenuMutationResponseDto>({
    url: fillMenuId('/menus/:menuId/enable', menuId),
    method: 'post',
  })
}

/** 禁用菜单：POST /menus/:menuId/disable（禁用菜单不出现在当前用户菜单树中） */
export function disableMenu(menuId: string): Promise<MenuMutationResponseDto> {
  return request<MenuMutationResponseDto>({
    url: fillMenuId('/menus/:menuId/disable', menuId),
    method: 'post',
  })
}

/** 删除菜单：DELETE /menus/:menuId；存在子菜单返回 409，响应 204 空体解包为 null */
export function deleteMenu(menuId: string): Promise<null> {
  return request<null>({
    url: fillMenuId('/menus/:menuId', menuId),
    method: 'delete',
  })
}
