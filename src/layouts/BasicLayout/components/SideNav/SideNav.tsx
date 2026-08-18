/**
 * 自绘侧边导航（SPEC_UI2 §6.1，取代 antd Menu inline 与 SPEC_UI §5.1）：
 * - 选中态：整行圆角 6px + 主色浅底（colorPrimaryBg 派生）+ 主色文字/图标，无左侧指示条；
 *   hover 中性浅底；过渡 200–300ms 纯 CSS；
 * - 一级 24px 彩色图标（AppIcon local: 集合）+ 14px/500 标题 + 12px 灰色 caption；
 *   子级 20px 同风格，无彩色资产条目经 AppIcon 回退 lucide 线性图标（同尺寸）；
 * - mini 折叠态：88px 宽、图标在上 12px 标题在下纵向排列；目录项 hover/键盘弹出
 *   右侧浮层卡片（圆角 12 + --app-shadow-raised 阴影阶梯），叶子项保持 tooltip；
 * - 可访问性红线：role=menu/menuitem、aria-expanded/aria-current、方向键/Enter/Esc
 *   经 navKeys 纯函数解析、roving tabindex 焦点可见；选中/展开链仍由路由 match 派生
 *   （openKeys 并入 ancestorOpenKeys，与 SPEC_UI 前一致）。
 * 桌面侧边布局内嵌于侧栏；窄视口（<768px）同一组件承载于导航 Drawer（inDrawer）。
 */
import { Tooltip } from 'antd'
import { ChevronDown, ChevronsLeft, ChevronsRight } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { AppIcon } from '@/components/AppIcon/AppIcon'
import { COMMON_NAMESPACE, MENU_NAMESPACE } from '@/i18n/i18n'
import type { NavTreeNode } from '@/layouts/BasicLayout/navModel'
import { mergeOpenKeys } from '@/layouts/BasicLayout/navTree'
import {
  flattenVisibleNavItems,
  resolveVerticalNavKey,
  type NavFlatItem,
} from '@/layouts/BasicLayout/navKeys'
import styles from './SideNav.module.css'

export interface SideNavProps {
  /** 已过滤导航树（router 注入 menuRoutes 投影） */
  items: readonly NavTreeNode[]
  /** 当前选中项 key（节点路径）；不在导航树内的路由（如错误页）无选中 */
  selectedKey?: string
  /** 选中项祖先展开链：随路由变化并入展开状态（规格 §11.2） */
  ancestorOpenKeys: readonly string[]
  /** 叶子菜单项导航回调：以节点完整路径跳转 */
  onNavigate: (path: string) => void
  /** mini 折叠态（桌面侧栏 88px 纵向图标态） */
  collapsed?: boolean
  /** 折叠球回调：桌面侧栏右缘悬浮折叠/展开（SPEC_UI2 §6.1） */
  onToggleCollapse?: () => void
  /** 承载于窄视口导航 Drawer：强制展开态且不渲染折叠球（规格 §11.1） */
  inDrawer?: boolean
}

/** 悬浮子菜单浮层的屏幕锚点（mini 态由触发项 getBoundingClientRect 计算） */
interface PopupAnchor {
  key: string
  top: number
  left: number
}

export function SideNav({
  items,
  selectedKey,
  ancestorOpenKeys,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
  inDrawer = false,
}: SideNavProps) {
  const { t } = useTranslation()
  const translate = useCallback((key: string) => t(key, { ns: MENU_NAMESPACE }), [t])
  const mini = collapsed && !inDrawer

  // 展开状态：初始与路由变化时并入祖先链；用户开合自由增删（规格 §11.2）
  const [openKeys, setOpenKeys] = useState<string[]>(() => [...ancestorOpenKeys])
  useEffect(() => {
    setOpenKeys((current) => mergeOpenKeys(current, ancestorOpenKeys))
  }, [ancestorOpenKeys])

  // 可见项扁平化：键盘游走路径与 roving tabindex 的唯一依据
  const flatItems = useMemo(() => flattenVisibleNavItems(items, openKeys), [items, openKeys])
  const tabbableKey = useMemo(() => {
    if (selectedKey !== undefined && flatItems.some((item) => item.key === selectedKey)) {
      return selectedKey
    }
    return flatItems[0]?.key
  }, [flatItems, selectedKey])

  // 菜单项 DOM 注册表：键盘动作解析后据此迁移焦点
  const itemNodes = useRef(new Map<string, HTMLElement>())
  const registerItem = useCallback((key: string, node: HTMLElement | null) => {
    if (node === null) {
      itemNodes.current.delete(key)
    } else {
      itemNodes.current.set(key, node)
    }
  }, [])

  const toggleOpen = useCallback((key: string, open: boolean) => {
    setOpenKeys((current) => (open ? mergeOpenKeys(current, [key]) : current.filter((k) => k !== key)))
  }, [])

  // mini 态悬浮子菜单：锚点 + 浮层内键盘游走（浮层子树全量展开扁平化）
  const [popup, setPopup] = useState<PopupAnchor | null>(null)
  const popupNodes = useRef(new Map<string, HTMLElement>())
  const registerPopupItem = useCallback((key: string, node: HTMLElement | null) => {
    if (node === null) {
      popupNodes.current.delete(key)
    } else {
      popupNodes.current.set(key, node)
    }
  }, [])
  const popupNode = useMemo(
    () => (popup === null ? undefined : items.find((node) => node.path === popup.key)),
    [items, popup],
  )
  const popupFlatItems = useMemo(
    () => (popupNode?.children === undefined ? [] : flattenVisibleNavItems(popupNode.children, [], true)),
    [popupNode],
  )

  const openPopup = useCallback((key: string, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect()
    setPopup({ key, top: rect.top, left: rect.right + 4 })
  }, [])

  const closePopup = useCallback(() => setPopup(null), [])

  /** 展开态键盘操作：navKeys 纯函数解析 → 焦点/开合/导航分发（SPEC_UI2 §6.1 红线） */
  const handleItemKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, key: string) => {
      const action = resolveVerticalNavKey(flatItems, key, event.key)
      if (action === null) {
        return
      }
      event.preventDefault()
      if (action.type === 'focus') {
        itemNodes.current.get(action.key)?.focus()
        return
      }
      if (action.type === 'toggle-open') {
        toggleOpen(action.key, action.open)
        return
      }
      onNavigate(action.key)
    },
    [flatItems, onNavigate, toggleOpen],
  )

  /** mini 态一级项键盘：上下游走；Enter/→ 目录开浮层并聚焦首项，叶子导航 */
  const handleMiniKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, node: NavTreeNode) => {
      if (node.path === undefined) {
        return
      }
      const topFlat = flattenVisibleNavItems(items, [], false)
      const hasChildren = node.children !== undefined && node.children.length > 0
      if ((event.key === 'Enter' || event.key === ' ') && !hasChildren) {
        event.preventDefault()
        onNavigate(node.path)
        return
      }
      if ((event.key === 'Enter' || event.key === 'ArrowRight' || event.key === 'ArrowDown') && hasChildren) {
        event.preventDefault()
        openPopup(node.path, event.currentTarget)
        return
      }
      const action = resolveVerticalNavKey(topFlat, node.path, event.key)
      if (action?.type === 'focus') {
        event.preventDefault()
        itemNodes.current.get(action.key)?.focus()
      }
    },
    [items, onNavigate, openPopup],
  )

  /** 浮层内键盘：上下游走、Enter 导航并关浮层、Esc 关浮层回焦触发项 */
  const handlePopupKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, key: string) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        const triggerKey = popup?.key
        closePopup()
        if (triggerKey !== undefined) {
          itemNodes.current.get(triggerKey)?.focus()
        }
        return
      }
      const action = resolveVerticalNavKey(popupFlatItems, key, event.key)
      if (action === null) {
        return
      }
      event.preventDefault()
      if (action.type === 'focus') {
        popupNodes.current.get(action.key)?.focus()
        return
      }
      if (action.type === 'activate') {
        closePopup()
        onNavigate(action.key)
      }
    },
    [closePopup, onNavigate, popup, popupFlatItems],
  )

  const selectedAncestors = useMemo(() => new Set(ancestorOpenKeys), [ancestorOpenKeys])

  /** 展开态递归渲染（任意层级，主规格 §11.2 能力不变） */
  const renderExpandedNodes = (nodes: readonly NavTreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (node.path === undefined) {
        // 无 path 目录不可寻址：可见子级上提一级（与 navTree 口径一致）
        return node.children !== undefined && node.children.length > 0 ? renderExpandedNodes(node.children, depth) : null
      }
      const hasChildren = node.children !== undefined && node.children.length > 0
      const isOpen = openKeys.includes(node.path)
      const isSelected = node.path === selectedKey
      const onChain = selectedAncestors.has(node.path)
      return (
        <li key={node.id} role="none" className={styles.entry}>
          <div
            ref={(el) => registerItem(node.path!, el)}
            role="menuitem"
            tabIndex={node.path === tabbableKey ? 0 : -1}
            className={styles.item}
            data-depth={depth}
            data-selected={isSelected}
            data-on-chain={onChain && !isSelected}
            aria-current={isSelected ? 'page' : undefined}
            aria-haspopup={hasChildren || undefined}
            aria-expanded={hasChildren ? isOpen : undefined}
            style={{ paddingInlineStart: 12 + depth * 16 }}
            onClick={() => (hasChildren ? toggleOpen(node.path!, !isOpen) : onNavigate(node.path!))}
            onKeyDown={(event) => handleItemKeyDown(event, node.path!)}
          >
            {node.icon !== undefined && (
              <span className={styles.itemIcon} aria-hidden>
                <AppIcon name={node.icon} size={depth === 0 ? 24 : 20} />
              </span>
            )}
            <span className={styles.itemText}>
              <span className={styles.itemTitle}>{translate(node.title)}</span>
              {node.caption !== undefined && depth === 0 && (
                <span className={styles.itemCaption}>{translate(node.caption)}</span>
              )}
            </span>
            {hasChildren && (
              <ChevronDown size={14} aria-hidden className={styles.itemArrow} data-open={isOpen} />
            )}
          </div>
          {hasChildren && isOpen && node.children !== undefined && (
            <ul role="menu" className={styles.submenu}>
              {renderExpandedNodes(node.children, depth + 1)}
            </ul>
          )}
        </li>
      )
    })

  /** mini 态一级项：图标在上、12px 标题在下；目录 hover/聚焦弹浮层，叶子 tooltip */
  const renderMiniNode = (node: NavTreeNode) => {
    if (node.path === undefined) {
      return null
    }
    const hasChildren = node.children !== undefined && node.children.length > 0
    const isSelected = node.path === selectedKey
    const onChain = selectedAncestors.has(node.path)
    const body = (
      <div
        ref={(el) => registerItem(node.path!, el)}
        role="menuitem"
        tabIndex={node.path === tabbableKey || (tabbableKey === undefined && items[0]?.path === node.path) ? 0 : -1}
        className={styles.miniItem}
        data-selected={isSelected}
        data-on-chain={onChain && !isSelected}
        aria-current={isSelected ? 'page' : undefined}
        aria-haspopup={hasChildren || undefined}
        aria-expanded={hasChildren ? popup?.key === node.path : undefined}
        onClick={() => {
          if (!hasChildren) {
            onNavigate(node.path!)
          }
        }}
        onMouseEnter={(event: MouseEvent<HTMLElement>) => {
          if (hasChildren) {
            openPopup(node.path!, event.currentTarget)
          } else {
            // 叶子项悬停时关闭既有浮层（浮层关闭统一由根容器 mouseleave 与叶子悬停承担，
            // 触发项自身不挂 mouseleave，保证鼠标可平移进入浮层）
            closePopup()
          }
        }}
        onKeyDown={(event) => handleMiniKeyDown(event, node)}
      >
        {node.icon !== undefined && (
          <span className={styles.miniIcon} aria-hidden>
            <AppIcon name={node.icon} size={24} />
          </span>
        )}
        <span className={styles.miniTitle}>{translate(node.title)}</span>
      </div>
    )
    return (
      <li key={node.id} role="none">
        {hasChildren ? (
          body
        ) : (
          <Tooltip title={translate(node.title)} placement="right">
            {body}
          </Tooltip>
        )}
      </li>
    )
  }

  return (
    <div
      className={styles.sideNav}
      data-mini={mini}
      onMouseLeave={() => {
        if (mini) {
          closePopup()
        }
      }}
    >
      <ul role="menu" aria-label={t('导航菜单', { ns: COMMON_NAMESPACE })} className={styles.menu}>
        {mini ? items.map(renderMiniNode) : renderExpandedNodes(items, 0)}
      </ul>
      {/* mini 悬浮子菜单浮层：圆角 12 + 阴影阶梯，fixed 锚定触发项右缘 */}
      {mini && popup !== null && popupNode?.children !== undefined && (
        <div
          className={styles.popup}
          style={{ top: popup.top, left: popup.left }}
          role="menu"
          aria-label={translate(popupNode.title)}
        >
          <p className={styles.popupTitle}>{translate(popupNode.title)}</p>
          <ul className={styles.popupList}>
            {popupFlatItems.map((item: NavFlatItem) => (
              <li key={item.key} role="none">
                <div
                  ref={(el) => registerPopupItem(item.key, el)}
                  role="menuitem"
                  tabIndex={-1}
                  className={styles.popupItem}
                  data-selected={item.key === selectedKey}
                  aria-current={item.key === selectedKey ? 'page' : undefined}
                  style={{ paddingInlineStart: 12 + item.depth * 16 }}
                  onClick={() => {
                    closePopup()
                    onNavigate(item.key)
                  }}
                  onKeyDown={(event) => handlePopupKeyDown(event, item.key)}
                >
                  <span className={styles.itemTitle}>{translate(item.title)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* 侧边栏右缘悬浮折叠球（slash 签名）：圆形小按钮半压右缘 */}
      {!inDrawer && onToggleCollapse !== undefined && (
        <button
          type="button"
          className={styles.collapseBall}
          aria-label={t(mini ? '展开侧边栏' : '收起侧边栏', { ns: COMMON_NAMESPACE })}
          onClick={onToggleCollapse}
        >
          {mini ? <ChevronsRight size={14} aria-hidden /> : <ChevronsLeft size={14} aria-hidden />}
        </button>
      )}
    </div>
  )
}
