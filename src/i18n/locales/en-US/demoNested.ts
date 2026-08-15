/**
 * en-US demoNested 命名空间资源（规格 §12）：多级菜单演示页面文案。
 * 中文文案即 key；层级标题（一级/二级/三级页面）复用 menu 命名空间的路由标题资源。
 */
const demoNested: Record<string, string> = {
  多级菜单演示: 'Nested Menu Demo',
  '进入{{name}}': 'Go to {{name}}',
  当前路由: 'Current route',
  面包屑链: 'Breadcrumb chain',
  页签缓存验证: 'Tab Cache Verification',
  '切换到其他页签或层级后返回本页签，下方表单内容保持不变（页面缓存由 Activity 保留）':
    'Switch to another tab or level and come back — the form values below are preserved (page kept alive by Activity).',
  演示输入框: 'Demo input',
  在任意层级页签输入内容后离开再返回: 'Type something at any level, leave, then come back',
  演示多行输入: 'Demo textarea',
  多行输入同样随页签缓存保留: 'Textarea content is preserved by the tab cache as well',
  演示开关: 'Demo switch',
}

export default demoNested
