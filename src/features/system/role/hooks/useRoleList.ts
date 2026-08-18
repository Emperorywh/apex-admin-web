/**
 * 角色列表数据 Hook（对齐真实后端 GET /roles）：
 * status 筛选 + sort 白名单排序 + 分页条件驱动的列表查询，请求经 usePageRequest() 注入
 * 页签作用域（规格 §7.4-6），页签隐藏/关闭/淘汰时统一取消。
 *
 * 竞态防护（§17.24：快速查询/分页时前请求被取消且不覆盖后请求结果）：
 * 每次查询条件变化的 Effect 清理都会 abort 上一个在途请求，并以调用方 signal
 * 丢弃迟到的陈旧响应；取消静默（规格 §7.4-9），真实失败的提示由请求层统一弹出。
 */
import { useCallback, useEffect, useState } from 'react'
import type { AxiosRequestConfig } from 'axios'
import { DEFAULT_SORT_BY, DEFAULT_SORT_ORDER, PAGE_DEFAULT, PAGE_SIZE_DEFAULT } from '@/constants/request.constants'
import type { SortOrder } from '@/constants/request.constants'
import type { RoleSortField } from '@/constants/system/role/role.constants'
import { usePageRequest } from '@/hooks/usePageRequest'
import { normalizePagination } from '@/utils/pagination'
import { buildSortParam } from '@/utils/sortParam'
import { listRoles } from '@/services/system/role/role.service'
import type { Role, RoleStatus } from '@/types/system/role/role.types'
// PageResult 是跨业务域共享的分页实体，权威定义位于 user 域（TASK-003 所有权划分）
import type { PageResult } from '@/types/system/user/user.types'

/**
 * 列表查询条件：status 为 undefined 表示全部；sortBy/sortOrder 组合为后端 sort 单参数
 * （后端未传 sort 时不排序，故初始即按 createdAt desc 显式发送）。
 */
export interface RoleListQuery {
  status: RoleStatus | undefined
  sortBy: RoleSortField
  sortOrder: SortOrder
  page: number
  pageSize: number
}

/** 初始查询条件：第 1 页、默认每页条数、createdAt 降序 */
const INITIAL_ROLE_LIST_QUERY: RoleListQuery = {
  status: undefined,
  sortBy: DEFAULT_SORT_BY as RoleSortField,
  sortOrder: DEFAULT_SORT_ORDER,
  page: PAGE_DEFAULT,
  pageSize: PAGE_SIZE_DEFAULT,
}

export interface UseRoleListResult {
  /** 已提交的查询条件（查询栏回显用） */
  query: RoleListQuery
  /** 当前页角色列表 */
  roles: Role[]
  /** 过滤条件后的总数（PageResult.total） */
  total: number
  /** 列表加载中 */
  loading: boolean
  /** 按状态筛选：重置回第 1 页；undefined 表示全部 */
  changeStatus: (status: RoleStatus | undefined) => void
  /** 更新排序：重置回第 1 页 */
  changeSort: (sortBy: RoleSortField, sortOrder: SortOrder) => void
  /** 翻页或修改每页条数（antd Table 分页变更） */
  changePagination: (page: number, pageSize: number) => void
  /** 按当前条件重新加载（写操作成功后刷新列表用） */
  reload: () => void
}

export function useRoleList(): UseRoleListResult {
  const pageRequest = usePageRequest()
  const [query, setQuery] = useState<RoleListQuery>(INITIAL_ROLE_LIST_QUERY)
  const [pageResult, setPageResult] = useState<PageResult<Role> | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)

    // 组合发送函数：在 service 构造的请求配置上合入调用方 signal（规格 §7.4-7 同一合流机制）
    const sendWithSignal = <T>(config: AxiosRequestConfig): Promise<T> =>
      pageRequest<T>({ ...config, signal: controller.signal })

    void listRoles(
      {
        // page/pageSize 经守卫归一：非法值回退默认、pageSize 截断到上限
        ...normalizePagination({ page: query.page, pageSize: query.pageSize }),
        // status 为 undefined（全部）时不发送该参数
        ...(query.status !== undefined ? { status: query.status } : {}),
        sort: buildSortParam(query.sortBy, query.sortOrder),
      },
      sendWithSignal,
    )
      .then((result) => {
        // 陈旧响应（未被取消却晚于后续请求返回）不得覆盖后请求结果（§17.24）
        if (controller.signal.aborted) {
          return
        }
        setPageResult(result)
        setLoading(false)
      })
      .catch(() => {
        // 取消静默（规格 §7.4-9）；真实失败的提示由请求层统一弹出，保留现有数据态
        if (controller.signal.aborted) {
          return
        }
        setLoading(false)
      })

    // Effect 清理：查询条件变化或卸载时取消在途请求（§17.24：前请求被取消）
    return () => {
      controller.abort()
    }
  }, [pageRequest, query, reloadToken])

  const changeStatus = useCallback((status: RoleStatus | undefined) => {
    setQuery((prev) =>
      prev.status === status && prev.page === PAGE_DEFAULT ? prev : { ...prev, status, page: PAGE_DEFAULT },
    )
  }, [])

  const changeSort = useCallback((sortBy: RoleSortField, sortOrder: SortOrder) => {
    setQuery((prev) =>
      prev.sortBy === sortBy && prev.sortOrder === sortOrder && prev.page === PAGE_DEFAULT
        ? prev
        : { ...prev, sortBy, sortOrder, page: PAGE_DEFAULT },
    )
  }, [])

  const changePagination = useCallback((page: number, pageSize: number) => {
    setQuery((prev) => (prev.page === page && prev.pageSize === pageSize ? prev : { ...prev, page, pageSize }))
  }, [])

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  return {
    query,
    roles: pageResult?.items ?? [],
    total: pageResult?.total ?? 0,
    loading,
    changeStatus,
    changeSort,
    changePagination,
    reload,
  }
}
