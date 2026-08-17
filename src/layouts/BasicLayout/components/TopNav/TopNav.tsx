/**
 * 自绘顶部导航（SPEC_UI2 §6.1，取代 antd Menu horizontal 方案）：
 * - 顶级行自绘，与 SideNav 同一套选中语言（主色浅底圆角 + 主色文字/图标）；
 * - 二级以下走 antd Dropdown 下拉浮层（主规格 §11.1 行为不变；浮层为 antd
 *   Menu 算法默认样式，SPEC_UI2 §4.2「业务页内 Menu/Dropdown 保持默认」口径）；
 * - 选中项由 Data Router 当前 match 派生（selectedKey 注入）；子级选中时
 *   其顶级祖先（ancestorOpenKeys 提供祖先链）呈选中态；
 * - 窄视口（<768px）本组件不渲染（导航由 Drawer 内 SideNav 承担）。
 */
import { Dropdown, type MenuProps } from 'antd'
import { ChevronDown } from 'lucide-react'
import { createElement, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppIcon } from '@/components/AppIcon/AppIcon'
import { NAV_ICON_SIZE_SUB_PX } from '@/constants/app.constants'
import { MENU_NAMESPACE } from '@/i18n/i18n'
import type { NavTreeNode } from '@/layouts/BasicLayout/navModel'
import styles from './TopNav.module.css'

export interface TopNavProps {
  /** 已过滤导航树（router 注入 menuRoutes 投影，与 SideNav 同源） */
  items: readonly NavTreeNode[]
  /** 当前选中项 key（节点路径） */
  selectedKey?: string
  /** 选中项祖先链：子级选中时其顶级祖先呈选中态（规格 §11.2） */
  ancestorOpenKeys: readonly string[]
  /** 叶子菜单项导航回调 */
  onNavigate: (path: string) => void
}

/** 递归构建下拉菜单 items：叶子可导航、目录为子菜单；选中叶子携带 aria-current（规格 §11.3） */
function buildDropdownItems(
  nodes: readonly NavTreeNode[],
  translate: (key: string) => string,
  selectedKey: string | undefined,
): Exclude<MenuProps['items'], undefined> {
  const items: Exclude<MenuProps['items'], undefined> = []
  for (const node of nodes) {
    if (node.path === undefined) {
      if (node.children !== undefined && node.children.length > 0) {
        items.push(...buildDropdownItems(node.children, translate, selectedKey))
      }
      continue
    }
    const label = createElement(
      'span',
      node.path === selectedKey ? { 'aria-current': 'page' } : undefined,
      translate(node.title),
    )
    if (node.children !== undefined && node.children.length > 0) {
      items.push({ key: node.path, label, children: buildDropdownItems(node.children, translate, selectedKey) })
      continue
    }
    items.push({ key: node.path, label })
  }
  return items
}

export function TopNav({ items, selectedKey, ancestorOpenKeys, onNavigate }: TopNavProps) {
  const { t } = useTranslation()
  const translate = useCallback((key: string) => t(key, { ns: MENU_NAMESPACE }), [t])
  const [openKey, setOpenKey] = useState<string | null>(null)

  const handleDropdownClick = useCallback<NonNullable<MenuProps['onClick']>>(
    ({ key, domEvent }) => {
      domEvent.preventDefault()
      onNavigate(key)
    },
    [onNavigate],
  )

  const dropdownMenus = useMemo(() => {
    const map = new Map<string, Exclude<MenuProps['items'], undefined>>()
    for (const node of items) {
      if (node.path !== undefined && node.children !== undefined && node.children.length > 0) {
        map.set(node.path, buildDropdownItems(node.children, translate, selectedKey))
      }
    }
    return map
  }, [items, translate, selectedKey])

  return (
    <div className={styles.nav} data-nav-mode="horizontal" data-testid="top-nav">
      <div className={styles.menu} role="menu" aria-label={translate('导航菜单')}>
        {items.map((node) => {
          const path = node.path
          if (path === undefined) {
            return null
          }
          const isSelected = path === selectedKey || ancestorOpenKeys.includes(path)
          const hasChildren = node.children !== undefined && node.children.length > 0
          const title = translate(node.title)
          const button = (
            <button
              type="button"
              className={styles.item}
              data-selected={isSelected}
              role="menuitem"
              aria-current={isSelected ? 'page' : undefined}
              aria-haspopup={hasChildren ? 'menu' : undefined}
              aria-expanded={hasChildren ? openKey === path : undefined}
              onClick={hasChildren ? undefined : () => onNavigate(path)}
            >
              {node.icon !== undefined && (
                <AppIcon
                  name={node.icon}
                  size={NAV_ICON_SIZE_SUB_PX}
                  className={styles.itemIcon}
                  color={isSelected ? 'var(--ant-color-primary)' : undefined}
                />
              )}
              <span className={styles.itemTitle}>{title}</span>
              {hasChildren && <ChevronDown size={14} aria-hidden className={styles.chevron} data-open={openKey === path} />}
            </button>
          )
          if (!hasChildren) {
            return <span key={path} className={styles.itemWrap}>{button}</span>
          }
          return (
            <Dropdown
              key={path}
              menu={{ items: dropdownMenus.get(path), onClick: handleDropdownClick }}
              trigger={['hover', 'click']}
              onOpenChange={(open) => setOpenKey(open ? path : null)}
            >
              <span className={styles.itemWrap}>{button}</span>
            </Dropdown>
          )
        })}
      </div>
    </div>
  )
}
