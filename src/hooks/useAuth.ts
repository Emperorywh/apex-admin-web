/**
 * 认证状态。
 */

import { useAppSelector } from '@/hooks/useAppSelector'
import type { AuthUser } from '@/types/auth/auth.types'

export interface UseAuthResult {
  user: AuthUser | null
  isAuthenticated: boolean
}

export function useAuth(): UseAuthResult {
  const user = useAppSelector((state) => state.auth.user)
  return {
    user,
    isAuthenticated: user !== null,
  }
}
