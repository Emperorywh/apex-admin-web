/**
 * 会话桥接：Redux 会话状态 ↔ 请求层令牌 ↔ 多窗口同步。
 *
 * - 令牌单向流动：auth.token 变化（登录/登出/过期/跨窗口）统一经 store 订阅
 *   同步到请求层，auth.service 不再直接操作令牌，避免两处真相源漂移
 * - 多窗口同步退出（规格 5.2）：监听其他窗口对 auth 持久化键的写入，
 *   对方会话清空时本窗口一并清空；登录不做跨窗口同步（规格只要求退出同步）
 */

import { setAccessToken } from '@/services/request/request'
import { sessionExpired } from '@/store/slices/authSlice'
import { store } from '@/store/store'

/** auth 切片的持久化键：与 store.ts 的 PERSIST_KEYS.AUTH 一致，并含 redux-persist 默认 keyPrefix（persist:） */
const AUTH_PERSIST_KEY = 'persist:apex-admin:auth'

/** 解析 redux-persist 写入的 auth 状态（非法内容返回 null 由调用方忽略） */
function parsePersistedAuth(raw: string | null): { user: unknown; token: unknown } | null {
  if (raw === null) return null
  try {
    return JSON.parse(raw) as { user: unknown; token: unknown }
  } catch {
    return null
  }
}

/** 初始化会话桥接：应在应用入口（渲染前）调用一次 */
export function initAuthBridge(): void {
  // 1) 初始令牌：无论本函数与 redux-persist rehydrate 谁先执行，都先对齐一次
  setAccessToken(store.getState().auth.token)

  // 2) store 订阅：token 每次变化同步到请求层（含 rehydrate 完成后的恢复）
  store.subscribe(() => {
    setAccessToken(store.getState().auth.token)
  })

  // 3) 多窗口同步退出：storage 事件只在"其他"窗口触发
  window.addEventListener('storage', (event) => {
    if (event.key !== AUTH_PERSIST_KEY) return
    const next = parsePersistedAuth(event.newValue)
    // 对方窗口会话已清空（登出/过期），而本窗口仍在登录态：同步清空
    if (next !== null && next.user === null && store.getState().auth.user !== null) {
      store.dispatch(sessionExpired())
    }
  })
}
