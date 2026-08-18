/**
 * 分页参数守卫（规格 §14.3）：无业务语义的纯工具。
 * 把任意输入归一化为合法分页参数，供列表查询与 URL 参数解析共用；
 * 默认值与上限的唯一所有者是 request.constants.ts。
 */
import { PAGE_DEFAULT, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '@/constants/request.constants'

/** 归一化后的分页参数：page 从 1 开始，size 在 [1, PAGE_SIZE_MAX] 内 */
export interface NormalizedPagination {
  page: number
  size: number
}

/** 有限正整数才视为有效输入；undefined、NaN、小数与负数一律回退默认值 */
function isPositiveInteger(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/**
 * 归一化分页参数：
 * - page 为正整数时保留，小于 1 或非法时回退 PAGE_DEFAULT；
 * - size 为正整数时截断到 PAGE_SIZE_MAX，非法或小于 1 时回退 PAGE_SIZE_DEFAULT。
 */
export function normalizePagination(input: {
  page?: number | null
  size?: number | null
}): NormalizedPagination {
  const page = isPositiveInteger(input.page) ? input.page : PAGE_DEFAULT
  const size = isPositiveInteger(input.size)
    ? Math.min(input.size, PAGE_SIZE_MAX)
    : PAGE_SIZE_DEFAULT
  return { page, size }
}
