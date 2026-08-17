/**
 * 主题 Provider 测试（规格 §10.2/§8.3）：
 * ConfigProvider theme 随 settings 实时组装（无「应用」按钮）、文档属性同步、
 * 跟随系统监听的启停（手动选择后停止跟随、重选跟随系统恢复，规格 §17.15）。
 */
import { act, render, screen } from '@testing-library/react'
import { Button, theme as antdTheme } from 'antd'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Provider } from 'react-redux'
import { ThemeProvider } from './ThemeProvider'
import { BASE_FONT_FAMILY, buildAntdThemeConfig } from '@/config/theme'
import { settingsChanged } from '@/store/slices/settings.slice'
import type { SettingsState } from '@/store/slices/settings.slice'
import { createComponentTestStore, type ComponentTestStore } from '@/test/componentTestHelpers'

/** 主题探针：读取 ConfigProvider 上下文 token 与 key，验证实时组装结果 */
function TokenProbe() {
  const { token } = antdTheme.useToken()
  return (
    <>
      <span data-testid="probe-color-primary">{token.colorPrimary}</span>
      <span data-testid="probe-bg-container">{token.colorBgContainer}</span>
      <Button data-testid="probe-button">probe</Button>
    </>
  )
}

/** 可控 matchMedia 桩：支持手动翻转 matches 并触发 change 监听 */
const mediaListeners = new Set<() => void>()
let mediaMatches = false

function installControllableMatchMedia(): void {
  const stub = (query: string) => ({
    matches: mediaMatches,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => {
      mediaListeners.add(listener)
    },
    removeEventListener: (_type: string, listener: () => void) => {
      mediaListeners.delete(listener)
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })
  window.matchMedia = stub as unknown as typeof window.matchMedia
}

/** 触发一次系统配色变化 */
function fireSystemPrefersChange(nextMatches: boolean): void {
  mediaMatches = nextMatches
  for (const listener of [...mediaListeners]) {
    listener()
  }
}

function renderThemeProvider(store: ComponentTestStore) {
  const view = render(
    <Provider store={store}>
      <ThemeProvider>
        <TokenProbe />
      </ThemeProvider>
    </Provider>,
  )
  return { ...view, store }
}

/** 独立 store 的 settings 快照（组件测试 store 无 persist 包装，取切片状态类型） */
function settingsOf(store: ComponentTestStore): SettingsState {
  return store.getState().settings
}

const setupMediaStub = window.matchMedia

beforeEach(() => {
  installControllableMatchMedia()
})

afterEach(() => {
  window.matchMedia = setupMediaStub
  mediaListeners.clear()
  mediaMatches = false
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.colorScheme = ''
  document.documentElement.style.backgroundColor = ''
  document.documentElement.style.fontSize = ''
  document.body.style.backgroundColor = ''
  document.body.style.color = ''
  document.body.style.removeProperty('--app-font-family')
})

describe('ThemeProvider 实时组装（规格 §10.2，无「应用」按钮）', () => {
  it('默认设置（跟随系统、系统亮色）解析为亮色：algorithm/token 与文档属性均为亮色口径', async () => {
    const { store } = renderThemeProvider(createComponentTestStore())
    await screen.findByTestId('probe-button')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(screen.getByTestId('probe-color-primary')).toHaveTextContent(settingsOf(store).colorPrimary)
  })

  it('dispatch 切换深色后立即以暗色 algorithm 重组 token 并同步文档属性（无应用按钮）', async () => {
    const store = createComponentTestStore()
    const { store: renderedStore } = renderThemeProvider(store)
    await screen.findByTestId('probe-button')
    expect(screen.getByTestId('probe-bg-container')).toHaveTextContent('#ffffff')

    act(() => {
      renderedStore.dispatch(settingsChanged({ themeMode: 'dark' }))
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    // antd 暗色算法下容器底色为深色
    expect(screen.getByTestId('probe-bg-container')).toHaveTextContent('#141414')

    act(() => {
      renderedStore.dispatch(settingsChanged({ colorPrimary: '#389e0d' }))
    })
    // useToken 返回算法加工后的 map token，与 getDesignToken 同口径比较
    const darkTokens = antdTheme.getDesignToken(buildAntdThemeConfig(settingsOf(renderedStore), 'dark'))
    expect(screen.getByTestId('probe-color-primary')).toHaveTextContent(darkTokens.colorPrimary)
    // rem 基准为固定基准字号（16px，规格 §10.1），不随设置变化
    expect(document.documentElement.style.fontSize).toBe('16px')
  })

  it('固定字体族经 body CSS 变量生效（规格 §10.1，字体无设置项）', async () => {
    renderThemeProvider(createComponentTestStore())
    await screen.findByTestId('probe-button')
    expect(document.body.style.getPropertyValue('--app-font-family')).toBe(BASE_FONT_FAMILY)
  })
})

describe('跟随系统启停（规格 §10.2/§17.15）', () => {
  it('跟随系统时监听 prefers-color-scheme：系统切暗后解析为暗色', async () => {
    renderThemeProvider(createComponentTestStore())
    await screen.findByTestId('probe-button')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    act(() => {
      fireSystemPrefersChange(true)
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(screen.getByTestId('probe-bg-container')).toHaveTextContent('#141414')
  })

  it('手动选择深色后停止跟随：系统再变化不改变解析结果', async () => {
    const store = createComponentTestStore()
    const { store: renderedStore } = renderThemeProvider(store)
    await screen.findByTestId('probe-button')
    act(() => {
      renderedStore.dispatch(settingsChanged({ themeMode: 'dark' }))
    })
    act(() => {
      fireSystemPrefersChange(false)
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('重选「跟随系统」恢复监听：立即按当前系统偏好解析', async () => {
    const store = createComponentTestStore()
    const { store: renderedStore } = renderThemeProvider(store)
    await screen.findByTestId('probe-button')
    act(() => {
      renderedStore.dispatch(settingsChanged({ themeMode: 'light' }))
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    // 系统先变为深色（手动模式下不生效），随后重选跟随系统应立即解析为深色
    act(() => {
      fireSystemPrefersChange(true)
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    act(() => {
      renderedStore.dispatch(settingsChanged({ themeMode: 'system' }))
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})

describe('ThemeProvider 卸载与监听清理', () => {
  it('卸载后取消系统配色监听（Effect 清理完整）', async () => {
    const { unmount } = renderThemeProvider(createComponentTestStore())
    await screen.findByTestId('probe-button')
    expect(mediaListeners.size).toBeGreaterThan(0)
    unmount()
    expect(mediaListeners.size).toBe(0)
  })
})
