/**
 * Auth 组件测试（规格 §5.2）：
 * 默认 mode=hidden 无权限不渲染；显式 mode=disabled 以禁用态渲染；
 * 判定与 useAuth 共用同一函数（admin 通配行为一致）。
 */
import type { UnknownAction } from '@reduxjs/toolkit'
import { act, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from 'antd'
import { PERMISSIONS } from '@/constants/permission.constants'
import { ADMIN_ROLE_CODE } from '@/constants/system/role/role.constants'
import { Auth } from '@/components/Auth/Auth'
import { profileLoaded } from '@/store/slices/user.slice'
import { renderWithProviders } from '@/test/componentTestHelpers'
import { userFixture } from '@/test/requestTestHelpers'

function seedPermissions(
  view: ReturnType<typeof renderWithProviders>,
  permCodes: string[],
  roles: string[],
): void {
  act(() => {
    view.store.dispatch(
      profileLoaded({
        user: userFixture,
        roles,
        permCodes,
        permissionVersion: 'v1',
      }) as UnknownAction,
    )
  })
}

describe('Auth 组件（规格 §5.2）', () => {
  it('无权限且未指定 mode（默认 hidden）时不渲染子节点', () => {
    const view = renderWithProviders(
      <Auth code={PERMISSIONS.SYSTEM_USER_CREATE}>
        <Button>新增用户</Button>
      </Auth>,
    )
    seedPermissions(view, [PERMISSIONS.DASHBOARD_VIEW], ['viewer'])
    expect(view.container).toBeEmptyDOMElement()
  })

  it('有权限时正常渲染子节点', () => {
    const view = renderWithProviders(
      <Auth code={PERMISSIONS.SYSTEM_USER_CREATE}>
        <Button>新增用户</Button>
      </Auth>,
    )
    seedPermissions(view, [PERMISSIONS.SYSTEM_USER_CREATE], ['viewer'])
    expect(screen.getByRole('button', { name: '新增用户' })).toBeInTheDocument()
  })

  it('显式 mode="disabled" 时以禁用态渲染子节点（aria-disabled + 交互关闭）', () => {
    const view = renderWithProviders(
      <Auth code={PERMISSIONS.SYSTEM_USER_CREATE} mode="disabled">
        <Button>新增用户</Button>
      </Auth>,
    )
    seedPermissions(view, [PERMISSIONS.DASHBOARD_VIEW], ['viewer'])
    expect(screen.getByRole('button', { name: '新增用户' })).toBeInTheDocument()
    const wrapper = view.container.querySelector('span[aria-disabled="true"]')
    expect(wrapper).not.toBeNull()
    expect(wrapper).toHaveStyle({ pointerEvents: 'none', cursor: 'not-allowed' })
  })

  it('admin 角色通配：与 useAuth 同一判定函数，任意权限码均可渲染', () => {
    const view = renderWithProviders(
      <Auth code={PERMISSIONS.SYSTEM_ROLE_DELETE}>
        <Button>删除角色</Button>
      </Auth>,
    )
    seedPermissions(view, [], [ADMIN_ROLE_CODE])
    expect(screen.getByRole('button', { name: '删除角色' })).toBeInTheDocument()
  })
})
