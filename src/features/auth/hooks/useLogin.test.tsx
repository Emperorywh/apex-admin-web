/**
 * useLogin Hook 测试（规格 §6.2/§14.2）：
 * 登录中状态翻转、回跳参数读取（URLSearchParams 已解码一次）与提交调用认证会话登录状态机。
 */
import { act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiError } from '@/services/request/envelope'
import { deferred } from '@/test/requestTestHelpers'
import { useLogin } from '@/features/auth/hooks/useLogin'

const { loginSpy } = vi.hoisted(() => ({ loginSpy: vi.fn() }))

vi.mock('@/services/auth/auth.session', () => ({
  getDefaultAuthSessionRuntime: () => ({ loginWithCredentials: loginSpy }),
}))

afterEach(() => {
  loginSpy.mockReset()
  window.history.replaceState({}, '', '/')
})

describe('useLogin（规格 §6.2/§14.2）', () => {
  it('无回跳参数时 redirectTarget 为 null', () => {
    const { result } = renderHook(() => useLogin())
    expect(result.current.redirectTarget).toBeNull()
  })

  it('读取回跳参数：URLSearchParams#get 已解码一次，不再二次解码', () => {
    window.history.replaceState({}, '', '/login?redirect=%2Fsystem%2Fuser%3Fid%3D1')
    const { result } = renderHook(() => useLogin())
    expect(result.current.redirectTarget).toBe('/system/user?id=1')
  })

  it('空串回跳参数视为无回跳', () => {
    window.history.replaceState({}, '', '/login?redirect=')
    const { result } = renderHook(() => useLogin())
    expect(result.current.redirectTarget).toBeNull()
  })

  it('提交成功：登录中状态先 true 后 false，值原样传给登录状态机', async () => {
    loginSpy.mockResolvedValue(undefined)
    const gate = deferred<void>()
    loginSpy.mockReturnValueOnce(gate.promise)
    const { result } = renderHook(() => useLogin())

    let pending!: Promise<void>
    await act(async () => {
      pending = result.current.submit({ username: 'admin', password: 'secret' })
    })
    expect(result.current.submitting).toBe(true)

    await act(async () => {
      gate.resolve()
      await pending
    })
    expect(result.current.submitting).toBe(false)
    expect(loginSpy).toHaveBeenCalledWith({ username: 'admin', password: 'secret' })
  })

  it('提交失败：错误原样上抛且登录中状态复位', async () => {
    loginSpy.mockRejectedValue(createApiError({ message: '网络错误，请求未送达' }))
    const { result } = renderHook(() => useLogin())

    await act(async () => {
      await expect(result.current.submit({ username: 'admin', password: 'wrong' })).rejects.toMatchObject({
        message: '网络错误，请求未送达',
      })
    })
    expect(result.current.submitting).toBe(false)
  })
})
