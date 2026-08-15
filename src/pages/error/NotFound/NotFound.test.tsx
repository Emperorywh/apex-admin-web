/** 404 页面测试（规格 §14.2）：标题渲染与返回首页导航 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTE_PATHS } from '@/constants/route.constants'
import { NotFound } from './NotFound'

let currentPath = ''
function PathProbe() {
  currentPath = useLocation().pathname
  return null
}

describe('NotFound（/404 与受保护根 *）', () => {
  it('渲染 404 结果页与标题文案', () => {
    render(
      <MemoryRouter initialEntries={[ROUTE_PATHS.NOT_FOUND]}>
        <Routes>
          <Route path={ROUTE_PATHS.NOT_FOUND} element={<NotFound />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('页面不存在')).toBeInTheDocument()
    expect(screen.getByText('您访问的页面不存在')).toBeInTheDocument()
  })

  it('返回首页按钮 replace 导航到 /dashboard', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={[ROUTE_PATHS.NOT_FOUND]}>
        <PathProbe />
        <Routes>
          <Route path={ROUTE_PATHS.NOT_FOUND} element={<NotFound />} />
          <Route path={ROUTE_PATHS.DASHBOARD} element={<div>dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: '返回首页' }))
    expect(currentPath).toBe(ROUTE_PATHS.DASHBOARD)
  })
})
