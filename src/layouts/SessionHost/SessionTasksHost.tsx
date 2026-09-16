/**
 * 会话任务层宿主（T011）：挂在 SessionHost 内 PageCacheHost 之后的
 * 稳定会话层挂载点（与页签宿主同层级、布局之上），保证切页签/进全屏/
 * 切布局时写入与传输任务继续接收回执。
 *
 * 本组件不渲染任何 UI（任务展示归各页面与后续外壳卡）；职责只有一项：
 * 订阅身份纪元——登录/登出/切账号/认证失效使纪元递增时，清空旧会话的
 * 全部任务记录，保证旧会话任务不流入新账号（SPEC §6.3、§9.1）。
 */

import { useEffect } from 'react'
import { useAppSelector } from '@/hooks/useAppSelector'
import { resetSessionTasks } from '@/services/session-tasks/sessionTaskStore'

export function SessionTasksHost(): null {
  // auth.epoch 在 identityReady（登录/恢复完成）与 sessionExpired 时递增；
  // 挂载时的首次 effect 以当前纪元为基线，仅在其后变化时复位
  const epoch = useAppSelector((state) => state.auth.epoch)

  useEffect(() => {
    resetSessionTasks()
  }, [epoch])

  return null
}
