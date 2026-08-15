/**
 * 权限树纯函数工具（规格 §14.1 PermissionNode）。
 * 叶子权限码收集被角色分配权限 Drawer（勾选初始值推导与提交载荷）与
 * demo adapter（分配权限的权限码存在性校验）共用；
 * 不依赖 React，保持纯函数以便跨层复用与独立测试。
 */
import type { PermissionNode } from '@/types/system/role/role.types'

/**
 * 收集权限树全部叶子节点的 permCode（按树序输出）。
 * 只有叶子节点必须提供 permCode（规格 §14.1）；目录节点与缺失 permCode 的
 * 异常叶子不产出权限码，直接跳过。
 */
export function collectPermissionLeafCodes(nodes: readonly PermissionNode[]): string[] {
  const leafCodes: string[] = []
  const walk = (current: readonly PermissionNode[]): void => {
    for (const node of current) {
      if (node.children !== undefined && node.children.length > 0) {
        walk(node.children)
      } else if (node.permCode !== undefined) {
        leafCodes.push(node.permCode)
      }
    }
  }
  walk(nodes)
  return leafCodes
}
