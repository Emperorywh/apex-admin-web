import { describe, expect, test } from 'vitest'
import {
  ADMIN_ROLE_CODE,
  PERMISSION_TREE_ENDPOINT,
  ROLE_ENDPOINTS,
  ROLE_I18N_NAMESPACE,
  ROLE_KEYWORD_FIELDS,
  ROLE_SORT_FIELDS,
} from './role.constants'

describe('role.constants', () => {
  test('角色接口路径与 §14.3 一致', () => {
    expect(ROLE_ENDPOINTS).toEqual({
      LIST: '/roles',
      CREATE: '/roles',
      UPDATE: '/roles/:id',
      DELETE: '/roles/:id',
      ASSIGN_PERMISSIONS: '/roles/:id/permissions',
    })
    expect(PERMISSION_TREE_ENDPOINT).toBe('/permissions/tree')
  })

  test('sortBy 白名单恰为 code/name/status/createdAt 且无重复（§14.3）', () => {
    expect(ROLE_SORT_FIELDS).toEqual(['code', 'name', 'status', 'createdAt'])
    expect(new Set(ROLE_SORT_FIELDS).size).toBe(ROLE_SORT_FIELDS.length)
  })

  test('keyword 匹配字段恰为 code/name（§14.3）', () => {
    expect(ROLE_KEYWORD_FIELDS).toEqual(['code', 'name'])
  })

  test('超级管理员角色标识固定为 admin（§5.1）', () => {
    expect(ADMIN_ROLE_CODE).toBe('admin')
  })

  test('i18n 命名空间为 role，与 en-US 资源文件名一致（§12）', () => {
    expect(ROLE_I18N_NAMESPACE).toBe('role')
  })
})
