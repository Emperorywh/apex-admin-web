/**
 * useFullscreen 测试（规格 §10.1/§10.2/§17.18）：
 * 全屏状态经 fullscreenchange 同步 app slice；API 不可用或被权限策略拒绝时
 * 保持原状态并经 uiFeedback 提示，不写入 settings。
 */
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Provider } from 'react-redux'
import { useFullscreen } from '@/hooks/useFullscreen'
import { fullscreenSet } from '@/store/slices/app.slice'
import type { SettingsState } from '@/store/slices/settings.slice'
import { createComponentTestStore, type ComponentTestStore } from '@/test/componentTestHelpers'

const { warningSpy } = vi.hoisted(() => ({ warningSpy: vi.fn() }))

vi.mock('@/services/feedback/uiFeedback', () => ({
  showUiWarning: warningSpy,
}))

/** 全屏探针：暴露 hook 返回值并渲染开关 */
function FullscreenProbe() {
  const { fullscreen, toggle } = useFullscreen()
  return (
    <>
      <span data-testid="probe-fullscreen">{String(fullscreen)}</span>
      <button type="button" data-testid="probe-toggle" onClick={toggle}>
        toggle
      </button>
    </>
  )
}

function renderFullscreenHook(): { store: ComponentTestStore } {
  const store = createComponentTestStore()
  render(
    <Provider store={store}>
      <FullscreenProbe />
    </Provider>,
  )
  return { store }
}

/** 设置 document.fullscreenElement 并广播 fullscreenchange */
function fireFullscreenChange(element: Element | null): void {
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => element,
  })
  document.dispatchEvent(new Event('fullscreenchange'))
}

afterEach(() => {
  warningSpy.mockClear()
  delete (document as { fullscreenElement?: Element | null }).fullscreenElement
})

describe('useFullscreen 状态同步（app slice，规格 §10.1）', () => {
  it('浏览器进入全屏后 fullscreenchange 把 app slice 同步为 true，Esc 退出后回到 false', async () => {
    const { store } = renderFullscreenHook()
    await screen.findByTestId('probe-toggle')
    expect(store.getState().app.fullscreen).toBe(false)

    act(() => {
      fireFullscreenChange(document.documentElement)
    })
    expect(store.getState().app.fullscreen).toBe(true)
    expect(screen.getByTestId('probe-fullscreen')).toHaveTextContent('true')

    act(() => {
      fireFullscreenChange(null)
    })
    expect(store.getState().app.fullscreen).toBe(false)
    expect(screen.getByTestId('probe-fullscreen')).toHaveTextContent('false')
  })

  it('卸载后移除 fullscreenchange 监听（Effect 清理完整）', async () => {
    const store = createComponentTestStore()
    const view = render(
      <Provider store={store}>
        <FullscreenProbe />
      </Provider>,
    )
    await screen.findByTestId('probe-toggle')
    view.unmount()
    fireFullscreenChange(document.documentElement)
    expect(store.getState().app.fullscreen).toBe(false)
  })
})

describe('useFullscreen 降级（规格 §10.2/§17.18）', () => {
  it('Fullscreen API 不可用：提示且保持原状态，不写 settings', async () => {
    const { store } = renderFullscreenHook()
    await screen.findByTestId('probe-toggle')
    const settingsBefore: SettingsState = { ...store.getState().settings }

    await act(async () => {
      screen.getByTestId('probe-toggle').click()
    })
    expect(warningSpy).toHaveBeenCalledTimes(1)
    expect(store.getState().app.fullscreen).toBe(false)
    expect(store.getState().settings).toEqual(settingsBefore)
  })

  it('requestFullscreen 被权限策略拒绝（Promise 拒绝）：提示且状态保持', async () => {
    document.documentElement.requestFullscreen = vi.fn().mockRejectedValue(new TypeError('permission denied'))
    const { store } = renderFullscreenHook()
    await screen.findByTestId('probe-toggle')
    const settingsBefore: SettingsState = { ...store.getState().settings }

    await act(async () => {
      screen.getByTestId('probe-toggle').click()
    })
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1)
    expect(warningSpy).toHaveBeenCalledTimes(1)
    expect(store.getState().app.fullscreen).toBe(false)
    expect(store.getState().settings).toEqual(settingsBefore)
    Reflect.deleteProperty(document.documentElement, 'requestFullscreen')
  })

  it('请求成功后经 fullscreenchange 事件写入状态（而非请求时直接写）', async () => {
    document.documentElement.requestFullscreen = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolve()
        }),
    )
    const { store } = renderFullscreenHook()
    await screen.findByTestId('probe-toggle')

    await act(async () => {
      screen.getByTestId('probe-toggle').click()
    })
    // 成功但尚未触发 fullscreenchange：状态仍为 false
    expect(store.getState().app.fullscreen).toBe(false)
    expect(warningSpy).not.toHaveBeenCalled()

    act(() => {
      fireFullscreenChange(document.documentElement)
    })
    expect(store.getState().app.fullscreen).toBe(true)
    Reflect.deleteProperty(document.documentElement, 'requestFullscreen')
  })
})

describe('useFullscreen 与 app slice 的边界', () => {
  it('外部派发 fullscreenSet 只影响 app slice，settings 不受牵连（全屏不持久化）', async () => {
    const { store } = renderFullscreenHook()
    await screen.findByTestId('probe-toggle')
    const settingsBefore: SettingsState = { ...store.getState().settings }
    act(() => {
      store.dispatch(fullscreenSet({ fullscreen: true }))
    })
    expect(store.getState().app.fullscreen).toBe(true)
    expect(store.getState().settings).toEqual(settingsBefore)
  })
})
