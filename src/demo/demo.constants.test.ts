/**
 * 演示账号与权限矩阵测试（规格 §5.3 验收固定）：
 * - admin/viewer 两账号、viewer 最小权限码恰好三个、个人中心仅登录；
 * - 矩阵每行经 hasPermissionChain（AND 语义 + admin 通配）复核 admin/viewer 期望值；
 * - 正式权限常量文件不泄漏任何演示账号数据（§5.3 边界）。
 */
import { describe, expect, it } from 'vitest'
import permissionConstantsSource from '@/constants/permission.constants.ts?raw'
import { PERMISSIONS, PERMISSION_WILDCARD } from '@/constants/permission.constants'
import { hasPermissionChain } from '@/store/permissions'
import {
  APEX_DEMO_SENTINEL,
  DEMO_ACCOUNTS,
  DEMO_ACCOUNT_USERNAMES,
  DEMO_PERMISSION_MATRIX,
  DEMO_SNAPSHOT_STORAGE_KEY,
  findDemoAccount,
  type DemoAccount,
} from './demo.constants'

function accountByUsername(username: string): DemoAccount {
  const account = DEMO_ACCOUNTS.find((candidate) => candidate.username === username)
  expect(account).toBeDefined()
  return account as DemoAccount
}

describe('演示账号（规格 §5.3）', () => {
  it('恰好 admin/viewer 两个账号，用户名与常量一致', () => {
    expect(DEMO_ACCOUNTS).toHaveLength(2)
    expect(DEMO_ACCOUNTS.map((account) => account.username)).toEqual([
      DEMO_ACCOUNT_USERNAMES.ADMIN,
      DEMO_ACCOUNT_USERNAMES.VIEWER,
    ])
    expect(findDemoAccount('admin')?.username).toBe('admin')
    expect(findDemoAccount('viewer')?.username).toBe('viewer')
    expect(findDemoAccount('alice')).toBeNull()
  })

  it('admin 角色 code 为 admin，经通配语义对任意权限码判定为真', () => {
    const admin = accountByUsername('admin')
    expect(admin.roleCodes).toEqual(['admin'])
    const input = { permCodes: admin.permCodes, roleCodes: admin.roleCodes }
    for (const code of Object.values(PERMISSIONS)) {
      expect(hasPermissionChain([code], input)).toBe(true)
    }
    expect(hasPermissionChain([], input)).toBe(true)
  })

  it('viewer 最小权限码恰好为 dashboard:view、system:user:list、demo:nested:view，不多不少', () => {
    const viewer = accountByUsername('viewer')
    expect([...viewer.permCodes].sort()).toEqual(
      [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.SYSTEM_USER_LIST, PERMISSIONS.DEMO_NESTED_VIEW].sort(),
    )
    expect(viewer.roleCodes).toEqual(['viewer'])
    expect(viewer.permCodes).not.toContain(PERMISSION_WILDCARD)
  })

  it('两账号 permissionVersion 均为非空字符串且互不相同', () => {
    const admin = accountByUsername('admin')
    const viewer = accountByUsername('viewer')
    expect(admin.permissionVersion.length).toBeGreaterThan(0)
    expect(viewer.permissionVersion.length).toBeGreaterThan(0)
    expect(admin.permissionVersion).not.toBe(viewer.permissionVersion)
  })
})

describe('演示权限矩阵（规格 §5.3 验收固定）', () => {
  const admin = accountByUsername('admin')
  const viewer = accountByUsername('viewer')
  const adminInput = { permCodes: admin.permCodes, roleCodes: admin.roleCodes }
  const viewerInput = { permCodes: viewer.permCodes, roleCodes: viewer.roleCodes }

  it('矩阵覆盖 §5.3 全部十项能力', () => {
    expect(DEMO_PERMISSION_MATRIX.map((row) => row.capability)).toEqual([
      'Dashboard',
      '用户列表/查询',
      '新增用户',
      '编辑用户',
      '删除用户',
      '分配用户角色',
      '角色管理',
      '菜单管理',
      '多级菜单演示',
      '个人中心查看/编辑',
    ])
  })

  it('每行 admin/viewer 期望值与 hasPermissionChain 实际判定一致', () => {
    for (const row of DEMO_PERMISSION_MATRIX) {
      const chain = row.requiredCodes ?? []
      expect(hasPermissionChain(chain, adminInput)).toBe(row.admin)
      expect(hasPermissionChain(chain, viewerInput)).toBe(row.viewer)
    }
  })

  it('viewer 恰好可访问 Dashboard、用户查询、多级菜单与个人中心；管理类能力全部拒绝', () => {
    const allowed = DEMO_PERMISSION_MATRIX.filter((row) => row.viewer).map((row) => row.capability)
    expect(allowed).toEqual(['Dashboard', '用户列表/查询', '多级菜单演示', '个人中心查看/编辑'])
  })

  it('个人中心行 requiredCodes 为 null：仅要求登录，不分配额外 permCode', () => {
    const profileRow = DEMO_PERMISSION_MATRIX.find((row) => row.capability === '个人中心查看/编辑')
    expect(profileRow?.requiredCodes).toBeNull()
    expect(profileRow?.admin).toBe(true)
    expect(profileRow?.viewer).toBe(true)
    // viewer 的权限码中不存在任何个人中心专用码
    expect(viewer.permCodes.some((code) => code.includes('profile'))).toBe(false)
  })

  it('角色/菜单管理为多码 AND 链：viewer 缺任一码即整体拒绝', () => {
    const roleRow = DEMO_PERMISSION_MATRIX.find((row) => row.capability === '角色管理')
    expect(roleRow?.requiredCodes?.length).toBeGreaterThan(1)
    expect(hasPermissionChain(roleRow?.requiredCodes ?? [], viewerInput)).toBe(false)
  })
})

describe('演示边界常量（规格 §5.3/§13.3）', () => {
  it('哨兵字符串与约定字面量完全一致', () => {
    expect(APEX_DEMO_SENTINEL).toBe('APEX_DEMO_SENTINEL')
  })

  it('正式权限常量文件不含任何演示账号数据', () => {
    expect(permissionConstantsSource).not.toContain(APEX_DEMO_SENTINEL)
    expect(permissionConstantsSource).not.toContain('演示管理员')
    expect(permissionConstantsSource).not.toContain('demo-user-')
    // 权限码本身是正式契约（含 demo:nested:view），但不得出现演示账号用户名
    expect(permissionConstantsSource).not.toContain("'admin'")
    expect(permissionConstantsSource).not.toContain("'viewer'")
  })

  it('快照 storage key 沿用全局前缀', () => {
    expect(DEMO_SNAPSHOT_STORAGE_KEY).toBe('apex_demo_data')
  })
})
