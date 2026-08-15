/**
 * profile 刷新单飞单元测试（规格 §5.4）：
 * 并发共享、防递归、30 秒冷却窗口与未注册执行器的显式错误。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerUiFeedbackInstances, resetUiFeedbackInstances } from '@/services/feedback/uiFeedback'
import type { UiFeedbackInstances } from '@/services/feedback/uiFeedback'
import { createRequestTestStore } from '@/test/requestTestHelpers'
import { profileLoaded } from '@/store/slices/user.slice'
import { userFixture } from '@/test/requestTestHelpers'
import { createProfileRefreshSingleFlight, registerProfileRefreshFetcher } from './profileRefresh'

let messageError: ReturnType<typeof vi.fn>

beforeEach(() => {
  messageError = vi.fn()
  registerUiFeedbackInstances({ message: { error: messageError } } as unknown as UiFeedbackInstances)
})

afterEach(() => {
  resetUiFeedbackInstances()
  registerProfileRefreshFetcher(null)
  vi.useRealTimers()
})

describe('createProfileRefreshSingleFlight（规格 §5.4）', () => {
  it('并发触发共享一个 Promise：执行器只跑一次，完成后按版本提示', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { store } = createRequestTestStore()
    store.dispatch(profileLoaded({ user: userFixture, roles: [], permCodes: [], permissionVersion: 'v1' }))
    const fetcher = vi.fn(async () => {
      store.dispatch(profileLoaded({ user: userFixture, roles: [], permCodes: [], permissionVersion: 'v2' }))
    })
    registerProfileRefreshFetcher(fetcher)
    const singleFlight = createProfileRefreshSingleFlight(store)

    const [a, b] = await Promise.all([singleFlight.trigger(), singleFlight.trigger()])
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(a).toEqual({ prompted: true })
    expect(b).toEqual({ prompted: true })
    expect(messageError).toHaveBeenCalledTimes(1)
    expect(messageError).toHaveBeenCalledWith('权限已变更，请刷新后重试')

    // 冷却窗口内同版本不再提示，但仍会执行刷新
    vi.setSystemTime(new Date(Date.now() + 5_000))
    store.dispatch(profileLoaded({ user: userFixture, roles: [], permCodes: [], permissionVersion: 'v2' }))
    const outcome = await singleFlight.trigger()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(outcome).toEqual({ prompted: false })
    expect(messageError).toHaveBeenCalledTimes(1)

    // 版本变化立即可再次提示（不同版本不受同版本冷却限制）
    const fetcher2 = vi.fn(async () => {
      store.dispatch(profileLoaded({ user: userFixture, roles: [], permCodes: [], permissionVersion: 'v3' }))
    })
    registerProfileRefreshFetcher(fetcher2)
    const changed = await singleFlight.trigger()
    expect(changed).toEqual({ prompted: true })
    expect(messageError).toHaveBeenCalledTimes(2)
  })

  it('执行器在途期间的新触发共享同一 Promise，不产生新请求（防递归）', async () => {
    const { store } = createRequestTestStore()
    const singleFlight = createProfileRefreshSingleFlight(store)
    const fetcher = vi.fn(async () => {
      // 模拟 /auth/profile 自身 403 AUTH_PERMISSION_CHANGED：错误处理里 fire-and-forget 再触发一次刷新
      void singleFlight.trigger().catch(() => undefined)
      await Promise.resolve()
    })
    registerProfileRefreshFetcher(fetcher)
    const outcome = await singleFlight.trigger()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(outcome).toEqual({ prompted: true })
  })

  it('未注册执行器时以 ApiError 显式拒绝，不静默成功', async () => {
    const { store } = createRequestTestStore()
    registerProfileRefreshFetcher(null)
    const singleFlight = createProfileRefreshSingleFlight(store)
    await expect(singleFlight.trigger()).rejects.toMatchObject({ name: 'ApiError' })
  })
})
