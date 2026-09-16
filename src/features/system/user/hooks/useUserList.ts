/**
 * 用户列表 Hook：分页 / 状态筛选 / 排序。
 * 查询生命周期统一由 usePageQuery 接管（可见性、过期响应隔离、取消）。
 */

import { useCallback, useState } from 'react'
import { usePageQuery } from '@/hooks/page-query'
import { DEFAULT_PAGE_SIZE } from '@/services/request/request.constants'
import { pageUsers } from '@/services/system/user/user.service'
import { toApiError } from '@/services/request/request'
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
  const [query, setQueryState] = useState<UserListQuery>({ page: 1, pageSize: DEFAULT_PAGE_SIZE })

  const page = usePageQuery({
    fetcher: (params, { signal }) => pageUsers(params, { signal }),
    params: query,
  })

  const setQuery = useCallback((patch: Partial<UserListQuery>) => {
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
