/**
 * 权限判定唯一实现（规格 §4.4/§5.2）：
 * useAuth、Auth 组件、菜单投影与路由守卫全部复用 hasPermissionCode，
 * 不允许在任何调用点另写一份包含/通配判断。
 * 本模块只做纯函数判定与 user 切片读取，不发起请求、不感知路由。
 */
import { ADMIN_ROLE_CODE } from '@/constants/system/role/role.constants'
import { PERMISSION_WILDCARD } from '@/constants/permission.constants'
import type { UserState } from '@/store/slices/user.slice'

/**
 * 判定权限快照是否满足单个权限码（规格 §4.4）：
 * admin 角色（按角色 code 判定，规格 §14.1）或持有 '*' 通配时对任意 code 均返回 true；
 * 其余按权限码精确命中。hasAuth('*') 依通配语义返回。
 */
export function hasPermissionCode(
  permCodes: readonly string[],
  roleCodes: readonly string[],
  code: string,
): boolean {
  if (roleCodes.includes(ADMIN_ROLE_CODE) || permCodes.includes(PERMISSION_WILDCARD)) {
    return true
  }
  return permCodes.includes(code)
}

/**
 * 判定权限快照是否满足一条完整权限码链（规格 §4.4）：
 * 祖先与叶子权限为 AND——链上任一权限码不满足即整体不满足；
 * 链为空（无 permCode 的路由）表示所有已登录用户可访问，返回 true。
 * 路由守卫、菜单过滤与失权页签判定共用本函数，不得另写一份链式判断。
 */
export function hasPermissionChain(chain: readonly string[], input: PermissionInput): boolean {
  return chain.every((code) => hasPermissionCode(input.permCodes, input.roleCodes, code))
}

/** 权限判定的输入快照：来自 user 切片的权限码与角色 code 列表 */
export interface PermissionInput {
  readonly permCodes: readonly string[]
  readonly roleCodes: readonly string[]
}

/** 从 user 切片状态读取权限判定输入（菜单投影/守卫/按钮级判定共用） */
export function selectPermissionInput(state: { user: UserState }): PermissionInput {
  return { permCodes: state.user.permCodes, roleCodes: state.user.roles }
}
