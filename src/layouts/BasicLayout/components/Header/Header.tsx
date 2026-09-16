/**
 * 顶部工具条：品牌 + 页签栏 + 状态区（语言 / 网络 / 时钟 / 头像）三段式玻璃条。
 * 原菜单文字项、搜索框、加号、通知、日历及 ⌘K / Ctrl+K 命令面板已移除。
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dropdown, Popover, type MenuProps } from 'antd'
import dayjs from 'dayjs'
import { KeyRound, LogOut, Monitor, Moon, Sun, Wifi } from 'lucide-react'
import { LanguageMenu } from '@/components/LanguageMenu/LanguageMenu'
import { useSystemImage } from '@/hooks/useSystemImage'
import { getRequestHealth, subscribeRequestHealth, type RequestHealth } from '@/services/request/request'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useAuth } from '@/hooks/useAuth'
import { themeChanged, type AppTheme } from '@/store/slices/settingsSlice'
import { PasswordModal } from '@/features/auth/components/PasswordModal/PasswordModal'
import { useProtectedLogout } from '@/features/auth/hooks/useProtectedLogout'
import { TabsBar } from '@/layouts/BasicLayout/components/TabsBar/TabsBar'
import styles from '@/layouts/BasicLayout/components/Header/Header.module.css'

/** 顶栏时钟刷新间隔（毫秒） */
const CLOCK_TICK_INTERVAL_MS = 1_000

/** 外壳品牌图默认资源：旧系统回退打包 SVG，本工程沿用现有 favicon 图标 */
const DEFAULT_HEADER_LOGO_URL = '/favicon.ico'

export function Header() {
  const { t } = useTranslation('common')
  /* G04：品牌图读取系统配置（headerLogo），未配置回退默认资源 */
  const { url: headerLogoUrl } = useSystemImage('headerLogo', DEFAULT_HEADER_LOGO_URL)

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <img className={styles.brandIcon} src={headerLogoUrl} alt="" aria-hidden="true" />
        <span className={styles.brandName}>{t('调度系统')}</span>
      </div>

      <span className={styles.divider} aria-hidden="true" />

      <div className={styles.tabs}>
        <TabsBar />
      </div>

      <span className={styles.divider} aria-hidden="true" />

      <div className={styles.actions}>
        <ThemeButton />
        {/* G03：语言入口为共享组件，登录页与顶栏共用同一份五语菜单 */}
        <LanguageMenu className={styles.iconBtn} />
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
  /* 中文（简/繁）使用「M月D日」格式并显示本地化星期；其余语言用英文月名格式 */
  const zh = i18n.language.startsWith('zh')
  return (
    <div className={styles.time} title={t('当前时间')}>
      {zh ? now.format('M月D日 ddd　HH:mm') : now.format('MMM D ddd HH:mm')}
    </div>
  )
}

function AvatarMenu() {
  const { t } = useTranslation('common')
  const { identity, isRoot } = useAuth()
  /* G01：主动退出统一走受保护退出（草稿/写入确认 → 二次确认 → 登出 → 收敛） */
  const protectedLogout = useProtectedLogout()
  /* G02：本人改密弹窗（源用户菜单：修改密码 + 退出，无个人中心页） */
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)

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
    { key: 'password', icon: <KeyRound size={15} />, label: t('修改密码') },
    { type: 'divider' },
    { key: 'logout', icon: <LogOut size={15} />, label: t('退出登录'), danger: true },
  ]

  const onClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'password') {
      setPasswordModalOpen(true)
    } else if (key === 'logout') {
      void protectedLogout()
    }
  }

  const initials = (identity?.username ?? '—').slice(0, 2).toUpperCase()

  return (
    <>
      <Dropdown menu={{ items, onClick }} trigger={['click']} placement="bottomRight">
        <button type="button" className={styles.avatar} title={identity?.username ?? t('用户')}>
          {initials}
        </button>
      </Dropdown>
      {/* 改密成功后复用同一受保护退出链路回登录页（源 onSuccess = 退出登录） */}
      <PasswordModal
        open={passwordModalOpen}
        username={identity?.username}
        onClose={() => setPasswordModalOpen(false)}
        onSuccess={() => void protectedLogout()}
      />
    </>
  )
}
