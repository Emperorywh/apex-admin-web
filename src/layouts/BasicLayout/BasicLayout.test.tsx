/**
 * BasicLayout 集成测试（规格 §11.1/§11.2/§11.3）：
 * 以桩 store（componentTestHelpers）+ 桩路由上下文（createMemoryRouter + 合成
 * handle.meta 树 + 纯渲染探针投影）渲染挂载 BasicLayout，覆盖：
 * - 双布局消费同一 navItems 无刷新热切换、外壳/页面缓存区/页签占位不重挂载；
 * - 选中项与祖先展开链由 Data Router 当前 match 决定、菜单点击导航；
 * - 面包屑读 handle.meta、无页面组件目录不可点击、breadcrumb:false 不出现；
 * - <768px（matchMedia stub）侧边菜单 Drawer 化、顶部布局折叠为菜单按钮、
 *   Header 次要操作收入更多菜单；
 * - Header 全功能回调（折叠、主题、语言、用户菜单、设置入口）与 TabsBar 占位。
 * 菜单权限/hideInMenu/目录保留过滤的判定测试位于 router/projections.test.tsx
 * （filterMenuRoutes 与守卫共用 hasPermissionChain），此处验证布局消费注入结果。
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter, useLocation, type RouteObject } from 'react-router'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BasicLayout } from '@/layouts/BasicLayout/BasicLayout'
import type { NavTreeNode } from '@/layouts/BasicLayout/navModel'
import { appI18n } from '@/i18n/i18n'
import { profileLoaded } from '@/store/slices/user.slice'
import { SETTINGS_LAYOUTS, settingsChanged } from '@/store/slices/settings.slice'
import type { User } from '@/types/system/user/user.types'
import { createComponentTestStore, renderWithProviders, type ComponentTestStore } from '@/test/componentTestHelpers'

// 全屏 API 不可用时的降级提示走反馈桥；测试环境未挂载 FeedbackBridge，桩掉以保持输出干净
vi.mock('@/services/feedback/uiFeedback', () => ({
  showUiWarning: vi.fn(),
}))

/** 测试用户：用户菜单展示与个人中心入口用 */
const TEST_USER: User = {
  id: 'u1',
  username: 'tester',
  displayName: '测试用户',
  email: 'tester@example.com',
  status: 'enabled',
  roleIds: ['r1'],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

/** 合成导航树：目录节点无页面组件（hasPage=false），三级叶子验证任意层级 */
const NAV_ITEMS: NavTreeNode[] = [
  { id: 'dashboard', path: '/dashboard', title: '仪表盘', hasPage: true },
  {
    id: 'system',
    path: '/system',
    title: '系统管理',
    hasPage: false,
    children: [
      { id: 'system-user', path: '/system/user', title: '用户管理', hasPage: true },
      {
        id: 'system-role',
        path: '/system/role',
        title: '角色管理',
        hasPage: true,
        children: [{ id: 'system-role-detail', path: '/system/role/detail', title: '角色详情', hasPage: true }],
      },
    ],
  },
  { id: 'profile', path: '/profile', title: '个人中心', hasPage: true },
]

/** 页面探针：渲染于纯渲染投影，统计挂载次数并显示自身路由上下文的 pathname */
let probeMountCount = 0
function ProbePage() {
  const location = useLocation()
  useEffect(() => {
    probeMountCount += 1
  }, [])
  return <div data-probe-page>{location.pathname}</div>
}

/** 纯渲染投影：BasicLayout 内容区经 useRoutes 消费（规格 §4.1） */
const RENDER_ROUTES: RouteObject[] = [
  { path: '/dashboard', element: <ProbePage /> },
  {
    path: '/system',
    element: <Outlet />,
    children: [
      { path: 'user', element: <ProbePage /> },
      { path: 'role', element: <Outlet />, children: [{ path: 'detail', element: <ProbePage /> }] },
    ],
  },
  { path: '/profile', element: <ProbePage /> },
  { path: '/403', element: <ProbePage /> },
]

/** Data Router 侧路由：只提供 handle.meta 匹配链（与真实 accessRoutes 空锚点叶子同构），不渲染页面 */
function buildAccessRoutes(navItems: readonly NavTreeNode[], onLogout: () => Promise<void>): RouteObject[] {
  return [
    {
      path: '/',
      element: (
        <BasicLayout
          navItems={navItems}
          renderRoutes={RENDER_ROUTES}
          affixTabRoutes={[{ pathname: '/dashboard', title: '仪表盘' }]}
          onLogout={onLogout}
        />
      ),
      children: [
        { path: 'dashboard', handle: { meta: { title: '仪表盘' } } },
        {
          path: 'system',
          handle: { meta: { title: '系统管理' } },
          children: [
            { path: 'user', handle: { meta: { title: '用户管理' } } },
            {
              path: 'role',
              handle: { meta: { title: '角色管理' } },
              children: [{ path: 'detail', handle: { meta: { title: '角色详情' } } }],
            },
          ],
        },
        { path: 'profile', handle: { meta: { title: '个人中心' } } },
        { path: '403', handle: { meta: { title: '无权限访问', breadcrumb: false } } },
      ],
    },
  ]
}

/** 可控 matchMedia 桩：matches 可变并触发 change 监听（setup.ts 的全局桩固定不匹配） */
interface MatchMediaStub {
  setMatches(matches: boolean): void
}

const originalMatchMedia = window.matchMedia

function installMatchMediaStub(initialMatches: boolean): MatchMediaStub {
  let matches = initialMatches
  // antd responsiveObserver 等监听方按 MediaQueryListEvent 形参读取 matches，需带事件对象回调
  const listeners = new Set<{ media: string; listener: (event: { matches: boolean; media: string }) => void }>()
  window.matchMedia = ((query: string) => ({
    // getter 保证已创建的 MediaQueryList 实例随 setMatches 变化实时反映新值
    get matches() {
      return matches
    },
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: (_type: string, listener: (event: { matches: boolean; media: string }) => void) => {
      listeners.add({ media: query, listener })
    },
    removeEventListener: (_type: string, listener: (event: { matches: boolean; media: string }) => void) => {
      for (const entry of [...listeners]) {
        if (entry.listener === listener) {
          listeners.delete(entry)
        }
      }
    },
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  return {
    setMatches(next: boolean) {
      matches = next
      for (const { media, listener } of listeners) {
        listener({ matches, media })
      }
    },
  }
}

interface RenderLayoutOptions {
  initialPath?: string
  layout?: 'side' | 'top'
  navItems?: readonly NavTreeNode[]
  onLogout?: () => Promise<void>
}

interface RenderLayoutResult {
  store: ComponentTestStore
  router: ReturnType<typeof createMemoryRouter>
  container: HTMLElement
}

/** 渲染挂载 BasicLayout：桩 store（预置测试用户）+ memory router + 纯渲染探针 */
function renderLayout(options: RenderLayoutOptions = {}): RenderLayoutResult {
  const { initialPath = '/dashboard', layout = SETTINGS_LAYOUTS.SIDE, navItems = NAV_ITEMS } = options
  const onLogout = options.onLogout ?? vi.fn().mockResolvedValue(undefined)
  const store = createComponentTestStore()
  store.dispatch(profileLoaded({ user: TEST_USER, roles: [], permCodes: [], permissionVersion: 'v1' }))
  if (layout === SETTINGS_LAYOUTS.TOP) {
    store.dispatch(settingsChanged({ layout: SETTINGS_LAYOUTS.TOP }))
  }
  const router = createMemoryRouter(buildAccessRoutes(navItems, onLogout), { initialEntries: [initialPath] })
  const view = renderWithProviders(<RouterProvider router={router} />, { store })
  return { store, router, container: view.container }
}

/** 导航并等待完成（memory router 异步状态更新） */
async function navigateTo(router: RenderLayoutResult['router'], path: string): Promise<void> {
  await act(() => router.navigate(path))
}

/** 导航区域（面包屑与菜单会同时展示路由标题，文本断言一律收敛到区域内） */
function sideNavRegion(): HTMLElement {
  return screen.getByRole('navigation', { name: '导航菜单' })
}

/** 在 antd 弹层（Dropdown 菜单）中查找指定文案的菜单项 */
async function findDropdownItem(text: string): Promise<HTMLElement> {
  const candidates = await screen.findAllByText(text)
  const item = candidates.find((element) => element.closest('.ant-dropdown') !== null)
  expect(item).toBeDefined()
  return item as HTMLElement
}

beforeEach(() => {
  probeMountCount = 0
})

afterEach(async () => {
  window.matchMedia = originalMatchMedia
  document.title = ''
  // 语言切换用例会改动 appI18n 单例语言，恢复 zh-CN 避免污染同文件后续用例
  if (appI18n.language !== 'zh-CN') {
    await appI18n.changeLanguage('zh-CN')
  }
})

describe('BasicLayout 双布局热切换（规格 §11.1）', () => {
  it('侧边布局：Logo、垂直菜单、顶栏、页签占位与页面缓存区就位', () => {
    const { container } = renderLayout({ initialPath: '/dashboard' })
    const shell = container.querySelector('[data-layout-shell]')
    expect(shell).not.toBeNull()
    expect(shell?.getAttribute('data-layout-mode')).toBe('side')
    // 品牌区（Logo + 标题）
    expect(screen.getByText('通用后台管理模板')).toBeInTheDocument()
    // 垂直导航（SPEC_UI2 §6.1 自绘，role=menu）与导航区域
    expect(within(screen.getByRole('navigation', { name: '导航菜单' })).getByRole('menu')).not.toBeNull()
    expect(screen.getByRole('navigation', { name: '导航菜单' })).toBeInTheDocument()
    // 顶栏与页签占位、页面缓存区
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(container.querySelector('[data-region="tabs-bar"]')).not.toBeNull()
    // 菜单项与页面内容（面包屑同样显示当前页标题，文本断言收敛到菜单区域内）
    expect(within(sideNavRegion()).getByText('仪表盘')).toBeInTheDocument()
    expect(screen.getByText('/dashboard')).toBeInTheDocument()
  })

  it('两种布局消费同一导航树热切换：外壳/页面缓存区/页签占位保持同一 DOM 节点，页面不重挂载', () => {
    const { store, container } = renderLayout({ initialPath: '/system/user' })
    const shell = container.querySelector('[data-layout-shell]') as HTMLElement
    const content = container.querySelector('[data-probe-page]') as HTMLElement
    const tabsRegion = container.querySelector('[data-region="tabs-bar"]') as HTMLElement
    const pathnameBefore = content.textContent
    const mountsBefore = probeMountCount
    expect(mountsBefore).toBe(1)

    const sideNav = screen.getByRole('navigation', { name: '导航菜单' })
    for (const title of ['仪表盘', '系统管理', '个人中心']) {
      expect(within(sideNav).getByText(title)).toBeInTheDocument()
    }

    act(() => {
      store.dispatch(settingsChanged({ layout: SETTINGS_LAYOUTS.TOP }))
    })

    // 外壳同一 DOM 节点（未重挂载），仅布局模式属性切换
    expect(container.querySelector('[data-layout-shell]')).toBe(shell)
    expect(shell.getAttribute('data-layout-mode')).toBe('top')
    // 页面缓存区与页签占位保持同一节点、页面探针未重挂载
    expect(container.querySelector('[data-probe-page]')).toBe(content)
    expect(content.textContent).toBe(pathnameBefore)
    expect(probeMountCount).toBe(mountsBefore)
    expect(container.querySelector('[data-region="tabs-bar"]')).toBe(tabsRegion)
    // 顶部布局：横向自绘 menubar 渲染且顶级菜单项集合与侧边布局一致（同一 navItems）
    expect(within(screen.getByRole('navigation', { name: '导航菜单' })).getByRole('menubar')).not.toBeNull()
    expect(container.querySelector('[role="menu"]')).toBeNull()
    const topNav = screen.getByRole('navigation', { name: '导航菜单' })
    for (const title of ['仪表盘', '系统管理', '个人中心']) {
      expect(within(topNav).getByText(title)).toBeInTheDocument()
    }
  })

  it('顶部布局二级以下呈现下拉子菜单：目录节点为 aria-haspopup 触发项，hover 弹出自绘浮层（规格 §11.1/SPEC_UI2 §6.1）', async () => {
    renderLayout({ initialPath: '/dashboard', layout: 'top' })
    const topNav = screen.getByRole('navigation', { name: '导航菜单' })
    const submenuTrigger = within(topNav).getByRole('menuitem', { name: /系统管理/ })
    expect(submenuTrigger).toHaveAttribute('aria-haspopup', 'true')
    // hover 弹出下拉浮层，呈现二级项
    fireEvent.mouseEnter(submenuTrigger)
    const popup = await screen.findByRole('menu', { name: '系统管理' })
    expect(within(popup).getByText('用户管理')).toBeInTheDocument()
    fireEvent.mouseLeave(submenuTrigger)
  })
})

describe('菜单选中链与导航（规格 §11.2）', () => {
  it('选中项与祖先展开链由 Data Router 当前 match 决定：深层叶子选中且全部祖先展开', async () => {
    const { router } = renderLayout({ initialPath: '/dashboard' })
    await navigateTo(router, '/system/role/detail')
    // 三级叶子选中：aria-current 标记当前项（规格 §11.3），祖先目录自动展开使子项可见
    const selected = await within(sideNavRegion()).findByText('角色详情')
    // aria-current 标记在自绘菜单项行上（SPEC_UI2 §6.1）
    expect(selected.closest('[role="menuitem"]')).toHaveAttribute('aria-current', 'page')
    await within(sideNavRegion()).findByText('用户管理')
    await within(sideNavRegion()).findByText('角色管理')
  })

  it('点击菜单叶子导航到对应路由（内容区经纯渲染投影呈现新地址）', async () => {
    const user = userEvent.setup()
    renderLayout({ initialPath: '/dashboard' })
    await user.click(screen.getByText('系统管理'))
    await user.click(await screen.findByText('用户管理'))
    await waitFor(() => {
      expect(screen.getByText('/system/user')).toBeInTheDocument()
    })
  })

  it('布局只消费注入的已过滤导航树：注入结果不含某节点时菜单不渲染该节点', () => {
    renderLayout({ initialPath: '/dashboard', navItems: [NAV_ITEMS[0]] })
    expect(within(sideNavRegion()).getByText('仪表盘')).toBeInTheDocument()
    expect(screen.queryByText('系统管理')).not.toBeInTheDocument()
  })
})

describe('面包屑（规格 §11.2：useMatches 读 handle.meta）', () => {
  it('层级与 handle.meta 一致：无页面组件目录不可点击，中间可点击层级为链接且可导航，末位当前页不可点击', async () => {
    const user = userEvent.setup()
    const { container, router } = renderLayout({ initialPath: '/dashboard' })
    await navigateTo(router, '/system/role/detail')
    const breadcrumb = await waitFor(() => {
      const element = container.querySelector('.ant-breadcrumb')
      expect(element).not.toBeNull()
      return element as HTMLElement
    })
    // 层级标题与 handle.meta 一致
    expect(within(breadcrumb).getByText('系统管理')).toBeInTheDocument()
    expect(within(breadcrumb).getByText('角色管理')).toBeInTheDocument()
    expect(within(breadcrumb).getByText('角色详情')).toBeInTheDocument()
    // 无页面组件的目录（hasPage=false）与末位当前页是纯文本（规格 §11.2）
    expect(within(breadcrumb).getByText('系统管理').closest('a')).toBeNull()
    expect(within(breadcrumb).getByText('角色详情').closest('a')).toBeNull()
    // 中间挂载页面的层级是链接，点击完成 SPA 导航
    expect(within(breadcrumb).getByText('角色管理').closest('a')).not.toBeNull()
    await user.click(within(breadcrumb).getByText('角色管理'))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/system/role')
    })
  })

  it('meta.breadcrumb:false 的层级不进入面包屑（错误页无面包屑）', async () => {
    const { container, router } = renderLayout({ initialPath: '/dashboard' })
    await navigateTo(router, '/403')
    await waitFor(() => {
      expect(screen.getByText('/403')).toBeInTheDocument()
    })
    expect(container.querySelector('.ant-breadcrumb')).toBeNull()
  })

  it('settings.breadcrumbEnabled 关闭时顶栏不渲染面包屑', () => {
    const { store, container } = renderLayout({ initialPath: '/system/user' })
    expect(container.querySelector('.ant-breadcrumb')).not.toBeNull()
    act(() => {
      store.dispatch(settingsChanged({ breadcrumbEnabled: false }))
    })
    expect(container.querySelector('.ant-breadcrumb')).toBeNull()
  })
})

describe('响应式断点 <768px（规格 §11.1，matchMedia stub）', () => {
  it('侧边布局：菜单收进 Drawer，触发按钮打开后可导航并自动关闭', async () => {
    const user = userEvent.setup()
    installMatchMediaStub(true)
    const { container } = renderLayout({ initialPath: '/dashboard' })
    // 侧边菜单不再内嵌渲染（收进 Drawer；面包屑仍显示当前页标题，不属于菜单）
    expect(screen.queryByRole('navigation', { name: '导航菜单' })).not.toBeInTheDocument()
    expect(container.querySelector('.ant-menu')).toBeNull()
    await user.click(screen.getByRole('button', { name: '打开导航菜单' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('仪表盘')).toBeInTheDocument()
    // 目录默认收起：先展开系统管理再点击叶子（同一展开链逻辑在抽屉内复用）
    await user.click(within(dialog).getByText('系统管理'))
    await user.click(await within(dialog).findByText('用户管理'))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText('/system/user')).toBeInTheDocument()
    })
  })

  it('顶部布局折叠为菜单按钮：水平菜单不渲染，按钮打开同一 Drawer 菜单', async () => {
    const user = userEvent.setup()
    installMatchMediaStub(true)
    const { container } = renderLayout({ initialPath: '/dashboard', layout: 'top' })
    expect(container.querySelector('.ant-menu-horizontal')).toBeNull()
    await user.click(screen.getByRole('button', { name: '打开导航菜单' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('系统管理')).toBeInTheDocument()
  })

  it('Header 次要操作收入更多菜单：全屏/语言/主题独立按钮消失，更多菜单内可触发设置变更', async () => {
    const user = userEvent.setup()
    installMatchMediaStub(true)
    const { store } = renderLayout({ initialPath: '/dashboard' })
    expect(screen.queryByRole('button', { name: '全屏' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '切换语言' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '切换主题' })).not.toBeInTheDocument()
    // 用户菜单与设置入口保持直达
    expect(screen.getByRole('button', { name: '用户菜单' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开界面设置' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '更多' }))
    await user.click(await findDropdownItem('深色'))
    await waitFor(() => {
      expect(store.getState().settings.themeMode).toBe('dark')
    })
  })

  it('桌面视口次要操作独立呈现；断点跨越即时切换形态', async () => {
    const stub = installMatchMediaStub(false)
    renderLayout({ initialPath: '/dashboard' })
    expect(screen.getByRole('button', { name: '全屏' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '切换语言' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '切换主题' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '更多' })).not.toBeInTheDocument()
    act(() => {
      stub.setMatches(true)
    })
    expect(screen.queryByRole('button', { name: '全屏' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '更多' })).toBeInTheDocument()
  })
})

describe('Header 全功能与回调（规格 §11.2）', () => {
  it('侧边布局桌面触发按钮折叠侧栏：写入 app.sidebarCollapsed 并驱动导航 mini 态', async () => {
    const user = userEvent.setup()
    const { store, container } = renderLayout({ initialPath: '/dashboard' })
    await user.click(screen.getByRole('button', { name: '切换侧边栏' }))
    await waitFor(() => {
      expect(store.getState().app.sidebarCollapsed).toBe(true)
    })
    // 自绘导航 mini 态（SPEC_UI2 §6.1）：侧栏 88px 标记 + 悬浮折叠球切换为展开语义
    await waitFor(() => {
      const nav = container.querySelector('nav[data-collapsed="true"]')
      expect(nav).not.toBeNull()
      expect(screen.getByRole('button', { name: '展开侧边栏' })).toBeInTheDocument()
    })
  })

  it('顶部布局桌面不渲染折叠按钮', () => {
    renderLayout({ initialPath: '/dashboard', layout: 'top' })
    expect(screen.queryByRole('button', { name: '切换侧边栏' })).not.toBeInTheDocument()
  })

  it('主题快捷切换实时写入 settings.themeMode', async () => {
    const user = userEvent.setup()
    const { store } = renderLayout({ initialPath: '/dashboard' })
    await user.click(screen.getByRole('button', { name: '切换主题' }))
    await user.click(await findDropdownItem('深色'))
    await waitFor(() => {
      expect(store.getState().settings.themeMode).toBe('dark')
    })
  })

  it('语言切换经资源预加载后写入 settings.language', async () => {
    const user = userEvent.setup()
    const { store } = renderLayout({ initialPath: '/dashboard' })
    await user.click(screen.getByRole('button', { name: '切换语言' }))
    await user.click(await findDropdownItem('English'))
    await waitFor(() => {
      expect(store.getState().settings.language).toBe('en-US')
    })
  })

  it('用户菜单：展示用户名，个人中心入口导航 /profile，退出登录触发注入回调', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn().mockResolvedValue(undefined)
    renderLayout({ initialPath: '/dashboard', onLogout })

    const userMenuButton = screen.getByRole('button', { name: '用户菜单' })
    expect(userMenuButton).toHaveTextContent('测试用户')
    await user.click(userMenuButton)
    // 下拉项与导航菜单同名，收敛到弹层内查找
    await user.click(await findDropdownItem('个人中心'))
    await waitFor(() => {
      expect(screen.getByText('/profile')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: '用户菜单' }))
    await user.click(await findDropdownItem('退出登录'))
    await waitFor(() => {
      expect(onLogout).toHaveBeenCalledTimes(1)
    })
  })

  it('设置入口打开界面设置抽屉，可经关闭按钮收起', async () => {
    const user = userEvent.setup()
    renderLayout({ initialPath: '/dashboard' })
    await user.click(screen.getByRole('button', { name: '打开界面设置' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('界面设置')).toBeInTheDocument()
    // 抽屉关闭按钮键盘可达（jsdom 中 Esc 事件链由 antd/rc-dialog 承接，此处驱动同一 onClose）；
    // 关闭后面板对可访问性树隐藏（文本仍可能留存于隐藏 DOM，以 dialog 角色判定）
    const closeButton = dialog.querySelector('.ant-drawer-close') as HTMLElement
    expect(closeButton).not.toBeNull()
    await user.click(closeButton)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})

describe('TabsBar 挂载点（规格 §11.1：随外壳持久存在）', () => {
  it('页签区域随外壳渲染（含 affix 仪表盘页签）且布局热切换保持同一挂载节点', () => {
    const { store, container } = renderLayout({ initialPath: '/dashboard' })
    const tabsBar = container.querySelector('[data-region="tabs-bar"]') as HTMLElement
    expect(tabsBar).not.toBeNull()
    // 浏览器刷新重建（规格 §9.3）：当前即 Dashboard 时只有 affix 一个页签
    const tablist = within(tabsBar).getByRole('tablist', { name: '页签' })
    expect(within(tablist).getAllByRole('tab')).toHaveLength(1)
    expect(within(tablist).getByRole('tab', { selected: true })).toHaveTextContent('仪表盘')
    act(() => {
      store.dispatch(settingsChanged({ layout: SETTINGS_LAYOUTS.TOP }))
    })
    expect(container.querySelector('[data-region="tabs-bar"]')).toBe(tabsBar)
  })
})

describe('文档标题跟随路由（规格 §12）', () => {
  it('最深层带 meta 的 match 标题写入 document.title', async () => {
    const { router } = renderLayout({ initialPath: '/dashboard' })
    await navigateTo(router, '/system/user')
    await waitFor(() => {
      expect(document.title).toBe('用户管理')
    })
  })
})
