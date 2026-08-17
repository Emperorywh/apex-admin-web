/**
 * 自绘垂直导航（SPEC_UI2 §6.1，取代 SPEC_UI §5.1 antd Menu 方案）：
 * - 选中态：整行 6px 圆角 + 主色浅底（colorPrimaryBg 派生）+ 主色文字/图标，
 *   无左侧指示条；hover 为中性浅底；过渡 200–300ms 纯 CSS；
 * - 行高 44px、标题 14px/500、一级 caption 12px 灰色副标题（SPEC_UI2 §6.1）；
 * - mini 折叠态（88px）：图标在上 12px 标题在下纵向排列；有子菜单的项
 *   hover/聚焦弹出右侧浮层卡片（自绘浮层，圆角 12 + 浮层阴影阶梯），
 *   无子菜单项保持 tooltip；
 * - 选中项与祖先展开链由 Data Router 当前 match 派生（selectedKey/ancestorOpenKeys
 *   注入，现有 openKeys 派生逻辑移植）；用户手动展开与祖先链并集共存；
 * - 可访问性红线（SPEC_UI2 §6.1）：role="menu"/"menuitem"、aria-expanded/aria-current、
 *   方向键/Enter/Esc 键盘语义经 navKeyboard 纯函数（同目录单测）、焦点可见。
 */
import { Tooltip } from 'antd'
import { ChevronRight } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { AppIcon } from '@/components/AppIcon/AppIcon'
import {
  NAV_ICON_SIZE_PX,
  NAV_ICON_SIZE_SUB_PX,
  NAV_MINI_TITLE_FONT_SIZE_PX,
} from '@/constants/app.constants'
import { MENU_NAMESPACE } from '@/i18n/i18n'
import { mergeOpenKeys } from '@/layouts/BasicLayout/navTree'
import {
  findNavEntry,
  flattenNavTree,
  isNavKeyWithin,
  resolveNavKeyAction,
  visibleNavEntries,
} from '@/layouts/BasicLayout/navKeyboard'
import type { NavTreeNode } from '@/layouts/BasicLayout/navModel'
import styles from './SideNav.module.css'

/** mini 浮层与触发球的悬浮关闭缓冲，单位 ms：允许指针从触发区滑入浮层 */
const MINI_HOVER_CLOSE_DELAY_MS = 150

/** mini 浮层距触发项的偏移，单位 px */
const MINI_POPUP_OFFSET_PX = 4

export interface SideNavProps {
  /** 已过滤导航树（router 注入 menuRoutes 投影） */
  items: readonly NavTreeNode[]
  /** 当前选中项 key（节点路径）；不在导航树内的路由（如错误页）无选中 */
  selectedKey?: string
  /** 选中项祖先展开链：随路由变化并入展开状态（规格 §11.2） */
  ancestorOpenKeys: readonly string[]
  /** 叶子菜单项导航回调：以节点完整路径跳转 */
  onNavigate: (path: string) => void
  /** mini 折叠态（桌面侧栏折叠：88px 图标 + 标题纵排） */
  collapsed?: boolean
}

/** mini 浮层定位：以触发项视口坐标落定（fixed 定位） */
interface MiniPopupAnchor {
  key: string
  top: number
  left: number
}

/** 行间共享的导航上下文：避免递归行组件逐层透传 props */
interface NavRowContext {
  selectedKey?: string
  collapsed: boolean
  openKeys: readonly string[]
  miniPopupKey: string | null
  registerNode: (key: string, node: HTMLElement | null) => void
  onRowKeyDown: (event: ReactKeyboardEvent<HTMLElement>, key: string) => void
  onToggle: (key: string, open: boolean) => void
  onNavigate: (path: string) => void
  onMiniEnter: (key: string, element: HTMLElement) => void
  onMiniLeave: () => void
}

const NavRowContext = createContext<NavRowContext | null>(null)

/** 单行导航节点：叶子或目录（含子树递归渲染） */
function NavRow({ node, level }: { node: NavTreeNode; level: number }) {
  const ctx = useContext(NavRowContext)
  const { t } = useTranslation()
  if (ctx === null) {
    return null
  }
  const hasChildren = node.children !== undefined && node.children.length > 0
  const isOpen = ctx.openKeys.includes(node.path ?? '')
  const isSelected = ctx.selectedKey === node.path
  const isMini = ctx.collapsed && level === 0
  const title = t(node.title, { ns: MENU_NAMESPACE })
  const caption = level === 0 && node.caption !== undefined ? t(node.caption, { ns: MENU_NAMESPACE }) : undefined

  const row = (
    <button
      type="button"
      ref={(element) => ctx.registerNode(node.path ?? node.id, element)}
      className={styles.row}
      data-level={level}
      data-selected={isSelected}
      data-open={hasChildren ? isOpen : undefined}
      data-mini={isMini}
      role="menuitem"
      aria-current={isSelected ? 'page' : undefined}
      aria-expanded={hasChildren ? ctx.collapsed ? ctx.miniPopupKey === node.path : isOpen : undefined}
      aria-haspopup={hasChildren ? 'menu' : undefined}
      onClick={() => {
        if (hasChildren) {
          ctx.onToggle(node.path ?? node.id, !isOpen)
          return
        }
        if (node.path !== undefined) {
          ctx.onNavigate(node.path)
        }
      }}
      onKeyDown={(event) => {
        if (node.path !== undefined) {
          ctx.onRowKeyDown(event, node.path)
        }
      }}
      onMouseEnter={
        isMini && hasChildren && node.path !== undefined
          ? (event) => ctx.onMiniEnter(node.path!, event.currentTarget)
          : undefined
      }
      onMouseLeave={isMini && hasChildren ? () => ctx.onMiniLeave() : undefined}
    >
      {node.icon !== undefined && (
        <AppIcon
          name={node.icon}
          size={level === 0 ? NAV_ICON_SIZE_PX : NAV_ICON_SIZE_SUB_PX}
          className={styles.rowIcon}
          color={isSelected ? 'var(--ant-color-primary)' : undefined}
        />
      )}
      <span
        className={isMini ? styles.miniText : styles.rowText}
        style={isMini ? { fontSize: NAV_MINI_TITLE_FONT_SIZE_PX } : undefined}
      >
        {isMini ? null : (
          <>
            <span className={styles.rowTitle}>{title}</span>
            {caption !== undefined && <span className={styles.rowCaption}>{caption}</span>}
          </>
        )}
        {isMini && title}
      </span>
      {hasChildren && !isMini && (
        <ChevronRight size={14} aria-hidden className={styles.chevron} data-open={isOpen} />
      )}
    </button>
  )

  // mini 折叠态：叶子包 tooltip，目录子树进浮层（由 SideNav 统一渲染）
  if (isMini) {
    if (hasChildren) {
      return row
    }
    return (
      <Tooltip title={title} placement="right">
        {row}
      </Tooltip>
    )
  }

  if (!hasChildren) {
    return row
  }

  return (
    <div className={styles.branch} data-open={isOpen}>
      {row}
      <div className={styles.submenu} role="menu" aria-label={title}>
        {node.children!.map((child) => (
          <NavRow key={child.path ?? child.id} node={child} level={level + 1} />
        ))}
      </div>
    </div>
  )
}

export function SideNav({ items, selectedKey, ancestorOpenKeys, onNavigate, collapsed = false }: SideNavProps) {
  const { t } = useTranslation()
  // 展开状态：初始与路由变化时并入祖先链；用户开合自由增删（与旧 SideMenu 同口径）
  const [openKeys, setOpenKeys] = useState<string[]>(() => [...ancestorOpenKeys])
  useEffect(() => {
    setOpenKeys((current) => mergeOpenKeys(current, ancestorOpenKeys))
  }, [ancestorOpenKeys])

  const [miniPopup, setMiniPopup] = useState<MiniPopupAnchor | null>(null)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const nodeRefs = useRef(new Map<string, HTMLElement>())
  const hoverCloseTimer = useRef<number | null>(null)

  const registerNode = useCallback((key: string, node: HTMLElement | null) => {
    if (node === null) {
      nodeRefs.current.delete(key)
    } else {
      nodeRefs.current.set(key, node)
    }
  }, [])

  // 展开模式下收起 mini 浮层状态
  useEffect(() => {
    if (!collapsed) {
      setMiniPopup(null)
    }
  }, [collapsed])

  // 焦点落定：键盘动作产生的 focusKey 变化驱动 DOM focus
  useEffect(() => {
    if (focusKey !== null) {
      nodeRefs.current.get(focusKey)?.focus()
    }
  }, [focusKey])

  const entries = useMemo(() => flattenNavTree(items), [items])
  // mini 折叠态：浮层打开等价于把浮层根并入展开集合，键盘焦点可自然跨入浮层条目
  const visible = useMemo(
    () => visibleNavEntries(entries, collapsed ? [...openKeys, ...(miniPopup !== null ? [miniPopup.key] : [])] : openKeys),
    [entries, openKeys, collapsed, miniPopup],
  )

  const handleToggle = useCallback((key: string, open: boolean) => {
    setOpenKeys((current) => (open ? mergeOpenKeys(current, [key]) : current.filter((item) => item !== key)))
  }, [])

  const openMiniPopup = useCallback((key: string, element: HTMLElement) => {
    if (hoverCloseTimer.current !== null) {
      window.clearTimeout(hoverCloseTimer.current)
      hoverCloseTimer.current = null
    }
    const rect = element.getBoundingClientRect()
    setMiniPopup({
      key,
      top: Math.max(rect.top - MINI_POPUP_OFFSET_PX, MINI_POPUP_OFFSET_PX),
      left: rect.right + MINI_POPUP_OFFSET_PX,
    })
  }, [])

  const scheduleCloseMiniPopup = useCallback(() => {
    if (hoverCloseTimer.current !== null) {
      window.clearTimeout(hoverCloseTimer.current)
    }
    hoverCloseTimer.current = window.setTimeout(() => {
      setMiniPopup(null)
      hoverCloseTimer.current = null
    }, MINI_HOVER_CLOSE_DELAY_MS)
  }, [])

  useEffect(
    () => () => {
      if (hoverCloseTimer.current !== null) {
        window.clearTimeout(hoverCloseTimer.current)
      }
    },
    [],
  )

  const closeMiniPopup = useCallback((refocusKey?: string) => {
    setMiniPopup(null)
    if (refocusKey !== undefined) {
      setFocusKey(refocusKey)
    }
  }, [])

  const navigateFromNav = useCallback(
    (path: string) => {
      setMiniPopup(null)
      onNavigate(path)
    },
    [onNavigate],
  )

  /** 键盘语义（navKeyboard 纯函数，SPEC_UI2 §6.1）：mini 折叠态的展开动作转译为浮层 */
  const handleRowKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>, key: string) => {
      const entry = findNavEntry(entries, key)
      if (entry === undefined) {
        return
      }
      const action = resolveNavKeyAction({ key: event.key, entry, entries, visible, openKeys })
      switch (action.type) {
        case 'focus':
          event.preventDefault()
          setFocusKey(action.key)
          return
        case 'expand':
          event.preventDefault()
          if (collapsed) {
            const node = nodeRefs.current.get(action.key)
            if (node !== undefined) {
              openMiniPopup(action.key, node)
              const firstChild = visible.find((item) => item.parentKey === action.key)
              if (firstChild !== undefined) {
                setFocusKey(firstChild.key)
              }
            }
            return
          }
          handleToggle(action.key, true)
          return
        case 'collapse':
          event.preventDefault()
          if (collapsed) {
            closeMiniPopup(action.key)
            return
          }
          handleToggle(action.key, false)
          setFocusKey(action.focusKey)
          return
        case 'navigate':
          event.preventDefault()
          navigateFromNav(action.path)
          return
        case 'escape':
          if (miniPopup !== null && isNavKeyWithin(entries, entry.key, miniPopup.key)) {
            event.preventDefault()
            closeMiniPopup(miniPopup.key)
            return
          }
          if (collapsed) {
            event.preventDefault()
            setMiniPopup(null)
          }
          return
        default:
          return
      }
    },
    [entries, visible, openKeys, collapsed, handleToggle, miniPopup, openMiniPopup, closeMiniPopup, navigateFromNav],
  )

  const ctx = useMemo<NavRowContext>(
    () => ({
      selectedKey,
      collapsed,
      openKeys,
      miniPopupKey: miniPopup?.key ?? null,
      registerNode,
      onRowKeyDown: handleRowKeyDown,
      onToggle: handleToggle,
      onNavigate: navigateFromNav,
      onMiniEnter: openMiniPopup,
      onMiniLeave: scheduleCloseMiniPopup,
    }),
    [
      selectedKey,
      collapsed,
      openKeys,
      miniPopup,
      registerNode,
      handleRowKeyDown,
      handleToggle,
      navigateFromNav,
      openMiniPopup,
      scheduleCloseMiniPopup,
    ],
  )

  const miniPopupNode = useMemo(() => {
    if (miniPopup === null) {
      return null
    }
    const group = items.find((item) => item.path === miniPopup.key)
    if (group === undefined || group.children === undefined) {
      return null
    }
    return (
      <div
        className={styles.miniPopup}
        style={{ top: `${miniPopup.top}px`, left: `${miniPopup.left}px` }}
        role="menu"
        aria-label={t(group.title, { ns: MENU_NAMESPACE })}
        onMouseEnter={() => {
          if (hoverCloseTimer.current !== null) {
            window.clearTimeout(hoverCloseTimer.current)
            hoverCloseTimer.current = null
          }
        }}
        onMouseLeave={scheduleCloseMiniPopup}
      >
        {group.children.map((child) => (
          <NavRow key={child.path ?? child.id} node={child} level={1} />
        ))}
      </div>
    )
  }, [miniPopup, items, t, scheduleCloseMiniPopup])

  return (
    <div className={styles.nav} data-collapsed={collapsed}>
      <div
        className={styles.menu}
        role="menu"
        aria-label={t('导航菜单', { ns: MENU_NAMESPACE })}
        style={collapsed ? undefined : { minWidth: 0 }}
        data-testid="side-nav-menu"
      >
        <NavRowContext.Provider value={ctx}>
          {items.map((item) => (
            <NavRow key={item.path ?? item.id} node={item} level={0} />
          ))}
        </NavRowContext.Provider>
      </div>
      {miniPopupNode}
    </div>
  )
}
