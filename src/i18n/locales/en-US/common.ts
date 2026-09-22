/**
 * en-US · common 命名空间（key 即中文文案）。
 */

export default {
	// 系统名称对应机器人控制用途，与登录页及导航中的译名一致。
	机器人系统: 'Robot Control System',
	切换语言: 'Switch language',
	切换主题: 'Switch theme',
	浅色: 'Light',
	深色: 'Dark',
	跟随系统: 'System',
	退出登录: 'Sign out',
	网络: 'Network',
	网络连接正常: 'Network is healthy',
	网络连接异常: 'Network is unreachable',
	连续失败请求: 'Consecutive failures',
	最近检查: 'Last checked',
	当前时间: 'Current time',
	'确认退出登录？': 'Sign out of this session?',
	'退出后需要重新输入账号密码。':
		'You will need to sign in again afterwards.',
	退出: 'Sign out',
	取消: 'Cancel',
	未分配角色: 'No roles assigned',
	用户: 'User',
	刷新当前页签: 'Refresh this tab',
	关闭其他页签: 'Close other tabs',
	关闭左侧页签: 'Close tabs to the left',
	关闭右侧页签: 'Close tabs to the right',
	关闭全部页签: 'Close all tabs',
	页面页签: 'Page tabs',
	向左滚动: 'Scroll left',
	向右滚动: 'Scroll right',
	关闭页签: 'Close tab',
	主导航: 'Main navigation',
	清理页签: 'Clear tabs',
	// 底部说明强调系统在单台 AGV 上运行的部署范围。
	'AGV 单机控制系统': 'AGV Onboard Control System',
	/* 底部浮层的分组说明与无障碍数量名称。
     与中文键保持一致，切换语言时不会残留中文提示。 */
	快捷导航: 'Quick navigation',
	子级菜单: 'Submenu',
	入口数量: 'Number of entries',
	返回上级菜单: 'Back to parent menu',
	关闭全部页签并清空缓存: 'Close all tabs and release cache',
	'已关闭全部页签，仅保留固定页':
		'All tabs closed; only the pinned tab remains',
	登录: 'Sign in',
	'操作失败，请稍后重试': 'Something went wrong. Please retry later.',
	'加载失败，点击重试': 'Failed to load. Click to retry.',
	返回工作台: 'Back to workspace',
	重新加载: 'Reload',
	页面加载失败: 'Failed to load the page',
	页面渲染出错: 'This page failed to render',
	重试: 'Retry',
} as const
