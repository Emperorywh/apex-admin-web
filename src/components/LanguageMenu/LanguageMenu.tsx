/**
 * 语言切换菜单（G03）：五语原生写法标签，Header 与登录页共用（T016/T017）。
 * 切换统一走 settingsSlice.localeChanged，由 App.tsx 执行预加载时序——
 * 禁止直接调用 i18next.changeLanguage（language-theme 合同 §3）。
 */

import { Dropdown, type MenuProps } from 'antd'
import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { localeChanged } from '@/store/slices/settingsSlice'
import type { AppLanguage } from '@/i18n/i18n'

/** 五语菜单：标签用各语言原生写法（对齐旧系统词条风格），便于用户在陌生语言下回切 */
const LANGUAGE_ITEMS: MenuProps['items'] = [
  { key: 'zh-CN', label: '简体中文' },
  { key: 'zh-TW', label: '繁體中文' },
  { key: 'en-US', label: 'English' },
  { key: 'ja-JP', label: '日本語' },
  { key: 'ko-KR', label: '한국어' },
]

interface LanguageMenuProps {
  /** 触发按钮样式类：由消费方传入（顶栏 iconBtn / 登录页独立定位样式） */
  className?: string
  /** 图标尺寸：登录页独立入口与顶栏按钮共用同一菜单 */
  iconSize?: number
}

export function LanguageMenu({ className, iconSize = 17 }: LanguageMenuProps) {
  const { t } = useTranslation('common')
  const dispatch = useAppDispatch()
  const locale = useAppSelector((state) => state.settings.locale)

  return (
    <Dropdown
      menu={{
        items: LANGUAGE_ITEMS,
        selectable: true,
        selectedKeys: [locale],
        onClick: ({ key }) => {
          if (key !== locale) dispatch(localeChanged(key as AppLanguage))
        },
      }}
      trigger={['click']}
      placement="bottomRight"
    >
      <button type="button" className={className} title={t('切换语言')}>
        <Languages size={iconSize} />
      </button>
    </Dropdown>
  )
}
