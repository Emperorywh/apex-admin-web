/**
 * 登录页语言切换：右上角入口，支持五语言。
 *
 * - 登录页 public + 无外壳顶栏（layout: false 语义），I01 要求登录前即可切换语言，
 *   因此独立于 BasicLayout 的 Header 语言按钮在此单独提供入口
 * - 语言名用各自语言书写（不译）：用户无需先懂当前界面语言即可识别
 * - 只派发 localeChanged：App.tsx 统一监听 settings.locale 执行 changeAppLanguage
 *   （预加载失败自动回滚原语言），本组件不直接调 i18next，避免双写语言来源
 */

import { Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/i18n/i18n'
import { localeChanged } from '@/store/slices/settingsSlice'
import styles from '@/features/auth/components/LoginLanguageSwitch/LoginLanguageSwitch.module.css'

/** 各语言自名（不进语言资源）：key 顺序即菜单展示顺序 */
const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'en-US': 'English',
  'ja-JP': '日本語',
  'ko-KR': '한국어',
}

export function LoginLanguageSwitch() {
  const { t } = useTranslation('common')
  const dispatch = useAppDispatch()
  const locale = useAppSelector((state) => state.settings.locale)

  // 菜单项由支持语言表推导，基座扩语言时此处自动跟随，不手写副本
  const menuItems: MenuProps['items'] = SUPPORTED_LANGUAGES.map((language) => ({
    key: language,
    label: LANGUAGE_LABELS[language],
  }))

  return (
    <div className={styles.wrap}>
      <Dropdown
        menu={{
          items: menuItems,
          selectable: true,
          selectedKeys: [locale],
          // 切换统一走 settings.locale 单一来源；失败回滚由 App.tsx 收敛
          onClick: ({ key }) => {
            if (key !== locale) dispatch(localeChanged(key as AppLanguage))
          },
        }}
        trigger={['click']}
        placement="bottomRight"
      >
        <button type="button" className={styles.btn} title={t('切换语言')} aria-label={t('切换语言')}>
          <Languages size={18} />
        </button>
      </Dropdown>
    </div>
  )
}
