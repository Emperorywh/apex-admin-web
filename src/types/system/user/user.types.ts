/**
 * 用户管理业务域实体（规格 §14.1）。
 * 被 pages/features/services/store 跨层共享的权威定义；
 * 请求/响应 DTO 随 service 任务放入 user.service.types.ts，不得复制本文件接口。
 */

/**
 * 所有实体 ID 都是非空字符串，时间统一使用带时区的 ISO 8601 字符串。
 * 前端不得假设 ID 可转换为安全整数。
 */
export interface User {
  id: string
  username: string
  displayName: string
  email: string
  phone?: string
  status: 'enabled' | 'disabled'
  roleIds: string[]
  createdAt: string
  updatedAt: string
}

/**
 * 分页从 1 开始，默认 size 为 10，最大 100（默认值/上限见 request.constants.ts）。
 * total 是应用过滤条件后的总数，不是当前页条数。
 */
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  size: number
}
