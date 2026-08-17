/**
 * 主题配置集中地测试（规格 §10.1/§10.2/§11.3）：
 * 预设色板、对比度校验、字体族/字号映射、antd theme 组装、文档属性同步与系统配色监听。
 */
import { theme } from 'antd'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_COLOR_PRIMARY,
  PRIMARY_COLOR_MIN_CONTRAST_RATIO,
  THEME_FONT_FAMILY_STACKS,
  THEME_FONT_SIZE_PX,
  THEME_PRESET_COLORS,
  applyThemeToDocument,
  buildAntdThemeConfig,
  contrastRatio,
  getPrimaryContrastRatio,
  getPrimarySolidTextColor,
  isHexColor,
  isReadablePrimaryColor,
  readSystemPrefersDark,
  relativeLuminance,
  resolveRuntimeThemeMode,
  subscribeSystemPrefersDark,
} from './theme'

/** 测试用可控 matchMedia 桩：记录监听器并支持手动触发 change */
interface ControllableMedia {
  matches: boolean
  listeners: Set<() => void>
}

/** setup.ts 安装的无操作 matchMedia 桩：每个用例后恢复，避免污染其他测试 */
const setupMediaStub = window.matchMedia

function installMatchMedia(initial: ControllableMedia): void {
  const stub = (query: string) => ({
    matches: initial.matches,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => {
      initial.listeners.add(listener)
    },
    removeEventListener: (_type: string, listener: () => void) => {
      initial.listeners.delete(listener)
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })
  window.matchMedia = stub as unknown as typeof window.matchMedia
}

afterEach(() => {
  window.matchMedia = setupMediaStub
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.colorScheme = ''
  document.documentElement.style.backgroundColor = ''
  document.documentElement.style.fontSize = ''
  document.body.style.backgroundColor = ''
  document.body.style.color = ''
  document.body.style.removeProperty('--app-font-family')
})

describe('预设主题色板（规格 §10.1 至少 6 个 + 自定义取色；SPEC-UI §4.4 现代色板）', () => {
  it('至少 6 个预设，key 与色值各自唯一且均为合法六位十六进制', () => {
    expect(THEME_PRESET_COLORS.length).toBeGreaterThanOrEqual(6)
    expect(new Set(THEME_PRESET_COLORS.map((preset) => preset.key)).size).toBe(THEME_PRESET_COLORS.length)
    expect(new Set(THEME_PRESET_COLORS.map((preset) => preset.color)).size).toBe(THEME_PRESET_COLORS.length)
    for (const preset of THEME_PRESET_COLORS) {
      expect(isHexColor(preset.color)).toBe(true)
    }
  })

  it('SPEC-UI §4.4 现代色板落盘：8 色 key/色值固定，靛蓝为新默认', () => {
    expect(THEME_PRESET_COLORS.map((preset) => [preset.key, preset.color])).toEqual([
      ['indigo', '#4f46e5'],
      ['azure', '#1677ff'],
      ['emerald', '#059669'],
      ['violet', '#7c3aed'],
      ['sunset', '#ea580c'],
      ['crimson', '#dc2626'],
      ['teal', '#0d9488'],
      ['magenta', '#db2777'],
    ])
    expect(DEFAULT_COLOR_PRIMARY).toBe('#4f46e5')
  })

  it('默认主题色为色板首项', () => {
    expect(DEFAULT_COLOR_PRIMARY).toBe(THEME_PRESET_COLORS[0].color)
  })

  it('每个预设主题色都通过对比度可读性校验（规格 §11.3）', () => {
    for (const preset of THEME_PRESET_COLORS) {
      expect(isReadablePrimaryColor(preset.color)).toBe(true)
    }
  })
})

describe('对比度校验（WCAG 2.1 相对亮度，规格 §11.3）', () => {
  it('相对亮度与对比度基准值正确（含三位缩写归一）', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 6)
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 6)
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 6)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 6)
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 6)
  })

  it('实心文字基准色取 antd colorTextLightSolid；低对比主题色判定不可读', () => {
    expect(getPrimarySolidTextColor()).toBe(theme.getDesignToken().colorTextLightSolid)
    // 亮黄与白字对比度约 1.07，远低于 3:1 阈值
    expect(getPrimaryContrastRatio('#ffff00')).toBeLessThan(PRIMARY_COLOR_MIN_CONTRAST_RATIO)
    expect(isReadablePrimaryColor('#ffff00')).toBe(false)
    expect(PRIMARY_COLOR_MIN_CONTRAST_RATIO).toBeGreaterThanOrEqual(3)
  })

  it('isHexColor 只接受六位十六进制', () => {
    expect(isHexColor('#1677ff')).toBe(true)
    expect(isHexColor('#ABC123')).toBe(true)
    expect(isHexColor('1677ff')).toBe(false)
    expect(isHexColor('#1677f')).toBe(false)
    expect(isHexColor('#1677fff')).toBe(false)
    expect(isHexColor('red')).toBe(false)
  })
})

describe('字体族与字号映射（规格 §10.1）', () => {
  it('字体族四档（系统默认/无衬线/衬线/等宽）栈互不相同且非空', () => {
    const stacks = Object.values(THEME_FONT_FAMILY_STACKS)
    expect(Object.keys(THEME_FONT_FAMILY_STACKS).sort()).toEqual(['mono', 'sans', 'serif', 'system'])
    expect(new Set(stacks).size).toBe(stacks.length)
    for (const stack of stacks) {
      expect(stack.length).toBeGreaterThan(0)
    }
  })

  it('字号三档对应 14/16/18（rem 基准 + antd fontSize 同值）', () => {
    expect(THEME_FONT_SIZE_PX).toEqual({ small: 14, medium: 16, large: 18 })
  })
})

describe('buildAntdThemeConfig 由设置实时组装（规格 §10.2）', () => {
  const baseSettings = { colorPrimary: DEFAULT_COLOR_PRIMARY, fontSize: 'medium' as const, fontFamily: 'serif' as const }

  it('亮色使用 defaultAlgorithm，暗色使用 darkAlgorithm；token 携带主题色/字号/字体族', () => {
    const light = buildAntdThemeConfig(baseSettings, 'light')
    const dark = buildAntdThemeConfig(baseSettings, 'dark')
    expect(light.algorithm).toBe(theme.defaultAlgorithm)
    expect(dark.algorithm).toBe(theme.darkAlgorithm)
    for (const config of [light, dark]) {
      expect(config.token?.colorPrimary).toBe(baseSettings.colorPrimary)
      expect(config.token?.fontSize).toBe(THEME_FONT_SIZE_PX.medium)
      expect(config.token?.fontFamily).toBe(THEME_FONT_FAMILY_STACKS.serif)
    }
  })

  it('视觉令牌基线（SPEC-UI §4.1/§4.2）：小圆角 + 菜单/表格/卡片组件覆盖', () => {
    const config = buildAntdThemeConfig(baseSettings, 'light')
    expect(config.token?.borderRadius).toBe(6)
    // 菜单：透明底色透出侧边栏中性灰、圆角 6、紧凑行高、主题色浅底选中
    const menu = config.components?.Menu
    expect(menu?.itemBg).toBe('transparent')
    expect(menu?.subMenuItemBg).toBe('transparent')
    expect(menu?.itemBorderRadius).toBe(6)
    expect(menu?.itemHeight).toBe(38)
    expect(menu?.activeBarBorderWidth).toBe(2)
    // 表格：表头去灰底、行高紧凑
    const table = config.components?.Table
    expect(table?.cellPaddingBlock).toBe(12)
  })

  it('组件覆盖从当前算法派生：亮/暗各自取值（菜单选中浅底与表头底色随模式分化）', () => {
    const light = buildAntdThemeConfig(baseSettings, 'light')
    const dark = buildAntdThemeConfig(baseSettings, 'dark')
    const lightDerived = theme.getDesignToken({ algorithm: theme.defaultAlgorithm, token: { colorPrimary: baseSettings.colorPrimary } })
    const darkDerived = theme.getDesignToken({ algorithm: theme.darkAlgorithm, token: { colorPrimary: baseSettings.colorPrimary } })
    expect(light.components?.Menu?.itemSelectedBg).toBe(lightDerived.colorPrimaryBg)
    expect(dark.components?.Menu?.itemSelectedBg).toBe(darkDerived.colorPrimaryBg)
    expect(light.components?.Table?.headerBg).toBe(lightDerived.colorBgContainer)
    expect(dark.components?.Table?.headerBg).toBe(darkDerived.colorBgContainer)
    // 亮/暗派生值确实不同（双主题独立成立，非简单同值）
    expect(light.components?.Table?.headerBg).not.toBe(dark.components?.Table?.headerBg)
  })
})

/** jsdom 会把内联色值重新序列化为 rgb()/rgba() 形式，经一次性元素归一后再比较 */
function normalizeCssColor(property: 'backgroundColor' | 'color', value: string): string {
  const probe = document.createElement('div')
  probe.style[property] = value
  return probe.style[property]
}

describe('applyThemeToDocument 文档属性同步（规格 §10.2/§8.3）', () => {
  it('按解析后模式设置 data-theme 与 color-scheme，背景/文字/rem 基准/字体变量取自当前 token', () => {
    const darkSettings = { colorPrimary: DEFAULT_COLOR_PRIMARY, fontSize: 'large' as const, fontFamily: 'mono' as const }
    applyThemeToDocument(darkSettings, 'dark')
    const root = document.documentElement
    expect(root.getAttribute('data-theme')).toBe('dark')
    expect(root.style.colorScheme).toBe('dark')
    // 背景色与 antd 暗色 colorBgLayout 一致（与 index.html 启动镜像取值相同）
    const darkTokens = theme.getDesignToken(buildAntdThemeConfig(darkSettings, 'dark'))
    expect(root.style.backgroundColor).toBe(normalizeCssColor('backgroundColor', darkTokens.colorBgLayout))
    expect(document.body.style.backgroundColor).toBe(normalizeCssColor('backgroundColor', darkTokens.colorBgLayout))
    expect(document.body.style.color).toBe(normalizeCssColor('color', darkTokens.colorText))
    // rem 基准与 antd fontSize 同值（large=18px）
    expect(root.style.fontSize).toBe('18px')
    // 字体族经 body CSS 变量消费（规格 §10.1）
    expect(document.body.style.getPropertyValue('--app-font-family')).toBe(THEME_FONT_FAMILY_STACKS.mono)
  })

  it('亮色模式写入 light 属性，背景色与亮色 colorBgLayout 一致，rem 基准随小号档位', () => {
    const lightSettings = { colorPrimary: DEFAULT_COLOR_PRIMARY, fontSize: 'small' as const, fontFamily: 'system' as const }
    applyThemeToDocument(lightSettings, 'light')
    const lightTokens = theme.getDesignToken(buildAntdThemeConfig(lightSettings, 'light'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.style.backgroundColor).toBe(
      normalizeCssColor('backgroundColor', lightTokens.colorBgLayout),
    )
    expect(document.documentElement.style.fontSize).toBe('14px')
  })
})

describe('系统配色读取与订阅（规格 §10.2/§17.15）', () => {
  it('matchMedia 不可用时读取为亮色、订阅为无操作', () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia
    expect(readSystemPrefersDark()).toBe(false)
    const unsubscribe = subscribeSystemPrefersDark(() => undefined)
    expect(() => unsubscribe()).not.toThrow()
  })

  it('读取当前深色偏好；change 事件触发监听，取消订阅后不再触发', () => {
    const media: ControllableMedia = { matches: true, listeners: new Set() }
    installMatchMedia(media)
    expect(readSystemPrefersDark()).toBe(true)

    const listener = vi.fn()
    const unsubscribe = subscribeSystemPrefersDark(listener)
    expect(listener).not.toHaveBeenCalled()

    media.matches = false
    for (const registered of media.listeners) {
      registered()
    }
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    for (const registered of media.listeners) {
      registered()
    }
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('resolveRuntimeThemeMode 运行时主题解析（规格 §10.2）', () => {
  it('手动亮/暗原样返回；跟随系统按系统深色偏好归约', () => {
    expect(resolveRuntimeThemeMode('dark', false)).toBe('dark')
    expect(resolveRuntimeThemeMode('dark', true)).toBe('dark')
    expect(resolveRuntimeThemeMode('light', true)).toBe('light')
    expect(resolveRuntimeThemeMode('system', true)).toBe('dark')
    expect(resolveRuntimeThemeMode('system', false)).toBe('light')
  })
})
