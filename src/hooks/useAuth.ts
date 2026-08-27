/**
 * 认证状态与权限判断。
 */

import { useCallback } from 'react'
import { WILDCARD_PERMISSION } from '@/constants/permission.constants'
import { useAppSelector } from '@/hooks/useAppSelector'
import type { AuthUser } from '@/types/auth/auth.types'

export interface UseAuthResult {
  user: AuthUser | null
  permissions: string[]
  isAuthenticated: boolean
  isAdmin: boolean
  /** 无 permCode 视为已登录即可访问；通配权限放行一切 */
  hasAuth: (permCode?: string) => boolean
}

export function useAuth(): UseAuthResult {
  const user = useAppSelector((state) => state.auth.user)
  const permissions = useAppSelector((state) => state.auth.permissions)

  const hasAuth = useCallback(
    (permCode?: string) => {
      if (!permCode) return true
      return permissions.includes(WILDCARD_PERMISSION) || permissions.includes(permCode)
    },
    [permissions],
  )

  return {
    user,
    permissions,
    isAuthenticated: user !== null,
    isAdmin: user?.isAdmin ?? false,
    hasAuth,
  }
}
