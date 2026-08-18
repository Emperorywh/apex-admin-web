/**
 * en-US menu 基础命名空间资源（规格 §12）：路由标题、菜单与面包屑文案。
 * 中文标题 key 与 router/definitions.tsx 的 meta.title 对应；
 * 路由命名空间资源随页面任务在相邻文件中扩展。
 */
const menu: Record<string, string> = {
  仪表盘: 'Dashboard',
  系统管理: 'System',
  用户管理: 'User Management',
  角色管理: 'Role Management',
  菜单管理: 'Menu Management',
  演示: 'Demo',
  多级菜单: 'Nested Menu',
  一级页面: 'Level 1 Page',
  二级页面: 'Level 2 Page',
  三级页面: 'Level 3 Page',
  个人中心: 'Profile',
  登录: 'Sign In',
  无权限访问: 'Forbidden',
  页面不存在: 'Not Found',
  服务器错误: 'Server Error',
  // 菜单副标题 caption（SPEC_UI2 §6.1：路由 meta.caption，menu 命名空间）
  工作台与核心指标: 'Workbench & metrics',
  '用户·角色·菜单': 'Users, roles & menus',
  账号与角色分配: 'Accounts & role assignment',
  角色与权限树: 'Roles & permission tree',
  后端菜单数据维护: 'Backend menu data',
  多级菜单与页签缓存: 'Nested menu & tab cache',
}

export default menu
