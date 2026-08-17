/**
 * 侧边菜单（规格 §11.1/§11.2）：antd Menu inline 模式，支持任意层级；
 * 选中项与祖先展开链由 Data Router 当前 match 派生（经 BasicLayout 注入 selectedKey/
 * ancestorOpenKeys），用户手动展开的目录与祖先链并集共存，选中项永远跟随路由。
 * 桌面侧边布局内嵌于侧栏（可折叠），窄视口（<768px）时同一组件承载于导航 Drawer。
 * 视觉（SPEC-UI §5.1）：菜单底色透明透出侧栏中性灰；选中项 = 主题色浅底（Menu token）
 * + 左侧 2px 主题色指示条（本组件 CSS），折叠态指示条保留。
 */
import { Menu } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MENU_NAMESPACE } from '@/i18n/i18n'
import { buildNavMenuItems, mergeOpenKeys, type NavTranslate } from '@/layouts/BasicLayout/navTree'
import type { NavTreeNode } from '@/layouts/BasicLayout/navModel'
import styles from './SideMenu.module.css'

export interface SideMenuProps {
  /** 已过滤导航树（router 注入 menuRoutes 投影） */
  items: readonly NavTreeNode[]
  /** 当前选中项 key（节点路径）；不在导航树内的路由（如错误页）无选中 */
  selectedKey?: string
  /** 选中项祖先展开链：随路由变化并入展开状态（规格 §11.2） */
  ancestorOpenKeys: readonly string[]
  /** 叶子菜单项导航回调：以节点完整路径跳转 */
  onNavigate: (path: string) => void
  /** 折叠态（桌面侧栏折叠时 icon-only，antd inlineCollapsed） */
  collapsed?: boolean
}

export function SideMenu({ items, selectedKey, ancestorOpenKeys, onNavigate, collapsed = false }: SideMenuProps) {
  const { t } = useTranslation()
  // 标题翻译绑定 menu 命名空间：语言切换时 t 引用变化触发菜单项重建（规格 §12）
  const translate = useCallback<NavTranslate>((key) => t(key, { ns: MENU_NAMESPACE }), [t])
  const menuItems = useMemo(() => buildNavMenuItems(items, translate, selectedKey), [items, translate, selectedKey])

  // 展开状态：初始与路由变化时并入祖先链；用户开合经 onOpenChange 自由增删
  const [openKeys, setOpenKeys] = useState<string[]>(() => [...ancestorOpenKeys])
  useEffect(() => {
    setOpenKeys((current) => mergeOpenKeys(current, ancestorOpenKeys))
  }, [ancestorOpenKeys])

  return (
    <Menu
      className={styles.menu}
      mode="inline"
      inlineCollapsed={collapsed}
      items={menuItems}
      selectedKeys={selectedKey !== undefined ? [selectedKey] : []}
      openKeys={openKeys}
      onOpenChange={(keys) => setOpenKeys(keys)}
      onClick={({ key }) => onNavigate(key)}
    />
  )
}
