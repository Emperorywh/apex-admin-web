/**
 * 底部 Dock 菜单：复刻设计稿的悬浮玻璃坞。
 * 菜单项来自 menuRoutes 投影（拍平叶子）；
 * 尾部的「废纸篓」承载关闭全部页签并释放缓存。
 */

import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { App } from 'antd'
import { Trash2 } from 'lucide-react'
import { buildMenuRoutes, flattenMenuLeaves } from '@/router/projections'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { allTabsClosed } from '@/store/slices/tabsSlice'
import styles from '@/layouts/BasicLayout/components/DockMenu/DockMenu.module.css'

export function DockMenu() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { t: tCommon } = useTranslation('common')
  const { t: tMenu } = useTranslation('menu')
  const { message } = App.useApp()

  const items = useMemo(
    () => flattenMenuLeaves(buildMenuRoutes()),
    [],
  )

  const activeRouteId = useMemo(() => {
    return items.find(
      (item) =>
        location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
    )?.routeId
  }, [items, location.pathname])

  const clearTabs = () => {
    dispatch(allTabsClosed())
    void message.success(tCommon('已关闭全部页签，仅保留固定页'))
  }

  return (
    <nav className={styles.dock} aria-label={tCommon('主导航')}>
      {items.map((item) => {
        const Icon = item.icon
        const active = item.routeId === activeRouteId
        return (
          <button
            key={item.routeId}
            type="button"
            className={active ? `${styles.item} ${styles.itemActive}` : styles.item}
            onClick={() => navigate(item.path)}
            aria-current={active ? 'page' : undefined}
          >
            {Icon ? <Icon size={18} strokeWidth={2} /> : null}
            <span className={styles.label}>{tMenu(item.title)}</span>
          </button>
        )
      })}
      <span className={styles.separator} />
      <button
        type="button"
        className={styles.item}
        title={tCommon('关闭全部页签并清空缓存')}
        onClick={clearTabs}
      >
        <Trash2 size={18} strokeWidth={2} />
      </button>
    </nav>
  )
}
