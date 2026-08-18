/**
 * 角色管理接口测试（规格 §14.3）：list/create/update/delete/assign-permissions
 * 与 GET /permissions/tree。
 * endpoint 引用 role 域常量、params/body 透传与 envelope 解包、:id 替换、
 * silent 选项与 send 注入形态。
 */
import type { InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AxiosRequestConfig } from 'axios'
import { configureRequestAdapter } from '@/services/request/request'
import type { SendRequest } from '@/services/request/request.types'
import { createMockAdapter, successEnvelope, type MockAdapter } from '@/test/requestTestHelpers'
import type { Role } from '@/types/system/role/role.types'
import {
  assignRolePermissions,
  createRole,
  deleteRole,
  getPermissionTree,
  listRoles,
  updateRole,
} from './role.service'

const roleFixture: Role = {
  id: 'r-1',
  code: 'admin',
  name: '管理员',
  status: 'enabled',
  builtIn: true,
  permCodes: ['*'],
  createdAt: '2026-08-15T00:00:00+08:00',
  updatedAt: '2026-08-15T00:00:00+08:00',
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

describe('listRoles（规格 §14.3：GET /roles）', () => {
  it('GET role 域常量 endpoint，params 透传并解包 PageResult<Role>', async () => {
    adapter.respondWith(() => ({
      status: 200,
      data: successEnvelope({ list: [roleFixture], total: 1, page: 1, size: 100 }),
    }))
    const page = await listRoles({ page: 1, size: 100 })
    expect(page).toEqual({ list: [roleFixture], total: 1, page: 1, size: 100 })
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(config.url).toBe('/roles')
    expect(config.method).toBe('get')
    expect(config.params).toEqual({ page: 1, size: 100 })
  })

  it('send 参数注入页签作用域请求函数：endpoint 仍由 service 组装', async () => {
    const sentConfigs: AxiosRequestConfig[] = []
    const send: SendRequest = <T,>(config: AxiosRequestConfig): Promise<T> => {
      sentConfigs.push(config)
      return Promise.resolve({ list: [], total: 0, page: 1, size: 10 } as unknown as T)
    }
    await listRoles({ keyword: 'admin' }, send)
    expect(sentConfigs).toHaveLength(1)
    expect(sentConfigs[0]).toMatchObject({ url: '/roles', method: 'get' })
    expect(adapter.calls.length).toBe(0)
  })
})

describe('createRole（规格 §14.3：POST /roles）', () => {
  it('POST 创建契约 body 并解包 Role；silent 关闭全局提示', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(roleFixture) }))
    const created = await createRole(
      { code: 'operator', name: '运营', status: 'enabled' },
      { silent: true },
    )
    expect(created).toEqual(roleFixture)
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(config.url).toBe('/roles')
    expect(config.method).toBe('post')
    expect(JSON.parse(config.data as string)).toEqual({ code: 'operator', name: '运营', status: 'enabled' })
    expect(config.silent).toBe(true)
  })

  it('默认不带 silent：表单外的调用走全局统一提示', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(roleFixture) }))
    await createRole({ code: 'operator', name: '运营', description: '选填描述', status: 'disabled' })
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(JSON.parse(config.data as string)).toEqual({ code: 'operator', name: '运营', description: '选填描述', status: 'disabled' })
    expect(config.silent).toBeUndefined()
  })
})

describe('updateRole（规格 §14.3：PUT /roles/:id，编辑契约不含 code）', () => {
  it('PUT 编辑契约 body，:id 替换进 endpoint', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(roleFixture) }))
    const updated = await updateRole('r/1', { name: '管理员', status: 'disabled' }, { silent: true })
    expect(updated).toEqual(roleFixture)
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(config.url).toBe('/roles/r%2F1')
    expect(config.method).toBe('put')
    expect(JSON.parse(config.data as string)).toEqual({ name: '管理员', status: 'disabled' })
  })
})

describe('deleteRole（规格 §14.3：DELETE /roles/:id）', () => {
  it('DELETE 解包 null 响应', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(null) }))
    await expect(deleteRole('r-1')).resolves.toBeNull()
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(config.url).toBe('/roles/r-1')
    expect(config.method).toBe('delete')
  })
})

describe('assignRolePermissions（规格 §14.3：PUT /roles/:id/permissions）', () => {
  it('PUT body { permCodes }，:id 替换进 endpoint', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(roleFixture) }))
    const updated = await assignRolePermissions('r-1', { permCodes: ['dashboard:view'] }, { silent: true })
    expect(updated).toEqual(roleFixture)
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(config.url).toBe('/roles/:id/permissions'.replace(':id', 'r-1'))
    expect(config.method).toBe('put')
    expect(JSON.parse(config.data as string)).toEqual({ permCodes: ['dashboard:view'] })
  })
})

describe('getPermissionTree（规格 §14.3：GET /permissions/tree）', () => {
  it('GET 权限树 endpoint 并解包 PermissionNode[]', async () => {
    const treeFixture = [{ key: 'dashboard:view', title: '查看仪表盘', permCode: 'dashboard:view' }]
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(treeFixture) }))
    const tree = await getPermissionTree()
    expect(tree).toEqual(treeFixture)
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(config.url).toBe('/permissions/tree')
    expect(config.method).toBe('get')
  })

  it('send 参数注入页签作用域请求函数', async () => {
    const sentConfigs: AxiosRequestConfig[] = []
    const send: SendRequest = <T,>(config: AxiosRequestConfig): Promise<T> => {
      sentConfigs.push(config)
      return Promise.resolve([] as unknown as T)
    }
    await getPermissionTree(send)
    expect(sentConfigs).toHaveLength(1)
    expect(sentConfigs[0]).toMatchObject({ url: '/permissions/tree', method: 'get' })
    expect(adapter.calls.length).toBe(0)
  })
})
