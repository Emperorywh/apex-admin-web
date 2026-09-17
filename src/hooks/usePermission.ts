/**
 * 按钮权限 Hook（T00.4）：页面按钮级权限判定的统一入口。
 *
 * 数据来源：登录会话的 permissions 平铺数组（后端 data.permissions）；
 * 超管（root/administrator）短路放行（规格 5.8 / D19）。
 * 后端拒绝仍是最终鉴权：按钮可见不代表操作必然成功（规格 5.9）。
 */

import { useMemo } from 'react'
import { useAppSelector } from '@/hooks/useAppSelector'
import { PERM_BUTTON, type PermButtonCode } from '@/constants/auth/permission.constants'
import { isRootUser } from '@/utils/auth/permission'

export interface PermissionAccess {
  /** 当前用户是否超管（root/administrator） */
  isSuperuser: boolean
  /** 按钮码判定：持有（或超管短路）返回 true */
  hasPerm: (code: PermButtonCode) => boolean
}

export function usePermission(): PermissionAccess {
  const permissions = useAppSelector((state) => state.auth.permissions)
  const username = useAppSelector((state) => state.auth.user?.username ?? null)

  // 集合随会话变化重建；按钮判定 O(1)，避免每次渲染重扫数组
  const codeSet = useMemo(() => new Set(permissions), [permissions])
  const superuser = useMemo(() => isRootUser(username), [username])

  return {
    isSuperuser: superuser,
    hasPerm: (code: PermButtonCode) => superuser || codeSet.has(code),
  }
}

/** 导出常量引用，便于调用方 alongside hook 使用同一码表（避免双 import 混乱） */
export { PERM_BUTTON }
export type { PermButtonCode }
