/**
 * 角色管理域常量。
 */

/** 列表 sort 白名单；协议同用户域 */
export const ROLE_SORT_FIELDS = ['code', 'name', 'createdAt', 'updatedAt'] as const

export type RoleSortField = (typeof ROLE_SORT_FIELDS)[number]
