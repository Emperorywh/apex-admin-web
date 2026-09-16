/**
 * 任务列表 Hook：分页 / 多条件筛选。
 * 查询生命周期统一由 usePageQuery 接管（可见性、过期响应隔离、取消）；
 * 1 秒轮询归 T066 接入真实接口时按 PAGE_POLLING.taskRecords 打开。
 */

import { useCallback, useState } from 'react'
import { usePageQuery } from '@/hooks/page-query'
import { DEFAULT_PAGE_SIZE } from '@/services/request/request.constants'
import { pageOrders } from '@/services/order-record/order.service'
import { toApiError } from '@/services/request/request'
import type { OrderListQuery } from '@/services/order-record/order.service.types'
import type { OrderEntity } from '@/types/order-record/order.types'

export interface UseOrderListResult {
  items: OrderEntity[]
  total: number
  loading: boolean
  error: string | null
  query: OrderListQuery
  setQuery: (patch: Partial<OrderListQuery>) => void
  reload: () => void
}

export function useOrderList(): UseOrderListResult {
  const [query, setQueryState] = useState<OrderListQuery>({ page: 1, pageSize: DEFAULT_PAGE_SIZE })

  const page = usePageQuery({
    fetcher: (params, { signal }) => pageOrders(params, { signal }),
    params: query,
  })

  const setQuery = useCallback((patch: Partial<OrderListQuery>) => {
    setQueryState((prev) => ({ ...prev, ...patch }))
  }, [])

  return {
    items: page.data?.items ?? [],
    total: page.data?.total ?? 0,
    loading: page.loading,
    error: page.error ? toApiError(page.error).title : null,
    query,
    setQuery,
    reload: page.reload,
  }
}
