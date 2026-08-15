/**
 * 会话清理与登录跳转（规格 §6.2/§7.4）：
 * refresh 失效（AUTH_REFRESH_EXPIRED/网络失败/协议错误）与 AUTH_ACCOUNT_DISABLED
 * 只执行一次会话清理并跳登录，跳转地址携带经同源校验的当前地址。
 * 本模块只负责动作序列与目标地址构造；具体路由跳转语义由路由任务经
 * registerSessionExpiredNavigator 注册的导航回调接线。
 */
import type { UnknownAction } from '@reduxjs/toolkit'
import { REDIRECT_QUERY_KEY, ROUTE_PATHS } from '@/constants/route.constants'
import { pageCacheCleared } from '@/store/slices/pageCache.slice'
import { tabsCleared } from '@/store/slices/tabs.slice'
import { authCleared, sessionEpochIncremented } from '@/store/slices/user.slice'
import { isSafeRedirectTarget } from '@/utils/redirect'
import type { RequestStore } from './request.types'

/** 会话过期导航回调：路由任务注册，接收构造好的登录目标地址（含校验后的 redirect 参数） */
export type SessionExpiredNavigator = (loginTarget: string) => void

let sessionExpiredNavigator: SessionExpiredNavigator | null = null

/** 注册/清空会话过期导航回调；路由接线任务在启动时调用一次 */
export function registerSessionExpiredNavigator(navigator: SessionExpiredNavigator | null): void {
  sessionExpiredNavigator = navigator
}

/** 读取当前完整地址（pathname + search + hash），供 redirect 参数使用 */
export function readCurrentAddress(): string {
  const { pathname, search, hash } = window.location
  return `${pathname}${search}${hash}`
}

/**
 * 构造登录跳转目标（规格 §17.21）：
 * 当前地址通过同源校验且不是登录页自身时，附带 redirect 参数；
 * 校验失败（外站、协议相对、反斜杠、控制字符）或已是登录页则不带参数回登录页。
 */
export function buildLoginTarget(currentAddress: string): string {
  const isLoginAddress = currentAddress === ROUTE_PATHS.LOGIN || currentAddress.startsWith(`${ROUTE_PATHS.LOGIN}?`)
  if (!isSafeRedirectTarget(currentAddress) || isLoginAddress) {
    return ROUTE_PATHS.LOGIN
  }
  const params = new URLSearchParams()
  params.set(REDIRECT_QUERY_KEY, currentAddress)
  return `${ROUTE_PATHS.LOGIN}?${params.toString()}`
}

/**
 * 执行一次会话清理动作序列（规格 §6.2）：
 * 先递增 epoch 阻止旧异步任务回写与重放，再清空认证、销毁页签与页面缓存。
 * 动作序列本身幂等；「只执行一次」的判定由请求运行时的纪元去重守卫负责。
 */
export function performSessionCleanup(store: RequestStore): void {
  store.dispatch(sessionEpochIncremented() as UnknownAction)
  store.dispatch(authCleared() as UnknownAction)
  store.dispatch(tabsCleared() as UnknownAction)
  store.dispatch(pageCacheCleared() as UnknownAction)
}

/** 会话过期跳登录：派发动作序列后经注册的导航回调跳转；未注册时只清理不跳转 */
export function runSessionCleanup(store: RequestStore): void {
  performSessionCleanup(store)
  sessionExpiredNavigator?.(buildLoginTarget(readCurrentAddress()))
}
