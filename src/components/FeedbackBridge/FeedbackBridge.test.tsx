/**
 * FeedbackBridge 组件测试（规格 §7.2）：
 * 调用 App.useApp 并把实例注册到 uiFeedback；消息经注册实例真实弹出；
 * 卸载时清空注册，未就绪阶段只记录不补弹。
 */
import { render, screen } from '@testing-library/react'
import { App as AntdApp } from 'antd'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isUiFeedbackReady,
  showUiApiError,
  showUiMessage,
} from '@/services/feedback/uiFeedback'
import { createApiError } from '@/services/request/envelope'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { FeedbackBridge } from './FeedbackBridge'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('FeedbackBridge（规格 §7.2）', () => {
  it('挂载于 antd App 内时注册 App.useApp 实例，卸载时清空', () => {
    const view = render(
      <AntdApp>
        <FeedbackBridge>
          <span>content</span>
        </FeedbackBridge>
      </AntdApp>,
    )
    expect(isUiFeedbackReady()).toBe(true)
    expect(screen.getByText('content')).toBeInTheDocument()
    view.unmount()
    expect(isUiFeedbackReady()).toBe(false)
  })

  it('经 uiFeedback 弹出的消息真实渲染在 antd message 容器中', async () => {
    render(
      <AntdApp>
        <FeedbackBridge>
          <span>content</span>
        </FeedbackBridge>
      </AntdApp>,
    )
    showUiMessage('全局错误提示文案')
    expect(await screen.findByText('全局错误提示文案')).toBeInTheDocument()

    showUiApiError(createApiError({ message: 'x', errorCode: API_ERROR_CODES.AUTH_FORBIDDEN }))
    expect(await screen.findByText('没有权限执行此操作')).toBeInTheDocument()
  })

  it('未挂载（未就绪）时只记录不弹也不抛错', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => showUiMessage('早期消息')).not.toThrow()
    expect(consoleSpy).toHaveBeenCalledWith('[uiFeedback] 实例未就绪，仅记录错误消息：', '早期消息')
    consoleSpy.mockRestore()
  })
})
