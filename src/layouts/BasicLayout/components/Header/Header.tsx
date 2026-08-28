/**
 * 顶部工具条：品牌 + 页签栏 + 状态区（语言 / 网络 / 时钟 / 头像）三段式玻璃条。
 * 原菜单文字项、搜索框、加号、通知、日历及 ⌘K / Ctrl+K 命令面板已移除。
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { App, Dropdown, Popover, type MenuProps } from 'antd'
import dayjs from 'dayjs'
import { Languages, LogOut, Monitor, Moon, Sun, UserRoundCog, Wifi } from 'lucide-react'
import { ROUTE_PATHS } from '@/router/definitions'
import { logout } from '@/services/auth/auth.service'
import { getRequestHealth, subscribeRequestHealth, type RequestHealth } from '@/services/request/request'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useAuth } from '@/hooks/useAuth'
import { sessionExpired } from '@/store/slices/authSlice'
import { localeChanged, themeChanged, type AppTheme } from '@/store/slices/settingsSlice'
import type { AppLanguage } from '@/i18n/i18n'
import { TabsBar } from '@/layouts/BasicLayout/components/TabsBar/TabsBar'
import styles from '@/layouts/BasicLayout/components/Header/Header.module.css'

/** 顶栏时钟刷新间隔（毫秒） */
const CLOCK_TICK_INTERVAL_MS = 1_000

export function Header() {
  const { t } = useTranslation('common')

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <svg className={styles.apple} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M13.9 10.57c.02 2.2 1.93 2.93 1.95 2.94-.02.05-.3 1.06-1 2.11-.6.92-1.23 1.83-2.21 1.85-.96.02-1.27-.57-2.37-.57-1.1 0-1.45.55-2.35.59-.95.03-1.68-.96-2.29-1.88-1.24-1.88-2.18-5.3-.91-7.52.63-1.1 1.74-1.8 2.94-1.82.92-.02 1.79.62 2.37.62.58 0 1.67-.77 2.81-.66.48.02 1.83.2 2.7 1.48-.07.04-1.61.94-1.64 2.86ZM12.01 3.97c.5-.61.84-1.45.75-2.29-.72.03-1.59.48-2.11 1.09-.47.54-.88 1.39-.77 2.21.8.06 1.62-.41 2.13-1.01Z" />
        </svg>
        <span className={styles.brandName}>{t('企业运营中心')}</span>
      </div>

      <span className={styles.divider} aria-hidden="true" />

      <div className={styles.tabs}>
        <TabsBar />
      </div>

      <span className={styles.divider} aria-hidden="true" />

      <div className={styles.actions}>
        <ThemeButton />
        <LanguageButton />
        <NetworkButton />
        <ClockText />
        <AvatarMenu />
      </div>
    </header>
  )
}

/* -------------------------------------------------------------------------- */
/* 主题 / 语言 / 网络 / 时钟 / 头像                                             */
/* -------------------------------------------------------------------------- */

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const

function ThemeButton() {
  const { t } = useTranslation('common')
  const dispatch = useAppDispatch()
  const theme = useAppSelector((state) => state.settings.theme)
  const ThemeIcon = THEME_ICONS[theme]

  const items: MenuProps['items'] = [
    { key: 'light', icon: <Sun size={15} />, label: t('浅色') },
    { key: 'dark', icon: <Moon size={15} />, label: t('深色') },
    { key: 'system', icon: <Monitor size={15} />, label: t('跟随系统') },
  ]

  return (
    <Dropdown
      menu={{
        items,
        selectable: true,
        selectedKeys: [theme],
        onClick: ({ key }) => {
          if (key !== theme) dispatch(themeChanged(key as AppTheme))
        },
      }}
      trigger={['click']}
      placement="bottomRight"
    >
      <button type="button" className={styles.iconBtn} title={t('切换主题')}>
        <ThemeIcon size={17} />
      </button>
    </Dropdown>
  )
}

function LanguageButton() {
  const { t } = useTranslation('common')
  const dispatch = useAppDispatch()
  const locale = useAppSelector((state) => state.settings.locale)

  const items: MenuProps['items'] = [
    { key: 'zh-CN', label: '中文' },
    { key: 'en-US', label: 'English' },
  ]

  return (
    <Dropdown
      menu={{
        items,
        selectable: true,
        selectedKeys: [locale],
        onClick: ({ key }) => {
          if (key !== locale) dispatch(localeChanged(key as AppLanguage))
        },
      }}
      trigger={['click']}
      placement="bottomRight"
    >
      <button type="button" className={styles.iconBtn} title={t('切换语言')}>
        <Languages size={17} />
      </button>
    </Dropdown>
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
        <Wifi size={17} />
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
      {zh ? now.format('M月D日 ddd　HH:mm') : now.format('MMM D ddd HH:mm')}
    </div>
  )
}

function AvatarMenu() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { modal } = App.useApp()

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
    { type: 'divider' },
    { key: 'logout', icon: <LogOut size={15} />, label: t('退出登录'), danger: true },
  ]

  const onClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'profile') {
      navigate(ROUTE_PATHS.profile)
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
