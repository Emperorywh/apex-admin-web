/**
 * 请求基础设施类型：协议级 DTO 与错误模型。
 * 与业务域无关，供所有 service 共用。
 */

/** 后端统一状态编码（无 enabled） */
export type EntityStatus = 'active' | 'disabled'

/** 分页/排序查询参数（协议：page/pageSize/sort 单参数、'-' 前缀降序、status 筛选） */
export interface PageQuery {
  page: number
  pageSize: number
  /** 逗号分隔 camelCase 字段，'-' 前缀降序；不传则不排序 */
  sort?: string
  status?: EntityStatus
}

/** 分页响应（固定结构） */
export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  pages: number
}

/** 422 校验错误条目（field 带 body. 前缀） */
export interface ApiFieldError {
  field: string
  reason: string
  message: string
}

/** 规范化后的 API 错误；后端 problem+json 与前端本地错误统一收敛到此形状 */
export interface ApiError {
  readonly isApiError: true
  /** 稳定错误码：<MODULE>.<REASON> 或 CLIENT.* */
  readonly code: string
  /** HTTP 状态码；网络错误为 0 */
  readonly status: number
  readonly title: string
  readonly detail?: string
  readonly errors?: ApiFieldError[]
}

/** 请求可选项 */
export interface RequestOptions {
  signal?: AbortSignal
}
