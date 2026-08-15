/**
 * 演示种子数据（规格 §13.2/§14.3）：用户 CRUD 的初始内存数据集与快照恢复基准。
 * 只允许被 src/demo 内部与同目录测试引用；账号权限语义见 demo.constants.ts（§5.3 权威）。
 * 种子时间戳固定，保证快照测试与默认排序（createdAt desc、id asc）确定性。
 */
import { PERMISSIONS, PERMISSION_WILDCARD } from '@/constants/permission.constants'
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
