import { describe, expect, it } from 'vitest'
import {
  bootstrapCompleted,
  fullscreenSet,
  initialAppState,
  loadingFinished,
  loadingStarted,
  sidebarCollapsedSet,
  appSlice,
} from '@/store/slices/app.slice'

const { reducer } = appSlice

describe('app.slice', () => {
  it('初始状态：零进度、侧栏展开、非全屏、未完成恢复', () => {
    expect(initialAppState).toEqual({
      loadingCount: 0,
      sidebarCollapsed: false,
      fullscreen: false,
      initialization: { rehydrated: false, recoveryFailed: false },
    })
  })

  it('loadingStarted/loadingFinished 维护全局进度计数', () => {
    const started = reducer(reducer(initialAppState, loadingStarted()), loadingStarted())
    expect(started.loadingCount).toBe(2)
    const finished = reducer(started, loadingFinished())
    expect(finished.loadingCount).toBe(1)
  })

  it('loadingFinished 下限钳制为 0：经历取消、401、重放后不为负（规格 §17.25）', () => {
    const finished = reducer(initialAppState, loadingFinished())
    expect(finished.loadingCount).toBe(0)
  })

  it('sidebarCollapsedSet 折叠侧栏（唯一持久化字段）', () => {
    const state = reducer(initialAppState, sidebarCollapsedSet({ collapsed: true }))
    expect(state.sidebarCollapsed).toBe(true)
  })

  it('fullscreenSet 写入全屏瞬时状态（不写入 settings、不持久化）', () => {
    const state = reducer(initialAppState, fullscreenSet({ fullscreen: true }))
    expect(state.fullscreen).toBe(true)
  })

  it('bootstrapCompleted 记录持久化恢复完成与降级标记', () => {
    const ok = reducer(initialAppState, bootstrapCompleted({ recoveryFailed: false }))
    expect(ok.initialization).toEqual({ rehydrated: true, recoveryFailed: false })

    const degraded = reducer(initialAppState, bootstrapCompleted({ recoveryFailed: true }))
    expect(degraded.initialization).toEqual({ rehydrated: true, recoveryFailed: true })
  })
})
