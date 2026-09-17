/**
 * 权限判定纯函数（T00.4 权限与路由）。
 *
 * 只依赖会话数据与权限码常量，不依赖路由树：
 * 与路由结构相关的可见性/落点判定在 @/router/routeAccess 中组合实现。
 * 语义对齐旧项目 src/utils/permission.ts，集中管理超管规则（规格 5.8 / D19）。
 */

import type { AuthPermissionDto } from '@/services/auth/auth.service.types'

/**
 * 超管账号判定（集中维护，规格 5.8）：旧系统固定 root 与 administrator 两个超管用户名。
 * 前置约束：后端保证这两个账号为系统固定超管；用户名取真实登录返回值，不信任任意输入。
 */
export function isRootUser(username?: string | null): boolean {
  return username === 'root' || username === 'administrator'
}

/**
 * 从后端权限树深度优先收集菜单码（type=MENU 的 code）。
 * 对齐旧 flattenPermissionCodes 默认行为：BUTTON 码不参与菜单/路由判定，
 * 按钮码统一走会话 permissions 平铺数组（hasButtonCode）。
 */
export function flattenMenuCodes(
  nodes?: AuthPermissionDto[] | null,
): Set<string> {
  const codes = new Set<string>()
  const walk = (list?: AuthPermissionDto[] | null): void => {
    if (!list) return
    for (const node of list) {
      // 仅收 MENU 码；code 为空的后端脏数据不进入集合
      if (node.type === 'MENU' && node.code) codes.add(node.code)
      walk(node.childPermissions)
    }
  }
  walk(nodes)
  return codes
}

/**
 * 按钮权限码判定：会话 permissions 平铺数组包含即持有。
 * 调用方（usePermission）负责超管短路；本函数保持纯判定。
 */
export function hasButtonCode(
  permissions: readonly string[],
  code: string,
): boolean {
  return permissions.includes(code)
}
