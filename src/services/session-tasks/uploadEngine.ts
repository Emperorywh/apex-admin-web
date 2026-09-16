/**
 * 旧协议上传引擎：基于 XMLHttpRequest 的真实进度上传（T011；SPEC §10.1）。
 *
 * 沿用旧系统 uploadWithProgress 的已验证语义（源：C:\code\dd\src\api\uploadWithProgress.ts）：
 * - fetch 标准不支持上传进度，真实进度必须走 XHR（xhr.upload.onprogress）；
 * - 进度回调 100ms 节流、末次必发（请求体发完后强制 flush 100% 或已知 loaded）；
 * - 停滞检测：连接/上传阶段 60 秒无新字节 → 中止（stallTimeoutMs 可覆盖）；
 *   请求体发完（进入服务端处理）后停用——后端校验/落盘耗时可能远超 60 秒，
 *   不得在服务端处理阶段误判停滞（SPEC §10.1）；
 * - 不设 xhr.timeout 硬超时：依赖停滞检测 + 手动取消；
 * - lengthComputable=false 时仅透传 loaded，由调用方降级为不定进度。
 *
 * 与旧实现的差异（迁移修正）：
 * - 鉴权头经 legacyRequest.buildLegacyRequestHeaders 提供（单一 Bearer 来源），
 *   信封错误经 reportLegacyRequestError 汇入同一事件总线（1000000/1001000
 *   由身份层消费）；不再复刻旧的跳转副作用；
 * - 结果以结构化 outcome 返回（不直接 reject 散payload），由传输控制器
 *   统一映射为任务状态与「业务结果待确认」标记。
 */

import type { ApiError } from '@/services/request/request.types'
import {
  buildLegacyRequestHeaders,
  reportLegacyRequestError,
  LEGACY_DOWNLOAD_TIMEOUT_MS,
} from '@/services/request/legacy/legacyRequest'
import {
  describeLegacyFailure,
  isLegacyEnvelope,
  isLegacySuccess,
} from '@/services/request/legacy/legacyProtocol'
import { LEGACY_ERROR_CODES } from '@/services/request/legacy/legacy.types'
import { toApiError } from '@/services/request/request'

/** 进度回调最小节流间隔（毫秒），与旧实现一致，避免高频渲染 */
const PROGRESS_THROTTLE_MS = 100

/** 连接/上传阶段的停滞阈值默认值：沿旧系统 60 秒（SPEC §10.1 保留） */
export const UPLOAD_STALL_TIMEOUT_MS = 60_000

/** 服务端处理阶段（请求体发完后等响应）的保护超时：停滞检测已停用，
 *  但响应本身不能无限等待；沿旧下载通道 60 秒（超时归 unknown，不得当失败重发） */
export const UPLOAD_SERVER_PROCESSING_TIMEOUT_MS = LEGACY_DOWNLOAD_TIMEOUT_MS

/** 引擎进度事件：speed/eta 由引擎按平均速度计算（保留实际速度与 ETA 能力） */
export interface UploadEngineProgress {
  loaded: number
  total: number
  lengthComputable: boolean
  speedBps: number | null
  etaMs: number | null
}

/** 传输阶段回调：uploading＝字节发送中；server-processing＝请求体已发完等待响应 */
export type UploadEnginePhase = 'uploading' | 'server-processing'

export interface UploadEngineCallbacks {
  onPhase?: (phase: UploadEnginePhase) => void
  onProgress?: (progress: UploadEngineProgress) => void
}

export interface UploadEngineOptions {
  /** 额外请求头（一般不需要；鉴权与语言头自动注入） */
  headers?: Record<string, string>
  /** 任务控制器的取消信号（会话级，不由页签可见性驱动） */
  signal?: AbortSignal
  /** 连接/上传阶段停滞阈值，默认 60 秒；服务端处理阶段不受其影响 */
  stallTimeoutMs?: number
}

/**
 * 结构化结果：调用方（transferTasks）据 kind 映射任务终态。
 * bytesSent 为引擎观测到的已发送字节峰值，是「业务结果待确认」的判据。
 */
export type UploadEngineOutcome =
  | { kind: 'success'; envelope: unknown; bytesSent: number }
  /** 信封可判读的业务拒绝：结果已知（failed） */
  | { kind: 'business-failure'; error: ApiError; bytesSent: number }
  /** 用户/外部取消：前端停止传输；业务结果按 bytesSent 判定待确认 */
  | { kind: 'aborted'; bytesSent: number }
  /** 连接/上传阶段停滞被中止：业务结果按 bytesSent 判定 */
  | { kind: 'stalled'; phase: 'connecting' | 'uploading'; bytesSent: number }
  /** 网络层失败：业务结果按 bytesSent 判定 */
  | { kind: 'network-error'; error: ApiError; bytesSent: number }
  /** HTTP 非 2xx（含网关错误页）：服务端已响应但无业务判读 */
  | { kind: 'http-error'; status: number; bytesSent: number }
  /** HTTP 2xx 但响应不是合法 JSON/信封：业务结果不可判读 */
  | { kind: 'unreadable-response'; status: number; snippet: string; bytesSent: number }

export function runLegacyUpload(
  url: string,
  formData: FormData,
  options: UploadEngineOptions,
  callbacks: UploadEngineCallbacks,
): Promise<UploadEngineOutcome> {
  const stallTimeoutMs = options.stallTimeoutMs ?? UPLOAD_STALL_TIMEOUT_MS

  return new Promise<UploadEngineOutcome>((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url, true)

    /* 中止标记与字节观测：aborted 保证只 settle 一次；bytesSentPeak 是
       「已有数据发往后端」的唯一判据（SPEC §10.1 结果待确认条件） */
    let settled = false
    let bytesSentPeak = 0
    let uploadDone = false
    let stallTimer: ReturnType<typeof setTimeout> | null = null
    let lastProgressEmitAt = 0
    let lastLoaded = 0
    let lastTotal = 0
    let lastLengthComputable = false
    let phase: 'connecting' | 'uploading' = 'connecting'
    const startedAt = Date.now()
    // 服务端处理阶段保护定时器：停滞检测停用后，响应仍受 60 秒保护
    let serverProcessingTimer: ReturnType<typeof setTimeout> | null = null

    const clearTimers = (): void => {
      if (stallTimer) {
        clearTimeout(stallTimer)
        stallTimer = null
      }
      if (serverProcessingTimer) {
        clearTimeout(serverProcessingTimer)
        serverProcessingTimer = null
      }
    }

    /** 统一出口：清定时器 → 中止请求 → resolve（仅一次） */
    const finish = (outcome: UploadEngineOutcome): void => {
      if (settled) return
      settled = true
      clearTimers()
      try {
        if (!uploadDone) xhr.abort()
      } catch {
        /* xhr 中止失败不影响结果返回 */
      }
      resolve(outcome)
    }

    /** 停滞定时器：仅连接/上传阶段有效；任一新字节进展重置 */
    const resetStallTimer = (): void => {
      if (uploadDone) return
      if (stallTimer) clearTimeout(stallTimer)
      stallTimer = setTimeout(() => {
        finish({ kind: 'stalled', phase, bytesSent: bytesSentPeak })
      }, stallTimeoutMs)
    }

    /* 外部取消：send 前已 abort 则直接返回，不发出请求（可证明未提交） */
    if (options.signal?.aborted) {
      finish({ kind: 'aborted', bytesSent: 0 })
      return
    }
    options.signal?.addEventListener('abort', () => {
      finish({ kind: 'aborted', bytesSent: bytesSentPeak })
    })

    /* 鉴权与语言头：与 JSON 通道同源（XHR 不经 axios 拦截器，需显式注入）；
       不手动设置 Content-Type，multipart boundary 由浏览器生成 */
    const headers = { ...buildLegacyRequestHeaders(), ...(options.headers ?? {}) }
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value)
    }

    /** 进度回调（100ms 节流）；force=true 绕过节流（末次 flush 必发） */
    const emitProgress = (
      loaded: number,
      total: number,
      lengthComputable: boolean,
      force = false,
    ): void => {
      if (!callbacks.onProgress) return
      const now = Date.now()
      if (!force && now - lastProgressEmitAt < PROGRESS_THROTTLE_MS) return
      lastProgressEmitAt = now
      const elapsedSec = Math.max((now - startedAt) / 1000, 0.001)
      const speedBps = loaded / elapsedSec
      callbacks.onProgress({
        loaded,
        total,
        lengthComputable,
        speedBps: loaded > 0 ? speedBps : null,
        // 可计算总量且已有速度才提供 ETA；否则页面显示不定进度
        etaMs: lengthComputable && total > 0 && loaded > 0 ? ((total - loaded) / speedBps) * 1000 : null,
      })
    }

    /* ① 连接建立、请求体开始发送：切上传阶段并启动停滞检测 */
    xhr.upload.onloadstart = () => {
      phase = 'uploading'
      callbacks.onPhase?.('uploading')
      resetStallTimer()
    }

    /* ② 字节发送中：真实进度 + 停滞检测（仅 loaded 真正增长才算进展） */
    xhr.upload.onprogress = (event: ProgressEvent) => {
      if (event.loaded > lastLoaded) {
        lastLoaded = event.loaded
        bytesSentPeak = Math.max(bytesSentPeak, event.loaded)
        resetStallTimer()
      }
      lastTotal = event.total
      lastLengthComputable = event.lengthComputable
      emitProgress(event.loaded, event.total, event.lengthComputable)
    }

    /* ③ 请求体发完：进入服务端处理——停用停滞检测（后端处理耗时不可
       预估，不误判停滞）、强制 flush 末次进度、启用响应保护超时 */
    xhr.upload.onload = () => {
      uploadDone = true
      if (stallTimer) {
        clearTimeout(stallTimer)
        stallTimer = null
      }
      callbacks.onPhase?.('server-processing')
      if (lastLengthComputable) {
        // 保证 100% 那次回调必发（节流可能吞掉末次 onprogress）
        emitProgress(lastTotal, lastTotal, true, true)
      } else {
        // 不伪造 total：透传已知 loaded，页面保持不定进度直到落定
        emitProgress(lastLoaded, 0, false, true)
      }
      serverProcessingTimer = setTimeout(() => {
        // 服务端处理超时＝响应丢失：结果不可判读，转待确认而非失败
        finish({ kind: 'network-error', error: {
          isApiError: true,
          code: 'CLIENT.NETWORK_ERROR',
          status: 0,
          title: '服务端处理超时，结果待确认',
        }, bytesSent: bytesSentPeak })
      }, UPLOAD_SERVER_PROCESSING_TIMEOUT_MS)
    }

    /* ④ 响应返回：按旧协议信封判读（复刻 JSON 通道语义） */
    xhr.onload = () => {
      if (settled) return
      const status = xhr.status
      const raw = xhr.responseText || ''
      if (status >= 200 && status < 300) {
        let envelope: unknown
        try {
          envelope = JSON.parse(raw)
        } catch {
          finish({ kind: 'unreadable-response', status, snippet: raw.slice(0, 200), bytesSent: bytesSentPeak })
          return
        }
        if (!isLegacyEnvelope(envelope)) {
          const error: ApiError = {
            isApiError: true,
            code: LEGACY_ERROR_CODES.MALFORMED_RESPONSE,
            status,
            title: '上传响应不是有效的旧协议数据',
            detail: url,
          }
          reportLegacyRequestError(error, url, 'POST')
          finish({ kind: 'unreadable-response', status, snippet: raw.slice(0, 200), bytesSent: bytesSentPeak })
          return
        }
        if (isLegacySuccess(envelope)) {
          finish({ kind: 'success', envelope, bytesSent: bytesSentPeak })
          return
        }
        // 业务拒绝：结果已知（后端明确处理并拒绝），同时汇入事件总线
        const error = describeLegacyFailure(envelope.code, envelope.message, status)
        reportLegacyRequestError(error, url, 'POST')
        finish({ kind: 'business-failure', error, bytesSent: bytesSentPeak })
        return
      }
      // HTTP 非 2xx（含网关 502 HTML 错误页）：无可用业务判读
      finish({ kind: 'http-error', status, bytesSent: bytesSentPeak })
    }

    /* ⑤ 网络层失败（DNS/断网/CORS）：按已发送字节判定结果可否证明 */
    xhr.onerror = () => {
      finish({
        kind: 'network-error',
        error: toApiError(new Error('网络不可达')),
        bytesSent: bytesSentPeak,
      })
    }

    /* ⑥ 被 abort（停滞或外部取消）——统一由 finish 出口 resolve，这里兜底 */
    xhr.onabort = () => {
      if (!settled) {
        finish({ kind: 'aborted', bytesSent: bytesSentPeak })
      }
    }

    xhr.send(formData)
    /* send 后立即启动停滞检测，覆盖 onloadstart 之前的连接建立阶段 */
    resetStallTimer()
  })
}
