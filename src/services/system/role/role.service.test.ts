/**
 * 角色列表接口测试（规格 §14.3）：GET /roles → PageResult<Role>。
 * endpoint 引用 role 域常量、params 透传与 envelope 解包、send 注入形态。
 */
import type { InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AxiosRequestConfig } from 'axios'
import { ROLE_ENDPOINTS } from '@/constants/system/role/role.constants'
import { configureRequestAdapter } from '@/services/request/request'
import type { SendRequest } from '@/services/request/request.types'
import { createMockAdapter, successEnvelope, type MockAdapter } from '@/test/requestTestHelpers'
import type { Role } from '@/types/system/role/role.types'
import { listRoles } from './role.service'

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
    expect(config.url).toBe(ROLE_ENDPOINTS.LIST)
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
    expect(sentConfigs[0]).toMatchObject({ url: ROLE_ENDPOINTS.LIST, method: 'get' })
    expect(adapter.calls.length).toBe(0)
  })
})
