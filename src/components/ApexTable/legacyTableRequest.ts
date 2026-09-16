/**
 * 服务端分页与跨页选择消费样例（T021 交付，T003 合同 §4 的表格侧映射）。
 *
 * - `createLegacyTableRequest` 把"旧协议 1 基页码取数"包装成 ApexTable
 *   request 模式回调：0 基 pageIndex 用 `toLegacyPageNo` 换算，取消信号
 *   原样下传（legacyGet 支持中止），total 必须是后端准确总数；
 * - `useCrossPageSelection` 把行选择状态保持在页面级：翻页/改页大小不丢，
 *   筛选变化后的清空由页面按业务时机调用 `clearSelection`（SPEC §7.2/A08：
 *   表头只做当前页全选，不存在"全库全选"；独立全量操作走 §6.4 业务流程）。
 */

import { useCallback, useMemo, useState } from 'react'
import type { ApexTableRequest, RowSelectionState } from 'apex-table-react'
import { toLegacyPageNo } from '@/services/request/legacy/legacyProtocol'

/** 页面提供的取数函数：pageNo 已是旧协议 1 基页码，signal 用于切页取消 */
export type LegacyTablePageFetcher<D> = (options: {
  pageNo: number
  pageSize: number
  signal: AbortSignal
}) => Promise<{ items: D[]; total: number }>

/**
 * 表格行数据约束：与库公开 API 的 RowData（Record 或数组）同形。
 * 库未再导出 RowData 本体，这里按同形约束声明，保证 D 可直接用于
 * ApexTableRequest/ApexColumnDef 等库类型。
 */
type ApexTableRowData = Record<string, any> | Array<any>

/**
 * 包装成 ApexTable request 回调。
 * rowCount 直接采用后端 total；末页删除后的页码回正仍由调用方
 * 用 `clampToValidPage` 处理（T003 合同 §4，本适配器不重复兜底）。
 */
export function createLegacyTableRequest<D extends ApexTableRowData>(fetchPage: LegacyTablePageFetcher<D>): ApexTableRequest<D> {
  return async ({ pageIndex, pageSize, signal }) => {
    const page = await fetchPage({ pageNo: toLegacyPageNo(pageIndex), pageSize, signal })
    return { data: page.items, rowCount: page.total }
  }
}

/** 跨页选择 Hook：状态、更新回调、清空与已选 ID 清单一站式提供 */
export function useCrossPageSelection() {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  /** 清空全部已选（含不在当前页的行） */
  const clearSelection = useCallback(() => setRowSelection({}), [])

  /** 已选行 ID 列表（TanStack 受控状态里值为 false 的键不计数） */
  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection],
  )

  return {
    rowSelection,
    onRowSelectionChange: setRowSelection,
    clearSelection,
    selectedIds,
    selectionCount: selectedIds.length,
  }
}
