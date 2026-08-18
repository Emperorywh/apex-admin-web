/**
 * 演示种子数据（规格 §13.2/§14.3）：用户/角色/菜单 CRUD 的初始内存数据集与快照恢复基准。
 * 只允许被 src/demo 内部与同目录测试引用；账号权限语义见 demo.constants.ts（§5.3 权威）。
 * 种子时间戳固定，保证快照测试与默认排序（createdAt desc、id asc）确定性。
 * 业务路由 id/path 直接自持字面量（规格 §4.2 v1.10，同 demo adapter 路径自持先例），
 * 仅框架核心路由（dashboard）引用 route.constants。
 */
import { PERMISSIONS, PERMISSION_WILDCARD } from '@/constants/permission.constants'
import { ROUTE_IDS, ROUTE_PATHS } from '@/constants/route.constants'
import type { MenuItem } from '@/types/system/menu/menu.types'
import type { Role } from '@/types/system/role/role.types'
import type { User } from '@/types/system/user/user.types'

/** 种子数据统一时间戳：带时区 ISO 8601（规格 §14.1），固定值保证确定性 */
export const DEMO_SEED_TIME = '2026-01-01T08:00:00+08:00'

/** 种子角色：admin/viewer 各一，均为 builtIn（删除约束随角色管理任务接入） */
export const DEMO_SEED_ROLES: readonly Role[] = [
  {
    id: 'demo-role-admin',
    code: 'admin',
    name: '演示管理员角色',
    description: '通配全部权限的演示角色',
    status: 'enabled',
    builtIn: true,
    permCodes: [PERMISSION_WILDCARD],
    createdAt: DEMO_SEED_TIME,
    updatedAt: DEMO_SEED_TIME,
  },
  {
    id: 'demo-role-viewer',
    code: 'viewer',
    name: '演示访客角色',
    description: '仅最小权限码的演示角色',
    status: 'enabled',
    builtIn: true,
    permCodes: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.SYSTEM_USER_LIST, PERMISSIONS.DEMO_NESTED_VIEW],
    createdAt: DEMO_SEED_TIME,
    updatedAt: DEMO_SEED_TIME,
  },
]

/**
 * 种子用户：admin/viewer 两个演示账号（userId 与 demo.constants.ts 的 DemoAccount 对齐）
 * 加两个普通 viewer 用户，保证列表分页与 CRUD 演示有真实数据。
 * 只有 admin 持有 admin 角色，使「删除最后一个 admin」冲突可复现（规格 §14.3）。
 */
export const DEMO_SEED_USERS: readonly User[] = [
  {
    id: 'demo-user-001',
    username: 'admin',
    displayName: '演示管理员',
    email: 'admin@apex.demo',
    phone: '13800000001',
    status: 'enabled',
    roleIds: ['demo-role-admin'],
    createdAt: DEMO_SEED_TIME,
    updatedAt: DEMO_SEED_TIME,
  },
  {
    id: 'demo-user-002',
    username: 'viewer',
    displayName: '演示访客',
    email: 'viewer@apex.demo',
    phone: '13800000002',
    status: 'enabled',
    roleIds: ['demo-role-viewer'],
    createdAt: DEMO_SEED_TIME,
    updatedAt: DEMO_SEED_TIME,
  },
  {
    id: 'demo-user-003',
    username: 'alice',
    displayName: '演示用户·爱丽丝',
    email: 'alice@apex.demo',
    status: 'enabled',
    roleIds: ['demo-role-viewer'],
    createdAt: DEMO_SEED_TIME,
    updatedAt: DEMO_SEED_TIME,
  },
  {
    id: 'demo-user-004',
    username: 'bob',
    displayName: '演示用户·鲍勃',
    email: 'bob@apex.demo',
    status: 'disabled',
    roleIds: ['demo-role-viewer'],
    createdAt: DEMO_SEED_TIME,
    updatedAt: DEMO_SEED_TIME,
  },
]

/** 新建演示用户的下一个数字序号（种子占用 001–004） */
export const DEMO_SEED_NEXT_USER_SEQUENCE = 5

/** 新建演示角色的下一个数字序号（种子角色使用语义化 ID，不占用数字序号） */
export const DEMO_SEED_NEXT_ROLE_SEQUENCE = 1

/**
 * 种子菜单（规格 §14.1/§14.3）：扁平存储（children 由 GET /menus/tree 组装），
 * routeId/path 只引用当前已注册的静态路由（ROUTE_IDS/ROUTE_PATHS 权威值）；
 * 多级菜单演示条目与路由定义同步注册（演示 > 多级菜单 > 三个层级页面，
 * 对应前端三级菜单，§14.2/§19.1）。button 类型仅展示权限资源关系。
 *
 * icon 为 demo fixture 私有演示字段（SPEC_UI2 §5.7：值 `local:` 图标名，
 * 驱动菜单管理页图标列；MenuItem 契约不含该字段，按钮/层级叶子不带 icon，
 * 演示「真实后端数据无该字段时图标列呈现占位」的路径）。
 */
export interface DemoMenuSeedItem extends MenuItem {
  icon?: string
}

export const DEMO_SEED_MENUS: readonly DemoMenuSeedItem[] = [
  {
    id: 'demo-menu-dashboard',
    parentId: null,
    type: 'page',
    name: '仪表盘',
    routeId: ROUTE_IDS.DASHBOARD,
    path: ROUTE_PATHS.DASHBOARD,
    icon: 'local:ic-dashboard',
    sort: 1,
    visible: true,
    status: 'enabled',
  },
  {
    id: 'demo-menu-system',
    parentId: null,
    type: 'directory',
    name: '系统管理',
    icon: 'local:ic-management',
    sort: 2,
    visible: true,
    status: 'enabled',
  },
  {
    id: 'demo-menu-system-user',
    parentId: 'demo-menu-system',
    type: 'page',
    name: '用户管理',
    routeId: 'system-user',
    path: '/system/user',
    icon: 'local:ic-user',
    sort: 1,
    visible: true,
    status: 'enabled',
  },
  { id: 'demo-menu-user-list', parentId: 'demo-menu-system-user', type: 'button', name: '查询', permCode: PERMISSIONS.SYSTEM_USER_LIST, sort: 1, visible: true, status: 'enabled' },
  { id: 'demo-menu-user-create', parentId: 'demo-menu-system-user', type: 'button', name: '新增', permCode: PERMISSIONS.SYSTEM_USER_CREATE, sort: 2, visible: true, status: 'enabled' },
  { id: 'demo-menu-user-update', parentId: 'demo-menu-system-user', type: 'button', name: '编辑', permCode: PERMISSIONS.SYSTEM_USER_UPDATE, sort: 3, visible: true, status: 'enabled' },
  { id: 'demo-menu-user-delete', parentId: 'demo-menu-system-user', type: 'button', name: '删除', permCode: PERMISSIONS.SYSTEM_USER_DELETE, sort: 4, visible: true, status: 'enabled' },
  { id: 'demo-menu-user-assign', parentId: 'demo-menu-system-user', type: 'button', name: '分配角色', permCode: PERMISSIONS.SYSTEM_USER_ASSIGN_ROLE, sort: 5, visible: true, status: 'enabled' },
  {
    id: 'demo-menu-system-role',
    parentId: 'demo-menu-system',
    type: 'page',
    name: '角色管理',
    routeId: 'system-role',
    path: '/system/role',
    icon: 'local:ic-role',
    sort: 2,
    visible: true,
    status: 'enabled',
  },
  { id: 'demo-menu-role-list', parentId: 'demo-menu-system-role', type: 'button', name: '查询', permCode: PERMISSIONS.SYSTEM_ROLE_LIST, sort: 1, visible: true, status: 'enabled' },
  { id: 'demo-menu-role-create', parentId: 'demo-menu-system-role', type: 'button', name: '新增', permCode: PERMISSIONS.SYSTEM_ROLE_CREATE, sort: 2, visible: true, status: 'enabled' },
  { id: 'demo-menu-role-update', parentId: 'demo-menu-system-role', type: 'button', name: '编辑', permCode: PERMISSIONS.SYSTEM_ROLE_UPDATE, sort: 3, visible: true, status: 'enabled' },
  { id: 'demo-menu-role-delete', parentId: 'demo-menu-system-role', type: 'button', name: '删除', permCode: PERMISSIONS.SYSTEM_ROLE_DELETE, sort: 4, visible: true, status: 'enabled' },
  { id: 'demo-menu-role-assign', parentId: 'demo-menu-system-role', type: 'button', name: '分配权限', permCode: PERMISSIONS.SYSTEM_ROLE_ASSIGN_PERMISSION, sort: 5, visible: true, status: 'enabled' },
  {
    id: 'demo-menu-system-menu',
    parentId: 'demo-menu-system',
    type: 'page',
    name: '菜单管理',
    routeId: 'system-menu',
    path: '/system/menu',
    icon: 'local:ic-menu',
    sort: 3,
    visible: true,
    status: 'enabled',
  },
  { id: 'demo-menu-menu-list', parentId: 'demo-menu-system-menu', type: 'button', name: '查询', permCode: PERMISSIONS.SYSTEM_MENU_LIST, sort: 1, visible: true, status: 'enabled' },
  { id: 'demo-menu-menu-create', parentId: 'demo-menu-system-menu', type: 'button', name: '新增', permCode: PERMISSIONS.SYSTEM_MENU_CREATE, sort: 2, visible: true, status: 'enabled' },
  { id: 'demo-menu-menu-update', parentId: 'demo-menu-system-menu', type: 'button', name: '编辑', permCode: PERMISSIONS.SYSTEM_MENU_UPDATE, sort: 3, visible: true, status: 'enabled' },
  { id: 'demo-menu-menu-delete', parentId: 'demo-menu-system-menu', type: 'button', name: '删除', permCode: PERMISSIONS.SYSTEM_MENU_DELETE, sort: 4, visible: true, status: 'enabled' },
  {
    id: 'demo-menu-demo',
    parentId: null,
    type: 'directory',
    name: '演示',
    icon: 'local:ic-flask',
    sort: 3,
    visible: true,
    status: 'enabled',
  },
  {
    id: 'demo-menu-nested',
    parentId: 'demo-menu-demo',
    type: 'directory',
    name: '多级菜单',
    icon: 'local:ic-menulevel',
    sort: 1,
    visible: true,
    status: 'enabled',
  },
  {
    id: 'demo-menu-nested-level1',
    parentId: 'demo-menu-nested',
    type: 'page',
    name: '一级页面',
    routeId: 'demo-nested-level1',
    path: '/demo/nested/level1',
    sort: 1,
    visible: true,
    status: 'enabled',
  },
  {
    id: 'demo-menu-nested-level2',
    parentId: 'demo-menu-nested',
    type: 'page',
    name: '二级页面',
    routeId: 'demo-nested-level2',
    path: '/demo/nested/level1/level2',
    sort: 2,
    visible: true,
    status: 'enabled',
  },
  {
    id: 'demo-menu-nested-level3',
    parentId: 'demo-menu-nested',
    type: 'page',
    name: '三级页面',
    routeId: 'demo-nested-level3',
    path: '/demo/nested/level1/level2/level3',
    sort: 3,
    visible: true,
    status: 'enabled',
  },
]

/** 新建演示菜单的下一个数字序号（种子菜单使用语义化 ID，不占用数字序号） */
export const DEMO_SEED_NEXT_MENU_SEQUENCE = 1
