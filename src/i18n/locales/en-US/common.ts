/**
 * en-US common 基础命名空间资源（规格 §12）。
 * 中文文案即 key；同一短语的语境差异用固定 context 后缀（<中文>_<context>，
 * 如 button/title/status），复数用 _one/_other，富文本用 <Trans>（键内 <n> 为
 * 子节点序号占位）。zh-CN 不维护资源文件，缺 key 直接返回中文 key 本身。
 */
const common: Record<string, string> = {
  // 通用操作文案
  确定: 'OK',
  取消: 'Cancel',
  保存: 'Save',
  新增: 'Create',
  编辑: 'Edit',
  删除: 'Delete',
  搜索: 'Search',
  重置: 'Reset',
  刷新: 'Refresh',
  关闭: 'Close',
  提交: 'Submit',
  操作: 'Actions',
  加载中: 'Loading',
  暂无数据: 'No data',
  // 语境差异（固定 context 名，规格 §12）：status 为状态标签、button 为动作按钮
  启用_status: 'Enabled',
  启用_button: 'Enable',
  禁用_status: 'Disabled',
  禁用_button: 'Disable',
  // 复数（规格 §12 _one/_other）：zh-CN 模式直接返回插值后的中文 key
  '{{count}} 条记录_one': '{{count}} record',
  '{{count}} 条记录_other': '{{count}} records',
  // 富文本（<Trans>，规格 §12）：<1> 与子节点占位序号对应
  '已阅读并同意<1>服务条款</1>': 'I have read and agree to the <1>Terms of Service</1>',
  // 登录页文案（规格 §14.2）
  用户名: 'Username',
  密码: 'Password',
  登录: 'Sign in',
  请输入用户名: 'Please enter your username',
  请输入密码: 'Please enter your password',
  登录后将前往: 'You will be redirected to',
  通用后台管理模板: 'General-purpose admin template',
  // API errorCode 本地化（规格 §7.1/§7.4）：键与 src/i18n/errorTexts.ts 的映射一一对应
  请求参数校验失败: 'Request validation failed',
  用户名或密码错误: 'Incorrect username or password',
  '账号已被禁用，请联系管理员': 'This account has been disabled. Please contact your administrator.',
  '登录状态已过期，请重新登录': 'Your session has expired. Please sign in again.',
  '登录已失效，请重新登录': 'Your sign-in is no longer valid. Please sign in again.',
  '权限已变更，请刷新后重试': 'Your permissions have changed. Please refresh and try again.',
  没有权限执行此操作: 'You do not have permission to perform this action.',
  请求的资源不存在: 'The requested resource was not found.',
  '操作与当前状态冲突，请刷新后重试': 'The operation conflicts with the current state. Please refresh and try again.',
  '服务器内部错误，请稍后重试': 'Internal server error. Please try again later.',
  '请求失败，请稍后重试': 'Request failed. Please try again later.',
  // 错误页与路由错误边界文案（规格 §14.2/§4.3）
  重试: 'Retry',
  返回首页: 'Back to Home',
  退出登录: 'Sign Out',
  您没有访问该页面的权限: 'You do not have permission to access this page.',
  您访问的页面不存在: 'The page you are looking for does not exist.',
  '服务器开小差了，请稍后重试': 'The server is having a moment. Please try again later.',
  // 持久化恢复失败一次性提示（规格 §4.3/§8.2）
  '本地设置恢复失败，已使用默认设置': 'Failed to restore local settings. Defaults were applied.',
  // 界面设置抽屉（规格 §10.1/§10.2）
  界面设置: 'Appearance Settings',
  主题: 'Theme',
  主题模式: 'Theme Mode',
  跟随系统: 'Follow System',
  浅色: 'Light',
  深色: 'Dark',
  主题色: 'Primary Color',
  自定义颜色: 'Custom Color',
  '当前主题色对比度较低，可能影响可读性': 'This primary color has low contrast and may affect readability.',
  湛蓝: 'Azure',
  翡翠绿: 'Emerald',
  酱紫: 'Violet',
  日暮橙: 'Sunset',
  绯红: 'Crimson',
  青碧: 'Teal',
  洋红: 'Magenta',
  鎏金: 'Gold',
  布局: 'Layout',
  侧边布局: 'Sidebar',
  顶部布局: 'Topbar',
  字体: 'Font',
  字体族: 'Font Family',
  系统默认: 'System Default',
  无衬线: 'Sans-serif',
  衬线: 'Serif',
  等宽: 'Monospace',
  字号: 'Font Size',
  小: 'Small',
  中: 'Medium',
  大: 'Large',
  界面元素: 'Interface Elements',
  面包屑: 'Breadcrumb',
  全屏: 'Fullscreen',
  // 全屏降级提示（规格 §10.2/§17.18）
  当前浏览器不支持全屏功能: 'Fullscreen is not supported by this browser.',
  '无法切换全屏，可能被浏览器权限策略拒绝':
    'Unable to toggle fullscreen. It may be blocked by a browser permission policy.',
}

export default common
