/**
 * en-US systemMenu 命名空间资源（规格 §12）：菜单管理页面与 MenuForm 文案。
 * 中文文案即 key（本文件不维护 zh-CN 资源，缺 key 返回 key 本身）；
 * 命名空间名与文件名一致（基础命名空间 menu 已被路由标题占用，菜单管理域使用
 * systemMenu 区分），经路由 meta.i18nNamespaces 声明后按需加载；
 * 通用文案在命名空间内自持（与 user/role 命名空间同一取舍，单一命名空间调用）。
 */
const systemMenu: Record<string, string> = {
  // 固定说明文案：菜单管理不动态改变前端静态路由
  '菜单管理仅维护后端菜单数据，不会动态改变前端静态路由':
    'Menu management only maintains backend menu data; it never changes frontend static routes',
  // 工具栏与表格列
  新增菜单: 'New Menu',
  类型: 'Type',
  图标: 'Icon',
  标题: 'Title',
  路由名称: 'Route Name',
  路由路径: 'Route Path',
  排序值: 'Sort Order',
  是否可见: 'Visible',
  状态: 'Status',
  更新时间: 'Updated At',
  操作: 'Actions',
  编辑: 'Edit',
  删除: 'Delete',
  显示: 'Shown',
  隐藏: 'Hidden',
  // 菜单类型（语境差异：固定 context 名 menuType，规格 §12）
  目录_menuType: 'Directory',
  页面_menuType: 'Page',
  外链_menuType: 'Link',
  // 语境差异（固定 context 名 status/button，规格 §12）
  启用_status: 'Enabled',
  启用_button: 'Enable',
  禁用_status: 'Disabled',
  禁用_button: 'Disable',
  启用成功: 'Enabled successfully',
  禁用成功: 'Disabled successfully',
  // 表单字段
  编辑菜单: 'Edit Menu',
  上级菜单: 'Parent Menu',
  留空为根级菜单: 'Leave empty for a root menu',
  请选择菜单类型: 'Please select a menu type',
  请输入菜单标题: 'Please enter a menu title',
  'link 类型必须设置路由路径': 'A link menu requires a route path',
  请输入外部链接地址: 'Please enter the external URL',
  '选填：前端路由名称': 'Optional: the frontend route name',
  '选填：前端路由路径': 'Optional: the frontend route path',
  '选填：前端组件标识': 'Optional: the frontend component identifier',
  '选填：图标标识': 'Optional: the icon identifier',
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
  '保存失败，请稍后重试': 'Save failed. Please try again later.',
  删除成功: 'Deleted successfully',
  '存在子菜单，无法删除': 'This menu has sub-menus and cannot be deleted',
}

export default systemMenu
