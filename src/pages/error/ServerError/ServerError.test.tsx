/** 500 页面测试（规格 §14.2）：标题渲染与返回首页导航 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTE_PATHS } from '@/constants/route.constants'
import { ServerError } from './ServerError'

let currentPath = ''
function PathProbe() {
  currentPath = useLocation().pathname
  return null
}

describe('ServerError（/500）', () => {
  it('渲染 500 结果页与标题文案', () => {
    render(
      <MemoryRouter initialEntries={[ROUTE_PATHS.SERVER_ERROR]}>
        <Routes>
          <Route path={ROUTE_PATHS.SERVER_ERROR} element={<ServerError />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('服务器错误')).toBeInTheDocument()
    expect(screen.getByText('服务器开小差了，请稍后重试')).toBeInTheDocument()
  })

  it('返回首页按钮 replace 导航到 /dashboard', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={[ROUTE_PATHS.SERVER_ERROR]}>
        <PathProbe />
        <Routes>
          <Route path={ROUTE_PATHS.SERVER_ERROR} element={<ServerError />} />
          <Route path={ROUTE_PATHS.DASHBOARD} element={<div>dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: '返回首页' }))
    expect(currentPath).toBe(ROUTE_PATHS.DASHBOARD)
  })
})
