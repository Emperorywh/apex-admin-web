/**
 * 推送状态纯函数（P12）：主表操作列入口显隐与子表取消入口显隐共用的
 * 可取消性判断。放独立模块避免组件文件混出非组件导出（fast-refresh 纪律）。
 */

import type { MapPushState } from '@/services/map-push-record/map-push-record.service.types'

/** 子记录当前是否可取消推送：仅等待/推送中存在未完成的推送任务（旧实现同边界） */
export function isSubRecordCancellable(state: MapPushState | undefined): boolean {
  return state === 'WAITING' || state === 'RUNNING'
}
