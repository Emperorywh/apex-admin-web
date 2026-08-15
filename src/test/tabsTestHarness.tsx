/**
 * 页签系统组件级测试共享 harness（规格 §9/§16.3，PoC harness 风格）：
 * 临时测试路由（access 侧只带 handle.meta 的空叶子、纯渲染侧为探针页）+ 桩 store，
 * 挂载完整「TabsBar + PageCacheHost」组合，供 PageCacheHost/TabsBar 同目录测试复用。
 * 不引用业务页面实现；真实路由与页面随后续任务增量接入。
 * 测试工具不参与 Fast Refresh，组件与工具函数同文件导出属预期。
 */
// oxlint-disable react/only-export-components
import { useEffect, useRef, useState } from 'react'
import { act } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation, useSearchParams, type RouteObject } from 'react-router'
import { usePageActive } from '@/hooks/usePageActive'
import { PageCacheHost } from '@/layouts/BasicLayout/components/PageCacheHost/PageCacheHost'
import { TabsBar } from '@/layouts/BasicLayout/components/TabsBar/TabsBar'
import { PAGE_CONTAINER_ID, type AffixTabRoute } from '@/layouts/BasicLayout/tabsModel'
import {
  createComponentTestStore,
  renderWithProviders,
  type ComponentTestStore,
} from '@/test/componentTestHelpers'

/** access 侧临时路由规格：path + meta（与真实路由 handle 投影同构） */
export interface HarnessRouteSpec {
  path: string
  meta: Record<string, unknown>
}

/** 渲染崩溃探针路径：页面级错误边界用（规格 §17.19） */
export const HARNESS_CRASH_PATH = '/boom'

/** LRU 压力路径：/p1../p11（PAGE_CACHE_MAX_ENTRIES + 1 个普通缓存页） */
export const HARNESS_LRU_PATHS: string[] = Array.from({ length: 11 }, (_, index) => `/p${index + 1}`)

/** 默认临时路由：affix Dashboard + 常规/查询/noCache/hideInTabs/pathname 键/崩溃/LRU 压力页 */
export const DEFAULT_HARNESS_SPECS: HarnessRouteSpec[] = [
  { path: '/dashboard', meta: { title: '仪表盘', affixTab: true } },
  { path: '/list', meta: { title: '列表页' } },
  { path: '/nocache', meta: { title: '不缓存页', noCache: true } },
  { path: '/hidden', meta: { title: '隐藏页', hideInTabs: true, noCache: true } },
  { path: '/pathname', meta: { title: '路径键页', tabKeyMode: 'pathname' } },
  { path: HARNESS_CRASH_PATH, meta: { title: '崩溃页' } },
  ...HARNESS_LRU_PATHS.map((path, index) => ({ path, meta: { title: `第 ${index + 1} 页` } })),
]

/** 默认 affix 页签注入（与真实 Dashboard 投影同构） */
export const DEFAULT_AFFIX_TABS: AffixTabRoute[] = [{ pathname: '/dashboard', title: '仪表盘' }]

/** 探针页观测记录：以「路径 + search」为 id 登记（同路由不同 query 各自独立） */
export interface PageObservation {
  mounts: number
  /** 激活态轨迹：挂载与每次翻转各追加一次当前值 */
  activeLog: boolean[]
}

const observations = new Map<string, PageObservation>()

export function resetPageObservations(): void {
  observations.clear()
}

export function pageObservation(id: string): PageObservation {
  let observation = observations.get(id)
  if (observation === undefined) {
    observation = { mounts: 0, activeLog: [] }
    observations.set(id, observation)
  }
  return observation
}

/** 探针页：展示自身路由上下文（pathname+search）、激活态、受控输入与独立滚动容器 */
export function HarnessProbePage({ pathKey }: { pathKey: string }) {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isActive = usePageActive()
  const [text, setText] = useState('')
  // 观测 id 含 search：同路由不同 query 的实例各自登记（§17.9）
  const observationId = `${pathKey}${location.search}`

  // 真实挂载计数：lazy 初始化每次真实挂载执行一次；Activity 隐藏/显示只清理并重建
  // Effect、不重跑初始化，因此该计数可区分「保活」与「卸载后重挂」（§9.1）
  useState(() => {
    pageObservation(observationId).mounts += 1
  })

  const observation = pageObservation(observationId)
  useEffect(() => {
    observation.activeLog.push(isActive)
  }, [observation, isActive])

  if (pathKey === HARNESS_CRASH_PATH) {
    throw new Error('探针渲染崩溃')
  }

  return (
    <div data-page={observationId}>
      <span data-probe-path>{`${location.pathname}${location.search}`}</span>
      <span data-probe-active={isActive ? 'active' : 'hidden'} />
      <input
        aria-label={`输入框-${observationId}`}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
        }}
      />
      <div data-probe-scroll style={{ height: 100, overflowY: 'auto' }}>
        <div style={{ height: 500 }} />
      </div>
      <span data-probe-query>{searchParams.toString()}</span>
    </div>
  )
}

/** harness 布局外壳：TabsBar + 主容器 + PageCacheHost（与 BasicLayout 装配同构的最小组合） */
function HarnessShell({ renderRoutes, affixTabRoutes }: { renderRoutes: RouteObject[]; affixTabRoutes: readonly AffixTabRoute[] }) {
  const mainRef = useRef<HTMLElement | null>(null)
  return (
    <div>
      <TabsBar pageContainerRef={mainRef} />
      <main ref={mainRef} id={PAGE_CONTAINER_ID} tabIndex={-1} data-harness-main style={{ height: 480 }}>
        <PageCacheHost renderRoutes={renderRoutes} affixTabRoutes={affixTabRoutes} />
      </main>
    </div>
  )
}

export interface TabsHarnessResult {
  store: ComponentTestStore
  router: ReturnType<typeof createMemoryRouter>
  container: HTMLElement
  navigate(to: string): Promise<void>
}

export interface TabsHarnessOptions {
  initialPath?: string
  specs?: readonly HarnessRouteSpec[]
}

/** 渲染完整页签系统 harness：桩 store + memory router + 临时测试路由 */
export function renderTabsHarness(options: TabsHarnessOptions = {}): TabsHarnessResult {
  const specs = options.specs ?? DEFAULT_HARNESS_SPECS
  const store = createComponentTestStore()
  const children = specs.map((spec) => ({
    path: spec.path.replace(/^\//, ''),
    handle: { meta: spec.meta },
  }))
  const renderRoutes: RouteObject[] = specs.map((spec) => ({
    path: spec.path.replace(/^\//, ''),
    element: <HarnessProbePage pathKey={spec.path} />,
  }))
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <HarnessShell renderRoutes={renderRoutes} affixTabRoutes={DEFAULT_AFFIX_TABS} />,
        children,
      },
    ],
    { initialEntries: [options.initialPath ?? '/dashboard'] },
  )
  const view = renderWithProviders(<RouterProvider router={router} />, { store })
  return {
    store,
    router,
    container: view.container,
    navigate: async (to: string) => {
      await act(() => router.navigate(to))
    },
  }
}

/** 当前 DOM 中缓存实例（pagePane）集合，以 data-page-pane 值返回 */
export function renderedPaneKeys(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-page-pane]')].map((node) =>
    node.getAttribute('data-page-pane') ?? '',
  )
}

/** 按地址寻找探针页节点（data-page = 路径 + search） */
export function findProbe(container: HTMLElement, pathWithSearch: string): HTMLElement | null {
  return container.querySelector(`[data-page="${pathWithSearch}"]`)
}
