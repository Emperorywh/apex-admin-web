/**
 * 菜单管理接口测试（规格 §14.3）：getMenuTree/create/update/delete。
 * endpoint 引用 menu 域常量、params/body 透传与 envelope 解包、:id 替换、
 * silent 选项与 send 注入形态。
 */
import type { InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AxiosRequestConfig } from 'axios'
import { MENU_ENDPOINTS } from '@/constants/system/menu/menu.constants'
import { configureRequestAdapter } from '@/services/request/request'
import type { SendRequest } from '@/services/request/request.types'
import { createMockAdapter, successEnvelope, type MockAdapter } from '@/test/requestTestHelpers'
import type { MenuItem } from '@/types/system/menu/menu.types'
import { createMenu, deleteMenu, getMenuTree, updateMenu } from './menu.service'

const menuFixture: MenuItem = {
  id: 'm-1',
  parentId: null,
  type: 'page',
  name: '用户管理',
  routeId: 'system-user',
  path: '/system/user',
  sort: 1,
  visible: true,
  status: 'enabled',
}

let adapter: MockAdapter

beforeEach(() => {
  adapter = createMockAdapter()
  configureRequestAdapter(() => adapter.adapter)
})

afterEach(() => {
  configureRequestAdapter(null)
  window.localStorage.clear()
})

describe('getMenuTree（规格 §14.3：GET /menus/tree，不分页）', () => {
  it('GET menu 域常量 endpoint、无分页参数并解包 MenuItem[]', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope([menuFixture]) }))
    const tree = await getMenuTree()
    expect(tree).toEqual([menuFixture])
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(config.url).toBe(MENU_ENDPOINTS.TREE)
    expect(config.method).toBe('get')
    expect(config.params).toBeUndefined()
  })

  it('send 参数注入页签作用域请求函数：endpoint 仍由 service 组装', async () => {
    const sentConfigs: AxiosRequestConfig[] = []
    const send: SendRequest = <T,>(config: AxiosRequestConfig): Promise<T> => {
      sentConfigs.push(config)
      return Promise.resolve([] as unknown as T)
    }
    await getMenuTree(send)
    expect(sentConfigs).toHaveLength(1)
    expect(sentConfigs[0]).toMatchObject({ url: MENU_ENDPOINTS.TREE, method: 'get' })
    expect(adapter.calls.length).toBe(0)
  })
})

describe('createMenu（规格 §14.3：POST /menus）', () => {
  it('POST 写入契约 body 并解包 MenuItem；silent 关闭全局提示', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(menuFixture) }))
    const created = await createMenu(
      { parentId: null, type: 'page', name: '用户管理', routeId: 'system-user', sort: 1, visible: true, status: 'enabled' },
      { silent: true },
    )
    expect(created).toEqual(menuFixture)
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(config.url).toBe(MENU_ENDPOINTS.CREATE)
    expect(config.method).toBe('post')
    expect(JSON.parse(config.data as string)).toEqual({
      parentId: null,
      type: 'page',
      name: '用户管理',
      routeId: 'system-user',
      sort: 1,
      visible: true,
      status: 'enabled',
    })
    expect(config.silent).toBe(true)
  })

  it('默认不带 silent：表单外的调用走全局统一提示', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(menuFixture) }))
    await createMenu({ parentId: null, type: 'button', name: '新增', permCode: 'system:user:create', sort: 1, visible: true, status: 'enabled' })
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(JSON.parse(config.data as string)).toEqual({
      parentId: null,
      type: 'button',
      name: '新增',
      permCode: 'system:user:create',
      sort: 1,
      visible: true,
      status: 'enabled',
    })
    expect(config.silent).toBeUndefined()
  })
})

describe('updateMenu（规格 §14.3：PUT /menus/:id）', () => {
  it('PUT 编辑契约 body（与创建同构），:id 替换进 endpoint', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(menuFixture) }))
    const updated = await updateMenu(
      'm/1',
      { parentId: null, type: 'directory', name: '系统管理', sort: 2, visible: true, status: 'enabled' },
      { silent: true },
    )
    expect(updated).toEqual(menuFixture)
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(config.url).toBe('/menus/m%2F1')
    expect(config.method).toBe('put')
    expect(JSON.parse(config.data as string)).toEqual({
      parentId: null,
      type: 'directory',
      name: '系统管理',
      sort: 2,
      visible: true,
      status: 'enabled',
    })
  })
})

describe('deleteMenu（规格 §14.3：DELETE /menus/:id）', () => {
  it('DELETE 解包 null 响应', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(null) }))
    await expect(deleteMenu('m-1')).resolves.toBeNull()
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(config.url).toBe(MENU_ENDPOINTS.DELETE.replace(':id', 'm-1'))
    expect(config.method).toBe('delete')
  })
})
