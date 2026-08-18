/**
 * 自绘顶部导航（SPEC_UI2 §6.1，取代 antd Menu horizontal 与 SPEC_UI §5.1）：
 * 横向自绘 menubar，与 SideNav 消费同一已过滤导航树与同一套选中语言
 * （浅底 colorPrimaryBg + 主色文字）；二级以下走自绘下拉浮层（圆角 12 +
 * 阴影阶梯，主规格 §11.1 行为不变）。
 * 可访问性：menubar 键盘语义（←/→ 游走、↓/Enter 开浮层、Esc 关浮层回焦）、
 * role=menubar/menuitem、aria-expanded/aria-current、roving tabindex；
 * 按键语义经 navKeys 纯函数解析（同目录单测）。
 * 窄视口（<768px）时顶部布局折叠为菜单按钮，本组件不渲染（导航由 Drawer 内
 * SideNav 承担，规格 §11.1）。
 */
import { ChevronDown } from 'lucide-react'
import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AppIcon } from '@/components/AppIcon/AppIcon'
import { COMMON_NAMESPACE, MENU_NAMESPACE } from '@/i18n/i18n'
import type { NavTreeNode } from '@/layouts/BasicLayout/navModel'
import {
  flattenVisibleNavItems,
  resolveHorizontalNavKey,
  resolveVerticalNavKey,
} from '@/layouts/BasicLayout/navKeys'
import styles from './TopNav.module.css'

export interface TopNavProps {
  /** 已过滤导航树（router 注入 menuRoutes 投影，与 SideNav 同源） */
  items: readonly NavTreeNode[]
  /** 当前选中项 key（节点路径） */
  selectedKey?: string
  /** 选中项祖先展开链：横向导航据此标示选中链（主色文字） */
  ancestorOpenKeys: readonly string[]
  /** 叶子菜单项导航回调 */
  onNavigate: (path: string) => void
}

/** 下拉浮层的屏幕锚点（由触发项 getBoundingClientRect 计算） */
interface DropdownAnchor {
  key: string
  top: number
  left: number
}

export function TopNav({ items, selectedKey, ancestorOpenKeys, onNavigate }: TopNavProps) {
  const { t } = useTranslation()
  const translate = useCallback((key: string) => t(key, { ns: MENU_NAMESPACE }), [t])

  // 横向 menubar 只承载一级项；roving tabindex 落选中项或首项
  const topItems = useMemo(() => items.filter((node) => node.path !== undefined), [items])
  const tabbableKey = useMemo(() => {
    if (selectedKey !== undefined && topItems.some((node) => node.path === selectedKey)) {
      return selectedKey
    }
    const chainTop = topItems.find((node) => ancestorOpenKeys.includes(node.path!))
    return (chainTop ?? topItems[0])?.path
  }, [topItems, selectedKey, ancestorOpenKeys])

  const itemNodes = useRef(new Map<string, HTMLElement>())
  const registerItem = useCallback((key: string, node: HTMLElement | null) => {
    if (node === null) {
      itemNodes.current.delete(key)
    } else {
      itemNodes.current.set(key, node)
    }
  }, [])

  // 下拉浮层：锚点 + 浮层内垂直键盘游走（子树全量展开扁平化）
  const [dropdown, setDropdown] = useState<DropdownAnchor | null>(null)
  const dropdownNodes = useRef(new Map<string, HTMLElement>())
  const registerDropdownItem = useCallback((key: string, node: HTMLElement | null) => {
    if (node === null) {
      dropdownNodes.current.delete(key)
    } else {
      dropdownNodes.current.set(key, node)
    }
  }, [])
  const dropdownNode = useMemo(
    () => (dropdown === null ? undefined : topItems.find((node) => node.path === dropdown.key)),
    [topItems, dropdown],
  )
  const dropdownFlatItems = useMemo(
    () => (dropdownNode?.children === undefined ? [] : flattenVisibleNavItems(dropdownNode.children, [], true)),
    [dropdownNode],
  )

  const openDropdown = useCallback((key: string, anchor: HTMLElement, focusFirst = false) => {
    const rect = anchor.getBoundingClientRect()
    setDropdown({ key, top: rect.bottom + 4, left: rect.left })
    if (focusFirst) {
      // 浮层渲染后聚焦首项（下一帧，等待 DOM 注册）
      requestAnimationFrame(() => {
        const first = dropdownNodes.current.keys().next()
        if (!first.done) {
          dropdownNodes.current.get(first.value)?.focus()
        }
      })
    }
  }, [])

  const closeDropdown = useCallback(() => setDropdown(null), [])

  const handleTopKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, node: NavTreeNode) => {
      if (node.path === undefined) {
        return
      }
      const flat = topItems.map((n) => ({
        key: n.path!,
        depth: 0,
        hasChildren: n.children !== undefined && n.children.length > 0,
        isOpen: false,
        title: n.title,
      }))
      const action = resolveHorizontalNavKey(flat, node.path, event.key)
      if (action === null) {
        return
      }
      event.preventDefault()
      if (action.type === 'focus') {
        itemNodes.current.get(action.key)?.focus()
        return
      }
      if (action.type === 'open-popup') {
        openDropdown(action.key, event.currentTarget, true)
        return
      }
      onNavigate(action.key)
    },
    [topItems, onNavigate, openDropdown],
  )

  const handleDropdownKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, key: string) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        const triggerKey = dropdown?.key
        closeDropdown()
        if (triggerKey !== undefined) {
          itemNodes.current.get(triggerKey)?.focus()
        }
        return
      }
      const action = resolveVerticalNavKey(dropdownFlatItems, key, event.key)
      if (action === null) {
        return
      }
      event.preventDefault()
      if (action.type === 'focus') {
        dropdownNodes.current.get(action.key)?.focus()
        return
      }
      if (action.type === 'activate') {
        closeDropdown()
        onNavigate(action.key)
      }
    },
    [closeDropdown, dropdown, dropdownFlatItems, onNavigate],
  )

  return (
    <div className={styles.topNav} onMouseLeave={closeDropdown}>
      <ul role="menubar" aria-label={t('导航菜单', { ns: COMMON_NAMESPACE })} className={styles.bar}>
        {topItems.map((node) => {
          const hasChildren = node.children !== undefined && node.children.length > 0
          const isSelected = node.path === selectedKey
          const onChain = ancestorOpenKeys.includes(node.path!)
          return (
            <li key={node.id} role="none" className={styles.barEntry}>
              <div
                ref={(el) => registerItem(node.path!, el)}
                role="menuitem"
                tabIndex={node.path === tabbableKey ? 0 : -1}
                className={styles.barItem}
                data-selected={isSelected}
                data-on-chain={onChain && !isSelected}
                aria-current={isSelected ? 'page' : undefined}
                aria-haspopup={hasChildren || undefined}
                aria-expanded={hasChildren ? dropdown?.key === node.path : undefined}
                onClick={() => {
                  if (!hasChildren) {
                    onNavigate(node.path!)
                  }
                }}
                onMouseEnter={(event: MouseEvent<HTMLElement>) => {
                  if (hasChildren) {
                    openDropdown(node.path!, event.currentTarget)
                  } else {
                    closeDropdown()
                  }
                }}
                onKeyDown={(event) => handleTopKeyDown(event, node)}
              >
                {node.icon !== undefined && (
                  <span className={styles.barIcon} aria-hidden>
                    <AppIcon name={node.icon} size={20} />
                  </span>
                )}
                <span className={styles.barTitle}>{translate(node.title)}</span>
                {hasChildren && <ChevronDown size={14} aria-hidden className={styles.barArrow} />}
              </div>
            </li>
          )
        })}
      </ul>
      {/* 二级以下下拉浮层（主规格 §11.1）：圆角 12 + 阴影阶梯，fixed 锚定触发项下缘 */}
      {dropdown !== null && dropdownNode?.children !== undefined && (
        <div
          className={styles.dropdown}
          style={{ top: dropdown.top, left: dropdown.left }}
          role="menu"
          aria-label={translate(dropdownNode.title)}
          onMouseEnter={() => setDropdown((current) => current)}
          onMouseLeave={closeDropdown}
        >
          <ul className={styles.dropdownList}>
            {dropdownFlatItems.map((item) => (
              <li key={item.key} role="none">
                <div
                  ref={(el) => registerDropdownItem(item.key, el)}
                  role="menuitem"
                  tabIndex={-1}
                  className={styles.dropdownItem}
                  data-selected={item.key === selectedKey}
                  aria-current={item.key === selectedKey ? 'page' : undefined}
                  style={{ paddingInlineStart: 12 + item.depth * 16 }}
                  onClick={() => {
                    closeDropdown()
                    onNavigate(item.key)
                  }}
                  onKeyDown={(event) => handleDropdownKeyDown(event, item.key)}
                >
                  <span className={styles.dropdownTitle}>{translate(item.title)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
