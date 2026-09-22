import type { CSSProperties } from 'react'
import { buildAppTheme } from '@/constants/designTokens'

/** 画布与顶栏继承系统原有深色背景；局部色板只提亮文字、节点、面板和控件。 */
const editorPalette = {
	panel: '#1a2e4b',
	'panel-inset': '#142840',
	'card-bg': '#1c314e',
	'control-bg': '#223b5b',
	'pop-bg': '#1c304d',
	'pop-bg-solid': '#1c304d',
	mask: '#071224ad',
	line: '#466b94',
	'line-soft': '#304d70',
	divider: '#365171',
	text: '#edf5ff',
	'text-2': '#c1d1e6',
	'text-3': '#9fb5d1',
	'text-4': '#829bbd',
	'control-text': '#d6e8ff',
	cyan: '#55d5ff',
	blue: '#4d9cf5',
	'blue-2': '#8ac0ff',
	'blue-text': '#a3caff',
	// 主操作及悬停态均保持小号白字所需的对比度，连线与焦点使用更明亮的蓝青色。
	primary: '#286ec2',
	'primary-hover': '#2d70c3',
	'primary-active': '#205faa',
	track: '#355c85',
	highlight: '#4d9cf533',
	'highlight-soft': '#4d9cf512',
	'hover-bg': '#4d9cf526',
	'accent-glow': '#55d5ff26',
	scrollbar: '#6688ae99',
	'scrollbar-hover': '#8badcf',
	// 点阵保留原有蓝色与透明度，不随控件边框提亮；缩略图使用轻遮罩保证节点可辨识。
	'canvas-dot': '#408cff4d',
	'minimap-mask': '#101e3366',
	// 柔和的上沿高光区分节点、工具与底层画布，减少大面积黑色阴影带来的压暗感。
	'card-surface': 'linear-gradient(145deg, #233d5f, #1a2e4b)',
	'shadow-1': '0 4px 12px #07132624, inset 0 1px 0 #c5e4ff0a',
	'shadow-2': '0 8px 24px #07132640, inset 0 1px 0 #c5e4ff0a',
	'window-shadow': '0 12px 36px #0713264d, inset 0 1px 0 #c5e4ff0a',
} as const

/** 局部 CSS 变量随编辑器及其弹窗挂载，不改变其他页面或中英文文案。 */
export const workflowEditorVariables = Object.fromEntries(
	Object.entries(editorPalette).map(([name, value]) => [
		`--app-${name}`,
		value,
	]),
) as CSSProperties

/** 浮层通过 ConfigProvider 继承同一主题；页签与提示单独提亮，避免暗色主按钮蓝降低可读性。 */
export function buildWorkflowEditorTheme() {
	const theme = buildAppTheme('dark', editorPalette)
	return {
		...theme,
		token: {
			...theme.token,
			colorBgSpotlight: editorPalette['pop-bg-solid'],
		},
		components: {
			...theme.components,
			Tabs: {
				itemColor: editorPalette['text-2'],
				itemSelectedColor: editorPalette.cyan,
				itemHoverColor: editorPalette.text,
				inkBarColor: editorPalette.cyan,
			},
		},
	}
}
