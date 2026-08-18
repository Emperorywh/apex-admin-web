/**
 * 认证导航意图通道（规格 §6.2）：
 * 会话编排产出「路由无关」的导航意图，路由任务经 registerAuthNavigator
 * 注册回调后接线消费并执行最终跳转；本模块不读取路由、不校验回跳、不执行导航。
 * 会话过期跳登录已有独立通道（sessionCleanup.registerSessionExpiredNavigator），此处不重复。
 */

/** 认证会话产生的导航意图 */
export type AuthNavigationIntent =
  | {
      /** 登录成功：默认落点为 /dashboard（ROUTE_FALLBACK_PATH）；合法回跳由路由任务校验后覆盖 */
      kind: 'post-login'
      target: string
    }
  | {
      /** 主动登出完成：回登录页，不携带 redirect 参数（用户显式离开，不回跳原地址） */
      kind: 'post-logout'
      target: string
    }

/** 导航意图消费回调：由路由任务注册 */
export type AuthNavigator = (intent: AuthNavigationIntent) => void

let authNavigator: AuthNavigator | null = null

/** 注册/清空导航意图消费回调；路由接线任务在启动时调用一次 */
export function registerAuthNavigator(navigator: AuthNavigator | null): void {
  authNavigator = navigator
}

/** 产出导航意图：未注册消费方时静默丢弃（测试与路由接线前的启动阶段） */
export function emitAuthNavigation(intent: AuthNavigationIntent): void {
  authNavigator?.(intent)
}
