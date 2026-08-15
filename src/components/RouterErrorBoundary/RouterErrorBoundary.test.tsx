/**
 * RouterErrorBoundary 测试（规格 §4.2/§4.3）：
 * loader 抛错时渲染错误界面并提供「重试」（重新导航触发 loader 重跑）与「退出登录」
 * （经注入回调执行会话状态机）。
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { RouterErrorBoundary } from './RouterErrorBoundary'

describe('RouterErrorBoundary', () => {
  it('loader 网络失败：显示错误界面与诊断信息，不误判为未登录', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/boom',
          loader: () => {
            throw new Error('profile 网络失败')
          },
          errorElement: <RouterErrorBoundary onLogout={vi.fn()} />,
        },
      ],
      { initialEntries: ['/boom'] },
    )
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('服务器错误', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText('profile 网络失败')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /重\s*试/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /退出登录/ })).toBeInTheDocument()
  })

  it('重试：replace 重新导航当前地址，失败 loader 重新执行（isNewLoader 语义）', async () => {
    const user = userEvent.setup()
    const loaderCalls: number[] = []
    let failFirst = true
    const router = createMemoryRouter(
      [
        {
          path: '/flaky',
        loader: () => {
          loaderCalls.push(loaderCalls.length)
          if (failFirst) {
            failFirst = false
            throw new Error('一次性失败')
          }
          return null
        },
        errorElement: <RouterErrorBoundary onLogout={vi.fn()} />,
        element: <div>恢复成功</div>,
      },
    ], { initialEntries: ['/flaky'] })
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('一次性失败', {}, { timeout: 5000 })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /重\s*试/ }))
    expect(await screen.findByText('恢复成功')).toBeInTheDocument()
    expect(loaderCalls.length).toBe(2)
  })

  it('退出登录：调用注入的会话状态机回调并展示 loading 态', async () => {
    const user = userEvent.setup()
    let releaseLogout!: () => void
    const onLogout = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseLogout = resolve
        }),
    )
    const router = createMemoryRouter(
      [
        {
          path: '/boom',
          loader: () => {
            throw new Error('boom')
          },
          errorElement: <RouterErrorBoundary onLogout={onLogout} />,
        },
      ],
      { initialEntries: ['/boom'] },
    )
    render(<RouterProvider router={router} />)
    await screen.findByText('boom', {}, { timeout: 5000 })
    await user.click(screen.getByRole('button', { name: /退出登录/ }))
    expect(onLogout).toHaveBeenCalledTimes(1)
    // 登出进行中：按钮进入 loading 态（antd 以类标记，不设置 disabled 属性）
    expect(screen.getByRole('button', { name: /退出登录/ }).className).toContain('ant-btn-loading')
    releaseLogout()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /退出登录/ }).className).not.toContain('ant-btn-loading')
    })
  })
})
