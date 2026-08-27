/**
 * 顶部状态栏：复刻设计稿（品牌 + 菜单 + 中央搜索 ⌘K + 功能图标 + 时钟 + 头像）。
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { App, Button, Calendar, Dropdown, Popover, type MenuProps } from 'antd'
import dayjs from 'dayjs'
import {
  Bell,
  CalendarDays,
  CornerDownLeft,
  Languages,
  LogOut,
  Plus,
  Search,
  UserRoundCog,
  Wifi,
} from 'lucide-react'
import { CLOCK_TICK_INTERVAL_MS } from '@/constants/app.constants'
import { ROUTE_PATHS } from '@/constants/route.constants'
import { buildMenuRoutes, flattenMenuLeaves } from '@/router/projections'
import { logout } from '@/services/auth/auth.service'
import { getRequestHealth, subscribeRequestHealth, type RequestHealth } from '@/services/request/request'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useAuth } from '@/hooks/useAuth'
import { sessionExpired } from '@/store/slices/authSlice'
import { localeChanged } from '@/store/slices/settingsSlice'
import type { AppLanguage } from '@/i18n/i18n'
import { TopMenu } from '@/layouts/BasicLayout/components/TopMenu/TopMenu'
import styles from '@/layouts/BasicLayout/components/Header/Header.module.css'

/** 通知条目（演示数据） */
const DEMO_NOTIFICATIONS = [
  { id: 1, title: '支付服务响应超时告警', detail: '平均响应时间 ＞ 300ms' },
  { id: 2, title: '库存预警：智能摄像头 Pro', detail: '广州仓剩余 32 件' },
  { id: 3, title: '月度安全巡检已完成', detail: '未发现高危风险' },
]

export function Header() {
  const { t } = useTranslation('common')
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  /* ⌘K / Ctrl+K 聚焦搜索 */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <header className={styles.topbar}>
      <div className={styles.menuLeft}>
        <div className={styles.brand}>
          <svg className={styles.apple} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M13.9 10.57c.02 2.2 1.93 2.93 1.95 2.94-.02.05-.3 1.06-1 2.11-.6.92-1.23 1.83-2.21 1.85-.96.02-1.27-.57-2.37-.57-1.1 0-1.45.55-2.35.59-.95.03-1.68-.96-2.29-1.88-1.24-1.88-2.18-5.3-.91-7.52.63-1.1 1.74-1.8 2.94-1.82.92-.02 1.79.62 2.37.62.58 0 1.67-.77 2.81-.66.48.02 1.83.2 2.7 1.48-.07.04-1.61.94-1.64 2.86ZM12.01 3.97c.5-.61.84-1.45.75-2.29-.72.03-1.59.48-2.11 1.09-.47.54-.88 1.39-.77 2.21.8.06 1.62-.41 2.13-1.01Z" />
          </svg>
          <span className={styles.brandName}>{t('企业运营中心')}</span>
        </div>
        <TopMenu />
      </div>

      <div className={styles.centerSearch}>
        <Search size={17} className={styles.searchIcon} strokeWidth={2.2} />
        <input
          ref={inputRef}
          value={query}
          placeholder={t('搜索应用、数据、设备、文档或输入命令...')}
          aria-label={t('全局搜索')}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <span className={styles.kbd}>⌘K</span>
        {focused && query.trim() !== '' && (
          <CommandPalette
            query={query}
            onDone={() => {
              setQuery('')
              inputRef.current?.blur()
            }}
          />
        )}
      </div>

      <div className={styles.menuRight}>
        <button
          type="button"
          className={styles.iconBtn}
          title={t('打开命令面板')}
          onClick={() => inputRef.current?.focus()}
        >
          <Plus size={18} />
        </button>
        <NotificationBell />
        <CalendarButton />
        <NetworkButton />
        <ClockText />
        <AvatarMenu />
      </div>
    </header>
  )
}

/* -------------------------------------------------------------------------- */
/* 命令面板                                                                     */
/* -------------------------------------------------------------------------- */

interface CommandItem {
  key: string
  kind: 'page' | 'action'
  title: string
  hint?: string
}

function CommandPalette({ query, onDone }: { query: string; onDone: () => void }) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { permissions } = useAuth()
  const locale = useAppSelector((state) => state.settings.locale)
  const { t: tCommon } = useTranslation('common')
  const { t: tMenu } = useTranslation('menu')
  const [highlight, setHighlight] = useState(0)

  const items = useMemo<CommandItem[]>(() => {
    const keyword = query.trim().toLowerCase()
    const leaves = flattenMenuLeaves(buildMenuRoutes(permissions))
    const pages: CommandItem[] = leaves
      .filter(
        (leaf) =>
          tMenu(leaf.title).toLowerCase().includes(keyword) ||
          leaf.path.toLowerCase().includes(keyword),
      )
      .map((leaf) => ({
        key: `page:${leaf.routeId}`,
        kind: 'page',
        title: tMenu(leaf.title),
        hint: leaf.path,
      }))
    const target: AppLanguage = locale === 'zh-CN' ? 'en-US' : 'zh-CN'
    const actions: CommandItem[] = [
      {
        key: 'action:lang',
        kind: 'action',
        title: `${tCommon('切换语言')} → ${target === 'en-US' ? 'English' : '中文'}`,
      },
      { key: 'action:logout', kind: 'action', title: tCommon('退出登录') },
    ]
    return [...pages, ...actions.filter((action) => action.title.toLowerCase().includes(keyword))]
  }, [locale, permissions, query, tCommon, tMenu])

  const run = (item: CommandItem | undefined) => {
    if (!item) return
    if (item.kind === 'page') {
      const routeId = item.key.slice('page:'.length)
      const leaves = flattenMenuLeaves(buildMenuRoutes(permissions))
      const target = leaves.find((leaf) => leaf.routeId === routeId)
      if (target) navigate(target.path)
    } else if (item.key === 'action:lang') {
      dispatch(localeChanged(locale === 'zh-CN' ? 'en-US' : 'zh-CN'))
    } else if (item.key === 'action:logout') {
      void logout().finally(() => {
        dispatch(sessionExpired())
      })
    }
    onDone()
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlight((prev) => (items.length === 0 ? 0 : (prev + 1) % items.length))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlight((prev) => (items.length === 0 ? 0 : (prev - 1 + items.length) % items.length))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        run(items[highlight])
      } else if (event.key === 'Escape') {
        onDone()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  useEffect(() => {
    setHighlight(0)
  }, [query])

  return (
    <div className={styles.palette} onMouseDown={(event) => event.preventDefault()}>
      {items.length === 0 ? (
        <div className={styles.paletteEmpty}>{tCommon('没有匹配的结果')}</div>
      ) : (
        items.map((item, index) => (
          <button
            key={item.key}
            type="button"
            className={index === highlight ? `${styles.paletteItem} ${styles.paletteItemActive}` : styles.paletteItem}
            onMouseEnter={() => setHighlight(index)}
            onClick={() => run(item)}
          >
            <span className={styles.paletteTitle}>{item.title}</span>
            {item.hint ? <span className={styles.paletteHint}>{item.hint}</span> : <CornerDownLeft size={13} className={styles.paletteHint} />}
          </button>
        ))
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 通知 / 日历 / 网络 / 时钟 / 头像                                               */
/* -------------------------------------------------------------------------- */

function NotificationBell() {
  const { t } = useTranslation('common')
  const [unread, setUnread] = useState(DEMO_NOTIFICATIONS.length + 5)
  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      title={t('通知')}
      content={
        <div className={styles.popList}>
          {DEMO_NOTIFICATIONS.map((item) => (
            <div key={item.id} className={styles.popItem}>
              <strong>{t(item.title)}</strong>
              <span>{t(item.detail)}</span>
            </div>
          ))}
          <Button size="small" type="link" onClick={() => setUnread(0)}>
            {t('全部标记已读')}
          </Button>
        </div>
      }
    >
      <button type="button" className={styles.iconBtn} title={t('通知')}>
        <Bell size={18} />
        {unread > 0 && <span className={styles.badge}>{unread}</span>}
      </button>
    </Popover>
  )
}

function CalendarButton() {
  const { t } = useTranslation('common')
  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      content={
        <div className={styles.calendarPop}>
          <Calendar fullscreen={false} value={dayjs()} />
        </div>
      }
    >
      <button type="button" className={styles.iconBtn} title={t('日历')}>
        <CalendarDays size={18} />
      </button>
    </Popover>
  )
}

function NetworkButton() {
  const { t } = useTranslation('common')
  const [health, setHealth] = useState<RequestHealth>(() => getRequestHealth())
  useEffect(() => subscribeRequestHealth(setHealth), [])
  const ok = health.consecutiveFailures < 2
  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      content={
        <div className={styles.popList}>
          <div className={styles.popItem}>
            <strong>{ok ? t('网络连接正常') : t('网络连接异常')}</strong>
            <span>
              {t('连续失败请求')}: {health.consecutiveFailures}
            </span>
            <span>
              {t('最近检查')}: {health.lastCheckedAt === 0 ? '—' : dayjs(health.lastCheckedAt).format('HH:mm:ss')}
            </span>
          </div>
        </div>
      }
    >
      <button type="button" className={styles.iconBtn} title={t('网络')} style={{ color: ok ? undefined : 'var(--app-red)' }}>
        <Wifi size={18} />
      </button>
    </Popover>
  )
}

function ClockText() {
  const { i18n, t } = useTranslation('common')
  const [now, setNow] = useState(() => dayjs())
  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), CLOCK_TICK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])
  const zh = i18n.language === 'zh-CN'
  return (
    <div className={styles.time} title={t('当前时间')}>
      {zh ? now.format('M月D日 ddd　HH:mm') : now.format('MMM D ddd HH:mm')}
    </div>
  )
}

function AvatarMenu() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { modal } = App.useApp()
  const locale = useAppSelector((state) => state.settings.locale)

  const items: MenuProps['items'] = [
    {
      key: 'header',
      label: (
        <span className={styles.avatarHeader}>
          <strong>{user?.displayName ?? '—'}</strong>
          <span>{user?.roleNames.join(' / ') ?? t('未分配角色')}</span>
        </span>
      ),
      disabled: true,
    },
    { type: 'divider' },
    { key: 'profile', icon: <UserRoundCog size={15} />, label: t('个人中心') },
    {
      key: 'lang',
      icon: <Languages size={15} />,
      label: locale === 'zh-CN' ? 'English' : '中文',
    },
    { type: 'divider' },
    { key: 'logout', icon: <LogOut size={15} />, label: t('退出登录'), danger: true },
  ]

  const onClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'profile') {
      navigate(ROUTE_PATHS.PROFILE)
    } else if (key === 'lang') {
      dispatch(localeChanged(locale === 'zh-CN' ? 'en-US' : 'zh-CN'))
    } else if (key === 'logout') {
      modal.confirm({
        title: t('确认退出登录？'),
        content: t('退出后需要重新输入账号密码。'),
        okText: t('退出'),
        cancelText: t('取消'),
        onOk: async () => {
          await logout()
          dispatch(sessionExpired())
        },
      })
    }
  }

  return (
    <Dropdown menu={{ items, onClick }} trigger={['click']} placement="bottomRight">
      <button type="button" className={styles.avatar} title={user?.displayName ?? t('用户')}>
        {user?.initials ?? '—'}
      </button>
    </Dropdown>
  )
}
