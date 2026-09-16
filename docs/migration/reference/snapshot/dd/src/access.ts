/**
 * @description 权限定义，统一管理
 * @date 2025-7-25
 * @access 参考文档 https://umijs.org/docs/max/access
 *
 * 基于 initialState.permissions（已扁平化 + 祖先填充的权限码集合）判定：
 * - root 用户：短路全权限（D5/D14），所有路由 access code 放行
 * - 普通用户：严格按 permissions 集合判定
 * - 未登录或无权限树：permissions 为空 → 全部 code 为 false → 全拦截
 *
 * 方案：显式枚举 PERM 生成 map（U2 已收敛为唯一方案，不使用 Proxy）
 *   - 路由 access 字段值仅取自 PERM（菜单码，有限集合），显式枚举即可覆盖
 *   - 按钮码（200+，不在 PERM）不走路由 access，统一由 useAccess 基于 Set 判定（§6.7）
 *   - 显式 map 规避了 Proxy 在 Umi access model 下「是否枚举 keys」的不确定性
 *
 * 详见 docs/SPEC_menu_permission.md §6.3
 */
import { GlobalTypes } from "./types/typing";
import { PERM, ROOT_ONLY_CODES } from "@/constants/permission";
import { isRootUser } from "@/utils/permission";

/** 路由 access 字段引用的全部 code（菜单级，有限可枚举） */
const ROUTE_ACCESS_CODES = Object.values(PERM);

export default (initialState: GlobalTypes.InitialState) => {
  const { username, token, permissions } = initialState ?? {};
  const isLogged = !!(username && token);

  // root 短路：所有路由 access code 放行（D5/D14）
  if (isLogged && isRootUser(username)) {
    return Object.fromEntries(ROUTE_ACCESS_CODES.map((c) => [c, true]));
  }

  // 普通用户：逐 code 判定是否在（已祖先填充的）权限集合中
  // root 专属菜单（ROOT_ONLY_CODES）一律拦截，不依赖后端权限数据
  // 未登录或无权限树时 permissions 为空 → 其余 code 为 false → 拦截
  const map: Record<string, boolean> = {};
  ROUTE_ACCESS_CODES.forEach((c) => {
    if (ROOT_ONLY_CODES.has(c)) {
      map[c] = false;
      return;
    }
    map[c] = !!permissions?.has(c);
  });
  return map;
};
