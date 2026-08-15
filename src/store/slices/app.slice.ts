/**
 * 应用切片（规格 §8.1）：全局进度计数、侧栏折叠、全屏瞬时状态与初始化状态。
 * 仅 sidebarCollapsed 持久化；Fullscreen 是浏览器瞬时状态，明确属于 app slice 而非 settings，
 * 且不持久化（规格 §10.1）。
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/** 应用初始化状态：由 store 启动闸门写入，应用外壳消费（规格 §4.3/§8.2/§17.22） */
export interface AppInitializationState {
  /** 持久化恢复是否完成：auth loader 必须等待 rehydratedPromise 后才读取 token 与 sessionSource */
  rehydrated: boolean
  /**
   * 上次持久化恢复是否发生降级（JSON 损坏/迁移抛错/storage 不可用）。
   * 应用外壳据此显示一次恢复失败提示后继续启动；本切片只落标记，不承载提示 UI。
   */
  recoveryFailed: boolean
}

/** app 切片状态：与规格 §8.1 表逐项对应 */
export interface AppState {
  /** 进行中的全局请求数：请求管理模块同步；Redux 只保存数字，归零后按延迟收起进度条（规格 §7.4） */
  loadingCount: number
  sidebarCollapsed: boolean
  /** 全屏瞬时状态：Fullscreen API 不可用或被权限策略拒绝时保持原状态（规格 §10.2/§17.18） */
  fullscreen: boolean
  initialization: AppInitializationState
}

export const initialAppState: AppState = {
  loadingCount: 0,
  sidebarCollapsed: false,
  fullscreen: false,
  initialization: { rehydrated: false, recoveryFailed: false },
}

export const appSlice = createSlice({
  name: 'app',
  initialState: initialAppState,
  reducers: {
    /** 全局进度 +1：请求开始时由请求管理模块派发 */
    loadingStarted(state) {
      state.loadingCount += 1
    },
    /** 全局进度 -1：经历取消、401 等待与重放后不得为负，下限钳制为 0（规格 §17.25） */
    loadingFinished(state) {
      state.loadingCount = Math.max(0, state.loadingCount - 1)
    },
    /** 折叠/展开侧栏（唯一持久化的 app 字段） */
    sidebarCollapsedSet(state, action: PayloadAction<{ collapsed: boolean }>) {
      state.sidebarCollapsed = action.payload.collapsed
    },
    /** 全屏状态变化：由 useFullscreen 在 Fullscreen API 事件回调中写入，不写入 settings */
    fullscreenSet(state, action: PayloadAction<{ fullscreen: boolean }>) {
      state.fullscreen = action.payload.fullscreen
    },
    /** 持久化恢复完成：由 persistor bootstrap 回调触发一次，标记恢复结果供外壳消费 */
    bootstrapCompleted(state, action: PayloadAction<{ recoveryFailed: boolean }>) {
      state.initialization = { rehydrated: true, recoveryFailed: action.payload.recoveryFailed }
    },
  },
})

export const { loadingStarted, loadingFinished, sidebarCollapsedSet, fullscreenSet, bootstrapCompleted } =
  appSlice.actions
