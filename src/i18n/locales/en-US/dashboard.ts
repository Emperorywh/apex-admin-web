/**
 * en-US dashboard 命名空间资源（规格 §12）：Dashboard 页面的统计卡与图表面板文案。
 * 中文文案即 key（本文件不维护 zh-CN 资源，缺 key 返回 key 本身）；
 * 命名空间名与文件名一致，经路由 meta.i18nNamespaces 声明后按需加载。
 */
const dashboard: Record<string, string> = {
  用户总数: 'Total Users',
  启用用户: 'Enabled Users',
  角色数量: 'Roles',
  今日登录: "Today's Logins",
  登录趋势: 'Login Trend',
  用户增长: 'User Growth',
  角色分布: 'Role Distribution',
  概览数据加载失败: 'Failed to load overview data',
  重试: 'Retry',
}

export default dashboard
