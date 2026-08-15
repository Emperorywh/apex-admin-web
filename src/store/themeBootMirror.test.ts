import { afterEach, describe, expect, it, vi } from 'vitest'
import { SETTINGS_THEME_MODES, initialSettingsState, type SettingsState } from '@/store/slices/settings.slice'
import {
  buildThemeBootMirror,
  readThemeBootMirror,
  resolveThemeMode,
  writeThemeBootMirror,
} from '@/store/themeBootMirror'

function settingsWith(overrides: Partial<SettingsState>): SettingsState {
  return { ...initialSettingsState, ...overrides }
}

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('resolveThemeMode 主题解析', () => {
  it('亮/暗原样返回', () => {
    expect(resolveThemeMode(SETTINGS_THEME_MODES.LIGHT)).toBe('light')
    expect(resolveThemeMode(SETTINGS_THEME_MODES.DARK)).toBe('dark')
  })

  it('跟随系统时按 prefers-color-scheme 解析：dark 命中返回暗色', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
    )
    expect(resolveThemeMode(SETTINGS_THEME_MODES.SYSTEM)).toBe('dark')
  })

  it('跟随系统且系统为亮色或 matchMedia 不可用时返回亮色', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    )
    expect(resolveThemeMode(SETTINGS_THEME_MODES.SYSTEM)).toBe('light')

    vi.stubGlobal('matchMedia', undefined)
    expect(resolveThemeMode(SETTINGS_THEME_MODES.SYSTEM)).toBe('light')
  })
})

describe('主题启动镜像读写', () => {
  it('buildThemeBootMirror 产出最小只读字段 mode/resolvedMode', () => {
    expect(buildThemeBootMirror(settingsWith({ themeMode: SETTINGS_THEME_MODES.DARK }))).toEqual({
      mode: 'dark',
      resolvedMode: 'dark',
    })
  })

  it('write 后 read 读回一致内容（读写往返）', () => {
    writeThemeBootMirror(settingsWith({ themeMode: SETTINGS_THEME_MODES.DARK }))
    expect(readThemeBootMirror()).toEqual({ mode: 'dark', resolvedMode: 'dark' })

    writeThemeBootMirror(settingsWith({ themeMode: SETTINGS_THEME_MODES.SYSTEM, colorPrimary: '#13c2c2' }))
    expect(readThemeBootMirror()).toEqual({ mode: 'system', resolvedMode: 'light' })
  })

  it('未写入时 read 返回 null', () => {
    expect(readThemeBootMirror()).toBeNull()
  })

  it('镜像损坏（非法 JSON / 非法字段取值）时 read 返回 null', () => {
    window.localStorage.setItem('apex_boot_theme', '{oops')
    expect(readThemeBootMirror()).toBeNull()

    window.localStorage.setItem('apex_boot_theme', JSON.stringify({ mode: 'pink', resolvedMode: 'dark' }))
    expect(readThemeBootMirror()).toBeNull()

    window.localStorage.setItem('apex_boot_theme', JSON.stringify({ mode: 'dark', resolvedMode: 'system' }))
    expect(readThemeBootMirror()).toBeNull()
  })

  it('localStorage 不可用时写入静默失败、不阻塞启动', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    })
    expect(() => writeThemeBootMirror(settingsWith({ themeMode: SETTINGS_THEME_MODES.DARK }))).not.toThrow()
    expect(readThemeBootMirror()).toBeNull()
  })
})
