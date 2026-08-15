/** BlankLayout 测试：空白布局以 Outlet 承载页面（规格 §3.1） */
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { BlankLayout } from './BlankLayout'

describe('BlankLayout', () => {
  it('经 Outlet 渲染子路由内容', () => {
    render(
      <MemoryRouter initialEntries={['/host/login']}>
        <Routes>
          <Route path="/host" element={<BlankLayout />}>
            <Route path="login" element={<div>登录页面内容</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('登录页面内容')).toBeInTheDocument()
  })

  it('不包含菜单等 BasicLayout 元素（仅空白容器）', () => {
    const { container } = render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<BlankLayout />}>
            <Route index element={<Outlet />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    expect(container.querySelectorAll('aside, nav').length).toBe(0)
  })
})
