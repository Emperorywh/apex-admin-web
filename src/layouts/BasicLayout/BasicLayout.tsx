/**
 * 基础布局（规格 §11.1/§11.2）：受保护根路由内唯一挂载的布局外壳。
 * - 侧边布局（Logo + 可折叠垂直菜单 + 顶栏 + 页签占位 + 页面缓存区）与
 *   顶部布局（Logo + 水平菜单 + 二级以下下拉子菜单 + 用户区）消费同一注入导航树，
 *   经 settings.layout 无刷新热切换：五个区域的 DOM 结构在两种布局下保持不变，
 *   仅由 grid-area 重排，页面缓存区与页签占位不重挂载；
 * - 内容区通栏不定宽（不支持定宽开关）；
 * - 视口 <768px（LAYOUT_MOBILE_MEDIA_QUERY）：侧边菜单改 Drawer、顶部布局折叠为
 *   菜单按钮（同一 Drawer 承载垂直菜单），Header 次要操作由 Header 自身收入更多菜单；
 * - 页面渲染（规格 §4.1/§9.1）：内容区经 PageCacheHost 的 Activity 缓存体系渲染所有
 *   缓存页签（CachedRouteView 以页签快照调用 useRoutes(renderRoutes, snapshot)），
 *   页签同步依据 Data Router 当前 location 完成；禁止缓存 <Outlet/> 或 useOutlet() 结果。
 */
import { Drawer } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useMatches, useNavigate, type RouteObject } from 'react-router'
import { LayoutGrid, Menu as MenuIcon, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { LAYOUT_MOBILE_MEDIA_QUERY } from '@/constants/app.constants'
import { appI18n, COMMON_NAMESPACE, MENU_NAMESPACE, setDocumentTitle } from '@/i18n/i18n'
import { readNavMatchMeta, type NavTreeNode } from '@/layouts/BasicLayout/navModel'
import { deriveNavSelection } from '@/layouts/BasicLayout/navTree'
import { PAGE_CONTAINER_ID, type AffixTabRoute } from '@/layouts/BasicLayout/tabsModel'
import { Header, type HeaderTrigger } from '@/layouts/BasicLayout/components/Header/Header'
import { PageCacheHost } from '@/layouts/BasicLayout/components/PageCacheHost/PageCacheHost'
import { SettingDrawer } from '@/layouts/BasicLayout/components/SettingDrawer/SettingDrawer'
import { SideMenu } from '@/layouts/BasicLayout/components/SideMenu/SideMenu'
import { TabsBar } from '@/layouts/BasicLayout/components/TabsBar/TabsBar'
import { TopMenu } from '@/layouts/BasicLayout/components/TopMenu/TopMenu'
import { sidebarCollapsedSet } from '@/store/slices/app.slice'
import { SETTINGS_LAYOUTS } from '@/store/slices/settings.slice'
import type { RootState } from '@/store/store'
import styles from './BasicLayout.module.css'

/** 窄视口导航 Drawer 宽度，单位 px（规格 §11.1：<768px 侧边菜单改 Drawer） */
const NAV_DRAWER_WIDTH = 280

/**
 * media query 匹配订阅：初始读取一次当前值，随后监听变化；
 * matchMedia 不可用的环境按不匹配处理（与全局测试桩口径一致）。
 */
function useMediaMatches(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined
    }
    const mediaQueryList = window.matchMedia(query)
    const sync = (): void => {
      setMatches(mediaQueryList.matches)
    }
    sync()
    mediaQueryList.addEventListener('change', sync)
    return () => {
      mediaQueryList.removeEventListener('change', sync)
    }
  }, [query])
  return matches
}

export interface BasicLayoutProps {
  /** 已过滤导航树：router 层经 filterMenuRoutes（权限/hideInMenu/目录保留）注入的 menuRoutes 投影 */
  navItems: readonly NavTreeNode[]
  /** 纯渲染投影（renderRoutes）：内容区经 PageCacheHost 以页签快照渲染页面（规格 §4.1/§9.1） */
  renderRoutes: RouteObject[]
  /** affix 页签投影（默认仅 Dashboard）：浏览器刷新后的页签重建来源（规格 §9.3） */
  affixTabRoutes: readonly AffixTabRoute[]
  /** 退出登录回调：执行认证登出状态机，post-logout 导航意图由路由接线消费 */
  onLogout: () => Promise<void>
}

export function BasicLayout({ navItems, renderRoutes, affixTabRoutes, onLogout }: BasicLayoutProps) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const matches = useMatches()
  const layout = useSelector((state: RootState) => state.settings.layout)
  const sidebarCollapsed = useSelector((state: RootState) => state.app.sidebarCollapsed)
  const isMobile = useMediaMatches(LAYOUT_MOBILE_MEDIA_QUERY)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [navDrawerOpen, setNavDrawerOpen] = useState(false)
  // 页面主容器：页面切换后焦点进入该容器（规格 §11.3），id 供页签 aria-controls 引用
  const pageContainerRef = useRef<HTMLElement | null>(null)

  // 选中项与祖先展开链由 Data Router 当前 match 派生（规格 §11.2）
  const selection = useMemo(() => deriveNavSelection(navItems, matches.map((match) => match.pathname)), [navItems, matches])

  // 文档标题跟随最深层带 meta 的 match（规格 §12：语言切换时按登记 key 重译）
  useEffect(() => {
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      const meta = readNavMatchMeta(matches[i].handle)
      if (meta !== undefined) {
        setDocumentTitle(appI18n, meta.title, MENU_NAMESPACE)
        return
      }
    }
  }, [matches])

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path)
    },
    [navigate],
  )

  const handleDrawerNavigate = useCallback(
    (path: string) => {
      setNavDrawerOpen(false)
      navigate(path)
    },
    [navigate],
  )

  // 左侧触发按钮：窄视口=打开导航 Drawer；侧边布局桌面=折叠/展开侧栏；顶部布局桌面无
  const trigger: HeaderTrigger | null = isMobile
    ? {
        icon: MenuIcon,
        label: t('打开导航菜单', { ns: COMMON_NAMESPACE }),
        onClick: () => setNavDrawerOpen(true),
      }
    : layout === SETTINGS_LAYOUTS.SIDE
      ? {
          icon: sidebarCollapsed ? PanelLeftOpen : PanelLeftClose,
          label: t('切换侧边栏', { ns: COMMON_NAMESPACE }),
          onClick: () => dispatch(sidebarCollapsedSet({ collapsed: !sidebarCollapsed })),
        }
      : null

  const showSideNav = layout === SETTINGS_LAYOUTS.SIDE && !isMobile
  const showTopNav = layout === SETTINGS_LAYOUTS.TOP && !isMobile
  const brandTitle = t('通用后台管理模板', { ns: COMMON_NAMESPACE })

  // 页面渲染（规格 §4.1/§9.1）：Data Router 只负责 URL/守卫，页面全部经 PageCacheHost
  // 的 Activity 缓存体系渲染（每个缓存页签独立路由上下文）；内容区随外壳持久存在、
  // 不因布局切换改变树位置

  return (
    <div
      className={styles.shell}
      data-layout-mode={layout}
      data-viewport={isMobile ? 'mobile' : 'desktop'}
      data-layout-shell
    >
      <div className={styles.brand} data-collapsed={showSideNav && sidebarCollapsed}>
        <LayoutGrid size={20} aria-hidden />
        <span className={styles.brandTitle}>{brandTitle}</span>
      </div>
      {showSideNav && (
        <nav className={styles.sideNav} data-collapsed={sidebarCollapsed} aria-label={t('导航菜单', { ns: COMMON_NAMESPACE })}>
          <SideMenu
            items={navItems}
            selectedKey={selection.selectedKey}
            ancestorOpenKeys={selection.openKeys}
            onNavigate={handleNavigate}
            collapsed={sidebarCollapsed}
          />
        </nav>
      )}
      {showTopNav && (
        <nav className={styles.topNav} aria-label={t('导航菜单', { ns: COMMON_NAMESPACE })}>
          <TopMenu items={navItems} selectedKey={selection.selectedKey} onNavigate={handleNavigate} />
        </nav>
      )}
      <div className={styles.mainBar}>
        <Header
          trigger={trigger}
          navItems={navItems}
          onLogout={onLogout}
          onOpenSettings={() => setSettingsOpen(true)}
          isMobile={isMobile}
        />
      </div>
      <div className={styles.tabsRegion}>
        <TabsBar pageContainerRef={pageContainerRef} />
      </div>
      <main ref={pageContainerRef} id={PAGE_CONTAINER_ID} tabIndex={-1} className={styles.content}>
        <PageCacheHost renderRoutes={renderRoutes} affixTabRoutes={affixTabRoutes} />
      </main>
      {/* 窄视口导航抽屉（规格 §11.1）：侧边与顶部布局共用，承载同一垂直菜单 */}
      <Drawer
        placement="left"
        width={NAV_DRAWER_WIDTH}
        open={navDrawerOpen}
        onClose={() => setNavDrawerOpen(false)}
        title={brandTitle}
      >
        <SideMenu
          items={navItems}
          selectedKey={selection.selectedKey}
          ancestorOpenKeys={selection.openKeys}
          onNavigate={handleDrawerNavigate}
        />
      </Drawer>
      <SettingDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
