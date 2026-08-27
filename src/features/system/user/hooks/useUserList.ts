/**
 * 用户列表 Hook：分页 / 状态筛选 / 排序，随页面请求 scope 取消。
 */

import { useCallback, useEffect, useState } from 'react'
import { usePageRequest } from '@/hooks/usePageRequest'
import { DEFAULT_PAGE_SIZE } from '@/services/request/request.constants'
import { pageUsers } from '@/services/system/user/user.service'
import { isCancelledError, toApiError } from '@/services/request/request'
import type { EntityStatus } from '@/services/request/request.types'
import type { UserEntity } from '@/types/system/user/user.types'

export interface UserListQuery {
  page: number
  pageSize: number
  sort?: string
  status?: EntityStatus
}

export interface UseUserListResult {
  items: UserEntity[]
  total: number
  loading: boolean
  error: string | null
  query: UserListQuery
  setQuery: (patch: Partial<UserListQuery>) => void
  reload: () => void
}

export function useUserList(): UseUserListResult {
  const { signal, revision } = usePageRequest()
  const [items, setItems] = useState<UserEntity[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQueryState] = useState<UserListQuery>({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  const setQuery = useCallback((patch: Partial<UserListQuery>) => {
    setQueryState((prev) => ({ ...prev, ...patch }))
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    pageUsers(query, { signal })
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
