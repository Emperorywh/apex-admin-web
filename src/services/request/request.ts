/**
 * axios 请求封装（规格 §7）：JSON envelope 解包、认证头、401 刷新单飞与一次重放
 * （epoch/abort 防护）、403 三类语义、GET 稳定去重、页签作用域取消与全局进度计数。
 *
 * 结构说明：
 * - 拦截器负责逐次尝试的横切逻辑（认证头、envelope→ApiError 归一、401/403 状态机与统一提示）；
 * - request() 包装负责每个逻辑请求的编排（去重、作用域、loading 租约、signal 合流），
 *   因此同一请求经历 401 等待与重放期间全局进度只计一次；
 * - refresh 使用不安装业务拦截器的专用实例，仍复用 baseURL 与 timeout（规格 §6.2）；
 * - 所有运行态编排在 createRequestRuntime 创建的实例内隔离，默认单例经 getDefaultRequestRuntime 懒创建。
 */
import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'
import type { UnknownAction } from '@reduxjs/toolkit'
import { API_ERROR_CODES, API_SUCCESS_CODE, REQUEST_TIMEOUT_MS } from '@/constants/request.constants'
import { showUiApiError } from '@/services/feedback/uiFeedback'
import { loadingFinished, loadingStarted } from '@/store/slices/app.slice'
import { tokensStored } from '@/store/slices/user.slice'
import { getDefaultAppStore } from '@/store/store'
import { buildDedupeKey } from './dedupe'
import { axiosErrorToApiError, coerceApiError, createApiError, createCanceledApiError, isRecord, unwrapSuccessResponse } from './envelope'
import { createProfileRefreshSingleFlight } from './profileRefresh'
import { registerScopeController } from './requestScope'
import type { RequestOptions, RequestStore } from './request.types'
import { runSessionCleanup } from './sessionCleanup'

/** 请求运行时：绑定一个 store 的全部请求编排状态 */
export interface RequestRuntime {
  /** 业务主实例：认证头拦截器 + envelope/状态机响应拦截器 */
  readonly instance: AxiosInstance
  /** refresh 专用实例：不安装业务响应拦截器，复用 baseURL/timeout */
  readonly refreshInstance: AxiosInstance
  /** 发起一个业务请求：envelope 解包后返回 data */
  request<T>(config: AxiosRequestConfig): Promise<T>
}

export interface CreateRequestRuntimeOptions {
  /** 显式 axios adapter（测试注入用）；缺省走 axios 默认实现 */
  adapter?: AxiosRequestConfig['adapter']
}

/** 全局 loading 租约：逻辑 requestId 只登记一次，结束时删除；请求结束路径统一释放（规格 §7.4-8/§17.25） */
interface LoadingLease {
  end(): void
}

export function createRequestRuntime(store: RequestStore, options: CreateRequestRuntimeOptions = {}): RequestRuntime {
  // 两实例共享同一份实例配置（规格 §6.2）
  const sharedConfig = {
    baseURL: import.meta.env.VITE_API_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    ...(options.adapter !== undefined ? { adapter: options.adapter } : {}),
  }
  const instance = axios.create(sharedConfig)
  const refreshInstance = axios.create(sharedConfig)

  // ── 认证头：请求发送前从 store 读取当下 accessToken；login/refresh 可经 skipAuthHeader 显式关闭 ──
  instance.interceptors.request.use((config) => {
    if (!config.skipAuthHeader) {
      const token = store.getState().user.accessToken
      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`)
      }
    }
    return config
  })

  // ── 会话清理守卫：同一纪元内只执行一次清理并跳登录（规格 §6.2） ──
  let cleanedAtEpoch: number | null = null
  function clearSessionOnce(expectedEpoch?: number): void {
    const currentEpoch = store.getState().user.sessionEpoch
    // 触发时的纪元与当前不同：登出/切账号已发生，旧触发直接丢弃（规格 §17.5）
    if (expectedEpoch !== undefined && expectedEpoch !== currentEpoch) {
      return
    }
    // 同纪元内已清理过且此后没有新会话（token 仍为空）：并发失败只清理/跳转一次
    if (cleanedAtEpoch === currentEpoch && store.getState().user.accessToken === null) {
      return
    }
    runSessionCleanup(store)
    cleanedAtEpoch = store.getState().user.sessionEpoch
  }

  // ── refresh 单飞：并发 401 共享一个 Promise，成功后原子替换双 token（规格 §6.2） ──
  const profileRefresh = createProfileRefreshSingleFlight(store)
  let refreshInFlight: Promise<void> | null = null

  function refreshTokens(): Promise<void> {
    refreshInFlight ??= executeRefresh()
    return refreshInFlight
  }

  async function executeRefresh(): Promise<void> {
    const startUser = store.getState().user
    const epochAtStart = startUser.sessionEpoch
    try {
      const { refreshToken } = startUser
      if (!refreshToken) {
        throw createApiError({
          errorCode: API_ERROR_CODES.AUTH_REFRESH_EXPIRED,
          message: '缺少可用的 refreshToken，会话已失效',
        })
      }
      const response = await refreshInstance.post('/auth/refresh', { refreshToken })
      const envelope: unknown = response.data
      const tokens =
        isRecord(envelope) && envelope.code === API_SUCCESS_CODE && isRecord(envelope.data) ? envelope.data : null
      const accessToken = tokens !== null && typeof tokens.accessToken === 'string' ? tokens.accessToken : undefined
      const rotatedRefreshToken =
        tokens !== null && typeof tokens.refreshToken === 'string' ? tokens.refreshToken : undefined
      if (!accessToken || !rotatedRefreshToken) {
        throw createApiError({ httpStatus: response.status, message: '刷新响应协议不合法' })
      }
      // refresh Promise 完成后必须再次核对 epoch；账号已经切换时丢弃结果（规格 §6.2）
      if (store.getState().user.sessionEpoch !== epochAtStart) {
        return
      }
      store.dispatch(tokensStored({ accessToken, refreshToken: rotatedRefreshToken }) as UnknownAction)
    } catch (error) {
      // epoch 已变化说明登出/切账号已发生：只丢弃旧结果，不清理新会话（规格 §17.5）
      if (store.getState().user.sessionEpoch === epochAtStart) {
        clearSessionOnce(epochAtStart)
      }
      throw coerceApiError(error)
    } finally {
      refreshInFlight = null
    }
  }

  // ── 响应处理：envelope 解包、取消归一、401 刷新重放、403 三类语义与统一提示 ──
  // 全部在 request() 包装内完成（而非响应拦截器），使重放复用同一编排路径且类型不解包不撒谎。

  /**
   * 处理一次传输失败：取消归一、401 刷新重放（epoch/abort 防护）、403 三类语义与统一提示。
   * 要么以终态 ApiError 结束（抛出），要么返回 { replay: true } 由调用方重发一次原请求。
   */
  async function processTransportError(error: unknown, config: AxiosRequestConfig & RequestOptions): Promise<{ replay: true }> {
    const apiError = error instanceof AxiosError ? await axiosErrorToApiError(error) : coerceApiError(error)
    // 所有 abort 统一转 canceled ApiError，不弹错误（规格 §7.4-9）
    if (apiError.canceled) {
      throw apiError
    }

    // 401 + AUTH_ACCESS_EXPIRED 是 accessToken 失效的唯一触发条件；skipAuthRefresh/已重放过的请求直接终态
    if (
      apiError.httpStatus === 401 &&
      apiError.errorCode === API_ERROR_CODES.AUTH_ACCESS_EXPIRED &&
      !config.skipAuthRefresh &&
      !config._authRetried
    ) {
      // 等待期间 signal 已 abort 或 sessionEpoch 已变化：以取消结束，不重放（规格 §6.2）
      if (config.signal?.aborted) {
        throw createCanceledApiError()
      }
      if (store.getState().user.sessionEpoch !== config._sessionEpoch) {
        throw createCanceledApiError()
      }
      await refreshTokens()
      // refresh 成功后再次防护：等待期间登出/切账号的请求不再重放
      if (config.signal?.aborted) {
        throw createCanceledApiError()
      }
      if (store.getState().user.sessionEpoch !== config._sessionEpoch) {
        throw createCanceledApiError()
      }
      config._authRetried = true
      return { replay: true }
    }

    if (apiError.httpStatus === 403) {
      if (apiError.errorCode === API_ERROR_CODES.AUTH_ACCOUNT_DISABLED) {
        // 账号禁用：不刷新 profile，直接一次会话清理并跳登录（规格 §6.2）
        clearSessionOnce(config._sessionEpoch)
        throw apiError
      }
      if (apiError.errorCode === API_ERROR_CODES.AUTH_PERMISSION_CHANGED) {
        // 权限变更：触发 profile 刷新单飞；用户提示由单飞完成后的冷却判定统一负责（规格 §5.4），
        // 单飞自身的失败已在 profile 请求的错误路径提示，这里不再重复弹错
        void profileRefresh.trigger().catch(() => undefined)
        throw apiError
      }
      // 普通 AUTH_FORBIDDEN 仅提示，不刷新 profile（规格 §5.4）
    }

    if (!config.silent) {
      showUiApiError(apiError)
    }
    throw apiError
  }

  // ── 全局进度：逻辑 requestId Set 去重，Redux 只存 loadingCount 数字（规格 §7.4-8） ──
  const loadingRequestIds = new Set<number>()
  let loadingSequence = 0

  function acquireLoadingLease(skipGlobalLoading?: boolean): LoadingLease {
    if (skipGlobalLoading) {
      return { end: () => undefined }
    }
    const id = ++loadingSequence
    loadingRequestIds.add(id)
    store.dispatch(loadingStarted() as UnknownAction)
    let ended = false
    return {
      end() {
        if (ended) {
          return
        }
        ended = true
        loadingRequestIds.delete(id)
        store.dispatch(loadingFinished() as UnknownAction)
      },
    }
  }

  // ── 重复 GET 取消：key → 在途请求的 AbortController（规格 §7.4-5） ──
  const dedupeSlots = new Map<string, AbortController>()

  function claimDedupeSlot(key: string, controller: AbortController): () => void {
    dedupeSlots.get(key)?.abort()
    dedupeSlots.set(key, controller)
    let released = false
    return () => {
      if (released) {
        return
      }
      released = true
      if (dedupeSlots.get(key) === controller) {
        dedupeSlots.delete(key)
      }
    }
  }

  // ── request() 包装：去重、作用域、loading 租约与 signal 合流的唯一入口 ──
  async function request<T>(config: AxiosRequestConfig): Promise<T> {
    const merged: AxiosRequestConfig = { ...config }
    merged._sessionEpoch ??= store.getState().user.sessionEpoch
    const method = (merged.method ?? 'get').toUpperCase()
    const controller = new AbortController()

    // 写操作不去重；GET 默认 cancel-previous；key 计算失败（函数/循环引用参数）时未占用任何资源，直接上抛
    const shouldDedupe = method === 'GET' && (merged.dedupe ?? 'cancel-previous') === 'cancel-previous'
    const dedupeRelease = shouldDedupe
      ? claimDedupeSlot(
          buildDedupeKey({
            method,
            baseURL: merged.baseURL ?? instance.defaults.baseURL,
            url: merged.url,
            params: merged.params,
            responseType: merged.responseType,
            headers: merged.headers,
            scopeId: merged.scopeId,
            sessionEpoch: merged._sessionEpoch ?? 0,
          }),
          controller,
        )
      : null

    const lease = acquireLoadingLease(merged.skipGlobalLoading)

    // 页签作用域登记：页签隐藏/关闭/缓存淘汰统一 abort（规格 §7.4-6）
    const releaseScope = merged.scopeId ? registerScopeController(merged.scopeId, controller) : null

    // 调用方 signal（loader 等）与作用域取消合流到同一 AbortController；loader 透传不进入页面 scope
    // 对外契约只接受标准 AbortSignal（axios 的 AbortSignalLike 方法可选，不满足合流需要）
    const callerSignal = merged.signal as AbortSignal | undefined
    const forwardAbort = () => controller.abort()
    if (callerSignal) {
      if (callerSignal.aborted) {
        controller.abort()
      } else {
        callerSignal.addEventListener('abort', forwardAbort, { once: true })
      }
    }
    merged.signal = controller.signal

    try {
      // 传输阶段：循环至多重放一次；401 刷新成功后重发原请求，
      // 重放再失败会再次进入错误处理并因 _authRetried 进入终态
      let response: AxiosResponse
      for (;;) {
        try {
          response = await instance.request<AxiosResponse>(merged)
          break
        } catch (error) {
          await processTransportError(error, merged)
        }
      }
      // 响应阶段：2xx envelope 解包；业务失败/协议不合法转 ApiError 并统一提示
      // （HTTP 已是 2xx，不进入 401/403 认证状态机）
      try {
        return unwrapSuccessResponse(response) as T
      } catch (error) {
        const apiError = coerceApiError(error)
        if (!merged.silent) {
          showUiApiError(apiError)
        }
        throw apiError
      }
    } finally {
      if (callerSignal) {
        callerSignal.removeEventListener('abort', forwardAbort)
      }
      releaseScope?.()
      dedupeRelease?.()
      lease.end()
    }
  }

  return { instance, refreshInstance, request }
}

let defaultRuntime: RequestRuntime | null = null

/** 默认请求运行时：绑定页面级默认 store，首次调用时懒创建，避免模块导入副作用 */
export function getDefaultRequestRuntime(): RequestRuntime {
  defaultRuntime ??= createRequestRuntime(getDefaultAppStore().store)
  return defaultRuntime
}

/**
 * 业务请求入口（规格 §7.1）：业务 service 通过 request<T>() 完成类型解包，
 * 不能把 AxiosInstance 全局伪装成已解包类型。
 */
export function request<T>(config: AxiosRequestConfig): Promise<T> {
  return getDefaultRequestRuntime().request<T>(config)
}
