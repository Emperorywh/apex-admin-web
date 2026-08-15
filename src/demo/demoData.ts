/**
 * 演示数据集与版本化快照（规格 §13.2）：
 * - 内存数据集是 CRUD 的唯一运行态，首次访问时懒加载；
 * - 每次写操作同步版本化 localStorage 快照（schemaVersion 校验）；
 * - 快照损坏或旧版本无迁移映射时恢复种子数据并提示一次；
 * - 登出确认框选择清除时移除快照并把内存数据集重置回种子。
 *
 * 本模块属于可整体剔除的 src/demo/（规格 §13.3），不得被 services/store 等常驻层静态引用。
 */
import { appI18n, COMMON_NAMESPACE } from '@/i18n/i18n'
import { showUiWarning } from '@/services/feedback/uiFeedback'
import type { Role } from '@/types/system/role/role.types'
import type { User } from '@/types/system/user/user.types'
import { DEMO_SNAPSHOT_SCHEMA_VERSION, DEMO_SNAPSHOT_STORAGE_KEY } from './demo.constants'
import {
  DEMO_SEED_NEXT_ROLE_SEQUENCE,
  DEMO_SEED_NEXT_USER_SEQUENCE,
  DEMO_SEED_ROLES,
  DEMO_SEED_USERS,
} from './fixtures/demoSeedData'

/** 演示数据集：用户与角色列表及各自的新建序号（角色 CRUD 的运行态，规格 §14.3） */
export interface DemoDataset {
  users: User[]
  nextUserSequence: number
  roles: Role[]
  nextRoleSequence: number
}

/** 快照不可用提示文案（zh 即 key；en-US 资源见 locales/en-US/common.ts） */
const SNAPSHOT_RESTORED_MESSAGE_KEY = '演示数据快照不可用，已恢复初始演示数据'

function translateDemoText(key: string): string {
  return appI18n.t(key, { ns: COMMON_NAMESPACE })
}

/** 种子数据集：深拷贝种子用户与角色（含嵌套 permCodes），避免运行态 mutation 污染模块常量 */
function createSeedDataset(): DemoDataset {
  return {
    users: DEMO_SEED_USERS.map((user) => ({ ...user })),
    nextUserSequence: DEMO_SEED_NEXT_USER_SEQUENCE,
    roles: DEMO_SEED_ROLES.map((role) => ({ ...role, permCodes: [...role.permCodes] })),
    nextRoleSequence: DEMO_SEED_NEXT_ROLE_SEQUENCE,
  }
}

/** User 形状校验：快照反序列化后的唯一外部数据校验边界 */
function isValidUserSnapshot(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const user = value as Record<string, unknown>
  return (
    typeof user.id === 'string' &&
    typeof user.username === 'string' &&
    typeof user.displayName === 'string' &&
    typeof user.email === 'string' &&
    (user.phone === undefined || typeof user.phone === 'string') &&
    (user.status === 'enabled' || user.status === 'disabled') &&
    Array.isArray(user.roleIds) &&
    user.roleIds.every((roleId) => typeof roleId === 'string') &&
    typeof user.createdAt === 'string' &&
    typeof user.updatedAt === 'string'
  )
}

/** Role 形状校验：快照反序列化后的唯一外部数据校验边界 */
function isValidRoleSnapshot(value: unknown): value is Role {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const role = value as Record<string, unknown>
  return (
    typeof role.id === 'string' &&
    typeof role.code === 'string' &&
    typeof role.name === 'string' &&
    (role.description === undefined || typeof role.description === 'string') &&
    (role.status === 'enabled' || role.status === 'disabled') &&
    typeof role.builtIn === 'boolean' &&
    Array.isArray(role.permCodes) &&
    role.permCodes.every((permCode) => typeof permCode === 'string') &&
    typeof role.createdAt === 'string' &&
    typeof role.updatedAt === 'string'
  )
}

/** 校验并读取快照；null 表示不存在、损坏或版本无迁移映射（调用方恢复种子） */
function parseSnapshot(raw: string | null): DemoDataset | null {
  if (raw === null) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }
    const snapshot = parsed as Record<string, unknown>
    // schemaVersion 必须与当前版本一致：旧版本无迁移映射时按不可恢复处理（规格 §13.2）
    if (snapshot.schemaVersion !== DEMO_SNAPSHOT_SCHEMA_VERSION) {
      return null
    }
    if (!Array.isArray(snapshot.users) || !snapshot.users.every(isValidUserSnapshot)) {
      return null
    }
    if (!Array.isArray(snapshot.roles) || !snapshot.roles.every(isValidRoleSnapshot)) {
      return null
    }
    if (typeof snapshot.nextUserSequence !== 'number' || !Number.isInteger(snapshot.nextUserSequence)) {
      return null
    }
    if (typeof snapshot.nextRoleSequence !== 'number' || !Number.isInteger(snapshot.nextRoleSequence)) {
      return null
    }
    return {
      users: snapshot.users.map((user) => ({ ...(user as User) })),
      nextUserSequence: snapshot.nextUserSequence,
      roles: snapshot.roles.map((role) => ({ ...(role as Role), permCodes: [...(role as Role).permCodes] })),
      nextRoleSequence: snapshot.nextRoleSequence,
    }
  } catch {
    return null
  }
}

/** 当前会话内已提示过快照恢复，避免重复打扰 */
let snapshotRestoreNotified = false

/** 恢复种子并提示一次：损坏/旧版快照不可迁移时的统一降级路径 */
function restoreSeedWithNotice(): DemoDataset {
  if (!snapshotRestoreNotified) {
    snapshotRestoreNotified = true
    showUiWarning(translateDemoText(SNAPSHOT_RESTORED_MESSAGE_KEY))
  }
  return createSeedDataset()
}

let dataset: DemoDataset | null = null

/**
 * 获取演示数据集（懒加载）：首次访问读取快照，无快照静默使用种子，
 * 损坏或旧版本恢复种子并提示一次；之后复用同一内存实例，
 * CRUD 直接修改后调用 persistDemoSnapshot 落盘。
 */
export function ensureDemoDataset(): DemoDataset {
  if (dataset !== null) {
    return dataset
  }
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(DEMO_SNAPSHOT_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (raw === null) {
    dataset = createSeedDataset()
  } else {
    dataset = parseSnapshot(raw) ?? restoreSeedWithNotice()
  }
  return dataset
}

/** 把当前内存数据集同步写入版本化快照；写失败（隐私模式/配额）静默降级为仅内存态 */
export function persistDemoSnapshot(): void {
  if (dataset === null) {
    return
  }
  try {
    window.localStorage.setItem(
      DEMO_SNAPSHOT_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: DEMO_SNAPSHOT_SCHEMA_VERSION,
        users: dataset.users,
        nextUserSequence: dataset.nextUserSequence,
        roles: dataset.roles,
        nextRoleSequence: dataset.nextRoleSequence,
      }),
    )
  } catch {
    // 快照写失败不影响当前会话的 CRUD 演示
  }
}

/**
 * 登出确认框勾选「清除演示数据快照」时调用：移除快照并把内存数据集重置回种子，
 * 下次登录从初始演示数据继续（默认保留路径不调用本函数，规格 §13.2）。
 */
export function clearDemoDataOnLogout(): void {
  dataset = createSeedDataset()
  try {
    window.localStorage.removeItem(DEMO_SNAPSHOT_STORAGE_KEY)
  } catch {
    // 清理失败不影响登出流程
  }
}

/**
 * 重置内存数据集（测试与登出运行态清理使用）。
 * keepSnapshot=true 时保留 localStorage 快照，模拟整页刷新后从快照重新加载。
 */
export function resetDemoDataset(options: { keepSnapshot?: boolean } = {}): void {
  dataset = null
  snapshotRestoreNotified = false
  if (options.keepSnapshot !== true) {
    try {
      window.localStorage.removeItem(DEMO_SNAPSHOT_STORAGE_KEY)
    } catch {
      // 忽略清理失败
    }
  }
}

/** 读取快照原始内容（测试断言用） */
export function readDemoSnapshotRaw(): string | null {
  try {
    return window.localStorage.getItem(DEMO_SNAPSHOT_STORAGE_KEY)
  } catch {
    return null
  }
}
