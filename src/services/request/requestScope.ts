/**
 * 页面请求作用域注册表（规格 §7.4-6）：
 * scopeId 标识请求属于哪个页签；页面隐藏、关闭或缓存淘汰时统一调用 abortRequestScope
 * 取消该 scope 下的全部在途请求，全局请求（scopeId 'global'）不被页签生命周期误杀。
 * 注册表只管理 AbortController 的登记与触发，不感知 React。
 */

/** scopeId → 该作用域下在途请求的 AbortController 集合 */
const scopedControllers = new Map<string, Set<AbortController>>()

/**
 * 把请求的 AbortController 登记到指定作用域。
 * 返回注销函数：请求结束后调用，把自身从作用域集合移除。
 */
export function registerScopeController(scopeId: string, controller: AbortController): () => void {
  let controllers = scopedControllers.get(scopeId)
  if (!controllers) {
    controllers = new Set()
    scopedControllers.set(scopeId, controllers)
  }
  controllers.add(controller)
  let unregistered = false
  return () => {
    if (unregistered) {
      return
    }
    unregistered = true
    controllers.delete(controller)
    if (controllers.size === 0) {
      scopedControllers.delete(scopeId)
    }
  }
}

/** 统一取消指定作用域下的全部在途请求：页签隐藏、关闭与缓存淘汰共用本入口 */
export function abortRequestScope(scopeId: string): void {
  const controllers = scopedControllers.get(scopeId)
  if (!controllers) {
    return
  }
  for (const controller of [...controllers]) {
    controller.abort()
  }
}

/** 当前作用域是否仍有在途请求（测试与诊断用） */
export function hasActiveScopeRequests(scopeId: string): boolean {
  const controllers = scopedControllers.get(scopeId)
  return controllers !== undefined && controllers.size > 0
}
