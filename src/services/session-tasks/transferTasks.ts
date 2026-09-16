/**
 * 会话级文件传输控制器（T011；SPEC §9.1、§10.1）。
 *
 * - 传输挂在稳定会话层（SessionHost）：切页签/进全屏/页签隐藏不中止传输，
 *   UI 仅订阅进度与阶段；传输控制器与页面查询完全解耦；
 * - 阶段反馈：preparing（连接中）→ uploading（字节发送中，真实进度/速度/
 *   ETA）→ server-processing（服务端处理中）→ 终态；字节 100% 不等于成功，
 *   必须等待后端业务成功响应（§10.1）；
 * - 结果语义：取消/停滞/网络中断后，已有字节发往服务端即 resultUnknown
 *   （业务结果待确认），不宣称后端未执行；信封明确拒绝才算 failed；
 * - 迟到落定隔离：会话纪元变化后到达的结果不写入新会话记录。
 */

import { getIdentityEpoch, isIdentityEpochCurrent } from '@/services/auth/auth.service'
import type { ApiError } from '@/services/request/request.types'
import type { TransferTaskRecord } from '@/services/session-tasks/sessionTask.types'
import {
  addTransferRecord,
  getTransferRecord,
  nextSessionTaskId,
  removeTransferRecord,
  updateTransferRecord,
} from '@/services/session-tasks/sessionTaskStore'
import {
  runLegacyUpload,
  type UploadEnginePhase,
  type UploadEngineOutcome,
} from '@/services/session-tasks/uploadEngine'

export interface StartTransferTaskInput {
  /** 发起时所属页签 key；null 表示会话级动作 */
  tabKey: string | null
  /** 传输类别（version/map/alarm-code 等），供订阅方分组展示 */
  kind: string
  /** 展示名（通常为文件名） */
  name: string
  /** 上传地址（旧协议路径，自带 /fms、/rcsFlow 前缀） */
  url: string
  /** 已组装好的表单（文件字段名与扩展名约束由页面按源契约负责） */
  formData: FormData
  /**
   * 明确成功后的页面后处理（刷新列表/按位置刷新图片等）；仅后端信封
   * 业务成功且会话纪元一致时调用——字节 100% 不触发，失败/待确认不触发。
   */
  onSuccess?: (envelope: unknown) => void
  /** 连接/上传阶段停滞阈值覆盖（隔离验证用；生产默认 60 秒） */
  stallTimeoutMs?: number
}

export interface TransferTaskHandle {
  id: string
  /** 终态 promise：记录被清除/复位时以 null 结束；不 reject */
  settled: Promise<TransferTaskRecord | null>
}

/** 传输任务取消信号登记表（引擎经 options.signal 消费；落定后移除防泄漏） */
const transferAbortControllers = new Map<string, AbortController>()

/**
 * 引擎结果 → 任务终态映射（结果语义见文件头注释）：
 * - 一律以 bytesSent>0 判定「已有数据发往后端」→ 业务结果待确认；
 * - 信封明确的业务拒绝是唯一「结果已知失败」；HTTP 2xx 但响应不可判读
 *   与服务端处理超时归 unknown（结果待确认）。
 */
function outcomeToTerminal(
  outcome: UploadEngineOutcome,
): {
  status: TransferTaskRecord['status']
  resultUnknown: boolean
  error: ApiError | null
} {
  switch (outcome.kind) {
    case 'business-failure':
      // 后端明确拒绝：结果已知
      return { status: 'failed', resultUnknown: false, error: outcome.error }
    case 'aborted':
      // 用户/外部取消：仅说明前端停止传输
      return { status: 'cancelled', resultUnknown: outcome.bytesSent > 0, error: null }
    case 'stalled':
      // 停滞中止：无字节 = 可证明未处理（failed）；有字节 = 待确认
      return outcome.bytesSent > 0
        ? { status: 'unknown', resultUnknown: true, error: null }
        : {
            status: 'failed',
            resultUnknown: false,
            error: {
              isApiError: true,
              code: 'CLIENT.NETWORK_ERROR',
              status: 0,
              title: `连接${outcome.phase === 'connecting' ? '' : '/上传'}停滞，已中止`,
            },
          }
    case 'network-error':
      return outcome.bytesSent > 0
        ? { status: 'unknown', resultUnknown: true, error: outcome.error }
        : { status: 'failed', resultUnknown: false, error: outcome.error }
    case 'http-error':
      // 服务端以非 2xx 拒绝：传输失败；是否处理过数据不可证明 → 有字节即待确认
      return {
        status: 'failed',
        resultUnknown: outcome.bytesSent > 0,
        error: {
          isApiError: true,
          code: 'CLIENT.UNKNOWN',
          status: outcome.status,
          title: `上传失败（HTTP ${outcome.status}）`,
        },
      }
    case 'unreadable-response':
      // 2xx 但响应不可判读（网关回退 HTML/信封形状错误）：结果待确认
      return {
        status: 'unknown',
        resultUnknown: true,
        error: {
          isApiError: true,
          code: 'CLIENT.MALFORMED_RESPONSE',
          status: outcome.status,
          title: '上传响应不可判读，结果待确认',
        },
      }
    case 'success':
      // 不会出现（成功走独立分支），防御性兜底
      return { status: 'success', resultUnknown: false, error: null }
  }
}

/** 发起一条文件传输任务；立即返回句柄，进度/阶段经订阅获取 */
export function startTransferTask(input: StartTransferTaskInput): TransferTaskHandle {
  const id = nextSessionTaskId('tr')
  const epoch = getIdentityEpoch()
  const controller = new AbortController()
  transferAbortControllers.set(id, controller)

  const record: TransferTaskRecord = {
    id,
    tabKey: input.tabKey,
    kind: input.kind,
    name: input.name,
    status: 'active',
    phase: 'preparing',
    loaded: 0,
    total: 0,
    lengthComputable: false,
    percent: null,
    speedBps: null,
    etaMs: null,
    resultUnknown: false,
    error: null,
    startedAt: Date.now(),
    finishedAt: null,
  }
  addTransferRecord(record)

  const settled = (async (): Promise<TransferTaskRecord | null> => {
    const outcome = await runLegacyUpload(
      input.url,
      input.formData,
      { signal: controller.signal, stallTimeoutMs: input.stallTimeoutMs },
      {
        /* 阶段只推进活动态展示；终态由 outcome 统一落定 */
        onPhase: (phase: UploadEnginePhase) => {
          if (getTransferRecord(id)?.status === 'active') {
            updateTransferRecord(id, { phase })
          }
        },
        onProgress: (progress) => {
          if (getTransferRecord(id)?.status !== 'active') return
          updateTransferRecord(id, {
            loaded: progress.loaded,
            total: progress.total,
            lengthComputable: progress.lengthComputable,
            percent:
              progress.lengthComputable && progress.total > 0
                ? Math.min(100, (progress.loaded / progress.total) * 100)
                : null,
            speedBps: progress.speedBps,
            etaMs: progress.etaMs,
          })
        },
      },
    )

    // 迟到落定隔离：纪元已变化（切账号/登出/失效）不写入新会话，
    // 记录已随会话复位清空；onSuccess 一律不调用
    if (!isIdentityEpochCurrent(epoch)) return getTransferRecord(id) ?? null

    if (outcome.kind === 'success') {
      // 字节 100% 且信封业务成功才算成功（§10.1）
      updateTransferRecord(id, {
        status: 'success',
        phase: null,
        finishedAt: Date.now(),
        error: null,
        resultUnknown: false,
      })
      input.onSuccess?.(outcome.envelope)
      return getTransferRecord(id) ?? null
    }
    const terminal = outcomeToTerminal(outcome)
    updateTransferRecord(id, {
      status: terminal.status,
      phase: null,
      finishedAt: Date.now(),
      error: terminal.error,
      resultUnknown: terminal.resultUnknown,
    })
    return getTransferRecord(id) ?? null
  })()

  // 落定后释放取消信号句柄，防止长会话句柄泄漏
  void settled.finally(() => {
    transferAbortControllers.delete(id)
  })

  return { id, settled }
}

/**
 * 取消传输（§9.1 主动退出/关闭页签的「可取消传输」原语）：
 * 仅说明前端停止传输；已有字节发出的，任务记录保留 cancelled +
 * resultUnknown=true（业务结果待确认），不宣称后端未执行。
 */
export function cancelTransferTask(id: string): void {
  const record = getTransferRecord(id)
  if (!record || record.status !== 'active') return
  transferAbortControllers.get(id)?.abort()
}

/** 移除单条传输记录（离开确认完成后调用；不撤回后端已接收的数据） */
export function dismissTransferTask(id: string): void {
  transferAbortControllers.get(id)?.abort()
  transferAbortControllers.delete(id)
  removeTransferRecord(id)
}
