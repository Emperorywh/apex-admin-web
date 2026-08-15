/**
 * 跨业务域 endpoint 唯一所有者完整性测试（规格 §3.6/§14.3）。
 * 断言同一 API 路径不会出现在两个不同的业务域常量文件中，
 * 从机制上防止页面、feature、service 与 demo adapter 各复制一份字面量。
 */
import { describe, expect, test } from 'vitest'
import { AUTH_ENDPOINTS } from './auth/auth.constants'
import { DASHBOARD_ENDPOINTS } from './dashboard/dashboard.constants'
import { PROFILE_ENDPOINTS } from './profile/profile.constants'
import { MENU_ENDPOINTS } from './system/menu/menu.constants'
import { PERMISSION_TREE_ENDPOINT, ROLE_ENDPOINTS } from './system/role/role.constants'
import { USER_ENDPOINTS } from './system/user/user.constants'

/** 各业务域常量文件拥有的全部 endpoint 路径，键为常量文件名 */
const ENDPOINT_GROUPS: Record<string, readonly string[]> = {
  'auth/auth.constants.ts': Object.values(AUTH_ENDPOINTS),
  'dashboard/dashboard.constants.ts': Object.values(DASHBOARD_ENDPOINTS),
  'profile/profile.constants.ts': Object.values(PROFILE_ENDPOINTS),
  'system/user/user.constants.ts': Object.values(USER_ENDPOINTS),
  'system/role/role.constants.ts': [...Object.values(ROLE_ENDPOINTS), PERMISSION_TREE_ENDPOINT],
  'system/menu/menu.constants.ts': Object.values(MENU_ENDPOINTS),
}

describe('endpoint 唯一所有者', () => {
  test('所有 endpoint 均为非空且以单个 / 开头的路径', () => {
    for (const paths of Object.values(ENDPOINT_GROUPS)) {
      for (const path of paths) {
        expect(path.length).toBeGreaterThan(1)
        expect(path.startsWith('/')).toBe(true)
        expect(path.startsWith('//')).toBe(false)
      }
    }
  })

  test('任一路径不得由两个业务域常量文件同时拥有', () => {
    const owners = new Map<string, string[]>()
    for (const [file, paths] of Object.entries(ENDPOINT_GROUPS)) {
      for (const path of paths) {
        owners.set(path, [...(owners.get(path) ?? []), file])
      }
    }
    const duplicated = [...owners.entries()].filter(([, files]) => new Set(files).size > 1)
    expect(duplicated).toEqual([])
  })

  test('业务域路径与 §14.3 接口契约逐条对应', () => {
    expect(AUTH_ENDPOINTS).toEqual({ LOGIN: '/auth/login', REFRESH: '/auth/refresh', LOGOUT: '/auth/logout' })
    expect(PROFILE_ENDPOINTS.GET_PROFILE).toBe('/auth/profile')
    expect(PROFILE_ENDPOINTS.UPDATE_PROFILE).toBe('/auth/profile')
    expect(PROFILE_ENDPOINTS.CHANGE_PASSWORD).toBe('/auth/password')
    expect(USER_ENDPOINTS).toEqual({
      LIST: '/users',
      CREATE: '/users',
      UPDATE: '/users/:id',
      DELETE: '/users/:id',
      ASSIGN_ROLES: '/users/:id/roles',
    })
    expect(ROLE_ENDPOINTS).toEqual({
      LIST: '/roles',
      CREATE: '/roles',
      UPDATE: '/roles/:id',
      DELETE: '/roles/:id',
      ASSIGN_PERMISSIONS: '/roles/:id/permissions',
    })
    expect(PERMISSION_TREE_ENDPOINT).toBe('/permissions/tree')
    expect(MENU_ENDPOINTS).toEqual({
      TREE: '/menus/tree',
      CREATE: '/menus',
      UPDATE: '/menus/:id',
      DELETE: '/menus/:id',
    })
    expect(DASHBOARD_ENDPOINTS.OVERVIEW).toBe('/dashboard/overview')
  })
})
