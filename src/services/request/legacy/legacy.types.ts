/**
 * 旧调度后端（/fms、/rcsFlow 前缀）协议级类型。
 *
 * 旧协议与 /api/v1 新协议并存但互不混用：
 * - 旧响应为 { code, message, data } 信封，成功判据集中于 legacyProtocol 判定
 * - 分页请求用 pageNo（1 起），响应用 records/current/size/total/pages
 * - 本文件只声明形状；解析、转换与错误映射见 legacyProtocol.ts / legacyRequest.ts
 */

import type { ApiError } from '@/services/request/request.types'

/** 旧协议业务信封（全部旧接口返回该形状；解析校验见 legacyProtocol.judgeLegacyEnvelope） */
export interface LegacyEnvelope<T = unknown> {
  code: number
  message: string
  data: T
}

/**
 * 旧协议服务端分页原始形状（typing.d.ts ResponseType）。
 * 各接口字段可能缺省，转换函数负责兜底，不强制所有接口同一形状（SPEC §6.1）。
 */
export interface LegacyRawPage<T = unknown> {
  records?: T[]
  total?: number
  size?: number
  current?: number
  pages?: number
}

/** 领域分页结果：records/current/size/total/pages 映射后的唯一形状（SPEC §6.1） */
export interface LegacyPage<T> {
  items: T[]
  /** 1 起页码，与旧协议 current 对齐；ApexTable 0 基页码由消费端再转换 */
  page: number
  pageSize: number
  total: number
  pages: number
}

/** 二进制下载结果：blob 与响应头信息一并返回，调用方据此移交浏览器或读取文件名 */
export interface LegacyDownloadResult {
  blob: Blob
  /** 已按 RFC 5987 / 普通 filename 解析的文件名；响应头缺失时为空串 */
  filename: string
  contentType: string
  status: number
}

/** 下载调用选项；method 仅支持 GET/POST（旧下载接口无其他方法） */
export interface LegacyDownloadOptions {
  method?: 'GET' | 'POST'
  params?: Record<string, unknown>
  data?: unknown
  signal?: AbortSignal
  /** 下载超时（毫秒）；默认 LEGACY_DOWNLOAD_TIMEOUT_MS，不套用 JSON 的 15 秒 */
  timeoutMs?: number
}

/** 旧协议请求公共选项 */
export interface LegacyRequestOptions {
  signal?: AbortSignal
  /** 超时（毫秒）；默认 LEGACY_JSON_TIMEOUT_MS */
  timeoutMs?: number
  headers?: Record<string, string>
}

/**
 * 旧协议稳定错误码（沿用 ApiError 的 <MODULE>.<REASON> 约定）。
 * bizCode / bizMessage 保留后端原文，供页面展示与合同核对。
 */
export const LEGACY_ERROR_CODES = {
  /** 业务码 1000000：token 失效，已发出 session-expired 事件 */
  SESSION_EXPIRED: 'LEGACY.SESSION_EXPIRED',
  /** 业务码 1001000：软件未授权，已发出 authorization-required 事件 */
  SOFTWARE_UNAUTHORIZED: 'LEGACY.SOFTWARE_UNAUTHORIZED',
  /** 其余非 200 业务码：业务失败（message 为后端文案） */
  BIZ_FAILURE: 'LEGACY.BIZ_FAILURE',
  /** 响应不是合法旧协议信封（如代理回退返回 HTML） */
  MALFORMED_RESPONSE: 'LEGACY.MALFORMED_RESPONSE',
} as const

/** 旧协议业务码常量（快照 dd/src/api/httpShared.ts BIZ_CODE + 成功码） */
export const LEGACY_BIZ_CODES = {
  /** 成功判据的一半：code===200 且 message==='success'（SPEC §6.1 保留原判据） */
  OK: 200,
  /** token 失效：清会话跳登录 */
  SESSION_EXPIRED: 1000000,
  /** 软件未授权：进授权流程 */
  SOFTWARE_UNAUTHORIZED: 1001000,
} as const

/** 旧协议请求事件类型 */
export type LegacyEventType =
  | 'session-expired'
  | 'authorization-required'
  | 'request-error'

/** 旧协议请求事件：身份/会话/提示层订阅，请求层不做路由跳转（交接给 T005/T015 编排） */
export interface LegacyRequestEvent {
  type: LegacyEventType
  /** request-error 时携带规范化错误；session-expired / authorization-required 时也附带对应错误 */
  error?: ApiError
  url?: string
  method?: string
}

export type LegacyEventListener = (event: LegacyRequestEvent) => void
