/**
 * 底部 Dock 菜单：macOS 风格玻璃坞，只承载菜单树顶层分区入口（不再平铺全部叶子页）。
 *
 * - 含子级的分区：悬停/点击在 Dock 上方弹出玻璃菜单面板，孙级分组沿面板侧边逐级飞出
 * - 叶子分区（如调度监控）：点击直接导航；当前所在分区整组高亮
 * - 打开页面（叶子分区或面板项）时所属分区图标做 macOS 启动弹跳，动画结束自动复位
 * - 面板为纯文本原生 macOS 菜单样式；Escape、点击外部、地址变化均收起；悬停移到叶子分区/废纸篓时收起悬停展开的面板
 * - 尾部「废纸篓」承载关闭全部页签并释放缓存
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { App } from 'antd'
import { ChevronRight, Trash2 } from 'lucide-react'
import { buildMenuRoutes } from '@/router/projections'
import type { MenuNode } from '@/router/projections'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { IconTile } from '@/layouts/BasicLayout/components/IconTile/IconTile'
import { routeIconTone } from '@/layouts/BasicLayout/components/IconTile/iconTones'
import { allTabsClosed } from '@/store/slices/tabsSlice'
import styles from '@/layouts/BasicLayout/components/DockMenu/DockMenu.module.css'

/** 弹出面板宽度（px）；与 .panel 宽度一致，用于视口边缘收拢 */
const PANEL_WIDTH = 232
/** 面板与触发元素的最大高度（px）；与 .panel max-height 一致，用于纵向收拢 */
const PANEL_MAX_HEIGHT = 360
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
 * 依据锚点与层级计算面板固定定位：顶层悬于 Dock 项上方（缩放原点在面板底边，向触发项生长）；
 * 子级顶部对齐触发项（macOS 子菜单贴附锚点），缩放原点取贴附侧边；
 * panelHeight 为面板实际高度，仅在底部放不下时按需整体上移——短面板不再被最大高度预留推向远处
 */
function computePanelStyle(anchor: PanelAnchor, depth: number, panelHeight = PANEL_MAX_HEIGHT): CSSProperties {
  const viewWidth = window.innerWidth
  const viewHeight = window.innerHeight
  if (depth === 0) {
    return {
      left: clamp(anchor.centerX - PANEL_WIDTH / 2, VIEWPORT_PADDING, viewWidth - VIEWPORT_PADDING - PANEL_WIDTH),
      bottom: viewHeight - anchor.top + PANEL_GAP,
      transformOrigin: '50% 100%',
    }
  }
  const besideRight = anchor.right + FLYOUT_GAP
  const flipLeft = besideRight + PANEL_WIDTH > viewWidth - VIEWPORT_PADDING
  const left = flipLeft
    ? Math.max(VIEWPORT_PADDING, anchor.left - FLYOUT_GAP - PANEL_WIDTH)
    : besideRight
  const maxTop = Math.max(VIEWPORT_PADDING, viewHeight - VIEWPORT_PADDING - panelHeight)
  return {
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
          const Icon = section.icon
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
              aria-expanded={trail[0]?.node.routeId === section.routeId}
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
              {Icon ? (
                <IconTile tone={routeIconTone(section.routeId)} size={24} radius={5}>
                  <Icon size={15} strokeWidth={2} />
                </IconTile>
              ) : null}
              <span className={styles.label}>{tMenu(section.title)}</span>
            </button>
          )
        })}
        <span className={styles.separator} aria-hidden="true" />
        <button
          type="button"
          className={styles.item}
          title={tCommon('关闭全部页签并清空缓存')}
          onMouseEnter={dismissHoverPanel}
          onClick={clearTabs}
        >
          <Trash2 size={18} strokeWidth={2} />
        </button>
      </nav>
      {trail.map((entry, depth) => (
        <DockMenuPanel
          key={entry.node.routeId}
          items={entry.node.children}
          anchor={entry.anchor}
          depth={depth}
          openChildId={trail[depth + 1]?.node.routeId ?? null}
          activePathname={location.pathname}
          onHoverGroup={(node, element) => expandNested(node, element, depth + 1)}
          onOpenGroup={(node, element) => expandNested(node, element, depth + 1)}
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
  items: readonly MenuNode[]
  anchor: PanelAnchor
  depth: number
  openChildId: string | null
  activePathname: string
  onHoverGroup: (node: MenuNode, element: HTMLButtonElement) => void
  onOpenGroup: (node: MenuNode, element: HTMLButtonElement) => void
  onNavigate: (node: MenuNode) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

/** 玻璃菜单面板：原生 macOS 菜单样式的纯文本项；分组项悬停向侧边展开下一级 */
function DockMenuPanel({
  items,
  anchor,
  depth,
  openChildId,
  activePathname,
  onHoverGroup,
  onOpenGroup,
  onNavigate,
  onMouseEnter,
  onMouseLeave,
}: DockMenuPanelProps) {
  const { t } = useTranslation('menu')
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
      role="menu"
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {items.map((item) => {
        const active = subtreeContains(item, activePathname)
        const className = active ? `${styles.panelItem} ${styles.panelItemActive}` : styles.panelItem
        if (item.children.length > 0) {
          return (
            <button
              key={item.routeId}
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={openChildId === item.routeId}
              className={className}
              onMouseEnter={(event) => onHoverGroup(item, event.currentTarget)}
              onClick={(event) => onOpenGroup(item, event.currentTarget)}
            >
              <span className={styles.panelLabel}>{t(item.title)}</span>
              <ChevronRight size={14} strokeWidth={2} className={styles.panelChevron} aria-hidden="true" />
            </button>
          )
        }
        return (
          <button
            key={item.routeId}
            type="button"
            role="menuitem"
            className={className}
            onClick={() => onNavigate(item)}
          >
            <span className={styles.panelLabel}>{t(item.title)}</span>
          </button>
        )
      })}
    </div>
  )
}
