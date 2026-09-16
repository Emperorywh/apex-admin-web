/**
 * 旧协议纯函数：信封判定、分页转换、ID 规范化、文件名解析、错误映射。
 *
 * 本文件不依赖 axios / store / i18n，可独立复用与核对；
 * 传输、头部与事件见 legacyRequest.ts。
 */

import type { ApiError } from '@/services/request/request.types'
import {
  LEGACY_BIZ_CODES,
  LEGACY_ERROR_CODES,
  type LegacyEnvelope,
  type LegacyPage,
  type LegacyRawPage,
} from '@/services/request/legacy/legacy.types'

/**
 * 判定响应体是否为旧协议信封形状。
 * 只校验形状（code 为数字、message 为字符串），不判定业务成功与否；
 * 代理回退返回的 HTML、网关错误页等在此被拦下，转为 MALFORMED_RESPONSE 而非 undefined 访问。
 */
export function isLegacyEnvelope(value: unknown): value is LegacyEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown }).code === 'number' &&
    typeof (value as { message?: unknown }).message === 'string'
  )
}

/**
 * 旧协议成功判据：code===200 且 message==='success'（SPEC §6.1：保留源判据并集中处理）。
 * requireSuccessMessage 供个别实际契约不同的接口关闭 message 比对；
 * 若真实环境发现其他差异，按合同记录后在 service 层处理，不在页面散落判断。
 */
export function isLegacySuccess(
  envelope: LegacyEnvelope,
  requireSuccessMessage = true,
): boolean {
  if (envelope.code !== LEGACY_BIZ_CODES.OK) return false
  return !requireSuccessMessage || envelope.message === 'success'
}

/**
 * 旧分页响应 → 领域分页结果。
 * 字段缺省时兜底：records→空数组、total/current/size/pages→按 0/第1页/空页推算；
 * missionPage 与订单主记录等特殊分页由各自任务另行映射，不复用本函数（SPEC §6.1）。
 */
export function convertLegacyPage<T>(raw: LegacyRawPage<T> | null | undefined): LegacyPage<T> {
  const records = Array.isArray(raw?.records) ? raw.records : []
  const total = typeof raw?.total === 'number' ? raw.total : 0
  const size = typeof raw?.size === 'number' && raw.size > 0 ? raw.size : 0
  const current = typeof raw?.current === 'number' && raw.current > 0 ? raw.current : 1
  const pages =
    typeof raw?.pages === 'number' && raw.pages >= 0
      ? raw.pages
      : size > 0
        ? Math.ceil(total / size)
        : total > 0
          ? 1
          : 0
  return { items: records, page: current, pageSize: size, total, pages }
}

/**
 * ApexTable 0 基页码 → 旧协议 pageNo（1 起）。
 * 只做页码换算；排序/筛选参数是否服务端支持由各页面按源行为决定（SPEC §6.1）。
 */
export function toLegacyPageNo(pageIndex: number): number {
  return Math.max(0, Math.floor(pageIndex)) + 1
}

/**
 * 删除末页最后一条、total 变化等场景下把请求页码拉回有效页（SPEC §6.1）。
 * 入参与出参均为 1 起页码；total 为 0 时回第 1 页。
 */
export function clampToValidPage(requestedPage: number, total: number, pageSize: number): number {
  if (pageSize <= 0 || total <= 0) return 1
  const pages = Math.ceil(total / pageSize)
  return Math.min(Math.max(1, Math.floor(requestedPage)), pages)
}

/**
 * 行身份 ID 规范化为字符串（SPEC §6.1）。
 * 后端以字符串下发的大整数 ID 原样保留，禁止 Number() 往返；
 * 数值 ID 仅在 Number.isSafeInteger 范围内可靠，超出时前端已无法挽回精度，
 * 记入合同限制，须由真实环境核对后端下发类型（附录B.1）。
 */
export function toRowId(value: string | number): string {
  return String(value)
}

/**
 * 组装 Authorization 头：无论 token 是否已带 Bearer 前缀，最终只含一份
 * （SPEC §6.2）。空 token 返回 null，调用方省略该头。
 */
export function buildAuthorizationHeader(token: string | null | undefined): string | null {
  const trimmed = token?.trim()
  if (!trimmed) return null
  return /^bearer /i.test(trimmed) ? trimmed : `Bearer ${trimmed}`
}

/**
 * 解析 Content-Disposition 中的文件名（沿源实现）：
 * 优先 RFC 5987 的 filename*=charset''value（服务端中文文件名），其次 filename="value"。
 * 解析失败返回空串，由调用方回退默认名。
 */
export function parseDispositionFilename(disposition?: string | null): string {
  if (!disposition) return ''
  const starMatch = disposition.match(/filename\*=[^']*''([^;]+)/i)
  if (starMatch) {
    try {
      return decodeURIComponent(starMatch[1])
    } catch {
      return starMatch[1]
    }
  }
  const match = disposition.match(/filename="?([^";]+)"?/i)
  return match ? match[1] : ''
}

/**
 * 把旧协议业务失败映射为规范化 ApiError。
 * 1000000/1001000 是认证/授权事件而非普通失败，错误码单独区分，
 * 便于 T005/T015 按类型编排；其余码统一 BIZ_FAILURE 并保留原文。
 */
export function describeLegacyFailure(
  code: number,
  message: string,
  status = 200,
): ApiError {
  const base = {
    isApiError: true as const,
    status,
    bizCode: code,
    bizMessage: message,
    title: message || '请求失败',
  }
  if (code === LEGACY_BIZ_CODES.SESSION_EXPIRED) {
    return {
      ...base,
      code: LEGACY_ERROR_CODES.SESSION_EXPIRED,
      title: message || '登录已过期，请重新登录',
    }
  }
  if (code === LEGACY_BIZ_CODES.SOFTWARE_UNAUTHORIZED) {
    return {
      ...base,
      code: LEGACY_ERROR_CODES.SOFTWARE_UNAUTHORIZED,
      title: message || '软件未授权或授权已过期',
    }
  }
  return { ...base, code: LEGACY_ERROR_CODES.BIZ_FAILURE }
}

/**
 * 从二进制响应中嗅探旧协议 JSON 业务错误（SPEC §6.1：binary 可能实为 JSON 错误）。
 * 仅当前部字节呈现 JSON 对象形态时尝试解析；解析出信封形状则原样返回，
 * 否则返回 null（视为真实二进制内容）。
 */
export async function sniffLegacyErrorBlob(blob: Blob): Promise<LegacyEnvelope | null> {
  // 只读前 512 字节足以判定形态，避免为嗅探整读大文件
  const head = await blob.slice(0, 512).text()
  const trimmed = head.trimStart()
  if (!trimmed.startsWith('{')) return null
  try {
    const parsed: unknown = JSON.parse(head)
    return isLegacyEnvelope(parsed) ? parsed : null
  } catch {
    return null
  }
}
