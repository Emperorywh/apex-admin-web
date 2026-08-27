/**
 * 页面激活状态：Activity 隐藏/显示时 isActive 变化，
 * 用于视频、音频、iframe、焦点、定时器等 DOM 型副作用的暂停与恢复（SPEC §5.2）。
 */

import { useRequestScope } from '@/components/RequestScopeProvider/RequestScopeContext'

export interface PageActiveState {
  isActive: boolean
  /** 激活轮次；重新激活时递增，可作为依赖触发“重新激活通知” */
  revision: number
}

export function usePageActive(): PageActiveState {
  const scope = useRequestScope()
  return {
    isActive: scope?.isActive ?? true,
    revision: scope?.revision ?? 0,
  }
}
