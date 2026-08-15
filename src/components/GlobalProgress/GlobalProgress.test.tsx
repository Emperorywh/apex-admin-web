/**
 * GlobalProgress 组件测试（规格 §7.4-8/§17.25）：
 * loadingCount > 0 显示，归零后按 GLOBAL_PROGRESS_HIDE_DELAY_MS=200ms 延迟收起，
 * 延迟窗口内计数回升则保持显示不闪烁。
 */
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import { appSlice } from '@/store/slices/app.slice'
import { Provider } from 'react-redux'
import { GLOBAL_PROGRESS_HIDE_DELAY_MS } from '@/constants/app.constants'
import { GlobalProgress } from './GlobalProgress'

function buildStore(started = 0) {
  return configureStore({
    reducer: { app: appSlice.reducer },
    preloadedState: started > 0 ? { app: { ...appSlice.getInitialState(), loadingCount: started } } : undefined,
  })
}

function progressBar(): HTMLElement | null {
  return screen.queryByRole('progressbar')
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GlobalProgress（规格 §7.4-8）', () => {
  it('loadingCount > 0 立即显示进度条', () => {
    const store = buildStore(1)
    render(
      <Provider store={store}>
        <GlobalProgress />
      </Provider>,
    )
    expect(progressBar()).toBeInTheDocument()
    expect(progressBar()).toHaveAttribute('aria-label', '加载中')
  })

  it('计数归零后延迟 200ms 收起；期间回升则保持显示', () => {
    const store = buildStore(1)
    render(
      <Provider store={store}>
        <GlobalProgress />
      </Provider>,
    )
    act(() => {
      store.dispatch(appSlice.actions.loadingFinished())
    })
    // 归零后立即仍在显示（延迟收起）
    expect(progressBar()).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(GLOBAL_PROGRESS_HIDE_DELAY_MS - 1)
    })
    expect(progressBar()).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(progressBar()).not.toBeInTheDocument()

    // 归零后的延迟窗口内计数回升：取消收起、保持显示
    act(() => {
      store.dispatch(appSlice.actions.loadingStarted())
      store.dispatch(appSlice.actions.loadingFinished())
    })
    act(() => {
      vi.advanceTimersByTime(GLOBAL_PROGRESS_HIDE_DELAY_MS - 1)
    })
    act(() => {
      store.dispatch(appSlice.actions.loadingStarted())
    })
    act(() => {
      vi.advanceTimersByTime(GLOBAL_PROGRESS_HIDE_DELAY_MS)
    })
    expect(progressBar()).toBeInTheDocument()
  })

  it('初始计数为 0 时不显示', () => {
    const store = buildStore(0)
    render(
      <Provider store={store}>
        <GlobalProgress />
      </Provider>,
    )
    expect(progressBar()).not.toBeInTheDocument()
  })
})
