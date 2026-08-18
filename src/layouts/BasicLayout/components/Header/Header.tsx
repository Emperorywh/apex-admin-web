/**
 * 顶栏（规格 §11.2）：折叠/菜单按钮、面包屑（useMatches 读 handle.meta）、全局进度、
 * 全屏、语言切换、主题快捷切换、用户菜单（个人中心入口 + 退出登录）与设置入口。
 * - 触发按钮由 BasicLayout 注入：侧边布局桌面为折叠侧栏，窄视口为打开导航抽屉；
 * - 语言切换先经 changeAppLanguage 预加载 common/menu 与当前路由声明命名空间，
 *   资源就绪后一次性 changeLanguage，再持久化 settings.language（规格 §12）；
 * - 主题快捷切换/全屏消费 TASK-009 的 settings 与 useFullscreen，不新增设置项；
 * - 窄视口（<768px）时全屏/语言/主题三项收入「更多」菜单（规格 §11.1），
 *   用户菜单与设置入口保持直达。
 */
import { Avatar, Button, Dropdown } from 'antd'
import { createElement, useCallback, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useMatches, useNavigate } from 'react-router'
import {
  Check,
  Languages,
  LogOut,
  Maximize,
  Minimize,
  Monitor,
  Moon,
  MoreHorizontal,
  Settings,
  Sun,
  User,
  type LucideIcon,
} from 'lucide-react'
import { ROUTE_PATHS } from '@/constants/route.constants'
import { appI18n, changeAppLanguage, COMMON_NAMESPACE, MENU_NAMESPACE } from '@/i18n/i18n'
import { useFullscreen } from '@/hooks/useFullscreen'
import { readNavMatchMeta, type NavTreeNode } from '@/layouts/BasicLayout/navModel'
import { Breadcrumb } from '@/layouts/BasicLayout/components/Breadcrumb/Breadcrumb'
import { GlobalProgress } from '@/components/GlobalProgress/GlobalProgress'
import {
  SETTINGS_LANGUAGES,
  SETTINGS_THEME_MODES,
  settingsChanged,
  type SettingsLanguage,
  type SettingsThemeMode,
} from '@/store/slices/settings.slice'
import type { RootState } from '@/store/store'
import styles from './Header.module.css'

/** 左侧触发按钮配置：icon-only 按钮必须携带可访问名称（规格 §11.3） */
export interface HeaderTrigger {
  icon: LucideIcon
  label: string
  onClick: () => void
}

export interface HeaderProps {
  /** 折叠/菜单按钮：侧边布局桌面=折叠侧栏；窄视口=打开导航抽屉；顶部布局桌面为 null */
  trigger: HeaderTrigger | null
  /** 已过滤导航树：面包屑层级与可点击性判定共用（规格 §11.2） */
  navItems: readonly NavTreeNode[]
  /** 退出登录回调：执行认证登出状态机，由 BasicLayout 注入 */
  onLogout: () => Promise<void>
  /** 设置入口回调：打开界面设置抽屉 */
  onOpenSettings: () => void
  /** 窄视口标记：次要操作收入更多菜单（规格 §11.1） */
  isMobile: boolean
}

/** 主题快捷切换档位：跟随系统/浅色/深色，当前档位以对钩标示 */
const THEME_QUICK_ENTRIES: ReadonlyArray<{
  mode: SettingsThemeMode
  labelKey: string
  icon: LucideIcon
}> = [
  { mode: SETTINGS_THEME_MODES.SYSTEM, labelKey: '跟随系统', icon: Monitor },
  { mode: SETTINGS_THEME_MODES.LIGHT, labelKey: '浅色', icon: Sun },
  { mode: SETTINGS_THEME_MODES.DARK, labelKey: '深色', icon: Moon },
]

/** 主题快捷切换菜单项：当前档位打钩，其余显示档位图标 */
function buildThemeQuickItems(
  translate: (key: string) => string,
  current: SettingsThemeMode,
): Array<{ key: string; label: string; icon: ReactNode }> {
  return THEME_QUICK_ENTRIES.map(({ mode, labelKey, icon }) => ({
    key: `theme:${mode}`,
    label: translate(labelKey),
    icon: mode === current ? <Check size={16} /> : createElement(icon, { size: 16 }),
  }))
}

/** 从菜单项 key 还原主题档位（key 前缀见 buildThemeQuickItems） */
function themeModeFromKey(key: string): SettingsThemeMode {
  return key.slice('theme:'.length) as SettingsThemeMode
}

export function Header({ trigger, navItems, onLogout, onOpenSettings, isMobile }: HeaderProps) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const matches = useMatches()
  const themeMode = useSelector((state: RootState) => state.settings.themeMode)
  const breadcrumbEnabled = useSelector((state: RootState) => state.settings.breadcrumbEnabled)
  const language = useSelector((state: RootState) => state.settings.language)
  const displayName = useSelector((state: RootState) => state.user.user?.displayName)
  const { fullscreen, toggle: toggleFullscreen } = useFullscreen()
  const [loggingOut, setLoggingOut] = useState(false)

  // 语言切换前预加载的命名空间：common/menu 之外并入当前路由声明（规格 §12）；
  // 已打开页签声明命名空间的并集随 TASK-011 页签体系接入
  const extraNamespaces = useMemo(
    () => matches.flatMap((match) => readNavMatchMeta(match.handle)?.i18nNamespaces ?? []),
    [matches],
  )

  const handleLanguageChange = useCallback(
    async (target: SettingsLanguage): Promise<void> => {
      // 先加载资源并一次性 changeLanguage，再持久化设置，避免半切换状态（规格 §12）
      await changeAppLanguage(appI18n, target, { extraNamespaces })
      dispatch(settingsChanged({ language: target }))
    },
    [extraNamespaces, dispatch],
  )

  /** 执行登出：登出请求进行中禁止重复触发（loading 态经 setLoggingOut 维持） */
  const handleLogout = useCallback((): void => {
    void (async () => {
      setLoggingOut(true)
      try {
        await onLogout()
      } finally {
        setLoggingOut(false)
      }
    })()
  }, [onLogout])

  const translateCommon = useCallback((key: string): string => t(key, { ns: COMMON_NAMESPACE }), [t])
  const translateMenu = useCallback((key: string): string => t(key, { ns: MENU_NAMESPACE }), [t])

  const userMenuItems = useMemo(
    () => [
      {
        key: 'profile',
        icon: <User size={16} aria-hidden />,
        label: translateMenu('个人中心'),
      },
      { type: 'divider' as const },
      {
        key: 'logout',
        icon: <LogOut size={16} aria-hidden />,
        label: translateCommon('退出登录'),
        // 登出请求进行中禁止重复触发（loading 态经 setLoggingOut 维持）
        disabled: loggingOut,
      },
    ],
    [translateCommon, translateMenu, loggingOut],
  )

  const languageMenuItems = useMemo(
    () => [
      {
        key: SETTINGS_LANGUAGES.ZH_CN,
        label: translateCommon('简体中文'),
        icon: language === SETTINGS_LANGUAGES.ZH_CN ? <Check size={16} /> : undefined,
      },
      {
        key: SETTINGS_LANGUAGES.EN_US,
        label: translateCommon('English'),
        icon: language === SETTINGS_LANGUAGES.EN_US ? <Check size={16} /> : undefined,
      },
    ],
    [translateCommon, language],
  )

  const moreMenuItems = useMemo(
    () => [
      { key: 'more:fullscreen', label: translateCommon('全屏'), onClick: toggleFullscreen },
      { type: 'divider' as const },
      ...buildThemeQuickItems(translateCommon, themeMode).map((item) => ({
        ...item,
        onClick: () => dispatch(settingsChanged({ themeMode: themeModeFromKey(item.key) })),
      })),
      { type: 'divider' as const },
      {
        key: `more:lang:${SETTINGS_LANGUAGES.ZH_CN}`,
        label: translateCommon('简体中文'),
        onClick: () => void handleLanguageChange(SETTINGS_LANGUAGES.ZH_CN),
      },
      {
        key: `more:lang:${SETTINGS_LANGUAGES.EN_US}`,
        label: translateCommon('English'),
        onClick: () => void handleLanguageChange(SETTINGS_LANGUAGES.EN_US),
      },
    ],
    [translateCommon, themeMode, toggleFullscreen, handleLanguageChange, dispatch],
  )

  const themeTriggerIcon =
    themeMode === SETTINGS_THEME_MODES.DARK ? (
      <Moon size={16} />
    ) : themeMode === SETTINGS_THEME_MODES.LIGHT ? (
      <Sun size={16} />
    ) : (
      <Monitor size={16} />
    )

  return (
    <header className={styles.header}>
      {trigger !== null && (
        <Button type="text" className={styles.iconButton} aria-label={trigger.label} onClick={trigger.onClick}>
          <trigger.icon size={16} />
        </Button>
      )}
      {breadcrumbEnabled && <Breadcrumb items={navItems} />}
      {/* 全局进度条（规格 §7.4-8）：fixed 定位，随顶栏挂载 */}
      <GlobalProgress />
      <div className={styles.actions}>
        {isMobile ? (
          <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
            <Button type="text" className={styles.iconButton} aria-label={translateCommon('更多')}>
              <MoreHorizontal size={16} />
            </Button>
          </Dropdown>
        ) : (
          <>
            <Button
              type="text"
              className={styles.iconButton}
              aria-label={fullscreen ? translateCommon('退出全屏') : translateCommon('全屏')}
              onClick={toggleFullscreen}
            >
              {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </Button>
            <Dropdown
              menu={{
                items: languageMenuItems,
                onClick: ({ key }) => void handleLanguageChange(key as SettingsLanguage),
              }}
              trigger={['click']}
            >
              <Button type="text" className={styles.iconButton} aria-label={translateCommon('切换语言')}>
                <Languages size={16} />
              </Button>
            </Dropdown>
            <Dropdown
              menu={{
                items: buildThemeQuickItems(translateCommon, themeMode),
                onClick: ({ key }) => dispatch(settingsChanged({ themeMode: themeModeFromKey(key) })),
              }}
              trigger={['click']}
            >
              <Button type="text" className={styles.iconButton} aria-label={translateCommon('切换主题')}>
                {themeTriggerIcon}
              </Button>
            </Dropdown>
          </>
        )}
        <Dropdown
          menu={{
            items: userMenuItems,
            onClick: ({ key }) => {
              if (key === 'profile') {
                navigate(ROUTE_PATHS.PROFILE)
                return
              }
              handleLogout()
            },
          }}
          trigger={['click']}
        >
          <Button type="text" className={styles.userTrigger} aria-label={translateCommon('用户菜单')}>
            <Avatar size={26} className={styles.avatar}>
              {(displayName ?? '').charAt(0)}
            </Avatar>
            <span className={styles.userName}>{displayName}</span>
          </Button>
        </Dropdown>
        <Button type="text" className={styles.iconButton} aria-label={translateCommon('打开界面设置')} onClick={onOpenSettings}>
          <Settings size={16} />
        </Button>
      </div>
    </header>
  )
}
