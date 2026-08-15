/**
 * 界面设置抽屉测试（规格 §10.1/§10.2）：四分组就位、设置实时派发（无「应用」按钮）、
 * 预设色板与对比度提示、全屏开关走 app slice 且不写入 settings。
 * 设置按 §8.1 白名单持久化（Fullscreen 不持久化）由 store 层 store.test.ts/persist.test.ts 覆盖。
 */
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingDrawer } from '@/layouts/BasicLayout/components/SettingDrawer/SettingDrawer'
import { settingsChanged } from '@/store/slices/settings.slice'
import type { SettingsState } from '@/store/slices/settings.slice'
import { renderWithProviders } from '@/test/componentTestHelpers'

const { warningSpy } = vi.hoisted(() => ({ warningSpy: vi.fn() }))

vi.mock('@/services/feedback/uiFeedback', () => ({
  showUiWarning: warningSpy,
}))

afterEach(() => {
  warningSpy.mockClear()
})

describe('SettingDrawer 四分组就位（规格 §10.2 分组）', () => {
  it('渲染主题/布局/字体/界面元素四组与抽屉标题', async () => {
    renderWithProviders(<SettingDrawer open onClose={() => undefined} />)
    expect(await screen.findByText('界面设置')).toBeInTheDocument()
    expect(screen.getByText('主题')).toBeInTheDocument()
    expect(screen.getByText('布局')).toBeInTheDocument()
    expect(screen.getByText('字体')).toBeInTheDocument()
    expect(screen.getByText('界面元素')).toBeInTheDocument()
  })

  it('关闭状态不渲染抽屉内容', () => {
    renderWithProviders(<SettingDrawer open={false} onClose={() => undefined} />)
    expect(screen.queryByText('界面设置')).not.toBeInTheDocument()
  })
})

describe('SettingDrawer 设置实时派发（规格 §10.2，无「应用」按钮）', () => {
  it('主题模式切换立即写入 settings', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<SettingDrawer open onClose={() => undefined} />)
    await user.click(await screen.findByRole('radio', { name: '深色' }))
    expect(store.getState().settings.themeMode).toBe('dark')
  })

  it('点击预设色板立即写入 colorPrimary', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<SettingDrawer open onClose={() => undefined} />)
    await user.click(await screen.findByRole('button', { name: '翡翠绿' }))
    expect(store.getState().settings.colorPrimary).toBe('#389e0d')
  })

  it('布局、字体族、字号切换立即写入 settings', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<SettingDrawer open onClose={() => undefined} />)
    await screen.findByRole('radio', { name: '顶部布局' })
    await user.click(screen.getByRole('radio', { name: '顶部布局' }))
    await user.click(screen.getByRole('radio', { name: '等宽' }))
    await user.click(screen.getByRole('radio', { name: '大' }))
    expect(store.getState().settings.layout).toBe('top')
    expect(store.getState().settings.fontFamily).toBe('mono')
    expect(store.getState().settings.fontSize).toBe('large')
  })

  it('面包屑开关切换写入 breadcrumbEnabled', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<SettingDrawer open onClose={() => undefined} />)
    await user.click(await screen.findByRole('switch', { name: '面包屑' }))
    expect(store.getState().settings.breadcrumbEnabled).toBe(false)
  })
})

describe('SettingDrawer 主题色对比度提示（规格 §11.3）', () => {
  it('低对比自定义主题色展示可读性警告，预设色不展示', async () => {
    const { store } = renderWithProviders(<SettingDrawer open onClose={() => undefined} />)
    await screen.findByText('界面设置')
    // 初始为预设默认色：无警告
    expect(screen.queryByText('当前主题色对比度较低，可能影响可读性')).not.toBeInTheDocument()

    act(() => {
      store.dispatch(settingsChanged({ colorPrimary: '#ffff00' }))
    })
    expect(await screen.findByText('当前主题色对比度较低，可能影响可读性')).toBeInTheDocument()
  })
})

describe('SettingDrawer 全屏开关（瞬时状态，规格 §10.1/§17.18）', () => {
  it('Fullscreen API 不可用时提示且不写入 settings，app 全屏状态保持 false', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<SettingDrawer open onClose={() => undefined} />)
    const fullscreenSwitch = await screen.findByRole('switch', { name: '全屏' })
    const settingsBefore: SettingsState = { ...store.getState().settings }

    await user.click(fullscreenSwitch)
    expect(warningSpy).toHaveBeenCalledTimes(1)
    expect(store.getState().app.fullscreen).toBe(false)
    expect(store.getState().settings).toEqual(settingsBefore)
  })
})
