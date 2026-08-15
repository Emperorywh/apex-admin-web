/**
 * 演示模式运行时（规格 §13.1/§13.2）：main.tsx 以静态条件 + 动态 import 引入的唯一入口
 * （off 构建经 Vite define 替换整体剔除，规格 §13.3）。
 *
 * 职责：
 * - 注册请求 adapter 解析器：force 模式全量走 demo adapter；fallback 模式仅 sessionSource=demo
 *   的会话走 demo adapter（主实例与 refresh 专用实例共用，401 刷新单飞同样落在 demo 契约上）；
 * - 注册登录传输扩展：fallback 登录网络级失败 → 提示并 dispatch sessionSource=demo →
 *   以 demo adapter 重放一次登录；业务错误不切换；
 * - 订阅会话清理：token 与来源清空后重置 demo token 运行态（登出清 demo 运行态，规格 §13.2）。
 */
import type { UnknownAction } from '@reduxjs/toolkit'
import { SESSION_SOURCES } from '@/constants/auth/auth.constants'
import { appI18n, COMMON_NAMESPACE } from '@/i18n/i18n'
import { loginViaTransport, registerLoginTransportExtension } from '@/services/auth/auth.service'
import type { LoginTransportExtension } from '@/services/auth/auth.service'
import { showUiWarning } from '@/services/feedback/uiFeedback'
import { isApiError } from '@/services/request/envelope'
import { configureRequestAdapter } from '@/services/request/request'
import type { RequestAdapterResolver } from '@/services/request/request'
import type { RequestStore } from '@/services/request/request.types'
import { getDefaultAppStore } from '@/store/store'
import { sessionSourceSet } from '@/store/slices/user.slice'
import { demoAdapter, resetDemoTokenRuntime } from './adapters/demo.adapter'
import { DEMO_MODES, type DemoMode } from './demo.constants'

/** fallback 切换提示文案（zh 即 key；en-US 资源见 locales/en-US/common.ts） */
const FALLBACK_SWITCH_NOTICE_KEY = '无法连接真实后端，已切换到演示模式'

/** 读取构建期固定的演示模式；类型由 vite-env.d.ts 严格约束，vite.config 启动时校验非法值 */
function currentDemoMode(): DemoMode {
  return import.meta.env.VITE_DEMO_MODE
}

/** 网络级失败判定（规格 §13.1）：无 HTTP 状态的 ApiError（网络不可达/超时）；业务错误与取消不算 */
function isNetworkLevelFailure(error: unknown): boolean {
  return isApiError(error) && !error.canceled && error.httpStatus === undefined
}

/** 演示模式运行时句柄：resolver 供组合/测试使用；dispose 注销全部注册 */
export interface DemoRuntimeHandle {
  /** 请求 adapter 解析器（已注册到请求层；组合真实 mock 时可复用） */
  readonly resolver: RequestAdapterResolver
  /** 注销 adapter 解析器、登录传输扩展与会话清理订阅 */
  dispose(): void
}

/**
 * 把演示模式运行时绑定到指定 store 并完成全部注册。
 * store 必须是当前页面实际使用的 store（默认单例或测试构造的刷新模拟 store）。
 */
export function createDemoRuntime(store: RequestStore): DemoRuntimeHandle {
  // ① adapter 解析器：force 全量接管；fallback 仅 demo 会话接管；其余回落真实 adapter
  const resolver: RequestAdapterResolver = () => {
    const mode = currentDemoMode()
    if (mode === DEMO_MODES.FORCE) {
      return demoAdapter
    }
    if (mode === DEMO_MODES.FALLBACK && store.getState().user.sessionSource === SESSION_SOURCES.DEMO) {
      return demoAdapter
    }
    return undefined
  }
  configureRequestAdapter(resolver)

  // ② 登录传输扩展（规格 §13.2）：真实 adapter 网络级失败后切换 demo 来源并重放一次
  const extension: LoginTransportExtension = {
    normalizeSourceAfterRealLogin() {
      // force 模式下「真实通道」请求实际由 demo adapter 承载，会话来源归一为 demo
      const source =
        currentDemoMode() === DEMO_MODES.FORCE ? SESSION_SOURCES.DEMO : SESSION_SOURCES.REAL
      store.dispatch(sessionSourceSet({ sessionSource: source }) as UnknownAction)
    },
    async replayViaDemoAfterNetworkFailure(dto, error) {
      if (currentDemoMode() !== DEMO_MODES.FALLBACK) {
        return null
      }
      // 业务错误（HTTP 状态存在）与取消不切换（规格 §13.1）
      if (!isNetworkLevelFailure(error)) {
        return null
      }
      store.dispatch(sessionSourceSet({ sessionSource: SESSION_SOURCES.DEMO }) as UnknownAction)
      showUiWarning(appI18n.t(FALLBACK_SWITCH_NOTICE_KEY, { ns: COMMON_NAMESPACE }))
      // 重放走原始传输请求：adapter 解析器已按 demo 来源路由到 demo adapter；
      // 不经 login() 编排避免重放自身再次触发扩展（保持「重放一次」上限）
      return loginViaTransport(dto)
    },
  }
  registerLoginTransportExtension(extension)

  // ③ 会话清理订阅：登出/清理使 token 与来源归空后重置 demo token 运行态；
  //    CRUD 快照不在清理范围（是否清除由登出确认框选择，默认保留，规格 §13.2）
  const unsubscribe = store.subscribe(() => {
    const user = store.getState().user
    if (user.accessToken === null && user.sessionSource === null) {
      resetDemoTokenRuntime()
    }
  })

  return {
    resolver,
    dispose() {
      unsubscribe()
      configureRequestAdapter(null)
      registerLoginTransportExtension(null)
    },
  }
}

/**
 * 演示模式启动入口：main.tsx 顶层 await 引入（先于首个请求完成注册）。
 * off 构建不会导入本模块；非法/未设置取值时防御性跳过（vite.config 启动校验兜底）。
 */
export function setupDemoMode(): void {
  const mode = currentDemoMode()
  if (mode !== DEMO_MODES.FORCE && mode !== DEMO_MODES.FALLBACK) {
    return
  }
  createDemoRuntime(getDefaultAppStore().store)
}
