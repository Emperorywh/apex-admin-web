/**
 * en-US systemMenu 命名空间资源（规格 §12）：菜单管理页面与 MenuForm 文案。
 * 中文文案即 key（本文件不维护 zh-CN 资源，缺 key 返回 key 本身）；
 * 命名空间名与文件名一致（基础命名空间 menu 已被路由标题占用，菜单管理域使用
 * systemMenu 区分），经路由 meta.i18nNamespaces 声明后按需加载；
 * 通用文案在命名空间内自持（与 user/role 命名空间同一取舍，单一命名空间调用）。
 */
const systemMenu: Record<string, string> = {
  // 固定说明文案（规格 §14.1/§14.2：菜单管理不动态改变前端静态路由）
  '菜单管理仅维护后端菜单数据，不会动态改变前端静态路由':
    'Menu management only maintains backend menu data; it never changes frontend static routes',
  // 工具栏与表格列
  新增菜单: 'New Menu',
  类型: 'Type',
  图标: 'Icon',
  名称: 'Name',
  '路由 ID': 'Route ID',
  路由路径: 'Route Path',
  权限码: 'Permission Code',
  排序: 'Sort',
  是否可见: 'Visible',
  状态: 'Status',
  操作: 'Actions',
  编辑: 'Edit',
  删除: 'Delete',
  显示: 'Shown',
  隐藏: 'Hidden',
  // 菜单类型（语境差异：固定 context 名 menuType，规格 §12）
  目录_menuType: 'Directory',
  页面_menuType: 'Page',
  按钮_menuType: 'Button',
  // 语境差异（固定 context 名 status，规格 §12）
  启用_status: 'Enabled',
  禁用_status: 'Disabled',
  // 表单字段
  编辑菜单: 'Edit Menu',
  上级菜单: 'Parent Menu',
  留空为根级菜单: 'Leave empty for a root menu',
  请选择菜单类型: 'Please select a menu type',
  请输入菜单名称: 'Please enter a menu name',
  'page 类型必须设置路由 ID': 'A page menu requires a route ID',
  '路由 ID 必须是已注册的路由 ID': 'The route ID must be a registered route ID',
  '请选择路由 ID': 'Please select a route ID',
  '选填：默认展示路由路径': 'Optional: the route path to display',
  'button 类型必须设置权限码': 'A button menu requires a permission code',
  请选择权限码: 'Please select a permission code',
  请输入排序值: 'Please enter a sort value',
  取消: 'Cancel',
  保存: 'Save',
  // 操作反馈
  删除菜单: 'Delete Menu',
  '确定要删除菜单「{{name}}」吗？删除后不可恢复。':
    'Are you sure you want to delete menu "{{name}}"? This cannot be undone.',
  确认删除: 'Confirm Delete',
  创建菜单成功: 'Menu created successfully',
  保存成功: 'Saved successfully',
  删除成功: 'Deleted successfully',
}

export default systemMenu
