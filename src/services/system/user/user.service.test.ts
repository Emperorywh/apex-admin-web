/**
 * 用户管理五接口测试（规格 §14.3/§7.1）：
 * endpoint 引用 USER_ENDPOINTS 域常量、:id 替换、写入契约 body、silent 选项透传
 * 与 envelope 解包；经 configureRequestAdapter 注入 mock adapter 走默认请求运行时。
 */
import type { InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { USER_ENDPOINTS } from '@/constants/system/user/user.constants'
import type { UserSortField } from '@/constants/system/user/user.constants'
import { configureRequestAdapter } from '@/services/request/request'
import type { ApiError } from '@/services/request/request.types'
import { createMockAdapter, failureEnvelope, successEnvelope, type MockAdapter } from '@/test/requestTestHelpers'
import type { User } from '@/types/system/user/user.types'
import { assignUserRoles, createUser, deleteUser, listUsers, updateUser } from './user.service'

const userFixture: User = {
  id: 'u-1',
  username: 'admin',
  displayName: '管理员',
  email: 'admin@example.com',
  phone: '13800000000',
  status: 'enabled',
  roleIds: ['r-1'],
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

describe('listUsers（规格 §14.3：GET /users）', () => {
  it('GET user 域常量 endpoint，params 原样透传并解包 PageResult', async () => {
    adapter.respondWith(() => ({
      status: 200,
      data: successEnvelope({ list: [userFixture], total: 1, page: 1, size: 10 }),
    }))
    const page = await listUsers({ page: 2, size: 20, keyword: 'admin', sortBy: 'username', sortOrder: 'asc' })
    expect(page).toEqual({ list: [userFixture], total: 1, page: 1, size: 10 })
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(config.url).toBe(USER_ENDPOINTS.LIST)
    expect(config.method).toBe('get')
    expect(config.params).toEqual({ page: 2, size: 20, keyword: 'admin', sortBy: 'username', sortOrder: 'asc' })
  })

  it('sortBy 白名单外参数由后端判定：失败 envelope 转 ApiError', async () => {
    adapter.respondWith(() => ({
      status: 400,
      data: failureEnvelope(400, API_ERROR_CODES.VALIDATION_FAILED, '参数校验失败'),
    }))
    // 类型层已拦住白名单外取值；此处模拟绕过类型的非法查询串，断言 service 透传后端失败 envelope
    const error: ApiError = await listUsers({ sortBy: 'nickname' as UserSortField }).catch((e) => e)
    expect(error).toMatchObject({
      name: 'ApiError',
      httpStatus: 400,
      errorCode: API_ERROR_CODES.VALIDATION_FAILED,
    })
  })
})

describe('createUser（规格 §14.3：POST /users）', () => {
  it('以创建契约 body POST，返回解包后的 User', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(userFixture) }))
    const dto = {
      username: 'admin',
      password: 'abc12345',
      displayName: '管理员',
      email: 'admin@example.com',
      status: 'enabled' as const,
      roleIds: ['r-1'],
    }
    await expect(createUser(dto)).resolves.toEqual(userFixture)
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(config.url).toBe(USER_ENDPOINTS.CREATE)
    expect(config.method).toBe('post')
    // axios 传输前已把 data 序列化为 JSON 字符串，解析后断言契约
    expect(JSON.parse(config.data as string)).toEqual(dto)
  })

  it('silent: true 关闭全局提示（表单自呈现错误）', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(userFixture) }))
    await createUser(
      { username: 'u', password: 'abc12345', displayName: 'd', email: 'u@e.com', status: 'enabled', roleIds: [] },
      { silent: true },
    )
    expect((adapter.calls[0] as InternalAxiosRequestConfig & { silent?: boolean }).silent).toBe(true)
  })
})

describe('updateUser（规格 §14.3：PUT /users/:id）', () => {
  it('endpoint 以真实用户 ID 替换 :id，body 不含 username/password/roleIds', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(userFixture) }))
    const dto = { displayName: '新名称', email: 'new@example.com', status: 'disabled' as const }
    await expect(updateUser('u/1', dto)).resolves.toEqual(userFixture)
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(config.url).toBe('/users/u%2F1')
    expect(config.method).toBe('put')
    expect(JSON.parse(config.data as string)).toEqual(dto)
  })
})

describe('deleteUser（规格 §14.3：DELETE /users/:id）', () => {
  it('endpoint 替换 :id，响应 data 为 null', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(null) }))
    await expect(deleteUser('u-1')).resolves.toBeNull()
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(config.url).toBe(USER_ENDPOINTS.DELETE.replace(':id', 'u-1'))
    expect(config.method).toBe('delete')
  })
})

describe('assignUserRoles（规格 §14.3：PUT /users/:id/roles）', () => {
  it('body 为 { roleIds }，返回更新后的 User', async () => {
    adapter.respondWith(() => ({ status: 200, data: successEnvelope(userFixture) }))
    await expect(assignUserRoles('u-1', { roleIds: ['r-2'] })).resolves.toEqual(userFixture)
    const config: InternalAxiosRequestConfig = adapter.calls[0]
    expect(config.url).toBe(USER_ENDPOINTS.ASSIGN_ROLES.replace(':id', 'u-1'))
    expect(config.method).toBe('put')
    expect(JSON.parse(config.data as string)).toEqual({ roleIds: ['r-2'] })
  })
})
