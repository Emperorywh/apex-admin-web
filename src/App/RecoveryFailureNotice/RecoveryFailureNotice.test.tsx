/**
 * 持久化恢复失败一次性提示测试（规格 §4.3/§8.2/§17.22）：
 * recoveryFailed 标记 + 进入登录页时经 uiFeedback 显示一次；未标记、非登录页与
 * 重复导航均不显示。
 */
import { render, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { ROUTE_PATHS } from '@/constants/route.constants'
import { showUiWarning } from '@/services/feedback/uiFeedback'
import { bootstrapCompleted } from '@/store/slices/app.slice'
import { createComponentTestStore } from '@/test/componentTestHelpers'
import { RecoveryFailureNotice } from './RecoveryFailureNotice'

vi.mock('@/services/feedback/uiFeedback', () => ({
  showUiWarning: vi.fn(),
}))

/** 最小 router 桩：state.location 可控、subscribe 返回退订函数 */
function createRouterStub(initialPathname: string) {
  let pathname = initialPathname
  const listeners = new Set<(state: { location: { pathname: string } }) => void>()
  return {
    state: {
      get location() {
        return { pathname }
      },
    },
    subscribe(listener: (state: { location: { pathname: string } }) => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    navigate(next: string) {
      pathname = next
      for (const listener of listeners) {
        listener({ location: { pathname: next } })
      }
    },
  }
}

afterEach(() => {
  vi.mocked(showUiWarning).mockClear()
})

describe('RecoveryFailureNotice（规格 §4.3）', () => {
  it('恢复失败标记就位且进入登录页：经 uiFeedback 显示一次提示', () => {
    const store = createComponentTestStore()
    store.dispatch(bootstrapCompleted({ recoveryFailed: true }))
    const router = createRouterStub(ROUTE_PATHS.LOGIN)
    render(
      <Provider store={store}>
        <RecoveryFailureNotice router={router as never} />
      </Provider>,
    )
    expect(showUiWarning).toHaveBeenCalledTimes(1)
    expect(showUiWarning).toHaveBeenCalledWith('本地设置恢复失败，已使用默认设置')
  })

  it('恢复失败但不在登录页：不显示；随后导航到登录页才显示一次', async () => {
    const store = createComponentTestStore()
    store.dispatch(bootstrapCompleted({ recoveryFailed: true }))
    const router = createRouterStub('/system/user')
    render(
      <Provider store={store}>
        <RecoveryFailureNotice router={router as never} />
      </Provider>,
    )
    expect(showUiWarning).not.toHaveBeenCalled()
    router.navigate(ROUTE_PATHS.LOGIN)
    await waitFor(() => {
      expect(showUiWarning).toHaveBeenCalledTimes(1)
    })
    // 再次导航不重复显示
    router.navigate('/dashboard')
    router.navigate(ROUTE_PATHS.LOGIN)
    expect(showUiWarning).toHaveBeenCalledTimes(1)
  })

  it('无恢复失败标记：即使位于登录页也不显示', () => {
    const store = createComponentTestStore()
    store.dispatch(bootstrapCompleted({ recoveryFailed: false }))
    const router = createRouterStub(ROUTE_PATHS.LOGIN)
    render(
      <Provider store={store}>
        <RecoveryFailureNotice router={router as never} />
      </Provider>,
    )
    expect(showUiWarning).not.toHaveBeenCalled()
  })
})
