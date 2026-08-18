/**
 * 排序参数组装（后端 SPEC 9.4）：把 UI 语义的单字段 + 方向组合为后端 sort 查询参数。
 * 后端协议：sort 为逗号分隔 camelCase 字段，`-` 前缀表示降序（如 `-createdAt`）；
 * 字段合法性由各列表接口的白名单（USER_SORT_FIELDS / ROLE_SORT_FIELDS）约束，
 * 调用方负责只传白名单内字段。
 */
import type { SortOrder } from '@/constants/request.constants'

/** 组装单字段排序参数：desc 加 `-` 前缀，asc 原样输出 */
export function buildSortParam(field: string, order: SortOrder): string {
  return order === 'desc' ? `-${field}` : field
}
