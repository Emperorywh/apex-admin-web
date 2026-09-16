/**
 * 表格列布局的会话内存偏好（SPEC §7.2：列设置"仅会话内记忆，提供恢复默认"）。
 *
 * - 库适配器 `createLocalColumnPreferences` 默认写 localStorage，这里注入
 *   模块级 Map 实现的内存存储：页签关闭/重建不丢（会话层），但整页刷新后
 *   回到默认，也不向磁盘持久化任何布局；
 * - 认证纪元（auth.epoch）推进（登出/切账号/认证失效）时清空全部内存布局，
 *   与 T013 页面会话"纪元复位"同一口径，不跨账号泄露布局；
 * - `useSessionColumnLayout` 负责适配器创建、恢复、自动防抖保存与恢复默认，
 *   页面只需把返回的 `columnProps` 展开进表格并把 `tableRef` 传给表格。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createLocalColumnPreferences } from 'apex-table-react/adapters/local-column-preferences'
import type { ColumnPreferenceSlices } from 'apex-table-react/adapters/local-column-preferences'
import type {
  ApexTableInstance,
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  ColumnVisibilityState,
} from 'apex-table-react'
import { store } from '@/store/store'

/** 会话内存存储：Storage 子集（只用到 get/set/remove 三方法），进程内唯一 */
const sessionMemoryStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem: (key) => sessionStore.get(key) ?? null,
  setItem: (key, value) => {
    sessionStore.set(key, value)
  },
  removeItem: (key) => {
    sessionStore.delete(key)
  },
}

/** 键值容器（模块级，跨页签实例共享；清空动作见纪元监听） */
const sessionStore = new Map<string, string>()

/** 纪元监听只注册一次；epoch 变化即清空全部内存布局 */
let epochWatcherStarted = false

/** 懒启动纪元监听：与 store 同生命周期，不产生渲染期副作用 */
function ensureEpochWatcher(): void {
  if (epochWatcherStarted) return
  epochWatcherStarted = true
  let lastEpoch = store.getState().auth.epoch
  store.subscribe(() => {
    const epoch = store.getState().auth.epoch
    if (epoch !== lastEpoch) {
      lastEpoch = epoch
      sessionStore.clear()
    }
  })
}

/**
 * 创建会话内存列偏好适配器。
 *
 * @param tableId 表格业务标识（同表跨页签共享布局）
 * @param schemaVersion 列结构版本：列集合变化时递增以丢弃旧布局
 */
export function createSessionTablePreferences(tableId: string, schemaVersion: string | number = 1) {
  ensureEpochWatcher()
  return createLocalColumnPreferences({
    namespace: 'apex-admin',
    userId: store.getState().auth.identity?.username ?? 'anonymous',
    tenantId: 'default',
    tableId,
    schemaVersion,
    storage: sessionMemoryStorage,
  })
}

/** `useSessionColumnLayout` 返回的受控布局 props：直接展开进 ApexTableReact（切片与行类型无关，故不带泛型） */
export interface SessionColumnLayoutProps {
  columnOrder: ColumnOrderState
  columnVisibility: ColumnVisibilityState
  columnSizing: ColumnSizingState
  columnPinning: ColumnPinningState
  onColumnOrderChange: (updater: ColumnOrderState | ((previous: ColumnOrderState) => ColumnOrderState)) => void
  onColumnVisibilityChange: (updater: ColumnVisibilityState | ((previous: ColumnVisibilityState) => ColumnVisibilityState)) => void
  onColumnSizingChange: (updater: ColumnSizingState | ((previous: ColumnSizingState) => ColumnSizingState)) => void
  onColumnPinningChange: (updater: ColumnPinningState | ((previous: ColumnPinningState) => ColumnPinningState)) => void
}

/** 挂载期恢复一次列布局，此后四份切片变化自动防抖写回内存存储 */
export function useSessionColumnLayout<D extends object>(tableId: string) {
  /** 表格实例引用：恢复布局需要运行时列集合（含列设置产生的显隐/顺序） */
  const tableRef = useRef<ApexTableInstance<D>>(null)
  const preferencesRef = useRef<ReturnType<typeof createSessionTablePreferences> | null>(null)
  /** 首次恢复完成前禁止自动保存，避免空默认布局覆盖已存偏好 */
  const restoredRef = useRef(false)
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ start: [], end: [] })

  /** 把一份布局切片应用到受控状态（恢复与恢复默认共用） */
  const applyLayout = useCallback((layout: ColumnPreferenceSlices) => {
    setColumnOrder(layout.columnOrder ?? [])
    setColumnVisibility(layout.columnVisibility ?? {})
    setColumnSizing(layout.columnSizing ?? {})
    setColumnPinning(layout.columnPinning ?? { start: [], end: [] })
  }, [])

  // 适配器随挂载创建、卸载释放；创建后立即从内存存储恢复一次
  useEffect(() => {
    const instance = createSessionTablePreferences(tableId)
    preferencesRef.current = instance
    // 本 Hook 属于页面组件（父级），effect 晚于表格子组件提交，实例引用可用
    if (tableRef.current) {
      applyLayout(instance.load({ columns: tableRef.current.getAllLeafColumns() }))
    }
    restoredRef.current = true
    return () => {
      instance.dispose()
      preferencesRef.current = null
      restoredRef.current = false
    }
  }, [applyLayout, tableId])

  // 自动保存：任一切片变化即交给适配器防抖写回（适配器内部与上次内容比对去重）
  useEffect(() => {
    if (!restoredRef.current || !preferencesRef.current) return
    preferencesRef.current.save({ columnOrder, columnVisibility, columnSizing, columnPinning })
  }, [columnOrder, columnVisibility, columnSizing, columnPinning])

  /** 恢复默认：清除本表已存布局并把受控切片归零（表格回到列定义顺序） */
  const resetToDefault = useCallback(() => {
    preferencesRef.current?.clear()
    applyLayout({})
  }, [applyLayout])

  /** 直接展开进 ApexTableReact 的受控布局 props */
  const columnProps: SessionColumnLayoutProps = {
    columnOrder,
    columnVisibility,
    columnSizing,
    columnPinning,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onColumnPinningChange: setColumnPinning,
  }

  return { tableRef, columnProps, resetToDefault }
}
