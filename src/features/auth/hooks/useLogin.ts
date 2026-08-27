/**
 * 登录流程 Hook：调用认证服务并落库会话。
 */

import { useCallback, useState } from 'react'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { login } from '@/services/auth/auth.service'
import { sessionReady } from '@/store/slices/authSlice'
import type { AuthSession } from '@/types/auth/auth.types'

export interface LoginInput {
  username: string
  password: string
}

export function useLogin() {
  const dispatch = useAppDispatch()
  const [submitting, setSubmitting] = useState(false)

  const submit = useCallback(
    async (input: LoginInput): Promise<AuthSession> => {
      setSubmitting(true)
      try {
        const session = await login({ username: input.username, password: input.password })
        dispatch(sessionReady(session))
        return session
      } finally {
        setSubmitting(false)
      }
    },
    [dispatch],
  )

  return { submitting, submit }
}
