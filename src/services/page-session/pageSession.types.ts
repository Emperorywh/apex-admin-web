/**
 * 页面会话类型定义（T013，SPEC §9.1）。
 *
 * 页面会话层与相邻层的边界：
 * - 页签实例（Activity 缓存）可被 LRU 淘汰，本层的草稿与轻量状态独立存在，
 *   干净页重建时可恢复轻量状态（草稿页本身受保护不会被淘汰）；
 * - 草稿登记是页面显式动作（事件处理器中调用），无稿初始值不会误标为脏；
 * - 会话任务层（@/services/session-tasks）提供运行中/待确认任务记录，
 *   离开协调器汇总两层构成完整保护条件。
 */

import type { TransferTaskRecord, WriteTaskRecord } from '@/services/session-tasks'

/** 一条内存草稿登记：页面保存成功或重置确认后必须解除（clearTabDraft） */
export interface DraftRecord {
  /** 页面内草稿标识（同页可有多份，如表单 + 表格编辑） */
  draftKey: string
  /** 草稿名称（提交时语言快照；离开确认弹窗直接展示） */
  label: string
  /** 登记为脏的时间戳（前端追溯用，不进业务请求） */
  dirtyAt: number
}

/** 单个页签的保护条件汇总：草稿 + 执行中/待确认写入 + 在途/待确认传输 */
export interface TabProtection {
  /** 页签 key；null 表示会话级任务条目（tabKey=null 的写入/传输，仅主动退出纳入） */
  tabKey: string | null
  drafts: readonly DraftRecord[]
  writes: readonly WriteTaskRecord[]
  transfers: readonly TransferTaskRecord[]
}

/** 离开动作类型：确认弹窗的标题/按钮文案与后续执行按此区分 */
export type LeaveAction = 'close' | 'refresh' | 'batch-close' | 'logout'

/**
 * 一条待确认的离开请求：协调器把保护条件汇总后交给 LeaveGuardHost 渲染，
 * 用户确认/取消经 resolveLeaveConfirm 回到发起方（Promise<boolean>）。
 */
export interface LeaveConfirmRequest {
  id: number
  action: LeaveAction
  /** 只含存在保护条件的页签；空数组时协调器不弹窗直接放行 */
  protections: readonly TabProtection[]
}

/** 页面会话快照：store 对外唯一读取形状（useSyncExternalStore 消费） */
export interface PageSessionSnapshot {
  /** tabKey → 草稿登记列表（只含有草稿的页签） */
  drafts: Readonly<Record<string, readonly DraftRecord[]>>
  /** tabKey → 轻量页签状态（查询条件/分页/展开与选中 ID 等可序列化数据） */
  lightStates: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}
