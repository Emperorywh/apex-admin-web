/**
 * en-US · common 命名空间（key 即中文文案）。
 */

export default {
  调度系统: 'Dispatch System',
  '切换语言': 'Switch language',
  '切换主题': 'Switch theme',
  '浅色': 'Light',
  '深色': 'Dark',
  '跟随系统': 'System',
  '退出登录': 'Sign out',
  '网络': 'Network',
  '网络连接正常': 'Network is healthy',
  '网络连接异常': 'Network is unreachable',
  '连续失败请求': 'Consecutive failures',
  '最近检查': 'Last checked',
  '当前时间': 'Current time',
  '个人中心': 'My Profile',
  '确认退出登录？': 'Sign out of this session?',
  '退出后需要重新输入账号密码。': 'You will need to sign in again afterwards.',
  '退出': 'Sign out',
  '取消': 'Cancel',
  '未分配角色': 'No roles assigned',
  '用户': 'User',
  '刷新当前页签': 'Refresh this tab',
  '关闭其他页签': 'Close other tabs',
  '关闭左侧页签': 'Close tabs to the left',
  '关闭右侧页签': 'Close tabs to the right',
  '关闭全部页签': 'Close all tabs',
  '页面页签': 'Page tabs',
  '向左滚动': 'Scroll left',
  '向右滚动': 'Scroll right',
  '关闭页签': 'Close tab',
  '主导航': 'Main navigation',
  /* 底部浮层的分组说明与无障碍数量名称。
     与中文键保持一致，切换语言时不会残留中文提示。 */
  '快捷导航': 'Quick navigation',
  '子级菜单': 'Submenu',
  '入口数量': 'Number of entries',
  '返回上级菜单': 'Back to parent menu',
  '关闭全部页签并清空缓存': 'Close all tabs and release cache',
  '已关闭全部页签，仅保留固定页': 'All tabs closed; only the pinned tab remains',
  '新建日程': 'New event',
  '全部事件': 'All events',
  '恢复': 'Resume',
  '登录': 'Sign in',
  '保存': 'Save',
  '编辑': 'Edit',
  '删除': 'Delete',
  '操作': 'Actions',
  '操作失败，请稍后重试': 'Something went wrong. Please retry later.',
  '加载失败，点击重试': 'Failed to load. Click to retry.',
  /* 请求层错误文案（services/request 统一收敛的 ApiError 标题） */
  '登录已过期，请重新登录': 'Your session has expired. Please sign in again.',
  '请求已取消': 'Request cancelled',
  '网络不可达，请检查连接或后端服务':
    'Network unreachable. Check your connection or the backend service.',
  'API 目标返回了 HTML 而非 JSON，请检查代理与后端服务':
    'The API target returned HTML instead of JSON. Check the proxy and the backend service.',
  '响应不符合调度协议（缺少 Result 包装）':
    'Response does not follow the dispatch protocol (missing Result envelope).',
  '请求失败（HTTP {{status}}）': 'Request failed (HTTP {{status}})',
  '业务处理失败（code={{code}}）': 'Operation failed (code {{code}})',
  /* 迁移过渡占位（T00.4：未迁移页面统一呈现，不进入业务代码） */
  '该功能正在迁移中，迁移完成后开放使用':
    'This feature is being migrated and will be available once the migration completes.',
  /* 统一状态块（T00.5 StateBlock：无权限/缺口/离线三类状态，区别于真实空数据） */
  '暂无访问权限': 'No access permission',
  '当前账号没有查看此内容的权限，请联系管理员开通':
    'Your account does not have permission to view this content. Contact an administrator.',
  '该功能暂不可用': 'This feature is currently unavailable',
  '所需接口能力尚未就绪，相关操作已禁用':
    'The required API capability is not ready yet. Related actions are disabled.',
  '加载失败': 'Failed to load',
  '无法获取数据，请检查网络或服务状态后重试':
    'Data could not be retrieved. Check the network or service status and retry.',
  '重新加载': 'Reload',
  /* 页签动作统一确认与传输状态（T00.6：脏页签保护 / 关闭与刷新检查 / 传输提示） */
  '关闭当前页签': 'Close this tab',
  '确认继续{{action}}？': 'Continue with {{action}}?',
  '继续': 'Continue',
  '确认刷新当前页签？': 'Refresh this tab?',
  '刷新页签': 'Refresh tab',
  '以下页签存在未保存的修改，继续操作后将丢失：':
    'The following tabs have unsaved changes that will be lost if you continue:',
  '这些页签仍有正在进行的传输：关闭后传输会继续，完成后将以消息提示结果。':
    'These tabs still have transfers in progress: transfers continue after closing, and a message will report the result.',
  '进行中的传输将被本机终止，不保证服务端已停止处理。':
    'Transfers in progress will be terminated locally. The server may still be processing them.',
  '登录已结束，传输已在本机终止': 'Session ended; transfers were terminated locally',
  '"{{name}}" 传输完成': '"{{name}}" transfer completed',
  '"{{name}}" 传输失败：{{reason}}': '"{{name}}" transfer failed: {{reason}}',
  '"{{name}}" 传输已终止：{{reason}}': '"{{name}}" transfer aborted: {{reason}}',
  /* 控制命令统一确认与批量反馈（T00.7：列明对象与影响 / 提交≠完成 / 逐项真实归纳） */
  '确定': 'OK',
  '本次操作影响以下对象：': 'This operation affects the following targets:',
  '等 {{count}} 个对象': '{{count}} targets in total',
  '命令提交后不代表操作已完成，请以实际状态核实结果':
    'Submitting a command does not mean the action has completed. Verify the result with the actual status.',
  '成功 {{count}} 项': '{{count}} succeeded',
  '成功 {{succeeded}} 项，失败 {{failed}} 项，结果未知 {{unknown}} 项':
    '{{succeeded}} succeeded, {{failed}} failed, {{unknown}} of unknown result',
  /* 关联选项失效呈现（T00.7：保留原值 + 不可用说明，不静默替换） */
  '（原值缺失）': '(original value missing)',
  '{{id}}（已不在当前选项中）': '{{id}} (no longer in the current options)',
} as const
