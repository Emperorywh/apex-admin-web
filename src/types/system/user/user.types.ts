/**
 * 用户管理业务域实体（对齐真实后端 identity UserResponse，apex-admin SPEC 11.2/9.3）。
 * 被 pages/features/services/store 跨层共享的权威定义；
 * 请求/响应 DTO 随 service 任务放入 user.service.types.ts，不得复制本文件接口。
 */

/**
 * 所有实体 ID 都是非空字符串（后端 UUID v4），时间统一为带时区的 ISO 8601 字符串。
 * 可空字段后端返回 null（不是缺省），前端类型显式声明 `| null` 与协议一致。
 */

/** 用户状态稳定编码（后端 UserStatus StrEnum：active / disabled） */
export type UserStatus = 'active' | 'disabled'

/** 用户所属部门投影（org 模块 G2 阶段未接入时为 null） */
export interface UserDepartmentInfo {
  departmentId: string
  departmentCode: string
  departmentName: string
  isPrimary: boolean
}

/** 用户岗位投影（org 模块 G2 阶段未接入时空数组） */
export interface UserPostInfo {
  postId: string
  postCode: string
  postName: string
}

/** 用户实体：密码哈希不出现在响应中（后端 SPEC 23.2 敏感字段不回显） */
export interface User {
  id: string
  username: string
  displayName: string
  status: UserStatus
  phone: string | null
  email: string | null
  lastLoginAt: string | null
  passwordUpdatedAt: string | null
  createdAt: string
  updatedAt: string
  department: UserDepartmentInfo | null
  posts: UserPostInfo[]
}

/**
 * 页码分页响应（后端 SPEC 9.4 固定结构，camelCase）：
 * page 从 1 开始，pageSize 默认 20、范围 1-100；
 * total 是应用过滤条件后的总数，pages 是总页数（total 为 0 时为 0）。
 */
export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  pages: number
}
