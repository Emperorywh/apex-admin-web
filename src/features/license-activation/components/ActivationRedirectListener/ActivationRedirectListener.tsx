/**
 * 未激活引导监听（P02）：挂载于应用根（App.tsx），常驻一次。
 *
 * 请求层在业务码 1001000（系统未被激活，真实环境已实证）时做单飞收敛：
 * 一次性提示 + 派发 window 自定义事件；本组件监听该事件并用路由实例
 * SPA 导航到软件授权页（不经 window.location 重载，不丢页签与内存草稿）。
 *
 * 用自定义事件而非 redux 状态的原因：auth 切片整体持久化，瞬态引导标记
 * 会污染持久化 schema；且导航决策点在路由层，与请求层解耦、便于单点演进。
 * 事件名常量唯一定义于 request.constants.ts，两端共享。
 */

import { useEffect } from 'react'
import { ACTIVATION_REQUIRED_EVENT } from '@/services/request/request.constants'
import { ROUTE_PATHS } from '@/router/definitions'
import { appRouter } from '@/router/router'

export function ActivationRedirectListener() {
  useEffect(() => {
    const handler = () => {
      // 已在授权页（本页自身请求触发）不重复导航，页面自行呈现后端信息
      if (window.location.pathname === ROUTE_PATHS['authorize-ingress']) return
      void appRouter.navigate(ROUTE_PATHS['authorize-ingress'])
    }
    window.addEventListener(ACTIVATION_REQUIRED_EVENT, handler)
    return () => window.removeEventListener(ACTIVATION_REQUIRED_EVENT, handler)
  }, [])
  // 纯副作用组件：不渲染任何内容
  return null
}
