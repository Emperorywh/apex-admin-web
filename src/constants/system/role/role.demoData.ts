/**
 * 角色管理演示数据（纯前端模式）：
 * 本仓库无请求层（CLAUDE.md「项目定位」），角色管理页按确定性静态数据在页面内存内
 * 渲染与 CRUD——无随机数、无请求；刷新页面后由页面重置回本数据。
 * 权限码一律引用 permission.constants.ts 的 PERMISSIONS 常量，不出现权限魔法字符串；
 * 成员数（ROLE_DEMO_MEMBER_COUNTS）与 user.demoData.ts 的 USER_DEMO_ROLE_CODES
 * 初始口径一致。
 */
import { PERMISSIONS } from '@/constants/permission.constants'
import type { Role } from '@/types/system/role/role.types'

/** 演示角色全集：2 个内置（admin/viewer，禁删禁停）+ 3 个业务角色，其中 1 个停用 */
export const ROLE_DEMO_LIST: Role[] = [
  {
    id: 'r-admin',
    code: 'admin',
    displayName: '超级管理员',
    description: '拥有全部权限的内置角色，不可删除或停用',
    status: 'active',
    isBuiltin: true,
    sortOrder: 1,
    createdAt: '2026-01-05T09:00:00+08:00',
    updatedAt: '2026-01-05T09:00:00+08:00',
  },
  {
    id: 'r-scheduler',
    code: 'scheduler',
    displayName: '调度操作员',
    description: '负责 AGV 任务调度、监控大屏与异常处置',
    status: 'active',
    isBuiltin: false,
    sortOrder: 10,
    createdAt: '2026-02-12T10:30:00+08:00',
    updatedAt: '2026-06-19T14:05:00+08:00',
  },
  {
    id: 'r-warehouse',
    code: 'warehouse_lead',
    displayName: '仓库主管',
    description: '管理出入库任务、库区人员与班次排班',
    status: 'active',
    isBuiltin: false,
    sortOrder: 20,
    createdAt: '2026-02-26T15:10:00+08:00',
    updatedAt: '2026-05-28T09:42:00+08:00',
  },
  {
    id: 'r-analyst',
    code: 'data_analyst',
    displayName: '数据分析员',
    description: '查看运营数据并生成调度效率报表（外包人员账号冻结期间停用）',
    status: 'disabled',
    isBuiltin: false,
    sortOrder: 30,
    createdAt: '2026-04-14T11:25:00+08:00',
    updatedAt: '2026-08-06T16:20:00+08:00',
  },
  {
    id: 'r-viewer',
    code: 'viewer',
    displayName: '只读访客',
    description: '仅可查看基础数据的内置角色，不可删除或停用',
    status: 'active',
    isBuiltin: true,
    sortOrder: 90,
    createdAt: '2026-01-05T09:00:00+08:00',
    updatedAt: '2026-01-05T09:00:00+08:00',
  },
]

/** 角色 → 已分配权限码全集（分配权限 Drawer 的初始勾选，权限码全量替换语义） */
export const ROLE_DEMO_PERMISSION_CODES: Record<string, string[]> = {
  'r-admin': [
    PERMISSIONS.SYSTEM_USER_LIST,
    PERMISSIONS.SYSTEM_USER_CREATE,
    PERMISSIONS.SYSTEM_USER_ASSIGN_ROLE,
    PERMISSIONS.SYSTEM_ROLE_LIST,
    PERMISSIONS.SYSTEM_ROLE_CREATE,
    PERMISSIONS.SYSTEM_ROLE_ASSIGN_PERMISSION,
    PERMISSIONS.SYSTEM_MENU_LIST,
    PERMISSIONS.SYSTEM_MENU_CREATE,
  ],
  'r-scheduler': [PERMISSIONS.SYSTEM_USER_LIST, PERMISSIONS.SYSTEM_ROLE_LIST, PERMISSIONS.SYSTEM_MENU_LIST],
  'r-warehouse': [PERMISSIONS.SYSTEM_USER_LIST, PERMISSIONS.SYSTEM_USER_CREATE, PERMISSIONS.SYSTEM_USER_ASSIGN_ROLE],
  'r-analyst': [PERMISSIONS.SYSTEM_USER_LIST, PERMISSIONS.SYSTEM_ROLE_LIST],
  'r-viewer': [PERMISSIONS.SYSTEM_USER_LIST],
}

/** 角色 → 成员数（与 user.demoData.ts 的 USER_DEMO_ROLE_CODES 初始口径一致） */
export const ROLE_DEMO_MEMBER_COUNTS: Record<string, number> = {
  'r-admin': 1,
  'r-scheduler': 5,
  'r-warehouse': 4,
  'r-analyst': 2,
  'r-viewer': 3,
}
