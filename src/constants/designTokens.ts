/**
 * antd 与自定义组件共享监控大屏色板，统一面板、浮层、表单与交互状态。
 * 当前外观为深蓝主题；主题偏好的解析不改变这套业务配色。
 */

import { theme, type ThemeConfig } from 'antd'

/** 解析后的具体主题；settings.theme（light/dark/system 三态）经 system 偏好解析后的结果 */
export type ResolvedTheme = 'light' | 'dark'

const THEME_ALGORITHMS: Partial<Record<ResolvedTheme, ThemeConfig['algorithm']>> = {
  dark: theme.darkAlgorithm,
}

/** 按解析后的主题生成 antd ThemeConfig（主题切换时重建） */
export function buildAppTheme(resolvedTheme: ResolvedTheme): ThemeConfig {
  const styles = getComputedStyle(document.documentElement)
  const token = (name: string) => styles.getPropertyValue(`--app-${name}`).trim()

  return {
    algorithm: THEME_ALGORITHMS[resolvedTheme] ?? theme.darkAlgorithm,
    token: {
      // 操作蓝比图表蓝更深，确保主要按钮的冷白小字清晰可读。
      colorPrimary: token('primary'),
      colorPrimaryHover: token('primary-hover'),
      colorPrimaryActive: token('primary-active'),
      colorPrimaryBg: token('highlight-soft'),
      colorPrimaryBgHover: token('highlight'),
      colorPrimaryBorder: token('line'),
      colorPrimaryText: token('blue-text'),
      colorPrimaryTextHover: token('cyan'),
      colorPrimaryTextActive: token('blue-2'),
      colorLink: token('blue-text'),
      colorLinkHover: token('cyan'),
      colorLinkActive: token('blue-2'),
      colorInfo: token('blue'),
      colorSuccess: token('green'),
      colorWarning: token('orange'),
      colorError: token('red'),
      // 状态正文使用提亮的语义色，图标与数据标记继续使用原始状态色。
      colorInfoText: token('blue-text'),
      colorSuccessText: token('green-text'),
      colorWarningText: token('orange-text'),
      colorErrorText: token('red-text'),
      colorBgBase: token('bg'),
      colorBgLayout: token('bg'),
      colorBgContainer: token('card-bg'),
      colorBgElevated: token('pop-bg-solid'),
      colorBgMask: token('mask'),
      colorBgContainerDisabled: token('panel-inset'),
      colorText: token('text'),
      colorTextSecondary: token('text-2'),
      colorTextTertiary: token('text-3'),
      colorTextQuaternary: token('text-4'),
      colorTextPlaceholder: token('text-3'),
      colorTextDisabled: token('text-4'),
      colorTextLightSolid: token('text'),
      colorBorder: token('line'),
      colorBorderSecondary: token('divider'),
      // 填充与选中态采用蓝色透明层，避免暗色算法生成中性灰块。
      colorFill: token('track'),
      colorFillSecondary: token('highlight'),
      colorFillTertiary: token('hover-bg'),
      colorFillQuaternary: token('highlight-soft'),
      colorFillAlter: token('highlight-soft'),
      controlItemBgHover: token('hover-bg'),
      controlItemBgActive: token('highlight'),
      controlItemBgActiveHover: token('hover-bg'),
      controlOutline: token('accent-glow'),
      boxShadow: token('shadow-2'),
      boxShadowSecondary: token('window-shadow'),
      fontFamily: token('font'),
      fontSize: Number.parseInt(token('fs-body'), 10),
      borderRadius: Number.parseInt(token('radius-control'), 10),
    },
    components: {
      // 默认操作是深蓝描边按钮，主要操作用实心蓝色；悬停以青色边线确认焦点。
      Button: {
        primaryColor: token('text'),
        defaultBg: token('control-bg'),
        defaultColor: token('control-text'),
        defaultBorderColor: token('line'),
        defaultHoverBg: token('hover-bg'),
        defaultHoverColor: token('cyan'),
        defaultHoverBorderColor: token('cyan'),
        defaultActiveBg: token('highlight'),
        defaultActiveColor: token('text'),
        defaultActiveBorderColor: token('blue'),
        defaultShadow: 'none',
        primaryShadow: 'none',
      },
      // 编辑区比面板稍暗，聚焦边框使用青色；只覆盖视觉令牌，不改变校验和禁用行为。
      Input: {
        colorBgContainer: token('panel-inset'),
        activeBg: token('panel-inset'),
        hoverBg: token('panel-inset'),
        activeBorderColor: token('cyan'),
        hoverBorderColor: token('blue'),
        activeShadow: `0 0 0 2px ${token('highlight')}`,
      },
      InputNumber: {
        colorBgContainer: token('panel-inset'),
        activeBg: token('panel-inset'),
        hoverBg: token('panel-inset'),
        activeBorderColor: token('cyan'),
        hoverBorderColor: token('blue'),
        activeShadow: `0 0 0 2px ${token('highlight')}`,
      },
      Select: {
        selectorBg: token('panel-inset'),
        activeBorderColor: token('cyan'),
        hoverBorderColor: token('blue'),
        optionSelectedBg: token('highlight'),
        optionSelectedColor: token('text'),
        optionActiveBg: token('hover-bg'),
      },
      // 分类选中态仅铺一层低亮蓝色，避免目录树的大块亮色压过业务内容。
      Tree: {
        nodeHoverBg: token('hover-bg'),
        nodeSelectedBg: token('highlight'),
        nodeSelectedColor: token('text'),
        directoryNodeSelectedBg: token('highlight'),
        directoryNodeSelectedColor: token('cyan'),
      },
      // 标准卡片与对话框和自绘面板共享蓝边、暗底，挂载到 body 的浮层同样生效。
      Card: {
        colorBorderSecondary: token('card-line'),
        headerBg: token('highlight-soft'),
      },
      Modal: {
        contentBg: token('pop-bg-solid'),
        headerBg: token('pop-bg-solid'),
        footerBg: token('pop-bg-solid'),
      },
    },
  }
}
