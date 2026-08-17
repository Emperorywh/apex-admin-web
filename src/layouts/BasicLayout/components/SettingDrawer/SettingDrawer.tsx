/**
 * 界面设置抽屉（规格 §10.1/§10.2；视觉 SPEC_UI2 §6.5 slash 化四要素）：
 * - 布局缩略图预览：侧边/顶部选项改为迷你线框缩略图卡片，选中态主色描边 + 浅底；
 * - 纵向色条选择器：8 色预设改为纵向圆角色条列表，选中横向拉宽 + 白色对勾
 *   （纯 CSS 宽度过渡）；自定义取色器与低对比度警告保留（规格 §10.1/§11.3）；
 * - 毛玻璃 + 光斑背景：抽屉 backdrop-filter blur + 右上/左下两张模糊光斑装饰
 *   （复用 slash-admin PNG 资产，暗色主题光斑透明度单独调）；
 * - 主题模式图标卡片：亮/暗/跟随系统改为三张图标卡片分段选择。
 * 分组保留「主题 / 布局 / 界面元素」；全部设置项与即时生效不变（无「应用」按钮），
 * 变更即 dispatch settingsChanged，经 ThemeProvider 实时组装生效。
 */
import { ColorPicker, Drawer, Switch } from 'antd'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { THEME_PRESET_COLORS, isReadablePrimaryColor } from '@/config/theme'
import { SETTING_DRAWER_WIDTH_PX } from '@/constants/app.constants'
import { useFullscreen } from '@/hooks/useFullscreen'
import cyanBlurPng from '@/assets/images/cyan-blur.png'
import redBlurPng from '@/assets/images/red-blur.png'
import {
  SETTINGS_LAYOUTS,
  SETTINGS_THEME_MODES,
  settingsChanged,
  type SettingsLayout,
  type SettingsThemeMode,
} from '@/store/slices/settings.slice'
import type { RootState } from '@/store/store'
import styles from './SettingDrawer.module.css'

export interface SettingDrawerProps {
  /** 抽屉开合：由 BasicLayout 状态控制，Header 设置入口触发 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
}

/** 主题模式图标卡片条目（SPEC_UI2 §6.5）：图标 + 文案的静态描述 */
const THEME_MODE_CARDS: ReadonlyArray<{ mode: SettingsThemeMode; labelKey: string; icon: ReactNode }> = [
  { mode: SETTINGS_THEME_MODES.LIGHT, labelKey: '浅色', icon: <Sun size={18} aria-hidden /> },
  { mode: SETTINGS_THEME_MODES.DARK, labelKey: '深色', icon: <Moon size={18} aria-hidden /> },
  { mode: SETTINGS_THEME_MODES.SYSTEM, labelKey: '跟随系统', icon: <Monitor size={18} aria-hidden /> },
]

/** 布局缩略图条目：mini 线框由 CSS 绘制（见 .thumbSide/.thumbTop） */
const LAYOUT_CARDS: ReadonlyArray<{ layout: SettingsLayout; labelKey: string; thumb: 'side' | 'top' }> = [
  { layout: SETTINGS_LAYOUTS.SIDE, labelKey: '侧边布局', thumb: 'side' },
  { layout: SETTINGS_LAYOUTS.TOP, labelKey: '顶部布局', thumb: 'top' },
]

export function SettingDrawer({ open, onClose }: SettingDrawerProps) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const settings = useSelector((state: RootState) => state.settings)
  const { fullscreen, toggle: toggleFullscreen } = useFullscreen()

  return (
    <Drawer
      title={t('界面设置')}
      placement="right"
      width={SETTING_DRAWER_WIDTH_PX}
      open={open}
      onClose={onClose}
      classNames={{ content: styles.drawerContent, header: styles.drawerHeader, body: styles.drawerBody }}
    >
      {/* 毛玻璃光斑装饰（SPEC_UI2 §6.5）：右上 cyan / 左下 red（PNG 资产经内联注入），
          暗色透明度单独调（CSS） */}
      <span className={`${styles.spot} ${styles.spotCyan}`} style={{ backgroundImage: `url(${cyanBlurPng})` }} aria-hidden />
      <span className={`${styles.spot} ${styles.spotRed}`} style={{ backgroundImage: `url(${redBlurPng})` }} aria-hidden />

      {/* ── 主题：模式图标卡片 + 纵向色条 + 自定义取色（规格 §10.2 分组） ── */}
      <section className={styles.settingGroup}>
        <h4 className={styles.groupTitle}>{t('主题')}</h4>
        <div className={styles.modeCards} role="radiogroup" aria-label={t('主题模式')}>
          {THEME_MODE_CARDS.map(({ mode, labelKey, icon }) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={settings.themeMode === mode}
              className={styles.modeCard}
              data-selected={settings.themeMode === mode}
              onClick={() => dispatch(settingsChanged({ themeMode: mode }))}
            >
              <span className={styles.modeCardIcon}>{icon}</span>
              <span className={styles.modeCardLabel}>{t(labelKey)}</span>
            </button>
          ))}
        </div>
        <div className={styles.settingRow}>
          <span className={styles.rowLabel}>{t('主题色')}</span>
          {/* 纵向圆角色条选择器（slash 签名）：选中横向拉宽 + 白色对勾，纯 CSS 宽度过渡；
           * 预设色值经内联 style 注入（来自 config/theme.ts），本组件不出现色值字面量 */}
          <div className={styles.presetBars} role="radiogroup" aria-label={t('主题色')}>
            {THEME_PRESET_COLORS.map((preset) => {
              const selected = settings.colorPrimary.toLowerCase() === preset.color.toLowerCase()
              return (
                <button
                  key={preset.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={styles.presetBar}
                  data-selected={selected}
                  style={{ backgroundColor: preset.color }}
                  aria-label={t(preset.labelKey)}
                  title={t(preset.labelKey)}
                  onClick={() => dispatch(settingsChanged({ colorPrimary: preset.color }))}
                >
                  {selected && <Check size={14} aria-hidden className={styles.presetCheck} />}
                </button>
              )
            })}
          </div>
        </div>
        <div className={styles.settingRow}>
          <span className={styles.rowLabel}>{t('自定义颜色')}</span>
          {/* 自定义取色：仅十六进制（禁用透明通道），持久化即色值合法落点（规格 §10.2） */}
          <ColorPicker
            value={settings.colorPrimary}
            format="hex"
            disabledAlpha
            onChangeComplete={(color) => {
              const hex = color.toHexString()
              if (hex !== settings.colorPrimary) {
                dispatch(settingsChanged({ colorPrimary: hex }))
              }
            }}
          />
        </div>
        {/* 主题色对比度可读性校验（规格 §11.3）：低对比仅提示，不阻止取色 */}
        {!isReadablePrimaryColor(settings.colorPrimary) && (
          <p className={styles.contrastWarning}>{t('当前主题色对比度较低，可能影响可读性')}</p>
        )}
      </section>

      {/* ── 布局：缩略图卡片（BasicLayout 经 settings.layout 热切换消费） ── */}
      <section className={styles.settingGroup}>
        <h4 className={styles.groupTitle}>{t('布局')}</h4>
        <div className={styles.layoutCards} role="radiogroup" aria-label={t('布局')}>
          {LAYOUT_CARDS.map(({ layout, labelKey, thumb }) => (
            <button
              key={layout}
              type="button"
              role="radio"
              aria-checked={settings.layout === layout}
              className={styles.layoutCard}
              data-selected={settings.layout === layout}
              onClick={() => dispatch(settingsChanged({ layout }))}
            >
              <span className={thumb === 'side' ? styles.thumbSide : styles.thumbTop} aria-hidden>
                <span className={styles.thumbNav} />
                <span className={styles.thumbMain}>
                  <span className={styles.thumbBar} />
                  <span className={styles.thumbBody} />
                </span>
              </span>
              <span className={styles.layoutCardLabel}>{t(labelKey)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── 界面元素：面包屑开关 + 全屏瞬时开关（规格 §10.2 分组） ── */}
      <section className={styles.settingGroup}>
        <h4 className={styles.groupTitle}>{t('界面元素')}</h4>
        <div className={`${styles.settingRow} ${styles.settingRowInline}`}>
          <span className={styles.rowLabel}>{t('面包屑')}</span>
          <Switch
            aria-label={t('面包屑')}
            checked={settings.breadcrumbEnabled}
            onChange={(checked) => dispatch(settingsChanged({ breadcrumbEnabled: checked }))}
          />
        </div>
        <div className={`${styles.settingRow} ${styles.settingRowInline}`}>
          <span className={styles.rowLabel}>{t('全屏')}</span>
          {/* 全屏走 app slice（useFullscreen），不写入 settings、不持久化（规格 §10.1） */}
          <Switch aria-label={t('全屏')} checked={fullscreen} onChange={toggleFullscreen} />
        </div>
      </section>
    </Drawer>
  )
}
