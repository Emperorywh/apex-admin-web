/**
 * 主题启动镜像（规格 §8.3）：settings 每次变化时同步写入最小只读镜像。
 * Redux 仍是运行时单一数据源；镜像仅供 index.html 启动脚本在首帧前读取
 * mode/resolvedMode，提前设置 data-theme、color-scheme 与初始背景，避免刷新时反色闪烁。
 * Provider 启动后立即以 Redux 设置校正镜像（store 创建时写入一次，之后随 settings 变化重写）。
 */
import { THEME_BOOT_STORAGE_KEY } from '@/constants/storage.constants'
import {
  SETTINGS_THEME_MODES,
  type SettingsState,
  type SettingsThemeMode,
} from '@/store/slices/settings.slice'

/** 解析后的主题模式：跟随系统时按 prefers-color-scheme 归约为亮/暗 */
export type ResolvedThemeMode = Exclude<SettingsThemeMode, (typeof SETTINGS_THEME_MODES)['SYSTEM']>

/** 镜像内容：只读最小字段集，结构与 index.html 启动脚本约定一致 */
export interface ThemeBootMirror {
  readonly mode: SettingsThemeMode
  readonly resolvedMode: ResolvedThemeMode
}

/** 解析主题模式：亮/暗原样返回；跟随系统时读 prefers-color-scheme，matchMedia 不可用按亮色处理 */
export function resolveThemeMode(mode: SettingsThemeMode): ResolvedThemeMode {
  if (mode !== SETTINGS_THEME_MODES.SYSTEM) {
    return mode
  }
  const prefersDark =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? SETTINGS_THEME_MODES.DARK : SETTINGS_THEME_MODES.LIGHT
}

export function buildThemeBootMirror(settings: SettingsState): ThemeBootMirror {
  return { mode: settings.themeMode, resolvedMode: resolveThemeMode(settings.themeMode) }
}

/** 同步写镜像：localStorage 不可用时静默跳过（启动脚本回退默认亮色，不阻塞启动） */
export function writeThemeBootMirror(settings: SettingsState): void {
  try {
    window.localStorage.setItem(THEME_BOOT_STORAGE_KEY, JSON.stringify(buildThemeBootMirror(settings)))
  } catch {
    // 镜像是尽力而为的首帧优化，写入失败不影响启动
  }
}

/** 读取镜像：供 Provider 启动后校正与测试核对；缺失或内容非法返回 null */
export function readThemeBootMirror(): ThemeBootMirror | null {
  try {
    const raw = window.localStorage.getItem(THEME_BOOT_STORAGE_KEY)
    if (raw === null) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    if (isThemeBootMirror(parsed)) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

function isThemeBootMirror(value: unknown): value is ThemeBootMirror {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const { mode, resolvedMode } = value as Record<string, unknown>
  const themeModes: readonly string[] = Object.values(SETTINGS_THEME_MODES)
  return (
    typeof mode === 'string' &&
    themeModes.includes(mode) &&
    (resolvedMode === SETTINGS_THEME_MODES.LIGHT || resolvedMode === SETTINGS_THEME_MODES.DARK)
  )
}
