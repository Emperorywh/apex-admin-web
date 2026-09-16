/**
 * @description 权限相关纯函数工具集
 *
 * 供 app.tsx（getInitialState）、Login、access.ts、useAccess 复用。
 * 统一定义于此（不在 app.tsx 内），避免运行时配置文件被业务 utils 反向引用产生循环依赖。
 *
 * 详见 docs/SPEC_menu_permission.md §6.8.1
 */
import { MENU_TREE, MenuPermNode, ROOT_ONLY_CODES } from "@/constants/permission";
import type { PermissionNode } from "@/types/Login";

/**
 * 超管账号判定（集中维护，B17）
 * 系统 root 为唯一固定超管账号，不可改名/禁用/出现非 root 用户名的超管。
 * 此前三处分散判断（access.ts、getFirstAccessiblePath、useAccess），
 * 现统一收敛到本函数，未来若超管标识变更（如改用 level/roles）只需改此处。
 *
 * 前置约束：后端须保证 root 为系统唯一固定超管账号。
 */
export function isRootUser(username?: string): boolean {
  return username === "root" || username === "administrator";
}

/**
 * 扁平化收集后端权限树的 code，深度优先
 * 仅收集「用户实际拥有」的 code；祖先分组完整性由 expandWithAncestors 兜底
 *
 * includeButtons（B1，评审 v1.1）：
 *   - 默认 false：只收 MENU 码（按钮源已切至 data.permissions 平铺数组，
 *     菜单集合无需 BUTTON 码，职责更清，菜单判定不受影响）
 *   - true：收 MENU + BUTTON 全集，仅供 dev 三向一致性告警（§10 ③）比对两源用
 */
export function flattenPermissionCodes(
  nodes?: PermissionNode[] | null,
  includeButtons = false
): Set<string> {
  const set = new Set<string>();
  const walk = (list?: PermissionNode[] | null) => {
    if (!list) return;
    for (const n of list) {
      // 默认仅收 MENU 码；BUTTON 码仅在显式 includeButtons=true 时收集
      if (includeButtons || n.type !== "BUTTON") {
        set.add(n.code);
      }
      if (n.childPermissions) walk(n.childPermissions);
    }
  };
  walk(nodes);
  return set;
}

/**
 * 防御性祖先填充（D15）：基于全量菜单结构 MENU_TREE
 * 若用户拥有某节点或其后代 code，则该节点及其全部祖先分组 code 进入结果集
 * 用于兜底后端权限树断链（§3.4）—— 保证「有子菜单则父分组可见」
 */
export function expandWithAncestors(userSet: Set<string>): Set<string> {
  const result = new Set(userSet);
  // 判断某子树内是否存在任一用户拥有的 code
  const subtreeHas = (node: MenuPermNode): boolean => {
    if (userSet.has(node.code)) return true;
    return (node.children ?? []).some(subtreeHas);
  };
  const walk = (nodes: MenuPermNode[], ancestors: string[]) => {
    for (const n of nodes) {
      if (subtreeHas(n)) {
        result.add(n.code); // 命中则补全自身
        ancestors.forEach((a) => result.add(a)); // 及全部祖先分组
      }
      if (n.children?.length) {
        walk(n.children, [...ancestors, n.code]);
      }
    }
  };
  walk(MENU_TREE, []);
  return result;
}

/**
 * 有序菜单路由清单：按 MENU_TREE 深度优先顺序，仅保留有 path 的节点（D16）
 * 分组节点 path 为空被自然过滤，故仅含「有实际页面」的叶子菜单
 * 作为 getFirstAccessiblePath 的遍历依据，不依赖运行时 routes API
 */
export const MENU_ROUTE_ORDER: { path: string; code: string }[] = (() => {
  const order: { path: string; code: string }[] = [];
  const walk = (nodes: MenuPermNode[]) => {
    for (const n of nodes) {
      if (n.path) order.push({ path: n.path, code: n.code });
      if (n.children?.length) walk(n.children);
    }
  };
  walk(MENU_TREE);
  return order;
})();

/**
 * 找首个可访问菜单路径（D6）
 * 策略：root 短路进首页；否则按 MENU_ROUTE_ORDER 顺序（即 .umirc.ts 书写顺序，D10）
 *       返回第一个「用户有权限」的菜单 path；全无权限返回 "/no-permission"
 *
 * 注意：调用处须传入 username，否则 username === "root" 短路分支不生效
 */
export function getFirstAccessiblePath(
  tree?: PermissionNode[] | null,
  username?: string,
): string {
  if (isRootUser(username)) return "/over-look"; // root 直接进首页（D5）
  const permSet = expandWithAncestors(flattenPermissionCodes(tree));
  for (const r of MENU_ROUTE_ORDER) {
    // root 专属菜单：非 root 跳过，避免登录后跳到无权限页（与 access.ts 一致）
    if (ROOT_ONLY_CODES.has(r.code)) continue;
    if (permSet.has(r.code)) return r.path;
  }
  return "/no-permission"; // 兜底：全无权限
}
