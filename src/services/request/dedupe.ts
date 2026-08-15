/**
 * 重复 GET 取消与稳定序列化（规格 §7.4-5）：
 * key 包含 method、规范化 baseURL/url、稳定序列化 params、responseType、Accept 头、
 * scopeId 与 sessionEpoch——不同页签、身份或响应类型不得碰撞。
 * 稳定序列化递归排序对象 key、保持数组与同名查询参数的原顺序，并拒绝函数/循环引用。
 * 写操作不去重。
 */
import type { AxiosRequestConfig } from 'axios'
import { createApiError } from './envelope'

/** 无法参与去重 key 计算的参数错误提示 */
const UNSERIALIZABLE_PARAMS_MESSAGE = '请求参数包含函数或循环引用，无法计算去重 key'

/** 递归过程中的已访问容器，用于识别循环引用 */
type SeenContainers = Set<unknown>

/** 单个值的稳定序列化：类型标签保证不同类型值不碰撞 */
function stableValue(value: unknown, seen: SeenContainers): string {
  if (value === null) {
    return 'null'
  }
  if (value === undefined) {
    return 'undefined'
  }
  switch (typeof value) {
    case 'number':
      return `number:${value}`
    case 'boolean':
      return `boolean:${value}`
    case 'string':
      return `string:${value}`
    case 'bigint':
      return `bigint:${value}`
    case 'function':
      throw createApiError({ message: UNSERIALIZABLE_PARAMS_MESSAGE })
    case 'symbol':
      throw createApiError({ message: UNSERIALIZABLE_PARAMS_MESSAGE })
    case 'object':
      break
    default:
      throw createApiError({ message: UNSERIALIZABLE_PARAMS_MESSAGE })
  }
  if (value instanceof Date) {
    return `date:${value.toISOString()}`
  }
  if (seen.has(value)) {
    throw createApiError({ message: UNSERIALIZABLE_PARAMS_MESSAGE })
  }
  seen.add(value)
  try {
    if (Array.isArray(value)) {
      // 数组保持原顺序：同名查询参数的顺序差异必须产生不同 key
      return `array:[${value.map((item) => stableValue(item, seen)).join(',')}]`
    }
    if (value instanceof URLSearchParams) {
      // URLSearchParams 逐对保序序列化，同名参数按出现顺序保留
      const pairs = [...value.entries()].map(([k, v]) => `${stableValue(k, seen)}=${stableValue(v, seen)}`)
      return `query:[${pairs.join('&')}]`
    }
    // 普通对象递归排序 key：key 顺序不影响 key 计算
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableValue(v, seen)}`)
    return `object:{${entries.join(',')}}`
  } finally {
    seen.delete(value)
  }
}

/**
 * 递归稳定序列化：排序对象 key、保序数组与同名查询参数、拒绝函数/循环引用。
 * 拒绝时抛出 ApiError，调用端以请求错误结束。
 */
export function stableSerializeParams(params: unknown): string {
  return stableValue(params, new Set())
}

/** 与 axios combineURLs 同语义地拼接 baseURL 与 url，再做查询串保序规范化 */
function normalizeUrl(baseURL?: string, url = ''): string {
  const trimmedBase = (baseURL ?? '').replace(/\/+$/, '')
  let combined: string
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(url)) {
    // 绝对地址不再叠加 baseURL
    combined = url
  } else if (trimmedBase.length === 0) {
    combined = `/${url.replace(/^\/+/, '')}`
  } else {
    combined = `${trimmedBase}/${url.replace(/^\/+/, '')}`
  }
  const queryIndex = combined.indexOf('?')
  if (queryIndex === -1) {
    return combined.replace(/\/+$/, '') || '/'
  }
  const path = combined.slice(0, queryIndex).replace(/\/+$/, '') || '/'
  // 分解查询串再用 URLSearchParams 重组：同名参数保持原顺序
  const search = new URLSearchParams(combined.slice(queryIndex + 1))
  const normalized = search.toString()
  return normalized.length > 0 ? `${path}?${normalized}` : path
}

/** 读取请求头字段的小写字符串值（兼容 AxiosHeaders 与普通对象） */
function readHeaderValue(headers: unknown, name: string): string {
  if (headers === null || typeof headers !== 'object') {
    return ''
  }
  const getter = (headers as { get?: (n: string) => unknown }).get
  if (typeof getter === 'function') {
    const value = getter.call(headers, name)
    return typeof value === 'string' ? value : ''
  }
  const raw = (headers as Record<string, unknown>)[name]
  return typeof raw === 'string' ? raw : ''
}

export interface DedupeKeyInput {
  method: string
  baseURL?: string
  url?: string
  params?: unknown
  responseType?: AxiosRequestConfig['responseType']
  headers?: unknown
  scopeId?: string
  sessionEpoch: number
}

/**
 * 计算重复 GET 的去重 key：method、规范化 baseURL/url（含保序查询串）、
 * 稳定序列化 params、responseType、Accept 头、scopeId 与 sessionEpoch。
 */
export function buildDedupeKey(input: DedupeKeyInput): string {
  return JSON.stringify([
    input.method.toUpperCase(),
    normalizeUrl(input.baseURL, input.url),
    stableSerializeParams(input.params),
    input.responseType ?? 'json',
    readHeaderValue(input.headers, 'Accept'),
    input.scopeId ?? '',
    input.sessionEpoch,
  ])
}
