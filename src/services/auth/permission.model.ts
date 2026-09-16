/**
 * 权限模型纯函数：权限树扁平化、祖先填充、源特权分支与双源判定。
 *
 * 迁移自旧系统 utils/permission.ts（@ e570b8df），按目标分层拆分：
 * - 本模块只保留纯函数与可注入的全量菜单树，不依赖 Redux / 组件；
 * - 全量菜单结构（旧 MENU_TREE）在 T007 接入路由单源前为空集：
 *   祖先填充退化为恒等（只保留用户自有的码），T007 绑定 definitions 后自动生效；
 * - 判定规则（SPEC §8.2）：
 *   · 菜单源 = permissionsTree 扁平化（仅 MENU 码）+ 祖先填充；
 *   · 按钮源 = flatPermissions 平铺数组直接建集合，不做祖先填充；
 *   · 两源不互相兜底；
 *   · isRootUser 为源实际判定：username 为 root 或 administrator 均走特权分支，
 *     不沿用"仅 root"的旧注释收窄。
 */

import type { PermissionNode } from '@/types/auth/auth.types'

/** 全量菜单树节点（祖先填充的结构来源；T007 从路由定义派生后注入） */
export interface MenuPermNode {
  code: string
  children?: MenuPermNode[]
}

/* -------------------------------------------------------------------------- */
/* 全量菜单树注入点（T007 绑定路由定义；为空时祖先填充为恒等）                       */
/* -------------------------------------------------------------------------- */

let permissionMenuTree: MenuPermNode[] = []

/** 注册全量菜单结构；重复注册以最后一次为准（启动期一次性调用） */
export function setPermissionMenuTree(tree: MenuPermNode[]): void {
  permissionMenuTree = tree
}

/** 读取当前注册的全量菜单结构（诊断/测试用） */
export function getPermissionMenuTree(): MenuPermNode[] {
  return permissionMenuTree
}

/* -------------------------------------------------------------------------- */
/* 源特权分支（SPEC §8.2：root 与 administrator 均放行）                          */
/* -------------------------------------------------------------------------- */

/** 超管账号判定：集中维护，与冻结源码 isRootUser 行为一致 */
export function isRootUser(username?: string | null): boolean {
  return username === 'root' || username === 'administrator'
}

/* -------------------------------------------------------------------------- */
/* 扁平化与祖先填充                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 深度优先扁平化权限树的 code 集合。
 * 默认只收 MENU 码（菜单源）；includeButtons=true 时收 MENU + BUTTON 全集，
 * 仅供核对两源一致性，不参与常规判定。
 */
export function flattenPermissionCodes(
  nodes?: PermissionNode[] | null,
  includeButtons = false,
): Set<string> {
  const set = new Set<string>()
  const walk = (list?: PermissionNode[] | null): void => {
    if (!list) return
    for (const node of list) {
      if (includeButtons || node.type !== 'BUTTON') {
        set.add(node.code)
      }
      walk(node.childPermissions)
    }
  }
  walk(nodes)
  return set
}

/**
 * 防御性祖先填充：基于全量菜单结构，
 * 用户拥有某节点或其后代任一 code 时，该节点及其全部祖先分组 code 进入结果集。
 * 兜底后端权限树断链——保证「有子菜单则父分组可见」；仅有父级不自动获得子页访问权。
 */
export function expandWithAncestors(
  userSet: Set<string>,
  menuTree: MenuPermNode[] = permissionMenuTree,
): Set<string> {
  const result = new Set(userSet)
  // 判断某子树内是否存在用户拥有的任一 code
  const subtreeHas = (node: MenuPermNode): boolean => {
    if (userSet.has(node.code)) return true
    return (node.children ?? []).some(subtreeHas)
  }
  const walk = (nodes: MenuPermNode[], ancestors: string[]): void => {
    for (const node of nodes) {
      if (subtreeHas(node)) {
        // 命中则补全自身与全部祖先分组码
        result.add(node.code)
        ancestors.forEach((code) => result.add(code))
      }
      if (node.children?.length) {
        walk(node.children, [...ancestors, node.code])
      }
    }
  }
  walk(menuTree, [])
  return result
}

/* -------------------------------------------------------------------------- */
/* 派生集合与判定（消费方经 useAuth / 选择器使用，不直接拼装）                       */
/* -------------------------------------------------------------------------- */

/** 菜单权限集合：permissionsTree 扁平化（仅 MENU）+ 祖先填充 */
export function deriveMenuCodes(permissionsTree?: PermissionNode[] | null): Set<string> {
  return expandWithAncestors(flattenPermissionCodes(permissionsTree))
}

/** 按钮权限集合：flatPermissions 平铺数组直接建集合，不做祖先填充（与菜单源解耦） */
export function deriveButtonCodes(flatPermissions?: string[] | null): Set<string> {
  return new Set(flatPermissions ?? [])
}

/** 判定入参：身份快照的最小消费面（避免把整个 Redux 状态带入业务判定） */
export interface PermissionCheckInput {
  username?: string | null
  permissionsTree?: PermissionNode[] | null
  flatPermissions?: string[] | null
}

/** 菜单码判定：特权账号短路放行；普通账号按祖先填充后的菜单集合 */
export function hasMenuCode(input: PermissionCheckInput, code: string): boolean {
  if (isRootUser(input.username)) return true
  return deriveMenuCodes(input.permissionsTree).has(code)
}

/** 按钮码判定：特权账号短路放行；普通账号按按钮源平铺集合（两源不互相兜底） */
export function hasButtonCode(input: PermissionCheckInput, code: string): boolean {
  if (isRootUser(input.username)) return true
  return deriveButtonCodes(input.flatPermissions).has(code)
}
