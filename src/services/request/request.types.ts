/**
 * 请求层类型契约（规格 §7.1/§7.3，v1.14）：problem+json 失败协议、ApiError 与请求扩展配置。
 *
 * - 成功条件固定为 HTTP 2xx，响应体即资源 JSON 本体（无 envelope）；
 *   无返回值接口使用 204，空响应体解包为 null。
 * - 失败响应统一为 RFC 9457 application/problem+json，稳定错误码在 code 字段；
 *   程序分支只能依赖 errorCode，detail 只用于诊断和未知错误兜底。
 * - 通过 module augmentation 把 RequestOptions 合并进 AxiosRequestConfig，
 *   业务模块不能用类型断言绕过配置类型。
 */
import type { Store } from '@reduxjs/toolkit'
import type { AxiosRequestConfig } from 'axios'
import type { ApiErrorCode } from '@/constants/request.constants'
import type { AppState } from '@/store/slices/app.slice'
import type { PageCacheState } from '@/store/slices/pageCache.slice'
import type { TabsState } from '@/store/slices/tabs.slice'
import type { UserState } from '@/store/slices/user.slice'

/**
 * 失败响应体：RFC 9457 application/problem+json（规格 §7.1）。
 * type 为 urn:apex:problem:<小写错误码>；requestId 优先取 body，其次 X-Request-Id 响应头；
 * errors 仅 VALIDATION.FAILED 携带（field/reason/message 三元组）。
 */
export interface ApiProblem {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  code: ApiErrorCode
  requestId?: string
  errors?: Array<{ field: string; reason: string; message: string }>
}

/**
 * 业务层统一捕获的错误形状，不直接依赖 AxiosError 内部结构（规格 §7.1）。
 * canceled 为 true 时禁止弹出全局错误提示。
 */
export interface ApiError extends Error {
  /** HTTP 状态码；网络失败/超时等未收到响应时缺失 */
  httpStatus?: number
  /** 跨前后端稳定错误码（problem+json 的 code 字段）；非 problem 形状失败时缺失 */
  errorCode?: ApiErrorCode
  /** 请求追踪标识：优先取 problem body，其次响应头 X-Request-Id */
  requestId?: string
  /** problem+json 的 errors 数组原样透传，供调用端按需窄化 */
  details?: unknown
  /** 所有 abort（页签作用域、重复 GET 取消、调用方 signal）统一转换为 true */
  canceled: boolean
}

/**
 * 请求扩展配置（规格 §7.3），经 module augmentation 合并进 AxiosRequestConfig。
 * 内部字段以下划线开头，只能由请求封装写入。
 */
export interface RequestOptions {
  /** 静默请求：错误不弹全局提示（loader/guard/profile 初始化等场景） */
  silent?: boolean
  /** 页签请求作用域：页面隐藏、关闭或缓存淘汰时统一取消该 scope；全局请求用 GLOBAL_REQUEST_SCOPE */
  scopeId?: string
  /** 不计入全局进度 loadingCount */
  skipGlobalLoading?: boolean
  /** 不触发 401 刷新重放；login/refresh/logout 固定关闭（规格 §6.2） */
  skipAuthRefresh?: boolean
  /** 不写入 Authorization 认证头；login/refresh 可显式关闭（规格 §7.4-2） */
  skipAuthHeader?: boolean
  /** 重复请求策略：GET 默认 cancel-previous，写操作不去重 */
  dedupe?: 'cancel-previous' | 'none'
  /** 内部字段：是否已因 401 刷新重放过，保证每个业务请求最多重放一次；仅封装写入 */
  _authRetried?: boolean
  /** 内部字段：请求创建时的 sessionEpoch，用于陈旧会话防护；仅封装写入 */
  _sessionEpoch?: number
}

declare module 'axios' {
  export interface AxiosRequestConfig extends RequestOptions {}
}

/**
 * 传输无关的请求发送函数形态：结构兼容 request 与 usePageRequest() 的返回值。
 * 业务 service 以 send 参数接收注入的发送函数（默认真实 request），
 * 页面 Hook 注入页签作用域请求函数，使请求随页签生命周期统一取消（规格 §7.4-6）。
 */
export type SendRequest = <T>(config: AxiosRequestConfig) => Promise<T>

/** 请求层依赖的最小 store 状态树：应用 RootState 的结构子集，测试可用纯 store 构造 */
export interface RequestStateTree {
  user: UserState
  tabs: TabsState
  pageCache: PageCacheState
  app: AppState
}

/** 请求运行时持有的 store 形态：只要求能读取请求相关切片并派发 action */
export type RequestStore = Store<RequestStateTree>
