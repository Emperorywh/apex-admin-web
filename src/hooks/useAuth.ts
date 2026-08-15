/**
 * 认证权限 Hook（规格 §5.2）：
 * hasAuth 与 <Auth> 组件共用 store/permissions 的同一判定函数（admin 按 '*' 通配）；
 * 通过 useSelector 订阅 user 切片，权限快照变化时组件自动重渲染。
 */
import { useCallback } from 'react'
import { useSelector } from 'react-redux'
import { hasPermissionCode } from '@/store/permissions'
import type { RootState } from '@/store/store'

export interface UseAuthResult {
  /**
   * 判定当前会话是否满足指定权限码（规格 §4.4）：
   * admin 角色或持有 '*' 通配时对任意 code（含 '*'）返回 true，其余按权限码精确命中。
   */
  hasAuth: (code: string) => boolean
}

export function useAuth(): UseAuthResult {
  const permCodes = useSelector((state: RootState) => state.user.permCodes)
  const roles = useSelector((state: RootState) => state.user.roles)
  const hasAuth = useCallback(
    (code: string) => hasPermissionCode(permCodes, roles, code),
    [permCodes, roles],
  )
  return { hasAuth }
}
