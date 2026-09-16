/**
 * 从路由定义派生全量菜单权限树并注入身份层（T007 绑定点）。
 *
 * 旧系统手工维护 MENU_TREE（permission.ts @ e570b8df），与其 .umirc.ts 菜单
 * 层级镜像；目标系统以 definitions.tsx 为唯一菜单结构来源，本模块在启动期
 * 派生一次并调用 setPermissionMenuTree，使祖先填充（expandWithAncestors）
 * 按「有子菜单则父分组可见」生效。结构要求：
 * - 只收录参与菜单层级与权限判定的节点（有 menuCode，且非 hideInMenu 辅助页）；
 * - 详情页、个人中心等 hideInMenu 页面不进权限树（与旧 MENU_TREE 一致）；
 * - 分组层级沿 definitions 父子关系折叠，连续分组节点保持逐级嵌套。
 */

import { setPermissionMenuTree, type MenuPermNode } from '@/services/auth/permission.model'
import { appRouteDefinitions } from '@/router/definitions'
import type { AppRouteDefinition } from '@/router/router.types'

/** 从定义子树派生权限树节点；无 menuCode 的节点只作结构穿透，不入结果 */
function toPermNodes(
  definitions: readonly AppRouteDefinition[],
): MenuPermNode[] | undefined {
  const nodes: MenuPermNode[] = []
  for (const definition of definitions) {
    if (definition.meta.hideInMenu) continue
    const children = definition.children?.length
      ? toPermNodes(definition.children)
      : undefined
    if (definition.meta.menuCode) {
      nodes.push({
        code: definition.meta.menuCode,
        ...(children?.length ? { children } : {}),
      })
    } else if (children?.length) {
      // 纯结构节点（如受保护根）：提升子节点，不产生额外层级
      nodes.push(...children)
    }
  }
  return nodes.length > 0 ? nodes : undefined
}

/** 派生结果（含菜单别名等全部参与权限的节点）；供诊断核对 */
export const permissionMenuTreeFromDefinitions: MenuPermNode[] =
  toPermNodes(appRouteDefinitions) ?? []

// 路由定义就绪后一次性注入：祖先填充由恒等切换为按树补全
setPermissionMenuTree(permissionMenuTreeFromDefinitions)
