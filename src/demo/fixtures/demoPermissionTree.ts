/**
 * 演示权限树种子（规格 §14.1/§14.3）：GET /permissions/tree 的固定返回数据。
 * 三层结构：模块 → 资源 → 动作；节点 key 全局唯一，叶子 key 即权限码本身，
 * 只有叶子提供 permCode。全部权限码引用正式常量 PERMISSIONS（§5.1），
 * 叶子集合必须与 PERMISSIONS 权威清单完全一致（同目录测试锁定）。
 * title 为后端返回的展示文案（中文即 i18n key，en-US 资源见 locales/en-US/role.ts）。
 *
 * 本文件属于可整体剔除的 src/demo/（规格 §13.3）。
 */
import { PERMISSIONS } from '@/constants/permission.constants'
import type { PermissionNode } from '@/types/system/role/role.types'

export const DEMO_PERMISSION_TREE: readonly PermissionNode[] = [
  {
    key: 'dashboard',
    title: '仪表盘',
    children: [{ key: PERMISSIONS.DASHBOARD_VIEW, title: '查看', permCode: PERMISSIONS.DASHBOARD_VIEW }],
  },
  {
    key: 'system',
    title: '系统管理',
    children: [
      {
        key: 'system:user',
        title: '用户管理',
        children: [
          { key: PERMISSIONS.SYSTEM_USER_LIST, title: '查询', permCode: PERMISSIONS.SYSTEM_USER_LIST },
          { key: PERMISSIONS.SYSTEM_USER_CREATE, title: '新增', permCode: PERMISSIONS.SYSTEM_USER_CREATE },
          { key: PERMISSIONS.SYSTEM_USER_UPDATE, title: '编辑', permCode: PERMISSIONS.SYSTEM_USER_UPDATE },
          { key: PERMISSIONS.SYSTEM_USER_DELETE, title: '删除', permCode: PERMISSIONS.SYSTEM_USER_DELETE },
          {
            key: PERMISSIONS.SYSTEM_USER_ASSIGN_ROLE,
            title: '分配角色',
            permCode: PERMISSIONS.SYSTEM_USER_ASSIGN_ROLE,
          },
        ],
      },
      {
        key: 'system:role',
        title: '角色管理',
        children: [
          { key: PERMISSIONS.SYSTEM_ROLE_LIST, title: '查询', permCode: PERMISSIONS.SYSTEM_ROLE_LIST },
          { key: PERMISSIONS.SYSTEM_ROLE_CREATE, title: '新增', permCode: PERMISSIONS.SYSTEM_ROLE_CREATE },
          { key: PERMISSIONS.SYSTEM_ROLE_UPDATE, title: '编辑', permCode: PERMISSIONS.SYSTEM_ROLE_UPDATE },
          { key: PERMISSIONS.SYSTEM_ROLE_DELETE, title: '删除', permCode: PERMISSIONS.SYSTEM_ROLE_DELETE },
          {
            key: PERMISSIONS.SYSTEM_ROLE_ASSIGN_PERMISSION,
            title: '分配权限',
            permCode: PERMISSIONS.SYSTEM_ROLE_ASSIGN_PERMISSION,
          },
        ],
      },
      {
        key: 'system:menu',
        title: '菜单管理',
        children: [
          { key: PERMISSIONS.SYSTEM_MENU_LIST, title: '查询', permCode: PERMISSIONS.SYSTEM_MENU_LIST },
          { key: PERMISSIONS.SYSTEM_MENU_CREATE, title: '新增', permCode: PERMISSIONS.SYSTEM_MENU_CREATE },
          { key: PERMISSIONS.SYSTEM_MENU_UPDATE, title: '编辑', permCode: PERMISSIONS.SYSTEM_MENU_UPDATE },
          { key: PERMISSIONS.SYSTEM_MENU_DELETE, title: '删除', permCode: PERMISSIONS.SYSTEM_MENU_DELETE },
        ],
      },
    ],
  },
  {
    key: 'demo',
    title: '演示',
    children: [
      {
        key: 'demo:nested',
        title: '多级菜单',
        children: [{ key: PERMISSIONS.DEMO_NESTED_VIEW, title: '查看', permCode: PERMISSIONS.DEMO_NESTED_VIEW }],
      },
    ],
  },
]
