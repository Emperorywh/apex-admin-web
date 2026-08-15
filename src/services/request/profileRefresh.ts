/**
 * 权限变更 profile 刷新单飞（规格 §5.4）：
 * HTTP 403 + AUTH_PERMISSION_CHANGED 触发 /auth/profile 刷新，多个并发响应共享一个 Promise；
 * profile 请求自身返回 403 AUTH_PERMISSION_CHANGED 时因单飞在途而不再发起新请求，天然防递归；
 * 刷新完成后按 permissionVersion 与 30 秒冷却窗口判定是否提示（相同版本不重复提示）。
 * 本模块只实现单飞编排；具体 profile 请求函数由认证任务经 registerProfileRefreshFetcher 注册。
 */
import { API_ERROR_CODES } from '@/constants/request.constants'
import { PERMISSION_CHANGE_TIP_COOLDOWN_MS } from '@/constants/app.constants'
import { showUiApiError } from '@/services/feedback/uiFeedback'
import type { RequestStore } from './request.types'
import { createApiError } from './envelope'

/** profile 刷新执行器：完成 profile 拉取并把结果写入 store；由认证任务注册 */
export type ProfileRefreshFetcher = () => Promise<void>

let profileRefreshFetcher: ProfileRefreshFetcher | null = null

/** 注册/清空 profile 刷新执行器；认证任务在启动时调用一次 */
export function registerProfileRefreshFetcher(fetcher: ProfileRefreshFetcher | null): void {
  profileRefreshFetcher = fetcher
}

/** 单次刷新结果：本次完成后是否向用户提示了权限变更 */
export interface ProfileRefreshOutcome {
  prompted: boolean
}

/** 冷却窗口记录：最近一次提示时的权限版本与时间 */
interface PromptRecord {
  version: string | null
  at: number
}

export interface ProfileRefreshSingleFlight {
  /** 触发一次 profile 刷新：并发调用共享同一 Promise；在途期间的新触发不产生新请求（防递归） */
  trigger(): Promise<ProfileRefreshOutcome>
}

/** 创建绑定到指定 store 的 profile 刷新单飞；单飞状态随实例隔离，测试可各建各的 */
export function createProfileRefreshSingleFlight(store: RequestStore): ProfileRefreshSingleFlight {
  let inFlight: Promise<ProfileRefreshOutcome> | null = null
  let lastPrompt: PromptRecord | null = null

  async function runOnce(): Promise<ProfileRefreshOutcome> {
    // 先让出微任务：确保 trigger() 已完成单飞登记。执行器同步重入 trigger() 时
    // （/auth/profile 自身返回 403 AUTH_PERMISSION_CHANGED 的场景）必须共享同一
    // 在途 Promise 而不是发起新请求（规格 §5.4 防递归）。
    await Promise.resolve()
    const fetcher = profileRefreshFetcher
    if (!fetcher) {
      throw createApiError({ message: '尚未注册 profile 刷新执行器' })
    }
    await fetcher()
    const version = store.getState().user.permissionVersion
    const now = Date.now()
    const inCooldown =
      lastPrompt !== null && lastPrompt.version === version && now - lastPrompt.at < PERMISSION_CHANGE_TIP_COOLDOWN_MS
    if (inCooldown) {
      return { prompted: false }
    }
    lastPrompt = { version, at: now }
    showUiApiError(createApiError({ errorCode: API_ERROR_CODES.AUTH_PERMISSION_CHANGED, message: '权限已变更' }))
    return { prompted: true }
  }

  return {
    trigger(): Promise<ProfileRefreshOutcome> {
      inFlight ??= runOnce().finally(() => {
        inFlight = null
      })
      return inFlight
    },
  }
}
