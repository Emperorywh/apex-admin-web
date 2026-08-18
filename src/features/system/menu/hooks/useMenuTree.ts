/**
 * 菜单树数据 Hook（对齐真实后端 GET /menus/tree、§17.24）：
 * 挂载与 reload 时请求菜单树（不分页，include_disabled=true 管理端全量），
 * 请求经 usePageRequest() 注入页签作用域（规格 §7.4-6），页签隐藏/关闭/淘汰时统一取消。
 *
 * 竞态防护（§17.24：快速刷新时前请求被取消且不覆盖后请求结果）：
 * Effect 清理 abort 上一个在途请求，并以调用方 signal 丢弃迟到的陈旧响应；
 * 取消静默（规格 §7.4-9），真实失败的提示由请求层统一弹出。
 */
import { useCallback, useEffect, useState } from 'react'
import type { AxiosRequestConfig } from 'axios'
import { usePageRequest } from '@/hooks/usePageRequest'
import { getMenuTree } from '@/services/system/menu/menu.service'
import type { MenuItem } from '@/types/system/menu/menu.types'

export interface UseMenuTreeResult {
  /** 菜单树（兄弟节点按 sortOrder asc 稳定排序，由后端契约保证） */
  menus: MenuItem[]
  /** 树加载中 */
  loading: boolean
  /** 重新加载（写操作成功后刷新树用） */
  reload: () => void
}

export function useMenuTree(): UseMenuTreeResult {
  const pageRequest = usePageRequest()
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)

    // 组合发送函数：在 service 构造的请求配置上合入调用方 signal（规格 §7.4-7 同一合流机制）
    const sendWithSignal = <T>(config: AxiosRequestConfig): Promise<T> =>
      pageRequest<T>({ ...config, signal: controller.signal })

    void getMenuTree(sendWithSignal)
      .then((tree) => {
        // 陈旧响应（未被取消却晚于后续请求返回）不得覆盖后请求结果（§17.24）
        if (controller.signal.aborted) {
          return
        }
        setMenus(tree)
        setLoading(false)
      })
      .catch(() => {
        // 取消静默（规格 §7.4-9）；真实失败的提示由请求层统一弹出，保留现有数据态
        if (controller.signal.aborted) {
          return
        }
        setLoading(false)
      })

    // Effect 清理：reload 或卸载时取消在途请求（§17.24：前请求被取消）
    return () => {
      controller.abort()
    }
  }, [pageRequest, reloadToken])

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  return { menus, loading, reload }
}
