/**
 * 任务列表 Hook：分页 / 多条件筛选，随页面请求 scope 取消。
 */

import { useCallback, useEffect, useState } from 'react'
import { usePageRequest } from '@/hooks/usePageRequest'
import { DEFAULT_PAGE_SIZE } from '@/services/request/request.constants'
import { pageOrders } from '@/services/order-record/order.service'
import { isCancelledError, toApiError } from '@/services/request/request'
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
  const { signal, revision } = usePageRequest()
  const [items, setItems] = useState<OrderEntity[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQueryState] = useState<OrderListQuery>({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  const setQuery = useCallback((patch: Partial<OrderListQuery>) => {
    setQueryState((prev) => ({ ...prev, ...patch }))
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    pageOrders(query, { signal })
      .then((page) => {
        if (!active) return
        setItems(page.items)
        setTotal(page.total)
      })
      .catch((caught) => {
        if (!active || isCancelledError(caught)) return
        setError(toApiError(caught).title)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query, signal, reloadToken, revision])

  return { items, total, loading, error, query, setQuery, reload }
}
