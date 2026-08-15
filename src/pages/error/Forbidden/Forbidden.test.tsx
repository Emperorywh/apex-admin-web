/** 403 页面测试（规格 §14.2）：标题渲染与返回首页导航 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTE_PATHS } from '@/constants/route.constants'
import { Forbidden } from './Forbidden'

/** 记录导航落点的探针 */
let currentPath = ''
function PathProbe() {
  currentPath = useLocation().pathname
  return null
}

describe('Forbidden（/403）', () => {
  it('渲染 403 结果页与标题文案', () => {
    render(
      <MemoryRouter initialEntries={[ROUTE_PATHS.FORBIDDEN]}>
        <Routes>
          <Route path={ROUTE_PATHS.FORBIDDEN} element={<Forbidden />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('无权限访问')).toBeInTheDocument()
    expect(screen.getByText('您没有访问该页面的权限')).toBeInTheDocument()
  })

  it('返回首页按钮 replace 导航到 /dashboard', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={[ROUTE_PATHS.FORBIDDEN]}>
        <PathProbe />
        <Routes>
          <Route path={ROUTE_PATHS.FORBIDDEN} element={<Forbidden />} />
          <Route path={ROUTE_PATHS.DASHBOARD} element={<div>dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: '返回首页' }))
    expect(currentPath).toBe(ROUTE_PATHS.DASHBOARD)
  })
})
