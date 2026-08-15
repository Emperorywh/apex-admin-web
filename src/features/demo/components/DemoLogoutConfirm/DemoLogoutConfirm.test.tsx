/**
 * demo 登出确认框测试（规格 §13.2）：默认不勾选清除快照（保留以便继续演示），
 * 勾选后 onConfirm 收到 true；确认框文案经 i18n key 提供。
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { UiFeedbackInstances } from '@/services/feedback/uiFeedback'
import { confirmDemoLogout } from './DemoLogoutConfirm'

interface CapturedConfirmOptions {
  title: string
  okText: string
  cancelText: string
  content: ReactNode
  onOk: () => Promise<void>
}

interface CapturedConfirm {
  onConfirm: ReturnType<typeof vi.fn>
  options: CapturedConfirmOptions
}

function captureConfirm(): CapturedConfirm {
  const confirm = vi.fn()
  const modal = { confirm } as unknown as UiFeedbackInstances['modal']
  const onConfirm = vi.fn().mockResolvedValue(undefined)
  confirmDemoLogout({ modal, onConfirm })
  expect(confirm).toHaveBeenCalledTimes(1)
  const options = (confirm.mock.calls[0] as unknown as CapturedConfirmOptions[])[0]
  return { onConfirm, options }
}

describe('confirmDemoLogout（规格 §13.2）', () => {
  it('默认保留快照：直接确认时 onConfirm 收到 false', async () => {
    const { onConfirm, options } = captureConfirm()
    expect(options.title).toBe('退出登录确认')
    expect(options.okText).toBe('退出登录')
    expect(options.cancelText).toBe('取消')

    render(options.content)
    expect(screen.getByText('同时清除演示数据快照')).toBeInTheDocument()
    await options.onOk()
    expect(onConfirm).toHaveBeenCalledWith(false)
  })

  it('勾选「同时清除演示数据快照」后确认收到 true', async () => {
    const { onConfirm, options } = captureConfirm()
    render(options.content)
    await userEvent.click(screen.getByRole('checkbox'))
    await options.onOk()
    expect(onConfirm).toHaveBeenCalledWith(true)
  })
})
