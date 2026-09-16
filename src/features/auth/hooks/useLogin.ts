/**
 * 登录流程 Hook：调用旧协议认证服务；身份落库（快照/存储/请求头）
 * 由服务层统一完成，Hook 只负责提交状态与回传结果。
 */

import { useCallback, useState } from 'react'
import { login } from '@/services/auth/auth.service'
import type { IdentitySnapshot } from '@/types/auth/auth.types'

export interface LoginInput {
  username: string
  password: string
}

export function useLogin() {
  const [submitting, setSubmitting] = useState(false)

  const submit = useCallback(
    async (input: LoginInput): Promise<IdentitySnapshot> => {
      setSubmitting(true)
      try {
        // 服务内部：密码 MD5 → POST login → 写快照/存储/请求头（含会话纪元推进）
        return await login({ username: input.username, password: input.password })
      } finally {
        setSubmitting(false)
      }
    },
    [],
  )

  return { submitting, submit }
}
