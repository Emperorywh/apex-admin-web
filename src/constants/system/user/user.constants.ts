/**
 * 用户管理域常量。
 */

/** 列表 sort 白名单；后端协议为单参数、逗号分隔、'-' 前缀降序 */
export const USER_SORT_FIELDS = ['username', 'displayName', 'createdAt', 'updatedAt'] as const

export type UserSortField = (typeof USER_SORT_FIELDS)[number]
