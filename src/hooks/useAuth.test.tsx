/**
 * useAuth Hook 测试（规格 §5.2）：hasAuth 与 store/permissions 同一判定函数的行为、
 * 权限快照变化时的响应式重渲染。
 */
import { act } from '@testing-library/react'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PERMISSIONS, PERMISSION_WILDCARD } from '@/constants/permission.constants'
import { ADMIN_ROLE_CODE } from '@/constants/system/role/role.constants'
import { profileLoaded } from '@/store/slices/user.slice'
import type { UnknownAction } from '@reduxjs/toolkit'
import { renderWithProviders, type ComponentTestStore } from '@/test/componentTestHelpers'
import { userFixture } from '@/test/requestTestHelpers'
import { useAuth } from '@/hooks/useAuth'

/** 判定探针：渲染目标权限码与通配码的判定结果 */
function PermissionProbe({ code }: { code: string }) {
  const { hasAuth } = useAuth()
  return (
    <div>
      <span data-testid="target">{String(hasAuth(code))}</span>
      <span data-testid="wildcard">{String(hasAuth(PERMISSION_WILDCARD))}</span>
    </div>
  )
}

function seedPermissions(store: ComponentTestStore, permCodes: string[], roles: string[]): void {
  act(() => {
    store.dispatch(
      profileLoaded({
        user: userFixture,
        roles,
        permCodes,
        permissionVersion: 'v1',
      }) as UnknownAction,
    )
  })
}

describe('useAuth（规格 §5.2）', () => {
  it('未加载 profile 时任意权限码均为 false', () => {
    renderWithProviders(<PermissionProbe code={PERMISSIONS.SYSTEM_USER_CREATE} />)
    expect(screen.getByTestId('target').textContent).toBe('false')
    expect(screen.getByTestId('wildcard').textContent).toBe('false')
  })

  it('权限码精确命中', () => {
    const view = renderWithProviders(<PermissionProbe code={PERMISSIONS.SYSTEM_USER_CREATE} />)
    seedPermissions(view.store, [PERMISSIONS.SYSTEM_USER_CREATE], ['viewer'])
    expect(screen.getByTestId('target').textContent).toBe('true')
    expect(screen.getByTestId('wildcard').textContent).toBe('false')
  })

  it('admin 角色按 * 通配：目标码与 hasAuth("*") 均为 true', () => {
    const view = renderWithProviders(<PermissionProbe code={PERMISSIONS.SYSTEM_ROLE_DELETE} />)
    seedPermissions(view.store, [], [ADMIN_ROLE_CODE])
    expect(screen.getByTestId('target').textContent).toBe('true')
    expect(screen.getByTestId('wildcard').textContent).toBe('true')
  })

  it('权限快照变化时自动重渲染（收窄后判定翻转）', () => {
    const view = renderWithProviders(<PermissionProbe code={PERMISSIONS.SYSTEM_USER_CREATE} />)
    seedPermissions(view.store, [PERMISSIONS.SYSTEM_USER_CREATE], ['viewer'])
    expect(screen.getByTestId('target').textContent).toBe('true')
    seedPermissions(view.store, [PERMISSIONS.DASHBOARD_VIEW], ['viewer'])
    expect(screen.getByTestId('target').textContent).toBe('false')
  })
})
