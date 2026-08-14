/**
 * §20 技术闸门 ①：独立路由上下文。
 *
 * 验证 CachedRouteView + useRoutes(renderRoutes, locationArg) 方案（§4.1 投影 2）：
 * - 两个同路由不同 query 的缓存页签同时挂载时，各自的 useLocation /
 *   useSearchParams / useParams 读到各自 location 快照的值，互不串值；
 * - 外层 Data Router（此处用 MemoryRouter 模拟）导航不改变缓存页签内部上下文；
 * - 单个页签更新快照只影响自身实例，不产生第二个缓存实例。
 *
 * 本文件是 §20 允许的验证性 PoC：最小路由定义与页签快照全部内联，
 * 不引用 src/ 内任何实现；业务页面由后续任务实现。
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  MemoryRouter,
  useLocation,
  useNavigate,
  useParams,
  useRoutes,
  useSearchParams,
} from 'react-router'
import type { RouteObject } from 'react-router'

/** 页签 location 快照（§4.5：只保存可序列化的 pathname/search/hash/key，state 固定 null） */
interface LocationSnapshot {
  pathname: string
  search: string
  hash: string
  key: string
  state: null
}

/** 各缓存实例通过自身路由上下文读到的观测值，按探针标签登记 */
interface RouteObservation {
  pathname: string
  search: string
  searchParams: string
  id: string | undefined
}

const observations = new Map<string, RouteObservation>()

function ListProbe() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'none'
  observations.set(`list:${tab}`, {
    pathname: location.pathname,
    search: location.search,
    searchParams: searchParams.toString(),
    id: undefined,
  })
  return <div data-testid={`list-${tab}`}>{`tab=${tab} search=${location.search}`}</div>
}

function DetailProbe() {
  const location = useLocation()
  const params = useParams()
  const [searchParams] = useSearchParams()
  observations.set(`detail:${params.id}`, {
    pathname: location.pathname,
    search: location.search,
    searchParams: searchParams.toString(),
    id: params.id,
  })
  return (
    <div data-testid={`detail-${params.id ?? 'none'}`}>
      {`id=${params.id ?? ''} from=${searchParams.get('from') ?? ''}`}
    </div>
  )
}

/** 内联最小纯渲染路由投影：不含 loader/action，只含页面锚点组件 */
const renderRoutes: RouteObject[] = [
  { path: '/list', element: <ListProbe /> },
  { path: '/detail/:id', element: <DetailProbe /> },
  { path: '/other', element: <div data-testid="other" /> },
]

/** CachedRouteView 的最小内联实现：以页签快照驱动 useRoutes（§4.1 投影 2 用法） */
function CachedRouteView({ snapshot }: { snapshot: LocationSnapshot }) {
  return useRoutes(renderRoutes, snapshot)
}

/** 外层路由探针：观察 Data Router 当前 location 并提供导航入口 */
function OuterNavProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <div>
      <span data-testid="outer-path">{location.pathname}</span>
      <button type="button" onClick={() => navigate('/other')}>
        go-other
      </button>
    </div>
  )
}

/** 双页签缓存宿主：两个 CachedRouteView 同时挂载，hidden 只影响可见性不影响挂载 */
function TabbedCacheHarness({
  activeKey,
  snapshots,
}: {
  activeKey: string
  snapshots: Record<string, LocationSnapshot>
}) {
  return (
    <div>
      <OuterNavProbe />
      {Object.keys(snapshots).map((key) => (
        <section key={key} data-testid={`host-${key}`} hidden={key !== activeKey}>
          <CachedRouteView snapshot={snapshots[key]} />
        </section>
      ))}
    </div>
  )
}

function renderHarness(snapshots: Record<string, LocationSnapshot>, activeKey: string) {
  return render(
    <MemoryRouter initialEntries={['/host']}>
      <TabbedCacheHarness snapshots={snapshots} activeKey={activeKey} />
    </MemoryRouter>,
  )
}

describe('§20 闸门 ①：独立路由上下文', () => {
  it('两个同路由不同 query 的缓存页签各自读取自己的 location 与 search params', () => {
    renderHarness(
      {
        a: { pathname: '/list', search: '?tab=a', hash: '', key: 'list-a', state: null },
        b: { pathname: '/list', search: '?tab=b', hash: '', key: 'list-b', state: null },
      },
      'a',
    )

    // 两个实例同时挂载，各自渲染自己快照的 query
    expect(screen.getByTestId('list-a')).toHaveTextContent('tab=a search=?tab=a')
    expect(screen.getByTestId('list-b')).toHaveTextContent('tab=b search=?tab=b')
    expect(screen.getAllByTestId(/^list-/)).toHaveLength(2)

    // useLocation / useSearchParams 读到的都是各自快照，互不串值
    expect(observations.get('list:a')).toMatchObject({
      pathname: '/list',
      search: '?tab=a',
      searchParams: 'tab=a',
    })
    expect(observations.get('list:b')).toMatchObject({
      pathname: '/list',
      search: '?tab=b',
      searchParams: 'tab=b',
    })
  })

  it('带路径参数的双页签各自读取自己的 useParams，互不串值', () => {
    renderHarness(
      {
        u1: { pathname: '/detail/u1', search: '?from=list', hash: '', key: 'detail-u1', state: null },
        u2: { pathname: '/detail/u2', search: '?from=detail', hash: '', key: 'detail-u2', state: null },
      },
      'u1',
    )

    expect(screen.getByTestId('detail-u1')).toHaveTextContent('id=u1 from=list')
    expect(screen.getByTestId('detail-u2')).toHaveTextContent('id=u2 from=detail')
    expect(observations.get('detail:u1')).toMatchObject({ id: 'u1', search: '?from=list' })
    expect(observations.get('detail:u2')).toMatchObject({ id: 'u2', search: '?from=detail' })
  })

  it('外层 Data Router 导航后，缓存页签内部上下文保持各自快照不受影响', () => {
    renderHarness(
      { a: { pathname: '/list', search: '?tab=a', hash: '', key: 'list-a', state: null } },
      'a',
    )

    fireEvent.click(screen.getByText('go-other'))
    expect(screen.getByTestId('outer-path')).toHaveTextContent('/other')

    // 缓存页签仍然渲染快照内容，useLocation 未被外层导航串改
    expect(screen.getByTestId('list-a')).toHaveTextContent('tab=a search=?tab=a')
    expect(observations.get('list:a')).toMatchObject({ pathname: '/list', search: '?tab=a' })
    // 纯渲染路由不响应外层导航：/other 锚点未被激活
    expect(screen.queryByTestId('other')).toBeNull()
    expect(screen.getByTestId('host-a')).toBeTruthy()
  })

  it('单个页签更新快照只更新自身实例，不产生第二个缓存实例', () => {
    const { rerender } = renderHarness(
      {
        a: { pathname: '/list', search: '?tab=a', hash: '', key: 'list-a', state: null },
        b: { pathname: '/list', search: '?tab=b', hash: '', key: 'list-b', state: null },
      },
      'a',
    )

    rerender(
      <MemoryRouter initialEntries={['/host']}>
        <TabbedCacheHarness
          activeKey="a"
          snapshots={{
            a: { pathname: '/list', search: '?tab=a', hash: '', key: 'list-a', state: null },
            b: { pathname: '/list', search: '?tab=b2&x=1', hash: '', key: 'list-b2', state: null },
          }}
        />
      </MemoryRouter>,
    )

    // 页签 b 复用同一实例更新为新快照，旧的 b 视图消失，实例总数不变
    expect(screen.getByTestId('list-b2')).toHaveTextContent('tab=b2 search=?tab=b2&x=1')
    expect(screen.queryByTestId('list-b')).toBeNull()
    expect(screen.getAllByTestId(/^list-/)).toHaveLength(2)
    // 页签 a 的上下文不受 b 快照更新影响
    expect(observations.get('list:a')).toMatchObject({ search: '?tab=a' })
    expect(observations.get('list:b2')).toMatchObject({ searchParams: 'tab=b2&x=1' })
  })
})
