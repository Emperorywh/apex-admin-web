/**
 * 界面设置抽屉（规格 §10.1/§10.2）：主题、布局、字体、界面元素四组。
 * 所有设置项变更即 dispatch settingsChanged，经 ThemeProvider 实时组装生效，
 * 无「应用」按钮；主题色预设取自 config/theme.ts，自定义取色经 ColorPicker
 * 以六位十六进制持久化（自定义取色持久化是色值字面量的合法落点，规格 §10.2）。
 * 全屏是瞬时状态：走 useFullscreen（app slice），不写入 settings、不持久化。
 * 本组件挂载进 Header 由 TASK-010 完成。
 */
import { ColorPicker, Drawer, Radio, Switch } from 'antd'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { THEME_PRESET_COLORS, isReadablePrimaryColor } from '@/config/theme'
import { useFullscreen } from '@/hooks/useFullscreen'
import {
  SETTINGS_FONT_FAMILIES,
  SETTINGS_FONT_SIZES,
  SETTINGS_LAYOUTS,
  SETTINGS_THEME_MODES,
  settingsChanged,
  type SettingsFontFamily,
  type SettingsFontSize,
  type SettingsLayout,
  type SettingsThemeMode,
} from '@/store/slices/settings.slice'
import type { RootState } from '@/store/store'
import styles from './SettingDrawer.module.css'

export interface SettingDrawerProps {
  /** 抽屉开合：由 Header 设置入口控制（TASK-010 接线） */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
}

export function SettingDrawer({ open, onClose }: SettingDrawerProps) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const settings = useSelector((state: RootState) => state.settings)
  const { fullscreen, toggle: toggleFullscreen } = useFullscreen()

  return (
    <Drawer title={t('界面设置')} placement="right" width={300} open={open} onClose={onClose}>
      {/* ── 主题：模式 + 主题色（规格 §10.2 分组） ── */}
      <section className={styles.settingGroup}>
        <h4 className={styles.groupTitle}>{t('主题')}</h4>
        <div className={styles.settingRow}>
          <span className={styles.rowLabel}>{t('主题模式')}</span>
          <Radio.Group
            size="small"
            value={settings.themeMode}
            onChange={(event) =>
              dispatch(settingsChanged({ themeMode: event.target.value as SettingsThemeMode }))
            }
            options={[
              { value: SETTINGS_THEME_MODES.SYSTEM, label: t('跟随系统') },
              { value: SETTINGS_THEME_MODES.LIGHT, label: t('浅色') },
              { value: SETTINGS_THEME_MODES.DARK, label: t('深色') },
            ]}
          />
        </div>
        <div className={styles.settingRow}>
          <span className={styles.rowLabel}>{t('主题色')}</span>
          {/* 预设色板：色值来自 config/theme.ts，本组件不出现色值字面量（规格 §10.2） */}
          <div className={styles.presetList}>
            {THEME_PRESET_COLORS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={`${styles.presetSwatch} ${
                  settings.colorPrimary.toLowerCase() === preset.color.toLowerCase()
                    ? styles.presetSwatchActive
                    : ''
                }`}
                style={{ backgroundColor: preset.color }}
                aria-label={t(preset.labelKey)}
                title={t(preset.labelKey)}
                onClick={() => dispatch(settingsChanged({ colorPrimary: preset.color }))}
              />
            ))}
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

      {/* ── 布局：侧边 / 顶部（BasicLayout 热切换由 TASK-010 消费） ── */}
      <section className={styles.settingGroup}>
        <h4 className={styles.groupTitle}>{t('布局')}</h4>
        <Radio.Group
          value={settings.layout}
          onChange={(event) => dispatch(settingsChanged({ layout: event.target.value as SettingsLayout }))}
          options={[
            { value: SETTINGS_LAYOUTS.SIDE, label: t('侧边布局') },
            { value: SETTINGS_LAYOUTS.TOP, label: t('顶部布局') },
          ]}
        />
      </section>

      {/* ── 字体：字体族 + 字号（token + body CSS 变量，规格 §10.1） ── */}
      <section className={styles.settingGroup}>
        <h4 className={styles.groupTitle}>{t('字体')}</h4>
        <div className={styles.settingRow}>
          <span className={styles.rowLabel}>{t('字体族')}</span>
          <Radio.Group
            size="small"
            value={settings.fontFamily}
            onChange={(event) =>
              dispatch(settingsChanged({ fontFamily: event.target.value as SettingsFontFamily }))
            }
            options={[
              { value: SETTINGS_FONT_FAMILIES.SYSTEM, label: t('系统默认') },
              { value: SETTINGS_FONT_FAMILIES.SANS, label: t('无衬线') },
              { value: SETTINGS_FONT_FAMILIES.SERIF, label: t('衬线') },
              { value: SETTINGS_FONT_FAMILIES.MONO, label: t('等宽') },
            ]}
          />
        </div>
        <div className={styles.settingRow}>
          <span className={styles.rowLabel}>{t('字号')}</span>
          <Radio.Group
            size="small"
            value={settings.fontSize}
            onChange={(event) =>
              dispatch(settingsChanged({ fontSize: event.target.value as SettingsFontSize }))
            }
            options={[
              { value: SETTINGS_FONT_SIZES.SMALL, label: t('小') },
              { value: SETTINGS_FONT_SIZES.MEDIUM, label: t('中') },
              { value: SETTINGS_FONT_SIZES.LARGE, label: t('大') },
            ]}
          />
        </div>
      </section>

      {/* ── 界面元素：面包屑开关 + 全屏瞬时开关（规格 §10.2 分组） ── */}
      <section className={styles.settingGroup}>
        <h4 className={styles.groupTitle}>{t('界面元素')}</h4>
        <div className={styles.settingRow}>
          <span className={styles.rowLabel}>{t('面包屑')}</span>
          <Switch
            aria-label={t('面包屑')}
            checked={settings.breadcrumbEnabled}
            onChange={(checked) => dispatch(settingsChanged({ breadcrumbEnabled: checked }))}
          />
        </div>
        <div className={styles.settingRow}>
          <span className={styles.rowLabel}>{t('全屏')}</span>
          {/* 全屏走 app slice（useFullscreen），不写入 settings、不持久化（规格 §10.1） */}
          <Switch aria-label={t('全屏')} checked={fullscreen} onChange={toggleFullscreen} />
        </div>
      </section>
    </Drawer>
  )
}
