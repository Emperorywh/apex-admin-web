/**
 * CachedRouteView 测试（规格 §4.1 投影 2/§9.1、§20 闸门 ① 同型最小验证）：
 * 以页签快照驱动 useRoutes，各缓存实例的 useLocation/useSearchParams 互不串值，
 * 外层 Data Router 导航不影响缓存实例内部上下文。
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate, useSearchParams, type RouteObject } from 'react-router'
import { describe, expect, it } from 'vitest'
import { CachedRouteView } from '@/layouts/BasicLayout/components/CachedRouteView/CachedRouteView'
import type { TabLocationSnapshot } from '@/store/slices/tabs.slice'

function snapshot(pathname: string, search: string): TabLocationSnapshot {
  return { pathname, search, hash: '', key: `${pathname}${search}`, state: null }
}

/** 探针：显示自身路由上下文读取的 pathname/search */
function Probe() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  return (
    <div data-testid="probe">{`${location.pathname}|${location.search}|id=${searchParams.get('id') ?? ''}`}</div>
  )
}

/** 外层导航探针：模拟 Data Router 当前地址变化 */
function OuterNav() {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate('/outer')}>
      go-outer
    </button>
  )
}

const routes: RouteObject[] = [
  { path: '/list', element: <Probe /> },
  { path: '/other', element: <Probe /> },
]

describe('CachedRouteView（规格 §4.1/§9.1）', () => {
  it('以各自快照渲染：同路由不同 query 的两个实例读取各自的 search', () => {
    render(
      <MemoryRouter initialEntries={['/host']}>
        <CachedRouteView routes={routes} snapshot={snapshot('/list', '?id=1')} />
        <CachedRouteView routes={routes} snapshot={snapshot('/list', '?id=2')} />
      </MemoryRouter>,
    )
    expect(screen.getAllByTestId('probe').map((node) => node.textContent)).toEqual([
      '/list|?id=1|id=1',
      '/list|?id=2|id=2',
    ])
  })

  it('外层 Data Router 导航不改变缓存实例内部上下文', async () => {
    const { userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/host']}>
        <OuterNav />
        <CachedRouteView routes={routes} snapshot={snapshot('/list', '?id=1')} />
      </MemoryRouter>,
    )
    await user.click(screen.getByText('go-outer'))
    expect(screen.getByTestId('probe')).toHaveTextContent('/list|?id=1|id=1')
  })
})
