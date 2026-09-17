/**
 * 列偏好适配器生命周期 Hook（T00.5 表格公共设施）。
 *
 * 负责三件与组件无关的接线事项（列偏好的读写仍由页面按官方 API 完成）：
 * - 从登录会话取 userId：列偏好按用户隔离（DoD 5），不落任何假身份；
 * - 创建官方适配器实例（createTableColumnPreferences 统一身份约定）；
 * - 组件卸载前 flush 待写布局并 dispose，防止最后一列调整因防抖丢失。
 *
 * StrictMode/重复渲染安全：适配器在 effect 中创建并随 cleanup dispose，
 * 引用变化通过 state 通知；已 dispose 的旧实例不会被继续持有。
 */

import { useEffect, useState } from 'react'
import { useAppSelector } from '@/hooks/useAppSelector'
import {
  createTableColumnPreferences,
  type TableColumnPreferences,
} from '@/utils/table/columnPreferences'

/** 登录用户未就绪时返回 null：页面据此跳过偏好接线，表格以默认布局运行 */
export function useColumnPreferences(tableId: string): TableColumnPreferences | null {
  const username = useAppSelector((state) => state.auth.user?.username ?? null)
  const [adapter, setAdapter] = useState<TableColumnPreferences | null>(null)

  useEffect(() => {
    // 会话缺失（登出/恢复中）不创建适配器，避免把不同用户的列布局串到一起
    if (!username) {
      setAdapter(null)
      return
    }

    const created = createTableColumnPreferences({ tableId, userId: username })
    setAdapter(created)

    // 卸载/换用户：先 flush 防抖中的待写数据，再标记销毁（dispose 后 save 为空操作）
    return () => {
      created.flush()
      created.dispose()
    }
  }, [tableId, username])

  return adapter
}
