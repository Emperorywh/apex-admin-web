/**
 * 演示模式常量（规格 §5.3/§13）：唯一允许存放演示账号、权限矩阵与假数据标识的位置。
 * 本目录可整体剔除（规格 §13.3）；正式常量文件（permission.constants.ts 等）不得导出
 * 任何演示账号数据。demo adapter、demo 运行时与同目录测试一律引用本文件。
 */
import { PERMISSIONS, PERMISSION_WILDCARD } from '@/constants/permission.constants'
import { STORAGE_KEY_PREFIX } from '@/constants/storage.constants'

/**
 * off 构建产物不得出现的约定哨兵字符串（规格 §13.3）。
 * scripts/check-demo-off.mjs 以它作为 demo 模块未被 Rollup 剔除的失败标记。
 */
export const APEX_DEMO_SENTINEL = 'APEX_DEMO_SENTINEL'

/** VITE_DEMO_MODE 三态枚举（规格 §13.1）；与 vite-env.d.ts/vite.config.ts 启动校验保持一致 */
export const DEMO_MODES = {
  /** 不允许 demo；构建产物不得包含 demo chunk、账号和假数据（真实生产默认） */
  OFF: 'off',
  /** 所有受支持请求直接走 demo adapter（示例部署） */
  FORCE: 'force',
  /** 先请求真实登录；仅网络级失败时提示并切换 demo 后重放一次登录（开发默认） */
  FALLBACK: 'fallback',
} as const

/** 演示模式联合类型：由 DEMO_MODES 推导 */
export type DemoMode = (typeof DEMO_MODES)[keyof typeof DEMO_MODES]

/** 演示账号用户名（规格 §5.3 固定为 admin/viewer，密码任意） */
export const DEMO_ACCOUNT_USERNAMES = {
  ADMIN: 'admin',
  VIEWER: 'viewer',
} as const

/** 演示账号定义：登录、profile 与权限判定的唯一数据源（规格 §5.3） */
export interface DemoAccount {
  /** 对应种子用户记录的 ID（fixtures/demoSeedData.ts 权威定义） */
  readonly userId: string
  readonly username: string
  /** profile.roleCodes；admin 角色按 '*' 通配判定（规格 §4.4） */
  readonly roleCodes: readonly string[]
  /** profile.permCodes；viewer 为固定最小权限码集合 */
  readonly permCodes: readonly string[]
  /** 权限快照版本：demo 会话内稳定，不随 CRUD 变化（权限矩阵验收固定） */
  readonly permissionVersion: string
}

/**
 * 两个演示账号（规格 §5.3）：
 * - admin：admin 角色经通配语义拥有全部权限（permCodes 置 '*' 仅为自描述，判定走角色通配）；
 * - viewer：最小权限码恰好为 dashboard:view、system:user:list、demo:nested:view，不多不少。
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    userId: 'demo-user-001',
    username: DEMO_ACCOUNT_USERNAMES.ADMIN,
    roleCodes: ['admin'],
    permCodes: [PERMISSION_WILDCARD],
    permissionVersion: 'demo-admin-v1',
  },
  {
    userId: 'demo-user-002',
    username: DEMO_ACCOUNT_USERNAMES.VIEWER,
    roleCodes: ['viewer'],
    permCodes: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.SYSTEM_USER_LIST, PERMISSIONS.DEMO_NESTED_VIEW],
    permissionVersion: 'demo-viewer-v1',
  },
]

/** 按用户名查找演示账号；未命中返回 null（登录按 AUTH_INVALID_CREDENTIALS 拒绝） */
export function findDemoAccount(username: string): DemoAccount | null {
  return DEMO_ACCOUNTS.find((account) => account.username === username) ?? null
}

/** §5.3 权限矩阵行：能力 → 所需权限码链（null 表示仅要求登录）；admin/viewer 期望值验收固定 */
export interface DemoPermissionMatrixRow {
  readonly capability: string
  /** AND 语义权限码链（规格 §4.4）；null 表示无 permCode、仅登录即可（个人中心） */
  readonly requiredCodes: readonly string[] | null
  readonly admin: boolean
  readonly viewer: boolean
}

/**
 * 演示账号权限矩阵（规格 §5.3 验收固定）。
 * requiredCodes 为 null 的行（个人中心）对所有已登录用户开放，不分配额外 permCode。
 */
export const DEMO_PERMISSION_MATRIX: readonly DemoPermissionMatrixRow[] = [
  {
    capability: 'Dashboard',
    requiredCodes: [PERMISSIONS.DASHBOARD_VIEW],
    admin: true,
    viewer: true,
  },
  {
    capability: '用户列表/查询',
    requiredCodes: [PERMISSIONS.SYSTEM_USER_LIST],
    admin: true,
    viewer: true,
  },
  {
    capability: '新增用户',
    requiredCodes: [PERMISSIONS.SYSTEM_USER_CREATE],
    admin: true,
    viewer: false,
  },
  {
    capability: '编辑用户',
    requiredCodes: [PERMISSIONS.SYSTEM_USER_UPDATE],
    admin: true,
    viewer: false,
  },
  {
    capability: '删除用户',
    requiredCodes: [PERMISSIONS.SYSTEM_USER_DELETE],
    admin: true,
    viewer: false,
  },
  {
    capability: '分配用户角色',
    requiredCodes: [PERMISSIONS.SYSTEM_USER_ASSIGN_ROLE],
    admin: true,
    viewer: false,
  },
  {
    capability: '角色管理',
    requiredCodes: [
      PERMISSIONS.SYSTEM_ROLE_LIST,
      PERMISSIONS.SYSTEM_ROLE_CREATE,
      PERMISSIONS.SYSTEM_ROLE_UPDATE,
      PERMISSIONS.SYSTEM_ROLE_DELETE,
      PERMISSIONS.SYSTEM_ROLE_ASSIGN_PERMISSION,
    ],
    admin: true,
    viewer: false,
  },
  {
    capability: '菜单管理',
    requiredCodes: [
      PERMISSIONS.SYSTEM_MENU_LIST,
      PERMISSIONS.SYSTEM_MENU_CREATE,
      PERMISSIONS.SYSTEM_MENU_UPDATE,
      PERMISSIONS.SYSTEM_MENU_DELETE,
    ],
    admin: true,
    viewer: false,
  },
  {
    capability: '多级菜单演示',
    requiredCodes: [PERMISSIONS.DEMO_NESTED_VIEW],
    admin: true,
    viewer: true,
  },
  {
    capability: '个人中心查看/编辑',
    requiredCodes: null,
    admin: true,
    viewer: true,
  },
]

/** demo CRUD 快照 storage key：沿用全局前缀（规格 §8.2 STORAGE_KEY_PREFIX） */
export const DEMO_SNAPSHOT_STORAGE_KEY = `${STORAGE_KEY_PREFIX}demo_data`

/**
 * demo CRUD 快照 schema 版本（规格 §13.2）。
 * 加载时校验；损坏或旧版本无迁移映射时恢复种子数据并提示一次。
 * v2：快照结构加入角色集合（roles/nextRoleSequence）；v3：加入菜单集合
 * （menus/nextMenuSequence）；v4：菜单条目加入 demo 私有 icon 演示字段
 * （SPEC_UI2 §5.7 菜单管理图标列）；v1–v3 快照按旧版本降级恢复种子。
 */
export const DEMO_SNAPSHOT_SCHEMA_VERSION = 4

/** demo accessToken 有效期，单位：毫秒；到期由 adapter 返回 401 AUTH_ACCESS_EXPIRED 触发刷新单飞 */
export const DEMO_ACCESS_TOKEN_TTL_MS = 5 * 60_000

/** demo refreshToken 有效期，单位：毫秒；到期刷新返回 401 AUTH_REFRESH_EXPIRED */
export const DEMO_REFRESH_TOKEN_TTL_MS = 12 * 60 * 60_000

/** demo accessToken 前缀：`demo-at.<用户名>.<到期时间戳>`，无状态自校验（刷新延续跨整页刷新） */
export const DEMO_ACCESS_TOKEN_PREFIX = 'demo-at.'

/** demo refreshToken 前缀：`demo-rt.<用户名>.<到期时间戳>.<签发时间戳>`，旋转后旧 token 失效 */
export const DEMO_REFRESH_TOKEN_PREFIX = 'demo-rt.'

/** demo 种子/新建用户 ID 前缀；同时是 off 构建产物扫描的 demo 账号数据标记之一 */
export const DEMO_USER_ID_PREFIX = 'demo-user-'

/** demo 新建角色 ID 前缀：`demo-role-<三位序号>`；种子角色使用语义化 ID（demo-role-admin/viewer） */
export const DEMO_ROLE_ID_PREFIX = 'demo-role-'

/** demo 新建菜单 ID 前缀：`demo-menu-<三位序号>`；种子菜单使用语义化 ID（demo-menu-system 等） */
export const DEMO_MENU_ID_PREFIX = 'demo-menu-'
