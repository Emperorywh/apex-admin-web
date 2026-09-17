/**
 * 页签脏状态登记 hook（T00.6 草稿保护，规格 8.1）。
 *
 * 页面在有未保存修改时置 dirty=true（可附说明），保存/重置后置回 false：
 * - 脏页签不被 LRU 淘汰（tabsSlice.tabSynced 豁免 dirty 页签）
 * - 关闭/刷新/批量关闭该页签前，TabsBar/Header 会列出本页签并要求确认
 *
 * 生命周期语义：
 * - 草稿数据始终留在页面组件内存（Activity 隐藏不丢）；本 hook 只同步「是否存在」标记
 * - 组件卸载（页签关闭、LRU 淘汰、页签刷新重建、导航离开 noCache 页）即草稿销毁，
 *   cleanup 自动清除标记，避免残留指向已不存在的草稿
 * - 无请求 scope 的场景（登录页等）不产生页签，静默跳过
 */

import { useEffect } from 'react'
import { useRequestScope } from '@/components/RequestScopeProvider/RequestScopeContext'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { tabDirtyMarked } from '@/store/slices/tabsSlice'

/**
 * 同步页面草稿脏状态到所属页签。
 * @param isDirty 是否存在未保存修改（受控：完全由页面的草稿状态推导）
 * @param label 脏对象说明（如「创建表单」），出现在关闭确认对话框中；可省略
 */
export function useTabDirtyGuard(isDirty: boolean, label?: string): void {
  const dispatch = useAppDispatch()
  const scope = useRequestScope()
  const scopeKey = scope?.scopeKey ?? null

  useEffect(() => {
    if (scopeKey === null) return
    // 标记变化即同步：打开确认对话框、LRU 豁免都依据此标记
    dispatch(tabDirtyMarked({ key: scopeKey, dirty: isDirty, label }))
    return () => {
      // 卸载 = 草稿随之销毁（关页/淘汰/刷新重建），必须清标记防止「幽灵脏页签」
      dispatch(tabDirtyMarked({ key: scopeKey, dirty: false }))
    }
  }, [dispatch, scopeKey, isDirty, label])
}
