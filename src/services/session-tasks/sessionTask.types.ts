/**
 * 会话级任务类型定义（SPEC §6.3、§9.1、§10；T011 交付）。
 *
 * 会话任务层与查询层（@/hooks/page-query）的边界：
 * - 查询绑定页签可见性与查询 AbortSignal，隐藏即中止；
 * - 写入与文件传输挂在稳定会话层（SessionHost），切页签/进全屏/切布局
 *   继续接收回执，绝不复用会被页签清理的查询 AbortSignal。
 */

import type { ApiError } from '@/services/request/request.types'

/**
 * 写入任务状态机：
 * - queued：已登记、执行器尚未启动（此刻取消可证明「未提交」）；
 * - running：请求执行器已启动（此后取消/超时都无法证明服务端未收到）；
 * - success：后端信封明确成功；
 * - failed：后端明确拒绝（业务失败/授权失败，信封可判读）；
 * - unknown：结果待确认——超时、响应丢失、判读失败或用户停止等待；
 *   保留对象/动作/提交时间供页面核查（§6.3），不得伪装成功或已撤销；
 * - cancelled：仅在「执行器未启动即取消」时可判定为未提交。
 */
export type WriteTaskStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'unknown'
  | 'cancelled'

/** 结果待确认的成因：供页面提示区分「用户停止等待」与「回执丢失」 */
export type WriteUnknownReason = 'receipt-lost' | 'stopped-waiting'

/** 一条普通写入任务记录；页面 UI 只订阅，不直接改写 */
export interface WriteTaskRecord {
  id: string
  /** 提交时所属页签 key（对象页签为稳定对象身份）；null 表示会话级动作 */
  tabKey: string | null
  /** 动作标识（如 vehicle.delete），页面可据其重新翻译展示文案 */
  actionKey: string
  /** 提交时的对象/动作描述（当前语言快照；跨语言展示由页面按 actionKey 重译） */
  detail: string
  status: WriteTaskStatus
  /** 结果待确认成因（仅 status=unknown 时有值） */
  unknownReason?: WriteUnknownReason
  /** 明确失败时保留错误（bizCode/bizMessage 原文），供页面展示原因 */
  error: ApiError | null
  submittedAt: number
  finishedAt: number | null
}

/**
 * 传输阶段（SPEC §10.1 至少区分的准备/连接、上传中、服务端处理中）：
 * 仅在 status=active 时有意义。
 */
export type TransferPhase = 'preparing' | 'uploading' | 'server-processing'

/**
 * 传输任务终态：
 * - success：上传字节 100% 且后端信封业务成功（不得只凭字节发完判成功）；
 * - failed：传输失败且业务结果可判读（服务端明确拒绝）或可证明未发出字节；
 * - cancelled：用户/外部主动取消（仅说明前端停止传输）；
 *   若已有字节发往服务端，resultUnknown=true（业务结果仍待确认）；
 * - unknown：停滞中止/网络中断等导致传输失败且后端可能已收到数据。
 */
export type TransferStatus = 'active' | 'success' | 'failed' | 'cancelled' | 'unknown'

/** 一条文件传输任务记录；进度字段由传输引擎按 100ms 节流推进 */
export interface TransferTaskRecord {
  id: string
  tabKey: string | null
  /** 页面传入的传输类别（如 version/map/alarm-code），供订阅方分组展示 */
  kind: string
  /** 展示名（通常为文件名） */
  name: string
  status: TransferStatus
  /** 仅 status=active 时有值：当前所处传输阶段 */
  phase: TransferPhase | null
  /** 已发送字节（引擎观测到的最大值） */
  loaded: number
  /** 总字节；lengthComputable=false 时不可信（可能为 0） */
  total: number
  /** 总量是否可计算；false 时页面必须降级为不定进度，不得显示百分比 */
  lengthComputable: boolean
  /** 0—100；仅 lengthComputable=true 时有值 */
  percent: number | null
  /** 平均速度（字节/秒）；无可计算总量时也可能为 null */
  speedBps: number | null
  /** 预计剩余时间（毫秒）；仅可计算总量且有速度时有值 */
  etaMs: number | null
  /** 前端停止传输但后端可能已收到数据（业务结果待确认） */
  resultUnknown: boolean
  /** 终态错误（failed 时保留；cancelled/unknown 可为空） */
  error: ApiError | null
  startedAt: number
  finishedAt: number | null
}

/** 会话任务快照：store 对外唯一读取形状（useSyncExternalStore 消费） */
export interface SessionTasksSnapshot {
  writes: readonly WriteTaskRecord[]
  transfers: readonly TransferTaskRecord[]
}

/** 写入任务执行上下文：signal 属于任务控制器（会话级），页面不得换成查询 scope 的 signal */
export interface WriteTaskRunContext {
  signal: AbortSignal
}
