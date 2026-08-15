// 全局测试初始化：只放跨业务通用的设置；业务测试不得集中到这里（规格 §3.1）
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// vitest 未开启 globals，Testing Library 的自动清理不会自行注册，这里统一接线
afterEach(cleanup)

// jsdom 未实现 ResizeObserver，antd 弹层等组件依赖它；提供无操作的最小桩
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

// jsdom 未实现 matchMedia，antd Grid/Form 的响应式断点监听依赖它；提供不匹配任何查询的最小桩
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}
