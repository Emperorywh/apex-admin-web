/**
 * PageErrorBoundary 测试（规格 §4.2/§9.1/§17.19）：
 * 页面渲染错误在本实例内显示 500 内容（复用 /500 页面实现），
 * 同树其他实例不受影响；控制台诊断只记录一次。
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { PageErrorBoundary } from '@/layouts/BasicLayout/components/PageErrorBoundary/PageErrorBoundary'

function Boom({ label }: { label: string }) {
  if (label === 'boom') {
    throw new Error('页面渲染崩溃')
  }
  return <div data-testid={`ok-${label}`} />
}

function renderInRouter(node: React.ReactNode) {
  return render(<MemoryRouter initialEntries={['/dashboard']}>{node}</MemoryRouter>)
}

describe('PageErrorBoundary（规格 §9.1/§17.19）', () => {
  it('子树渲染错误时显示 500 内容（服务器错误页），不再渲染出错子树', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderInRouter(
      <PageErrorBoundary>
        <Boom label="boom" />
      </PageErrorBoundary>,
    )
    // 复用 /500 页面实现（antd Result 500 + 文案）
    expect(screen.getByText('服务器错误')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '返回首页' })).toBeInTheDocument()
    consoleSpy.mockRestore()
  })

  it('相邻实例互不影响：崩溃实例显示 500，正常实例继续渲染', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderInRouter(
      <div>
        <PageErrorBoundary>
          <Boom label="boom" />
        </PageErrorBoundary>
        <PageErrorBoundary>
          <Boom label="fine" />
        </PageErrorBoundary>
      </div>,
    )
    expect(screen.getByText('服务器错误')).toBeInTheDocument()
    expect(screen.getByTestId('ok-fine')).toBeInTheDocument()
    consoleSpy.mockRestore()
  })

  it('无错误时原样渲染子树', () => {
    renderInRouter(
      <PageErrorBoundary>
        <Boom label="fine" />
      </PageErrorBoundary>,
    )
    expect(screen.getByTestId('ok-fine')).toBeInTheDocument()
    expect(screen.queryByText('服务器错误')).not.toBeInTheDocument()
  })
})
