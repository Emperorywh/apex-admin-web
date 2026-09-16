/**
 * 认证状态：唯一身份快照 + 权限判定的组件入口。
 *
 * 判定函数为稳定引用（模块级纯函数），组件按需调用：
 * - hasMenu(code)：菜单/路由权限（祖先填充后的集合，特权账号短路）；
 * - hasButton(code)：按钮权限（平铺集合，与菜单源不互相兜底）；
 * 路由接入、菜单过滤等宿主级消费归 T007，本 hook 只提供统一判定面。
 */

import { useCallback } from 'react'
import { useAppSelector } from '@/hooks/useAppSelector'
import { hasButtonCode, hasMenuCode, isRootUser } from '@/services/auth/permission.model'
import type { IdentitySnapshot } from '@/types/auth/auth.types'

export interface UseAuthResult {
  /** 当前身份快照；null = 未登录 */
  identity: IdentitySnapshot | null
  /** 是否已登录（存在身份快照） */
  isAuthenticated: boolean
  /** 是否走源特权分支（root / administrator） */
  isRoot: boolean
  /** 菜单权限判定（祖先填充 + 特权短路） */
  hasMenu: (code: string) => boolean
  /** 按钮权限判定（平铺集合 + 特权短路） */
  hasButton: (code: string) => boolean
}

export function useAuth(): UseAuthResult {
  const identity = useAppSelector((state) => state.auth.identity)

  const hasMenu = useCallback(
    (code: string) => hasMenuCode(identity ?? {}, code),
    [identity],
  )
  const hasButton = useCallback(
    (code: string) => hasButtonCode(identity ?? {}, code),
    [identity],
  )

  return {
    identity,
    isAuthenticated: identity !== null,
    isRoot: isRootUser(identity?.username),
    hasMenu,
    hasButton,
  }
}
