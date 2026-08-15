/**
 * 顶部菜单（规格 §11.1/§11.2）：antd Menu horizontal 模式，与 SideMenu 消费同一
 * 已过滤导航树；二级及以上层级由 antd 水平菜单以下拉/弹出子菜单呈现。
 * 选中项由 Data Router 当前 match 派生（selectedKey 注入），点击叶子导航。
 * 窄视口（<768px）时顶部布局折叠为菜单按钮，本组件不渲染（导航由 Drawer 内
 * SideMenu 承担）。
 */
import { Menu } from 'antd'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MENU_NAMESPACE } from '@/i18n/i18n'
import { buildNavMenuItems, type NavTranslate } from '@/layouts/BasicLayout/navTree'
import type { NavTreeNode } from '@/layouts/BasicLayout/navModel'

export interface TopMenuProps {
  /** 已过滤导航树（router 注入 menuRoutes 投影，与 SideMenu 同源） */
  items: readonly NavTreeNode[]
  /** 当前选中项 key（节点路径） */
  selectedKey?: string
  /** 叶子菜单项导航回调 */
  onNavigate: (path: string) => void
}

export function TopMenu({ items, selectedKey, onNavigate }: TopMenuProps) {
  const { t } = useTranslation()
  const translate = useCallback<NavTranslate>((key) => t(key, { ns: MENU_NAMESPACE }), [t])
  const menuItems = useMemo(() => buildNavMenuItems(items, translate, selectedKey), [items, translate, selectedKey])

  return (
    <Menu
      mode="horizontal"
      items={menuItems}
      selectedKeys={selectedKey !== undefined ? [selectedKey] : []}
      onClick={({ key }) => onNavigate(key)}
    />
  )
}
