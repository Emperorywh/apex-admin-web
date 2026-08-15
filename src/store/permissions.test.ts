/**
 * 权限判定唯一实现测试（规格 §4.4/§5.2）：
 * 精确命中、admin 角色与 '*' 通配、未命中语义与 user 切片输入读取。
 */
import { describe, expect, it } from 'vitest'
import { PERMISSION_WILDCARD } from '@/constants/permission.constants'
import { ADMIN_ROLE_CODE } from '@/constants/system/role/role.constants'
import { initialUserState } from '@/store/slices/user.slice'
import { hasPermissionCode, selectPermissionInput } from '@/store/permissions'

describe('hasPermissionCode（规格 §4.4/§5.2）', () => {
  it('权限码精确命中时返回 true，未命中返回 false', () => {
    const permCodes = ['dashboard:view', 'system:user:list']
    expect(hasPermissionCode(permCodes, ['viewer'], 'dashboard:view')).toBe(true)
    expect(hasPermissionCode(permCodes, ['viewer'], 'system:user:list')).toBe(true)
    expect(hasPermissionCode(permCodes, ['viewer'], 'system:role:list')).toBe(false)
    expect(hasPermissionCode([], [], 'dashboard:view')).toBe(false)
  })

  it('admin 角色按通配处理：任意权限码与 hasAuth("*") 均返回 true', () => {
    expect(hasPermissionCode([], [ADMIN_ROLE_CODE], 'system:user:create')).toBe(true)
    expect(hasPermissionCode([], [ADMIN_ROLE_CODE], PERMISSION_WILDCARD)).toBe(true)
    expect(hasPermissionCode([], [ADMIN_ROLE_CODE], '任意:not:in:list')).toBe(true)
  })

  it("permCodes 含 '*' 通配时与 admin 角色等效", () => {
    expect(hasPermissionCode([PERMISSION_WILDCARD], ['viewer'], 'system:menu:delete')).toBe(true)
    expect(hasPermissionCode([PERMISSION_WILDCARD], [], PERMISSION_WILDCARD)).toBe(true)
  })

  it("普通用户的 hasAuth('*') 为 false：通配只属于 admin 或显式 '*' 快照", () => {
    expect(hasPermissionCode(['dashboard:view'], ['viewer'], PERMISSION_WILDCARD)).toBe(false)
  })

  it('角色命中要求精确的 admin code，其他角色码不产生通配', () => {
    expect(hasPermissionCode([], ['administrator'], 'dashboard:view')).toBe(false)
    expect(hasPermissionCode([], ['admin2'], 'dashboard:view')).toBe(false)
  })
})

describe('selectPermissionInput', () => {
  it('从 user 切片状态读取权限码与角色 code 列表', () => {
    const state = {
      user: { ...initialUserState, permCodes: ['dashboard:view'], roles: ['viewer'], sessionEpoch: 3 },
    }
    expect(selectPermissionInput(state)).toEqual({
      permCodes: ['dashboard:view'],
      roleCodes: ['viewer'],
    })
  })
})
