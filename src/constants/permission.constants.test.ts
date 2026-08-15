import { describe, expect, test } from 'vitest'
import { PERMISSIONS, PERMISSION_WILDCARD } from './permission.constants'

/** 规格 §5.1 固定的 16 个正式权限码 */
const SPEC_PERMISSION_CODES = [
  'dashboard:view',
  'system:user:list',
  'system:user:create',
  'system:user:update',
  'system:user:delete',
  'system:user:assign-role',
  'system:role:list',
  'system:role:create',
  'system:role:update',
  'system:role:delete',
  'system:role:assign-permission',
  'system:menu:list',
  'system:menu:create',
  'system:menu:update',
  'system:menu:delete',
  'demo:nested:view',
] as const

describe('permission.constants', () => {
  test('权限码恰好包含 §5.1 的 16 个，无多无少', () => {
    expect(Object.values(PERMISSIONS).sort()).toEqual([...SPEC_PERMISSION_CODES].sort())
    expect(Object.keys(PERMISSIONS)).toHaveLength(16)
  })

  test('权限码值全局唯一', () => {
    const values = Object.values(PERMISSIONS)
    expect(new Set(values).size).toBe(values.length)
  })

  test('权限码符合小写连字符段 + 冒号分隔的 2~3 段格式（dashboard:view 为两段）', () => {
    for (const code of Object.values(PERMISSIONS)) {
      expect(code).toMatch(/^[a-z]+(-[a-z]+)*(:[a-z]+(-[a-z]+)*){1,2}$/)
    }
  })

  test('不含演示账号或权限矩阵数据（§5.3 归 src/demo/）', () => {
    const serialized = JSON.stringify(PERMISSIONS)
    // admin/viewer 是演示账号名与角色 code，不得出现在正式权限码文件中
    expect(serialized).not.toContain('admin')
    expect(serialized).not.toContain('viewer')
    expect(PERMISSION_WILDCARD).toBe('*')
    expect(Object.values(PERMISSIONS)).not.toContain(PERMISSION_WILDCARD)
  })
})
