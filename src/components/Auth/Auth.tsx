/**
 * 按钮级权限组件（规格 §5.2）：
 * 与 useAuth().hasAuth 使用同一判定函数；
 * 默认 mode="hidden"（无权限不渲染子节点），disabled 必须由具体需求显式指定，
 * 以禁用态（pointer-events 关闭 + aria-disabled）渲染子节点。
 * 页面级权限由 Data Router guard 与 menuRoutes 过滤承担，不使用本组件。
 */
import type { ReactNode } from 'react'
import { theme } from 'antd'
import { useAuth } from '@/hooks/useAuth'

/** 无权限时的呈现方式（规格 §5.2） */
export type AuthMode = 'hidden' | 'disabled'

export interface AuthProps {
  /** 集中定义的权限码（PERMISSIONS 常量）；页面禁止出现权限魔法字符串 */
  code: string
  /** 默认 hidden；disabled 需显式传入 */
  mode?: AuthMode
  children: ReactNode
}

export function Auth({ code, mode = 'hidden', children }: AuthProps) {
  const { hasAuth } = useAuth()
  const { token } = theme.useToken()
  if (hasAuth(code)) {
    return <>{children}</>
  }
  if (mode === 'disabled') {
    return (
      <span
        aria-disabled="true"
        style={{
          display: 'inline-flex',
          pointerEvents: 'none',
          cursor: 'not-allowed',
          color: token.colorTextDisabled,
        }}
      >
        {children}
      </span>
    )
  }
  return null
}
