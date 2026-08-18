/**
 * 界面设置抽屉（规格 §10.1/§10.2；视觉 SPEC_UI2 §6.5 slash 化四要素）：
 * - 布局缩略图预览：侧边/顶部布局两张迷你线框缩略图卡片，选中态主色描边 + 浅底；
 * - 纵向色条选择器：8 色预设纵向圆角色条，选中横向拉宽 + 白色对勾（slash 签名，
 *   纯 CSS 宽度过渡）；自定义取色器与低对比度警告保留（规格 §10.1/§11.3）；
 * - 毛玻璃 + 光斑背景：抽屉背景 backdrop-filter blur(20px) + 右上/左下两张模糊
 *   光斑装饰（slash-admin 资产，MIT，见 src/assets/NOTICE.md），暗色光斑透明度单独调；
 * - 主题模式图标卡片：亮/暗/跟随系统三张图标卡片分段选择。
 * 所有设置项变更即 dispatch settingsChanged，经 ThemeProvider 实时组装生效，
 * 无「应用」按钮；自定义取色经 ColorPicker 以六位十六进制持久化（规格 §10.2）。
 * 全屏是瞬时状态：走 useFullscreen（app slice），不写入 settings、不持久化。
 */
import { ColorPicker, Drawer, Switch } from 'antd'
import { Check, LayoutPanelLeft, LayoutPanelTop, Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import cyanBlurUrl from '@/assets/images/cyan-blur.png'
import redBlurUrl from '@/assets/images/red-blur.png'
import { THEME_PRESET_COLORS, isReadablePrimaryColor } from '@/config/theme'
import { useFullscreen } from '@/hooks/useFullscreen'
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

/** 抽屉宽度，单位 px（SPEC_UI2 §6.5：320 → 360 实测定稿） */
const SETTING_DRAWER_WIDTH = 360

/** 主题模式图标卡片分段项（SPEC_UI2 §6.5）：图标 + 文案 key */
const THEME_MODE_CARDS: ReadonlyArray<{
  mode: SettingsThemeMode
  labelKey: string
  icon: typeof Sun
}> = [
  { mode: SETTINGS_THEME_MODES.LIGHT, labelKey: '浅色', icon: Sun },
  { mode: SETTINGS_THEME_MODES.DARK, labelKey: '深色', icon: Moon },
  { mode: SETTINGS_THEME_MODES.SYSTEM, labelKey: '跟随系统', icon: Monitor },
]

/** 布局缩略图分段项：缩略图线框经 CSS 伪元素网格绘制，选中态主色描边 */
const LAYOUT_CARDS: ReadonlyArray<{
  layout: SettingsLayout
  labelKey: string
  icon: typeof LayoutPanelLeft
}> = [
  { layout: SETTINGS_LAYOUTS.SIDE, labelKey: '侧边布局', icon: LayoutPanelLeft },
  { layout: SETTINGS_LAYOUTS.TOP, labelKey: '顶部布局', icon: LayoutPanelTop },
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
      width={SETTING_DRAWER_WIDTH}
      open={open}
      onClose={onClose}
      classNames={{ content: styles.drawerContent, body: styles.drawerBody }}
    >
      {/* 毛玻璃光斑装饰（SPEC_UI2 §6.5）：右上 cyan / 左下 red，暗色透明度单独调 */}
      <img src={cyanBlurUrl} alt="" aria-hidden className={`${styles.blob} ${styles.blobCyan}`} />
      <img src={redBlurUrl} alt="" aria-hidden className={`${styles.blob} ${styles.blobRed}`} />

      {/* ── 主题：模式图标卡片 + 纵向色条 + 自定义取色（规格 §10.2 分组） ── */}
      <section className={styles.settingGroup}>
        <h4 className={styles.groupTitle}>{t('主题')}</h4>
        <div className={styles.settingRow}>
          <span className={styles.rowLabel}>{t('主题模式')}</span>
          <div className={styles.modeCardList} role="radiogroup" aria-label={t('主题模式')}>
            {THEME_MODE_CARDS.map(({ mode, labelKey, icon: ModeIcon }) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={settings.themeMode === mode}
                className={styles.modeCard}
                data-active={settings.themeMode === mode}
                onClick={() => dispatch(settingsChanged({ themeMode: mode }))}
              >
                <ModeIcon size={18} aria-hidden />
                <span className={styles.modeCardLabel}>{t(labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.settingRow}>
          <span className={styles.rowLabel}>{t('主题色')}</span>
          {/* 纵向色条选择器（SPEC_UI2 §6.5）：色值来自 config/theme.ts，本组件不出现色值字面量 */}
          <div className={styles.presetBarList} role="radiogroup" aria-label={t('主题色')}>
            {THEME_PRESET_COLORS.map((preset) => {
              const active = settings.colorPrimary.toLowerCase() === preset.color.toLowerCase()
              return (
                <button
                  key={preset.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={styles.presetBar}
                  data-active={active}
                  style={{ backgroundColor: preset.color }}
                  aria-label={t(preset.labelKey)}
                  title={t(preset.labelKey)}
                  onClick={() => dispatch(settingsChanged({ colorPrimary: preset.color }))}
                >
                  {active && <Check size={14} aria-hidden className={styles.presetBarCheck} />}
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

      {/* ── 布局：缩略图预览卡片（BasicLayout 经 settings.layout 热切换消费） ── */}
      <section className={styles.settingGroup}>
        <h4 className={styles.groupTitle}>{t('布局')}</h4>
        <div className={styles.layoutCardList} role="radiogroup" aria-label={t('布局')}>
          {LAYOUT_CARDS.map(({ layout, labelKey, icon: LayoutIcon }) => (
            <button
              key={layout}
              type="button"
              role="radio"
              aria-checked={settings.layout === layout}
              className={styles.layoutCard}
              data-active={settings.layout === layout}
              onClick={() => dispatch(settingsChanged({ layout }))}
            >
              <span className={styles.layoutThumb} data-layout={layout} aria-hidden>
                <span className={styles.layoutThumbRegion} />
              </span>
              <span className={styles.layoutCardLabel}>
                <LayoutIcon size={14} aria-hidden />
                {t(labelKey)}
              </span>
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
