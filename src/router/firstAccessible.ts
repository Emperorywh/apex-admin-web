/**
 * 首个有权入口与安全返回目标解析（SPEC §4/P41、§8.1）。
 *
 * 规则：
 * - 按定义顺序遍历菜单叶子，选取第一个「本轮已实现且当前用户有权」的业务页；
 * - 跳过暂缓模块（deferred），特权账号也不固定进入暂缓页；
 * - 没有任何本轮可用入口时落 /no-permission；若用户仅持有暂缓模块权限，
 *   以查询参数标记，P41 据此区分「无权限」与「仅有暂缓模块权限」；
 * - 返回目标只依据路由定义与身份快照推导，不信任外部 returnUrl；
 * - 只依赖 definitions 与权限纯函数，保持可被守卫/页面双向引用而无循环初始化。
 */

import { appRouteDefinitions, joinPath, ROUTE_PATHS } from '@/router/definitions'
import type { AppRouteDefinition } from '@/router/router.types'
import { hasMenuCode, isRootUser } from '@/services/auth/permission.model'
import type { PermissionCheckInput } from '@/services/auth/permission.model'

/** 无权限页地址；仅有暂缓权限时追加 scope 标记 */
export const NO_PERMISSION_PATH = ROUTE_PATHS['no-permission']

/** P41 区分标记：用户持有部分权限但全部落在暂缓模块 */
const DEFERRED_ONLY_SCOPE = 'deferred-only'

export interface AccessibleResolution {
  /** 可导航目标地址（有权业务页或无权限页） */
  path: string
  /** 目标是否为无权限页 */
  noPermission: boolean
  /** 无权限且用户仅持有暂缓模块权限（P41 区分文案依据） */
  deferredOnly: boolean
}

/**
 * 遍历菜单叶子（按 definitions 声明顺序 = 旧 MENU_ROUTE_ORDER 语义）。
 * 目录节点先于其子级出现；目录自身（无 loadPage/redirect）只作分组不参与。
 */
function walkMenuLeaves(
  definitions: readonly AppRouteDefinition[],
  basePath: string,
  visit: (leaf: AppRouteDefinition, path: string) => void,
): void {
  for (const definition of definitions) {
    const path = joinPath(basePath, definition.path)
    if (definition.children?.length) {
      walkMenuLeaves(definition.children, path, visit)
      continue
    }
    if (
      !definition.meta.hideInMenu &&
      definition.meta.menuCode !== undefined &&
      (definition.loadPage !== undefined || definition.redirect !== undefined)
    ) {
      visit(definition, path)
    }
  }
}

/** 解析当前身份的首个有权入口 */
export function resolveAccessibleEntry(
  input: PermissionCheckInput,
): AccessibleResolution {
  let firstImplemented: string | undefined
  let hasDeferredOnly = false
  const root = isRootUser(input.username)
  walkMenuLeaves(appRouteDefinitions, '/', (leaf, path) => {
    // 特权专属入口对非 root 不可作为入口（对齐源 access.ts ROOT_ONLY 行为）
    if (leaf.meta.rootOnly === true && !root) return
    if (!hasMenuCode(input, leaf.meta.menuCode!)) return
    if (leaf.meta.deferred === true) {
      // 暂缓模块：不是本轮入口，但证明用户并非完全无权限
      hasDeferredOnly = true
      return
    }
    if (firstImplemented === undefined) firstImplemented = path
  })
  if (firstImplemented !== undefined) {
    return { path: firstImplemented, noPermission: false, deferredOnly: false }
  }
  const path = hasDeferredOnly
    ? `${NO_PERMISSION_PATH}?scope=${DEFERRED_ONLY_SCOPE}`
    : NO_PERMISSION_PATH
  return { path, noPermission: true, deferredOnly: hasDeferredOnly }
}

/** 登录成功/目录默认入口/安全返回的统一目标地址 */
export function resolveFirstAccessiblePath(input: PermissionCheckInput): string {
  return resolveAccessibleEntry(input).path
}
