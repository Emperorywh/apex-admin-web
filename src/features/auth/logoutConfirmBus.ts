/**
 * 退出确认请求总线：把「确认退出登录？」从命令式 modal.confirm 改为声明式宿主。
 * 背景：本工程已确认命令式 modal.confirm 会产生无法销毁的僵尸弹窗实例
 * （T013 教验，SessionHost 容量确认同因改造），退出确认必须走同一模式。
 */

export interface LogoutConfirmRequest {
  /** 确认文案（缺省为通用退出提示） */
  content?: string
}

type LogoutConfirmResponder = (ok: boolean) => void

interface LogoutConfirmPending {
  request: LogoutConfirmRequest
  respond: LogoutConfirmResponder
}

let pending: LogoutConfirmPending | null = null
/** useSyncExternalStore 快照：必须是稳定对象身份，裁决前后各只有一个值 */
let snapshot: { request: LogoutConfirmRequest } | null = null
const subscribers = new Set<() => void>()

function emitChange(): void {
  for (const notify of subscribers) notify()
}

/** 发起退出确认；用户裁决后 resolve（true=确认退出，false=取消） */
export function requestLogoutConfirm(request: LogoutConfirmRequest = {}): Promise<boolean> {
  // 已有待裁决请求时直接拒绝新的（幂等）：同一时刻只应存在一个退出确认
  if (pending !== null) return Promise.resolve(false)
  return new Promise((resolve) => {
    snapshot = { request }
    pending = {
      request,
      respond: (ok) => {
        pending = null
        snapshot = null
        emitChange()
        resolve(ok)
      },
    }
    emitChange()
  })
}

/** 宿主裁决入口：ok=true 确认，false 取消 */
export function respondLogoutConfirm(ok: boolean): void {
  pending?.respond(ok)
}

/** 声明式宿主订阅：注册/注销渲染同步回调 */
export function subscribeLogoutConfirm(listener: () => void): () => void {
  subscribers.add(listener)
  return () => {
    subscribers.delete(listener)
  }
}

/** 当前待裁决快照（宿主渲染用）：对象身份稳定，仅在请求建立/裁决时变化 */
export function peekLogoutConfirm(): { request: LogoutConfirmRequest } | null {
  return snapshot
}
