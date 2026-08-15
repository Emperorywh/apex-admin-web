/**
 * uiFeedback 反馈桥单元测试（规格 §7.2/§7.4-3）：
 * 已知 errorCode 走 i18n 映射、未知错误固定文案+requestId、未就绪只记录不排队补弹。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_ERROR_CODES } from '@/constants/request.constants'
import { createApiError } from '@/services/request/envelope'
import {
  isUiFeedbackReady,
  registerUiFeedbackInstances,
  resetUiFeedbackInstances,
  showUiApiError,
  showUiMessage,
  showUiWarning,
} from './uiFeedback'

const messageError = vi.fn()
const messageWarning = vi.fn()

beforeEach(() => {
  messageError.mockClear()
  messageWarning.mockClear()
  registerUiFeedbackInstances({ message: { error: messageError, warning: messageWarning } } as never)
})

afterEach(() => {
  resetUiFeedbackInstances()
})

describe('uiFeedback（规格 §7.2/§7.4-3）', () => {
  it('注册与重置控制就绪状态', () => {
    expect(isUiFeedbackReady()).toBe(true)
    resetUiFeedbackInstances()
    expect(isUiFeedbackReady()).toBe(false)
  })

  it('已知 errorCode 映射为 TASK-005 的 i18n 文案，不附 requestId', () => {
    showUiApiError(createApiError({ message: '后端诊断消息', errorCode: API_ERROR_CODES.AUTH_INVALID_CREDENTIALS }))
    expect(messageError).toHaveBeenCalledTimes(1)
    expect(messageError).toHaveBeenCalledWith('用户名或密码错误')

    messageError.mockClear()
    showUiApiError(createApiError({ message: 'x', errorCode: API_ERROR_CODES.RESOURCE_CONFLICT, requestId: 'r-9' }))
    expect(messageError).toHaveBeenCalledWith('操作与当前状态冲突，请刷新后重试')
  })

  it('未知错误显示固定兜底文案 + requestId；无 requestId 只有固定文案', () => {
    showUiApiError(createApiError({ message: 'whatever', httpStatus: 502, requestId: 'req-42' }))
    expect(messageError).toHaveBeenCalledWith('请求失败，请稍后重试（requestId: req-42）')

    messageError.mockClear()
    showUiApiError(createApiError({ message: 'whatever', httpStatus: 502 }))
    expect(messageError).toHaveBeenCalledWith('请求失败，请稍后重试')
  })

  it('未知 errorCode 字符串同样走兜底文案', () => {
    showUiApiError(createApiError({ message: 'x', errorCode: 'NOT_IN_TABLE' as never, requestId: 'r-8' }))
    expect(messageError).toHaveBeenCalledWith('请求失败，请稍后重试（requestId: r-8）')
  })

  it('showUiWarning 经注册实例展示警告消息（恢复失败一次性提示，规格 §4.3）', () => {
    showUiWarning('本地设置恢复失败，已使用默认设置')
    expect(messageWarning).toHaveBeenCalledTimes(1)
    expect(messageWarning).toHaveBeenCalledWith('本地设置恢复失败，已使用默认设置')
    expect(messageError).not.toHaveBeenCalled()
  })

  it('showUiWarning 未就绪时只记录、不抛错', () => {
    resetUiFeedbackInstances()
    expect(() => showUiWarning('本地设置恢复失败，已使用默认设置')).not.toThrow()
    expect(messageWarning).not.toHaveBeenCalled()
  })

  it('未就绪时只记录、不排队补弹、不抛错', () => {
    resetUiFeedbackInstances()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => showUiMessage('登录状态已过期')).not.toThrow()
    expect(consoleSpy).toHaveBeenCalledTimes(1)
    expect(consoleSpy).toHaveBeenCalledWith('[uiFeedback] 实例未就绪，仅记录错误消息：', '登录状态已过期')
    // 注册后不会补弹过期消息
    registerUiFeedbackInstances({ message: { error: messageError } } as never)
    expect(messageError).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
