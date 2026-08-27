/**
 * 顶部菜单：macOS 风格功能菜单（工作区 / 视图 / 窗口 / 帮助）。
 * 工作区承载快捷入口，视图承载刷新与语言，窗口承载页签批量操作。
 */

import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { App, Dropdown, type MenuProps } from 'antd'
import { buildMenuRoutes, flattenMenuLeaves } from '@/router/projections'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { allTabsClosed, otherTabsClosed, rightTabsClosed, tabRefreshed } from '@/store/slices/tabsSlice'
import { localeChanged } from '@/store/slices/settingsSlice'
import type { AppLanguage } from '@/i18n/i18n'
import styles from '@/layouts/BasicLayout/components/TopMenu/TopMenu.module.css'

const MENU_KEYS = ['workspace', 'view', 'window', 'help'] as const
type MenuKey = (typeof MENU_KEYS)[number]

export function TopMenu() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { t: tCommon } = useTranslation('common')
  const { t: tMenu } = useTranslation('menu')
  const activeTabKey = useAppSelector((state) => state.tabs.activeTabKey)
  const locale = useAppSelector((state) => state.settings.locale)

  const quickLinks = useMemo(() => flattenMenuLeaves(buildMenuRoutes()), [])

  const changeLocale = useCallback(
    (next: AppLanguage) => {
      if (next !== locale) dispatch(localeChanged(next))
    },
    [dispatch, locale],
  )

  const menus = useMemo<Record<MenuKey, MenuProps>>(() => {
    const tabOps: MenuProps['items'] = [
      { key: 'refresh', label: tCommon('刷新当前页签') },
      { type: 'divider' },
      { key: 'others', label: tCommon('关闭其他页签') },
      { key: 'right', label: tCommon('关闭右侧页签') },
      { key: 'all', label: tCommon('关闭全部页签') },
    ]
    const runTabOp = (key: string) => {
      if (!activeTabKey) return
      if (key === 'refresh') dispatch(tabRefreshed(activeTabKey))
      else if (key === 'others') dispatch(otherTabsClosed(activeTabKey))
      else if (key === 'right') dispatch(rightTabsClosed(activeTabKey))
      else if (key === 'all') dispatch(allTabsClosed())
    }
    return {
      workspace: {
        items: quickLinks.map((leaf) => ({
          key: leaf.routeId,
          label: <span className={styles.menuEntry}>{tMenu(leaf.title)}</span>,
        })),
        onClick: ({ key }) => {
          const target = quickLinks.find((leaf) => leaf.routeId === key)
          if (target) navigate(target.path)
        },
      },
      view: {
        items: [
          { key: 'refresh', label: tCommon('刷新当前页签') },
          { type: 'divider' },
          { key: 'zh-CN', label: '中文' },
          { key: 'en-US', label: 'English' },
        ],
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation()
          if (key === 'refresh') runTabOp('refresh')
          else if (key === 'zh-CN') changeLocale('zh-CN')
          else if (key === 'en-US') changeLocale('en-US')
        },
      },
      window: {
        items: tabOps,
        onClick: ({ key }) => runTabOp(key),
      },
      help: {
        items: [{ key: 'about', label: tCommon('关于企业运营中心') }],
        onClick: () => {
          void message.info(tCommon('通用后台管理模板 · 开箱包含多语言、多页签与页面保活'))
        },
      },
    }
  }, [activeTabKey, changeLocale, dispatch, message, navigate, quickLinks, tCommon, tMenu])

  const labels: Record<MenuKey, string> = {
    workspace: tCommon('工作区'),
    view: tCommon('视图'),
    window: tCommon('窗口'),
    help: tCommon('帮助'),
  }

  return (
    <nav className={styles.menu} aria-label={tCommon('顶部菜单')}>
      {MENU_KEYS.map((key) => (
        <Dropdown key={key} menu={menus[key]} trigger={['click']}>
          <button type="button" className={styles.item}>
            {labels[key]}
          </button>
        </Dropdown>
      ))}
    </nav>
  )
}
