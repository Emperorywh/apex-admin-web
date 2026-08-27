/**
 * 角色列表 Hook：分页 / 状态筛选 / 排序。
 */

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_PAGE_SIZE } from '@/constants/request.constants'
import { usePageRequest } from '@/hooks/usePageRequest'
import { pageRoles } from '@/services/system/role/role.service'
import { isCancelledError, toApiError } from '@/services/request/request'
import type { EntityStatus } from '@/services/request/request.types'
import type { RoleEntity } from '@/types/system/role/role.types'

export interface RoleListQuery {
  page: number
  pageSize: number
  sort?: string
  status?: EntityStatus
}

export interface UseRoleListResult {
  items: RoleEntity[]
  total: number
  loading: boolean
  error: string | null
  query: RoleListQuery
  setQuery: (patch: Partial<RoleListQuery>) => void
  reload: () => void
}

export function useRoleList(): UseRoleListResult {
  const { signal, revision } = usePageRequest()
  const [items, setItems] = useState<RoleEntity[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQueryState] = useState<RoleListQuery>({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  const setQuery = useCallback((patch: Partial<RoleListQuery>) => {
    setQueryState((prev) => ({ ...prev, ...patch }))
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    pageRoles(query, { signal })
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
