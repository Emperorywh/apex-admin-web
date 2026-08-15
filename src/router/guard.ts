/**
 * 认证与权限守卫（规格 §4.3）：
 * - 每个受保护 loader 第一行 await rehydratedPromise，随后调用同一 ensureProfile
 *   （父子 loader 可能并行执行，不能假设父 loader 已先完成；单飞保证一次启动最多一个 profile 请求）；
 * - 无 accessToken → 用 URLSearchParams#set 一次性编码当前 pathname+search+hash 后跳 /login；
 * - 匹配链中任一 permCode 不满足（hasPermissionChain AND 语义）→ replace /403；
 * - /login loader 发现 token 时先 ensureProfile，认证有效才跳合法 redirect 或 /dashboard，
 *   token 无效并完成清理后继续显示登录页；网络失败原样上抛由路由错误页提供重试与退出登录。
 */
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router'
import { replace } from 'react-router'
import { REDIRECT_QUERY_KEY, ROUTE_PATHS } from '@/constants/route.constants'
import type { ProfileData } from '@/types/auth/auth.types'
import { getDefaultAuthSessionRuntime } from '@/services/auth/auth.session'
import type { RequestStore } from '@/services/request/request.types'
import { getDefaultAppStore } from '@/store/store'
import { hasPermissionChain, selectPermissionInput } from '@/store/permissions'
import { readSanitizedRedirectTarget } from './redirect'

/** 守卫依赖：测试注入桩实现隔离网络与持久化；生产经 resolveDefaultGuardDeps 取默认单例 */
export interface RouteGuardDeps {
  store: RequestStore
  /** 启动闸门 Promise（规格 §4.3）：所有守卫 loader 第一行等待它 */
  rehydrated: Promise<void>
  /** 启动 profile 单飞（规格 §4.3）：父子并行 loader 共享同一实现 */
  ensureProfile(): Promise<ProfileData | null>
}

/** 守卫依赖提供者：延迟解析默认单例，保证模块导入无副作用 */
export type RouteGuardDepsProvider = () => RouteGuardDeps

/** 解析默认守卫依赖：绑定默认 store、其 rehydratedPromise 与默认认证会话单飞 */
export function resolveDefaultGuardDeps(): RouteGuardDeps {
  const appStore = getDefaultAppStore()
  return {
    store: appStore.store,
    rehydrated: appStore.rehydratedPromise,
    ensureProfile: getDefaultAuthSessionRuntime().ensureProfile,
  }
}

/**
 * 构造未登录跳转目标（规格 §4.3）：
 * 用 URLSearchParams#set 把当前 pathname+search+hash 编码一次作为 redirect 参数，
 * 禁止手工字符串拼接与重复 encodeURIComponent。
 */
function buildLoginRedirectTarget(url: URL): string {
  const current = `${url.pathname}${url.search}${url.hash}`
  const params = new URLSearchParams()
  params.set(REDIRECT_QUERY_KEY, current)
  return `${ROUTE_PATHS.LOGIN}?${params.toString()}`
}

/**
 * 受保护路由 loader 工厂（规格 §4.3）：
 * chain 为从受保护根到本节点累计的权限码链（含祖先，AND 语义）。
 * profile 失败但会话已被清理（AUTH_FORBIDDEN/刷新失效）时按未登录跳登录；
 * 其余失败（网络错误等）原样上抛，由 RouterErrorBoundary 提供重试与退出登录。
 */
export function createProtectedRouteLoader(getDeps: RouteGuardDepsProvider, chain: readonly string[]): LoaderFunction {
  return async ({ request }: LoaderFunctionArgs): Promise<Response | undefined> => {
    const deps = getDeps()
    // 启动闸门：第一行等待持久化恢复完成，不得先读 token（规格 §4.3/§17.1）
    await deps.rehydrated
    const url = new URL(request.url)
    if (deps.store.getState().user.accessToken === null) {
      return replace(buildLoginRedirectTarget(url))
    }
    try {
      await deps.ensureProfile()
    } catch (error) {
      if (deps.store.getState().user.accessToken === null) {
        // 等待期间会话已被清理：按未登录处理，携带当前地址回登录
        return replace(buildLoginRedirectTarget(url))
      }
      throw error
    }
    if (!hasPermissionChain(chain, selectPermissionInput(deps.store.getState()))) {
      return replace(ROUTE_PATHS.FORBIDDEN)
    }
    return undefined
  }
}

/**
 * /login loader 工厂（规格 §4.3）：
 * 无 token 时显示登录页；有 token 先 ensureProfile，认证有效才跳合法 redirect 或 /dashboard
 * （redirect 值经五步同源校验，失败回 /dashboard）；token 无效并完成清理后继续显示登录页；
 * 网络失败原样上抛，防止把网络故障误判为未登录。
 */
export function createLoginRouteLoader(getDeps: RouteGuardDepsProvider): LoaderFunction {
  return async ({ request }: LoaderFunctionArgs): Promise<Response | undefined> => {
    const deps = getDeps()
    await deps.rehydrated
    if (deps.store.getState().user.accessToken === null) {
      return undefined
    }
    try {
      await deps.ensureProfile()
    } catch (error) {
      // 会话已被清理（如 AUTH_FORBIDDEN、refresh 失效）：继续显示登录页
      if (deps.store.getState().user.accessToken === null) {
        return undefined
      }
      throw error
    }
    const url = new URL(request.url)
    return replace(readSanitizedRedirectTarget(url.search, url.origin))
  }
}

/** 受保护 index route loader：固定 replace 重定向到 /dashboard（规格 §4.2） */
export function createIndexRedirectLoader(): LoaderFunction {
  return () => replace(ROUTE_PATHS.DASHBOARD)
}
