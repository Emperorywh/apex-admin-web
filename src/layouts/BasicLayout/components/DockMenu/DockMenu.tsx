/**
 * 底部 Dock 菜单：macOS 风格玻璃坞，只承载菜单树顶层分区入口（不再平铺全部叶子页）。
 *
 * - 含子级的分区：悬停/点击在 Dock 上方弹出磨砂玻璃面板，孙级分组沿面板侧边逐级飞出
 * - 叶子分区（如仪表盘）：点击直接导航；当前所在分区整组高亮
 * - 打开页面（叶子分区或面板项）时所属分区图标做 macOS 启动弹跳，动画结束自动复位
 * - 面板以分区标题、图标和数量呈现层次；Escape、点击外部、地址变化均收起
 * - 悬停移到叶子分区/废纸篓时收起悬停展开的面板
 * - 尾部「废纸篓」承载关闭全部页签并释放缓存
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { App } from 'antd'
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Folder, LayoutGrid, Trash2 } from 'lucide-react'
import { buildMenuRoutes } from '@/router/projections'
import type { MenuNode } from '@/router/projections'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { IconTile } from '@/layouts/BasicLayout/components/IconTile/IconTile'
import { routeIconTone } from '@/layouts/BasicLayout/components/IconTile/iconTones'
import { allTabsClosed } from '@/store/slices/tabsSlice'
import styles from '@/layouts/BasicLayout/components/DockMenu/DockMenu.module.css'

/**
 * 弹层采用更宽的图文布局，尺寸通过内联样式统一传递。
 * 实际宽高再受视口约束，避免窄屏或长菜单超出可用区域。
 */
const PANEL_WIDTH = 272
const PANEL_MAX_HEIGHT = 420
/** 面板与锚点间距（px） */
const PANEL_GAP = 10
/** 子面板与父面板的间距（px）：比主面板更贴合，接近 macOS 子菜单的贴附感 */
const FLYOUT_GAP = 6
/** 视口四周最小留白（px） */
const VIEWPORT_PADDING = 8
/** 悬停展开顶层分区的延迟（毫秒）：扫过 Dock 时不闪面板 */
const HOVER_OPEN_DELAY_MS = 120
/** 指针离开 Dock/面板后延迟收起（毫秒）：给跨面板移动留时间 */
const HOVER_CLOSE_DELAY_MS = 240

/** 面板锚点：触发元素的关键位置（视口坐标） */
interface PanelAnchor {
  left: number
  right: number
  top: number
  centerX: number
}

/** 展开路径记录：node 为该面板展示的分组，anchor 为触发它的元素位置 */
interface TrailEntry {
  node: MenuNode
  anchor: PanelAnchor
}

function anchorOf(element: HTMLElement): PanelAnchor {
  const rect = element.getBoundingClientRect()
  return {
    left: rect.left,
    right: rect.right,
    top: rect.top,
    centerX: rect.left + rect.width / 2,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/**
 * 两侧都放不下完整面板时采用叠层导航。
 * 此时仅响应点击展开，避免悬停生成的子面板覆盖原点击目标而误触页面。
 */
function hasFlyoutSpace(anchor: PanelAnchor): boolean {
  return anchor.right + FLYOUT_GAP + PANEL_WIDTH <= window.innerWidth - VIEWPORT_PADDING
    || anchor.left - FLYOUT_GAP - PANEL_WIDTH >= VIEWPORT_PADDING
}

/**
 * 依据锚点与层级计算面板固定定位：顶层悬于 Dock 项上方（缩放原点在面板底边，向触发项生长）；
 * 子级顶部对齐触发项（macOS 子菜单贴附锚点），缩放原点取贴附侧边；
 * panelHeight 为面板实际高度，仅在底部放不下时按需整体上移——短面板不再被最大高度预留推向远处
 */
function computePanelStyle(anchor: PanelAnchor, depth: number, panelHeight = PANEL_MAX_HEIGHT): CSSProperties {
  const viewWidth = window.innerWidth
  const viewHeight = window.innerHeight
  /* 同时约束主菜单和子菜单，短视口仍保留滚动空间。
     子菜单沿用实际测量高度，避免按最大高度产生不必要的跳位。 */
  const width = Math.min(PANEL_WIDTH, viewWidth - VIEWPORT_PADDING * 2)
  const maxHeight = Math.min(PANEL_MAX_HEIGHT, depth === 0
    ? anchor.top - PANEL_GAP - VIEWPORT_PADDING
    : viewHeight - VIEWPORT_PADDING * 2)
  if (depth === 0) {
    return {
      width,
      maxHeight,
      left: clamp(anchor.centerX - width / 2, VIEWPORT_PADDING, viewWidth - VIEWPORT_PADDING - width),
      bottom: viewHeight - anchor.top + PANEL_GAP,
      transformOrigin: '50% 100%',
    }
  }
  const besideRight = anchor.right + FLYOUT_GAP
  const flipLeft = besideRight + width > viewWidth - VIEWPORT_PADDING
  const left = flipLeft
    ? Math.max(VIEWPORT_PADDING, anchor.left - FLYOUT_GAP - width)
    : besideRight
  const maxTop = Math.max(VIEWPORT_PADDING, viewHeight - VIEWPORT_PADDING - panelHeight)
  return {
    width,
    maxHeight,
    left,
    top: clamp(anchor.top - 6, VIEWPORT_PADDING, maxTop),
    transformOrigin: flipLeft ? '100% 50%' : '0% 50%',
  }
}

/** 判断菜单子树是否包含当前地址（分区高亮用） */
function subtreeContains(node: MenuNode, pathname: string): boolean {
  if (pathname === node.path || pathname.startsWith(`${node.path}/`)) return true
  return node.children.some((child) => subtreeContains(child, pathname))
}

export function DockMenu() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { t: tCommon } = useTranslation('common')
  const { t: tMenu } = useTranslation('menu')
  const { message } = App.useApp()

  const sections = useMemo(() => buildMenuRoutes(), [])
  const [trail, setTrail] = useState<TrailEntry[]>([])
  /** 正在播放启动弹跳的分区（routeId）；动画结束由 onAnimationEnd 复位 */
  const [launchingId, setLaunchingId] = useState<string | null>(null)
  const openTimer = useRef<number | null>(null)
  const closeTimer = useRef<number | null>(null)
  /** 当前展开是否由悬停触发：悬停展开后同分区的点击应保持展开而非收起 */
  const hoverOpenedRef = useRef(false)

  /** 启动弹跳：导航的同时让所属分区图标弹跳（页面窗口浮出期间持续） */
  const bounce = useCallback((routeId: string) => {
    setLaunchingId(routeId)
  }, [])

  const clearTimers = useCallback(() => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current)
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    openTimer.current = null
    closeTimer.current = null
  }, [])

  const closeAll = useCallback(() => {
    clearTimers()
    hoverOpenedRef.current = false
    setTrail([])
  }, [clearTimers])

  /** 悬停展开的面板不驻留：指针移到无下级的目标（叶子分区/废纸篓）时立即收起 */
  const dismissHoverPanel = useCallback(() => {
    if (hoverOpenedRef.current) closeAll()
  }, [closeAll])

  /** 指针离开 Dock/面板：延迟收起，期间进入其它面板则取消 */
  const scheduleClose = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setTrail([]), HOVER_CLOSE_DELAY_MS)
  }, [])

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = null
  }, [])

  /* 地址变化即收起（含导航与页签激活跳转） */
  useEffect(() => {
    setTrail([])
  }, [location.key])

  /* Escape / 点击面板与 Dock 以外区域 / 视口尺寸变化时收起 */
  useEffect(() => {
    if (trail.length === 0) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAll()
    }
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target?.closest('[data-dock-menu]')) closeAll()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('resize', closeAll)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('resize', closeAll)
    }
  }, [trail.length, closeAll])

  useEffect(() => clearTimers, [clearTimers])

  const hoverSection = (node: MenuNode, element: HTMLElement) => {
    /* 叶子分区没有下级面板：悬停不展开，并收起此前悬停展开的面板 */
    if (node.children.length === 0) {
      dismissHoverPanel()
      return
    }
    if (openTimer.current !== null) window.clearTimeout(openTimer.current)
    if (trail[0]?.node.routeId === node.routeId) return
    openTimer.current = window.setTimeout(() => {
      hoverOpenedRef.current = true
      setTrail([{ node, anchor: anchorOf(element) }])
    }, HOVER_OPEN_DELAY_MS)
  }

  const clickSection = (node: MenuNode, element: HTMLElement) => {
    clearTimers()
    /* 叶子分区：点击直接导航，不弹面板 */
    if (node.children.length === 0) {
      bounce(node.routeId)
      navigate(node.path)
      return
    }
    setTrail((prev) => {
      const isOpen = prev[0]?.node.routeId === node.routeId
      // 悬停刚展开同一分区时，点击视为确认而非切换，避免「悬停展开、点击又收起」
      if (isOpen && hoverOpenedRef.current) {
        hoverOpenedRef.current = false
        return prev
      }
      hoverOpenedRef.current = false
      return isOpen ? [] : [{ node, anchor: anchorOf(element) }]
    })
  }

  /** 在 depth 面板中展开子分组（幂等：已展开则保持，仅收起更深层级） */
  const expandNested = (node: MenuNode, element: HTMLElement, depth: number) => {
    cancelClose()
    setTrail((prev) => {
      if (prev[depth]?.node.routeId === node.routeId) return prev
      return [...prev.slice(0, depth), { node, anchor: anchorOf(element) }]
    })
  }

  const clearTabs = () => {
    dispatch(allTabsClosed())
    void message.success(tCommon('已关闭全部页签，仅保留固定页'))
  }

  return (
    <>
      <nav
        className={styles.dock}
        data-dock-menu
        aria-label={tCommon('主导航')}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        onScroll={closeAll}
      >
        {sections.map((section) => {
          /* 每个分区始终显示上方图标和下方名称。
             未配置图标时使用统一兜底，保证底栏各项对齐。 */
          const Icon = section.icon ?? LayoutGrid
          const sectionActive = subtreeContains(section, location.pathname)
          const launching = launchingId === section.routeId
          return (
            <button
              key={section.routeId}
              type="button"
              className={
                (sectionActive ? `${styles.item} ${styles.itemActive}` : styles.item) +
                (launching ? ` ${styles.itemLaunching}` : '')
              }
              title={tMenu(section.title)}
              aria-current={sectionActive ? 'true' : undefined}
              aria-expanded={section.children.length > 0 ? trail[0]?.node.routeId === section.routeId : undefined}
              aria-haspopup={section.children.length > 0 ? 'menu' : undefined}
              onMouseEnter={(event) => hoverSection(section, event.currentTarget)}
              onMouseLeave={() => {
                if (openTimer.current !== null) window.clearTimeout(openTimer.current)
                openTimer.current = null
              }}
              onClick={(event) => clickSection(section, event.currentTarget)}
              onAnimationEnd={(event) => {
                /* 弹跳作用在首元素（图标瓷片）上；结束即复位，便于下次点击重新触发 */
                if (event.target === event.currentTarget.firstElementChild) {
                  setLaunchingId((prev) => (prev === section.routeId ? null : prev))
                }
              }}
            >
              {/* 缩小图标底座与内部字形，适配紧凑底栏。
                  保留下方名称，维持原有菜单识别方式。 */}
              <IconTile tone={routeIconTone(section.routeId)} size={28} radius={8}>
                <Icon size={17} strokeWidth={2} />
              </IconTile>
              <span className={styles.label}>{tMenu(section.title)}</span>
            </button>
          )
        })}
        <span className={styles.separator} aria-hidden="true" />
        <button
          type="button"
          className={`${styles.item} ${styles.trash}`}
          title={tCommon('关闭全部页签并清空缓存')}
          aria-label={tCommon('关闭全部页签并清空缓存')}
          onMouseEnter={dismissHoverPanel}
          onClick={clearTabs}
        >
          {/* 清理页签入口独立放在分隔线后。
              同步缩小线性图标，并保留完整无障碍名称。 */}
          <Trash2 size={26} strokeWidth={1.5} />
        </button>
      </nav>
      {trail.map((entry, depth) => (
        <DockMenuPanel
          key={entry.node.routeId}
          node={entry.node}
          anchor={entry.anchor}
          depth={depth}
          openChildId={trail[depth + 1]?.node.routeId ?? null}
          activePathname={location.pathname}
          onHoverGroup={(node, element) => {
            /* 窄屏保留明确的点击展开，桌面继续支持悬停穿行。
               依据实际锚点空间判断，兼容不同宽度的窗口。 */
            if (hasFlyoutSpace(anchorOf(element))) expandNested(node, element, depth + 1)
          }}
          onOpenGroup={(node, element) => expandNested(node, element, depth + 1)}
          onBack={() => setTrail((prev) => prev.slice(0, depth))}
          onHoverLeaf={() => {
            /* 切换到叶子项时移除之前的子分组。
               避免旧子面板遮挡当前选择，也用于滚动时清理失效锚点。 */
            setTrail((prev) => prev.length > depth + 1 ? prev.slice(0, depth + 1) : prev)
          }}
          onNavigate={(node) => {
            /* 先取面板所属分区：closeAll 清空 trail 后弹跳要落在 Dock 图标上 */
            const sectionId = trail[0]?.node.routeId ?? null
            closeAll()
            if (sectionId !== null) bounce(sectionId)
            navigate(node.path)
          }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      ))}
    </>
  )
}

interface DockMenuPanelProps {
  /**
   * 分组节点同时提供标题、图标与子项。
   * 展示信息直接来自路由树，避免维护重复的菜单元数据。
   */
  node: MenuNode
  anchor: PanelAnchor
  depth: number
  openChildId: string | null
  activePathname: string
  onHoverGroup: (node: MenuNode, element: HTMLButtonElement) => void
  onOpenGroup: (node: MenuNode, element: HTMLButtonElement) => void
  onHoverLeaf: () => void
  onBack: () => void
  onNavigate: (node: MenuNode) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

/**
 * 磨砂玻璃菜单：标题明确当前分组，图标辅助扫描，计数提示下级规模。
 * 叶子项与分组共用行布局，保持悬停、当前页和键盘焦点的反馈一致。
 */
function DockMenuPanel({
  node,
  anchor,
  depth,
  openChildId,
  activePathname,
  onHoverGroup,
  onOpenGroup,
  onHoverLeaf,
  onBack,
  onNavigate,
  onMouseEnter,
  onMouseLeave,
}: DockMenuPanelProps) {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const items = node.children
  const GroupIcon = node.icon ?? Folder
  const stacked = depth > 0 && !hasFlyoutSpace(anchor)
  const panelRef = useRef<HTMLDivElement>(null)
  /* 首帧按最大高度兜底定位，挂载后量取实际高度重算，使子面板贴附触发项而非按最大高度预留 */
  const [style, setStyle] = useState(() => computePanelStyle(anchor, depth))

  useLayoutEffect(() => {
    if (depth === 0) return
    const height = panelRef.current?.offsetHeight
    if (height === undefined) return
    setStyle(computePanelStyle(anchor, depth, height))
  }, [anchor, depth])

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      data-dock-menu
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* 标题与数量保持独立于滚动列表，长菜单中也能识别当前位置。
          数量只表示实际下级入口，不混入设备在线状态等业务信息。 */}
      <div className={styles.panelHeader}>
        {/* 窄屏叠层可能遮挡父菜单，提供可聚焦的返回入口。
            桌面侧向展开仍使用分组图标，保持紧凑布局。 */}
        {stacked ? (
          <button type="button" className={styles.panelBack} aria-label={tCommon('返回上级菜单')} onClick={onBack}>
            <ChevronLeft size={19} strokeWidth={1.8} />
          </button>
        ) : <IconTile tone={routeIconTone(node.routeId)} size={34} radius={10}>
          <GroupIcon size={19} strokeWidth={1.8} />
        </IconTile>}
        <div className={styles.panelHeading}>
          <span className={styles.panelEyebrow}>{tCommon(depth === 0 ? '快捷导航' : '子级菜单')}</span>
          <span className={styles.panelTitle}>{t(node.title)}</span>
        </div>
        <span className={styles.panelTotal} aria-label={tCommon('入口数量')}>{items.length.toString().padStart(2, '0')}</span>
      </div>
      <div className={styles.panelList} role="menu" aria-label={t(node.title)} onScroll={onHoverLeaf}>
      {items.map((item) => {
        const active = subtreeContains(item, activePathname)
        const hasChildren = item.children.length > 0
        const ItemIcon = item.icon ?? (hasChildren ? Folder : LayoutGrid)
        const className = active ? `${styles.panelItem} ${styles.panelItemActive}` : styles.panelItem
        /* 使用统一菜单行，避免有子级与无子级的图标、文本错位。
           当前页使用勾选标记，分组使用真实数量及展开箭头。 */
        return (
          <button
            key={item.routeId}
            type="button"
            role="menuitem"
            aria-haspopup={hasChildren ? 'menu' : undefined}
            aria-expanded={hasChildren ? openChildId === item.routeId : undefined}
            aria-current={active && !hasChildren ? 'page' : undefined}
            className={className}
            title={t(item.title)}
            onMouseEnter={(event) => hasChildren ? onHoverGroup(item, event.currentTarget) : onHoverLeaf()}
            onFocus={onMouseEnter}
            onClick={(event) => hasChildren ? onOpenGroup(item, event.currentTarget) : onNavigate(item)}
          >
            <span className={styles.panelIcon} aria-hidden="true"><ItemIcon size={18} strokeWidth={1.7} /></span>
            <span className={styles.panelLabel}>{t(item.title)}</span>
            {hasChildren ? (
              <>
                <span className={styles.panelCount} aria-hidden="true">{item.children.length}</span>
                <ChevronRight size={14} strokeWidth={2} className={styles.panelChevron} aria-hidden="true" />
              </>
            ) : active ? (
              <Check size={15} strokeWidth={2.2} aria-hidden="true" />
            ) : (
              <ArrowUpRight size={15} strokeWidth={1.8} className={styles.panelLink} aria-hidden="true" />
            )}
          </button>
        )
      })}
      </div>
    </div>
  )
}
