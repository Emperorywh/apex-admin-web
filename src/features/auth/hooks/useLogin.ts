/**
 * 登录提交 Hook（规格 §6.2/§14.2）：
 * 组合认证会话编排的登录状态机（保存 token → profile → 导航意图），
 * 提供登录中状态与登录页回跳参数展示；表单字段校验规则由 LoginForm 承载。
 * 回跳值只按 §4.3 第 1 步语义读取（URLSearchParams#get 已解码一次，不再二次解码），
 * 其合法性校验与最终跳转由路由任务唯一承担，本 Hook 不校验、不跳转。
 */
import { useCallback, useState } from 'react'
import { REDIRECT_QUERY_KEY } from '@/constants/route.constants'
import { getDefaultAuthSessionRuntime } from '@/services/auth/auth.session'

/** 登录表单值：与 LoginForm 的字段一一对应 */
export interface LoginSubmitValues {
  username: string
  password: string
}

export interface UseLoginResult {
  /** 登录请求进行中：绑定到提交按钮 loading */
  submitting: boolean
  /** 登录页回跳参数原始值（仅展示用）；无参数或空串时为 null */
  redirectTarget: string | null
  /** 提交登录：内部走登录状态机；失败原样上抛由表单呈现错误 */
  submit: (values: LoginSubmitValues) => Promise<void>
}

/** 读取回跳参数：URLSearchParams#get 取已解码一次的值（规格 §4.3 第 1 步读取语义） */
function readRedirectTarget(): string | null {
  const raw = new URLSearchParams(window.location.search).get(REDIRECT_QUERY_KEY)
  return raw !== null && raw.length > 0 ? raw : null
}

export function useLogin(): UseLoginResult {
  const [submitting, setSubmitting] = useState(false)
  // 回跳参数在挂载时读取一次：提交期间地址栏不变，无需响应式订阅
  const [redirectTarget] = useState(readRedirectTarget)

  const submit = useCallback(async (values: LoginSubmitValues) => {
    setSubmitting(true)
    try {
      await getDefaultAuthSessionRuntime().loginWithCredentials(values)
    } finally {
      setSubmitting(false)
    }
  }, [])

  return { submitting, redirectTarget, submit }
}
