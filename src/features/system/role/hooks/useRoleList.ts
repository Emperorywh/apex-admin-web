/**
 * 角色列表数据 Hook（规格 §14.2/§14.3、§17.24）：
 * keyword/sortBy/sortOrder/分页条件驱动的列表查询，请求经 usePageRequest() 注入
 * 页签作用域（规格 §7.4-6），页签隐藏/关闭/淘汰时统一取消。
 *
 * 竞态防护（§17.24：快速查询/分页时前请求被取消且不覆盖后请求结果）：
 * 每次查询条件变化的 Effect 清理都会 abort 上一个在途请求，并以调用方 signal
 * 丢弃迟到的陈旧响应；取消静默（规格 §7.4-9），真实失败的提示由请求层统一弹出。
 */
import { useCallback, useEffect, useState } from 'react'
import type { AxiosRequestConfig } from 'axios'
import { DEFAULT_SORT_ORDER, PAGE_DEFAULT, PAGE_SIZE_DEFAULT } from '@/constants/request.constants'
import type { SortOrder } from '@/constants/request.constants'
import type { RoleSortField } from '@/constants/system/role/role.constants'
import { usePageRequest } from '@/hooks/usePageRequest'
import { normalizePagination } from '@/utils/pagination'
import { listRoles } from '@/services/system/role/role.service'
import type { Role } from '@/types/system/role/role.types'
import type { PageResult } from '@/types/system/user/user.types'

/** 列表查询条件：keyword 为已提交值；sortBy 未选时不发送，由后端按 createdAt desc（规格 §14.3） */
export interface RoleListQuery {
  keyword: string
  sortBy: RoleSortField | undefined
  sortOrder: SortOrder
  page: number
  size: number
}

/** 初始查询条件：第 1 页、默认每页条数、默认排序（未传 sortBy） */
const INITIAL_ROLE_LIST_QUERY: RoleListQuery = {
  keyword: '',
  sortBy: undefined,
  sortOrder: DEFAULT_SORT_ORDER,
  page: PAGE_DEFAULT,
  size: PAGE_SIZE_DEFAULT,
}

export interface UseRoleListResult {
  /** 已提交的查询条件（查询栏回显用） */
  query: RoleListQuery
  /** 当前页角色列表 */
  roles: Role[]
  /** 过滤条件后的总数（规格 §14.1 PageResult.total） */
  total: number
  /** 列表加载中 */
  loading: boolean
  /** 提交关键字搜索：重置回第 1 页（发送前统一去空白） */
  searchKeyword: (keyword: string) => void
  /** 更新排序：重置回第 1 页；sortBy 传 undefined 恢复默认排序 */
  changeSort: (sortBy: RoleSortField | undefined, sortOrder: SortOrder) => void
  /** 翻页或修改每页条数（antd Table 分页变更） */
  changePagination: (page: number, size: number) => void
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
        // page/size 经守卫归一：非法值回退默认、size 截断到上限（规格 §14.3）
        ...normalizePagination({ page: query.page, size: query.size }),
        // keyword 去首尾空白后发送（规格 §14.3）
        keyword: query.keyword.trim(),
        // sortBy 未选时不发送：后端统一按 createdAt desc
        ...(query.sortBy !== undefined ? { sortBy: query.sortBy, sortOrder: query.sortOrder } : {}),
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

  const searchKeyword = useCallback((keyword: string) => {
    setQuery((prev) =>
      prev.keyword === keyword && prev.page === PAGE_DEFAULT ? prev : { ...prev, keyword, page: PAGE_DEFAULT },
    )
  }, [])

  const changeSort = useCallback((sortBy: RoleSortField | undefined, sortOrder: SortOrder) => {
    setQuery((prev) =>
      prev.sortBy === sortBy && prev.sortOrder === sortOrder && prev.page === PAGE_DEFAULT
        ? prev
        : { ...prev, sortBy, sortOrder, page: PAGE_DEFAULT },
    )
  }, [])

  const changePagination = useCallback((page: number, size: number) => {
    setQuery((prev) => (prev.page === page && prev.size === size ? prev : { ...prev, page, size }))
  }, [])

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  return {
    query,
    roles: pageResult?.list ?? [],
    total: pageResult?.total ?? 0,
    loading,
    searchKeyword,
    changeSort,
    changePagination,
    reload,
  }
}
