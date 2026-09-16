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
import { confirmSessionExit } from '@/services/page-session/leaveGuard'
import { apiErrorMessage, getRequestHealth, subscribeRequestHealth, type RequestHealth } from '@/services/request/request'
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
        <img className={styles.brandIcon} src="/favicon.ico" alt="" aria-hidden="true" />
        <span className={styles.brandName}>{t('调度系统')}</span>
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
  const { identity, isRoot } = useAuth()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { modal, message } = App.useApp()

  const items: MenuProps['items'] = [
    {
      key: 'header',
      label: (
        <span className={styles.avatarHeader}>
          {/* 旧协议身份只有账号名；特权分支按源 isRootUser 判定展示 */}
          <strong>{identity?.username ?? '—'}</strong>
          <span>{isRoot ? t('特权账号') : t('普通账号')}</span>
        </span>
      ),
      disabled: true,
    },
    { type: 'divider' },
    { key: 'profile', icon: <UserRoundCog size={15} />, label: t('个人中心') },
    { type: 'divider' },
    { key: 'logout', icon: <LogOut size={15} />, label: t('退出登录'), danger: true },
  ]

  const onClick: MenuProps['onClick'] = async ({ key }) => {
    if (key === 'profile') {
      navigate(ROUTE_PATHS.profile)
    } else if (key === 'logout') {
      /* 主动退出保护（T013 §9.1）：先完成草稿/写入/传输确认——无保护时
         confirmSessionExit 直接放行；取消则留在当前页。确认后再走登出请求。 */
      const confirmed = await confirmSessionExit()
      if (!confirmed) return
      modal.confirm({
        title: t('确认退出登录？'),
        content: t('退出后需要重新输入账号密码。'),
        okText: t('退出'),
        cancelText: t('取消'),
        onOk: async () => {
          try {
            // 源行为：后端登出失败时保留会话并提示，不本地登出
            await logout()
          } catch (error) {
            const text = apiErrorMessage(error)
            void message.error(text ? `${t('退出登录出错')}${text}` : t('退出登录出错'))
            throw error
          }
          // 成功后统一收敛：清身份/页签/缓存，SessionHost 监听未登录自动回登录页
          dispatch(sessionExpired())
        },
      })
    }
  }

  const initials = (identity?.username ?? '—').slice(0, 2).toUpperCase()

  return (
    <Dropdown menu={{ items, onClick }} trigger={['click']} placement="bottomRight">
      <button type="button" className={styles.avatar} title={identity?.username ?? t('用户')}>
        {initials}
      </button>
    </Dropdown>
  )
}
