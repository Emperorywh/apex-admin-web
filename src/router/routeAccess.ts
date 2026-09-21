/**
 * 路由访问判定核心（T00.4 权限与路由）。
 *
 * 以「登录会话（permissionsTree / permissions / activated / username）」
 * 与「路由定义树节点上的 meta.perm 权限码」为唯一依据，提供：
 * 1. 访问上下文构建：超管短路、菜单码扁平化、祖先填充、root 专属码排除（规格 5.7/5.8）
 * 2. 单码可见性判定：未声明权限码的页面 = 登录即可达（旧 Umi「未写 access」语义，
 *    载具类型/数据库备份等页由 P06/P30 核对后端菜单树后再收紧，不凭空造码，规格 5.12）
 * 3. 落点解析：activated=false → 软件授权页（D29）；首页可用优先；
 *    否则按菜单顺序取首个「有权限且已迁移完成」的业务页；全部不可用 → 无权限页
 * 4. 登录回跳校验：深链接回跳仅允许站内、存在且当前可用的目标（规格 5.11）
 *
 * 本模块不读 store、不依赖 React：loader 与组件层各自传入会话快照。
 */

import { ROOT_ONLY_CODES, type PermCode } from '@/constants/auth/permission.constants'
import {
  appRouteDefinitions,
  joinPath,
  ROUTE_PATHS,
} from '@/router/definitions'
import type { AppRouteDefinition } from '@/router/router.types'
import { flattenMenuCodes, isRootUser } from '@/utils/auth/permission'
import type { AuthPermissionDto } from '@/services/auth/auth.service.types'

/** 守卫/落点所需的会话快照（与 store 的 auth 切片形状结构兼容） */
export interface AccessSubject {
  /** 登录用户摘要；null = 未登录（调用方须先做登录判定再进入本模块） */
  user: { username: string } | null
  /** 系统激活状态；false 时登录落点为软件授权页（D29） */
  activated: boolean
  /** 按钮权限码平铺数组（本模块暂不消费，按钮判定走 usePermission） */
  permissions: readonly string[]
  /** 后端菜单权限树 */
  permissionsTree: AuthPermissionDto[]
}

/** 访问上下文：超管短路标记 + 已解析的可见菜单码集合 */
export interface AccessContext {
  /** 超管（root/administrator）：全部权限码放行（D19） */
  isSuperuser: boolean
  /**
   * 可见菜单码集合：flattenMenuCodes（MENU 码）+ 祖先填充 − root 专属码。
   * 超管时为 null（不做集合判定，一律放行）。
   */
  allowedCodes: ReadonlySet<string> | null
}

/** 从会话快照构建访问上下文；每次构建都是独立快照，调用方按需缓存 */
export function buildAccessContext(subject: AccessSubject): AccessContext {
  // 超管短路：不做集合判定（旧 access.ts 的 root 全放行语义）；
  // 用户名取真实登录返回值（subject.user.username），不信任任意输入
  if (isRootUser(subject.user?.username)) {
    return { isSuperuser: true, allowedCodes: null }
  }
  // 祖先填充（规格 5.7 保留旧语义）：拥有任一子节点码时，
  // 该节点及其全部分组祖先码一并可见——兜底后端权限树断链，
  // 保证「有子菜单则父分组可见」，结构依据是路由定义树上的 perm 挂接。
  const owned = flattenMenuCodes(subject.permissionsTree)
  const allowed = expandWithAncestors(owned)
  // root 专属码：非超管一律移除，即使后端下发了这些码（旧 ROOT_ONLY_CODES 语义）
  for (const code of ROOT_ONLY_CODES) allowed.delete(code)
  return { isSuperuser: false, allowedCodes: allowed }
}

/**
 * 单码可见性判定。
 * - perm 未声明：登录即可达（对齐旧 Umi「未写 access」= 仅要求登录的语义；
 *   不把「未写 access」解释为免登录公开，公开页必须显式 meta.public）
 * - 超管：放行
 * - 其余：码在已祖先填充的可见集合中
 */
export function hasMenuAccess(ctx: AccessContext, perm?: PermCode): boolean {
  if (ctx.isSuperuser) return true
  if (perm === undefined) return true
  return ctx.allowedCodes?.has(perm) === true
}

/**
 * 业务叶子当前是否可用：已实现（非迁移过渡占位）且有权访问。
 * 迁移过渡中的页面（meta.migrationPending）不作为落点候选（规格 3.1 / T00.4 退出检查），
 * 权限放行只代表「将来可用」，不代表现在可进入真实业务。
 * 本期暂缓页（meta.migrationDeferred，H01–H03）同样排除：说明入口虽已交付且
 * 按原权限可达，但它不是「已迁移完成的业务页」（规格 5.6），不得抢占登录落点，
 * 登录回跳也不放行——否则「无可用业务页」反馈会被一个说明页静默替代。
 */
export function isLeafAvailable(
  definition: AppRouteDefinition,
  ctx: AccessContext,
): boolean {
  if (!definition.loadPage) return false
  if (definition.meta.migrationPending === true) return false
  if (definition.meta.migrationDeferred === true) return false
  return hasMenuAccess(ctx, definition.meta.perm)
}

/**
 * 登录落点候选判定：在可用性之上排除公开页（登录页/显式 404）与
 * 隐藏辅助页（错误页、个人中心、软件授权、无权限页等），
 * 保证「首个可用业务页」不会解析回登录页或其他非业务落点形成循环。
 */
function isLandingCandidate(
  definition: AppRouteDefinition,
  ctx: AccessContext,
): boolean {
  if (definition.meta.hideInMenu === true) return false
  if (definition.meta.public === true) return false
  return isLeafAvailable(definition, ctx)
}

/** 判定子树内是否存在任一已拥有的权限码（祖先填充用） */
function subtreeOwnsCode(
  definition: AppRouteDefinition,
  owned: ReadonlySet<string>,
): boolean {
  const code = definition.meta.perm
  if (code !== undefined && owned.has(code)) return true
  return (definition.children ?? []).some((child) => subtreeOwnsCode(child, owned))
}

/** 基于路由定义树做祖先填充：命中码的节点及其全部分组祖先码进入结果集 */
function expandWithAncestors(owned: ReadonlySet<string>): Set<string> {
  const result = new Set(owned)
  const walk = (
    definitions: readonly AppRouteDefinition[],
    ancestorCodes: string[],
  ): void => {
    for (const definition of definitions) {
      const code = definition.meta.perm
      if (code !== undefined && subtreeOwnsCode(definition, owned)) {
        result.add(code)
        for (const ancestor of ancestorCodes) result.add(ancestor)
      }
      if (definition.children?.length) {
        walk(definition.children, code !== undefined ? [...ancestorCodes, code] : ancestorCodes)
      }
    }
  }
  walk(appRouteDefinitions, [])
  return result
}

/** 深度优先寻找子树中第一个「落点候选」叶子（定义顺序 = 菜单顺序，对齐旧 MENU_ROUTE_ORDER 语义） */
function findFirstAvailableLeaf(
  definitions: readonly AppRouteDefinition[],
  basePath: string,
  ctx: AccessContext,
): string | null {
  for (const definition of definitions) {
    const path = joinPath(basePath, definition.path)
    if (definition.children?.length) {
      const found = findFirstAvailableLeaf(definition.children, path, ctx)
      if (found !== null) return found
      continue
    }
    if (definition.index || definition.redirect) continue
    if (isLandingCandidate(definition, ctx)) return path
  }
  return null
}

/**
 * 登录落点（D29 + 规格 5.6）：
 * 1. activated=false → 软件授权页（授权失效/未激活与无权限分开处理）
 * 2. 首页（/dashboard，P34 合并实时看板）有权限且已完成迁移 → 首页
 * 3. 按菜单顺序第一个「有权限且已迁移完成」的业务页
 * 4. 全部不可用 → 无权限页（明确反馈，而非白屏或死循环）
 */
export function resolveLandingPath(subject: AccessSubject): string {
  if (!subject.activated) return ROUTE_PATHS['authorize-ingress']
  const ctx = buildAccessContext(subject)
  // 首页固定优先：权限放行且迁移完成后即为全站落点
  const dashboardPath = ROUTE_PATHS['dashboard']
  const dashboardLeaf = findLeafByPath(dashboardPath)
  if (dashboardLeaf && isLeafAvailable(dashboardLeaf, ctx)) return dashboardPath
  return (
    findFirstAvailableLeaf(appRouteDefinitions, '/', ctx) ??
    ROUTE_PATHS['no-permission']
  )
}

/** 按定义树推导的 id → 完整路径表（放宽为 string 索引，供目录动态解析） */
const pathById: Readonly<Record<string, string>> = ROUTE_PATHS

/**
 * 目录默认子页落点：目录子树中第一个可用叶子的完整路径。
 * 目录索引不得指向无权限/未实现页（T00.4 退出检查）；全部不可用时落无权限页。
 */
export function resolveDirectoryLandingPath(
  directory: AppRouteDefinition,
  ctx: AccessContext,
): string {
  // 子路径以目录自身完整路径为基准拼接（pathById 由定义树推导，禁止手写路径）
  const basePath = pathById[directory.id] ?? '/'
  return (
    findFirstAvailableLeaf(directory.children ?? [], basePath, ctx) ??
    ROUTE_PATHS['no-permission']
  )
}

/** 按完整路径反查叶子定义（含路径归一化拼接比对）；未命中返回 undefined */
function findLeafByPath(
  pathname: string,
): AppRouteDefinition | undefined {
  let found: AppRouteDefinition | undefined
  const walk = (
    definitions: readonly AppRouteDefinition[],
    basePath: string,
  ): void => {
    for (const definition of definitions) {
      const path = joinPath(basePath, definition.path)
      if (definition.children?.length) {
        walk(definition.children, path)
        continue
      }
      if (!definition.index && definition.loadPage && path === pathname) {
        found = definition
      }
    }
  }
  walk(appRouteDefinitions, '/')
  return found
}

/**
 * 登录回跳目标校验（规格 5.11）：仅允许「站内路径 + 定义树中存在 + 当前可用」的目标。
 * raw 为登录页 redirect 参数（可能携带 search）；不合法时返回 null，由调用方落回登录落点。
 * 外站绝对地址、未知路径、无权限页与迁移占位页一律拒绝，防止借回跳绕过权限或死循环。
 */
export function resolveSafeRedirectPath(
  raw: string | null,
  subject: AccessSubject,
): string | null {
  if (!raw || !raw.startsWith('/')) return null
  const pathname = raw.split('?')[0] ?? ''
  // 无权限页是「无任何可用业务页」的反馈落点而非业务目标：
  // 即使当前会话可达（超管放行/已实现）也不作为登录回跳目标——
  // 守卫把未登录深链接弹回登录页后，登录成功把用户原样送回
  // 刚被反馈过「无权限」的页面，违背 A22 合法落点语义（P41 audit 实测修正）
  if (pathname === ROUTE_PATHS['no-permission']) return null
  const leaf = findLeafByPath(pathname)
  if (!leaf) return null
  const ctx = buildAccessContext(subject)
  if (!isLeafAvailable(leaf, ctx)) return null
  return raw
}
