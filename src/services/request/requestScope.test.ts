/**
 * 页面请求作用域注册表单元测试（规格 §7.4-6/§17.12）：
 * 登记、注销、统一 abort 与空作用域安全调用。
 */
import { describe, expect, it } from 'vitest'
import { abortRequestScope, hasActiveScopeRequests, registerScopeController } from './requestScope'

describe('requestScope 注册表（规格 §17.12）', () => {
  it('abort 取消该作用域下全部在途请求；不同作用域互不影响', () => {
    const tabControllerA = new AbortController()
    const tabControllerB = new AbortController()
    const globalController = new AbortController()
    const releaseA1 = registerScopeController('tab-1', tabControllerA)
    registerScopeController('tab-1', tabControllerB)
    registerScopeController('global', globalController)

    expect(hasActiveScopeRequests('tab-1')).toBe(true)
    expect(hasActiveScopeRequests('global')).toBe(true)

    abortRequestScope('tab-1')
    expect(tabControllerA.signal.aborted).toBe(true)
    expect(tabControllerB.signal.aborted).toBe(true)
    // 全局作用域不被页签取消误杀
    expect(globalController.signal.aborted).toBe(false)
    expect(hasActiveScopeRequests('global')).toBe(true)
    releaseA1()
    expect(hasActiveScopeRequests('tab-1')).toBe(true)
  })

  it('全部请求结束后作用域集合与登记项清理', () => {
    const controller = new AbortController()
    const release = registerScopeController('tab-2', controller)
    expect(hasActiveScopeRequests('tab-2')).toBe(true)
    release()
    expect(hasActiveScopeRequests('tab-2')).toBe(false)
    // 重复释放幂等
    release()
    expect(hasActiveScopeRequests('tab-2')).toBe(false)
  })

  it('abort 空作用域安全无操作', () => {
    expect(() => abortRequestScope('not-exist')).not.toThrow()
    expect(hasActiveScopeRequests('not-exist')).toBe(false)
  })

  it('abort 后同一作用域的新请求不受影响', () => {
    const first = new AbortController()
    const releaseFirst = registerScopeController('tab-3', first)
    abortRequestScope('tab-3')
    releaseFirst()
    const second = new AbortController()
    const releaseSecond = registerScopeController('tab-3', second)
    expect(second.signal.aborted).toBe(false)
    releaseSecond()
  })
})
