/**
 * 会话级普通写入任务控制器（T011；SPEC §6.3、§9.1）。
 *
 * 与查询层（@/hooks/page-query）的硬边界：
 * - 本控制器自持 AbortController，绝不接收查询 scope 的 signal；
 *   切页签/进全屏/页签隐藏都不会中止写入等待；
 * - 写请求单次发送，无任何自动重试/重发（§6.3）；「停止等待」只是
 *   前端中止等待并转待确认，不能伪装成后端已撤销。
 *
 * 结果语义（§6.3「仅能证明请求尚未发出时才可判定为未提交」）：
 * - 执行器调用前即取消 → cancelled（未提交，可证明）；
 * - 执行器已调用后被取消/超时/网络中断/响应判读失败 → unknown（待确认）；
 * - 后端信封明确拒绝（业务失败/授权失败）→ failed（结果已知）。
 */

import { isIdentityEpochCurrent, getIdentityEpoch } from '@/services/auth/auth.service'
import { CLIENT_ERROR_CODES } from '@/services/request/request.constants'
import { toApiError } from '@/services/request/request'
import type { ApiError } from '@/services/request/request.types'
import { LEGACY_ERROR_CODES } from '@/services/request/legacy/legacy.types'
import type {
  WriteTaskRecord,
  WriteTaskRunContext,
} from '@/services/session-tasks/sessionTask.types'
import {
  addWriteRecord,
  getWriteRecord,
  nextSessionTaskId,
  removeWriteRecord,
  updateWriteRecord,
} from '@/services/session-tasks/sessionTaskStore'

export interface SubmitWriteTaskInput {
  /** 提交时所属页签 key；null 表示会话级动作（页面订阅按 tabKey 过滤） */
  tabKey: string | null
  /** 动作标识（稳定 key，页面据此重译展示文案，如 vehicle.delete） */
  actionKey: string
  /** 提交时的对象/动作描述（当前语言，如「删除车辆 AGV-01」） */
  detail: string
  /**
   * 请求执行器：页面在此发起真实业务请求，并必须把 ctx.signal 透传给
   * 请求层（legacyPost 等 options.signal）；「停止等待」经该 signal 中止。
   */
  run: (ctx: WriteTaskRunContext) => Promise<unknown>
  /**
   * 明确成功后的页面后处理（刷新列表/统计等）；仅回执成功且会话纪元
   * 仍一致时调用——失败/待确认/旧会话迟到一律不调用。
   */
  onSuccess?: (result: unknown) => void
}

export interface WriteTaskHandle {
  id: string
  /** 任务终态 promise：记录被清除/复位时以 null 结果结束，页面无需 catch */
  settled: Promise<WriteTaskRecord | null>
}

/** 任务信号登记表：stopWaitingForWrite 据此中止在途执行器；落定后移除防泄漏 */
const writeAbortControllers = new Map<string, AbortController>()

/**
 * 判定写入失败是否「结果已知」：只有后端信封可判读的明确拒绝才算
 * failed；超时/网络中断（无法证明请求未发出）、信封形状不合法
 * （响应丢失/代理回退）一律转待确认（§6.3）。
 */
function isDefinitiveRejection(error: ApiError): boolean {
  return (
    error.code === LEGACY_ERROR_CODES.BIZ_FAILURE ||
    error.code === LEGACY_ERROR_CODES.SOFTWARE_UNAUTHORIZED ||
    error.code === LEGACY_ERROR_CODES.SESSION_EXPIRED
  )
}

/** 提交一条普通写入任务；立即返回句柄，状态经订阅或 settled promise 获取 */
export function submitWriteTask(input: SubmitWriteTaskInput): WriteTaskHandle {
  const id = nextSessionTaskId('wt')
  const epoch = getIdentityEpoch()
  const controller = new AbortController()
  // started＝执行器已调用：此后请求随时可能发出，取消不再可证明「未提交」
  let started = false

  const record: WriteTaskRecord = {
    id,
    tabKey: input.tabKey,
    actionKey: input.actionKey,
    detail: input.detail,
    status: 'queued',
    error: null,
    submittedAt: Date.now(),
    finishedAt: null,
  }
  addWriteRecord(record)
  writeAbortControllers.set(id, controller)

  const settled = (async (): Promise<WriteTaskRecord | null> => {
    try {
      const runPromise = Promise.resolve(input.run({ signal: controller.signal }))
      // 执行器已调用：进入 running（此后取消不再可证明「未提交」），
      // UI 与 stopWaitingForWrite 依赖该状态区分 queued/running
      started = true
      if (getWriteRecord(id)?.status === 'queued') {
        updateWriteRecord(id, { status: 'running' })
      }
      const result = await runPromise
      // 迟到回执隔离（§6.3）：会话纪元已变化时不改写状态、不回调后处理；
      // 记录已随会话复位清空，这里仅丢弃结果
      if (!isIdentityEpochCurrent(epoch)) return getWriteRecord(id) ?? null
      updateWriteRecord(id, {
        status: 'success',
        finishedAt: Date.now(),
        error: null,
      })
      input.onSuccess?.(result)
      return getWriteRecord(id) ?? null
    } catch (rawError) {
      const error = toApiError(rawError)
      if (!isIdentityEpochCurrent(epoch)) return getWriteRecord(id) ?? null
      const existing = getWriteRecord(id)
      if (!existing) return null
      // 取消分两类：执行器未调用 = 可证明未提交 → cancelled；
      // 已调用 = 服务端可能已收到 → 待确认（stopped-waiting）
      if (error.code === CLIENT_ERROR_CODES.CANCELLED) {
        // stopWaitingForWrite 可能已把记录标记为 unknown，保留该标记
        if (existing.status !== 'unknown') {
          if (!started) {
            updateWriteRecord(id, { status: 'cancelled', finishedAt: Date.now(), error: null })
          } else {
            updateWriteRecord(id, {
              status: 'unknown',
              unknownReason: 'stopped-waiting',
              finishedAt: Date.now(),
              error: null,
            })
          }
        }
        return getWriteRecord(id) ?? null
      }
      if (isDefinitiveRejection(error)) {
        // 后端明确拒绝：保留原文原因，页面展示并刷新受影响数据（§6.3）
        updateWriteRecord(id, { status: 'failed', finishedAt: Date.now(), error })
        return getWriteRecord(id) ?? null
      }
      // 超时/网络中断/响应判读失败：无法证明未发出 → 待确认，保留对象/
      // 动作/提交时间供页面核查，不得标为失败或已撤销（§6.3）
      updateWriteRecord(id, {
        status: 'unknown',
        unknownReason: 'receipt-lost',
        finishedAt: Date.now(),
        error,
      })
      return getWriteRecord(id) ?? null
    } finally {
      writeAbortControllers.delete(id)
    }
  })()

  return { id, settled }
}

/**
 * 停止等待（§9.1 离开确认的「停止等待并关闭」原语）：
 * 中止任务信号并把在途任务预先标记为待确认。注意：不能撤销后端执行，
 * 记录保留供页面核查；离开确认完成后由协调器（T013/T017）调用
 * dismissWriteTask 清除记录。
 */
export function stopWaitingForWrite(id: string): void {
  const record = getWriteRecord(id)
  if (!record) return
  if (record.status === 'running') {
    updateWriteRecord(id, {
      status: 'unknown',
      unknownReason: 'stopped-waiting',
      finishedAt: Date.now(),
    })
  }
  writeAbortControllers.get(id)?.abort()
}

/** 移除单条写入记录（离开确认/批量关闭确认完成后调用；不撤回后端动作） */
export function dismissWriteTask(id: string): void {
  writeAbortControllers.get(id)?.abort()
  writeAbortControllers.delete(id)
  removeWriteRecord(id)
}
