/**
 * 角色管理业务域实体（规格 §14.1）。
 * 被 pages/features/services/store 跨层共享的权威定义；
 * 请求/响应 DTO 随 service 任务放入 role.service.types.ts，不得复制本文件接口。
 */

/**
 * code 是后端稳定角色标识；builtIn 角色禁止删除和修改 code。
 * permCodes 返回完整权限码集合，不返回半选节点状态。
 */
export interface Role {
  id: string
  code: string
  name: string
  description?: string
  status: 'enabled' | 'disabled'
  builtIn: boolean
  permCodes: string[]
  createdAt: string
  updatedAt: string
}

/**
 * 权限树节点 key 全局唯一；只有叶子节点必须提供 permCode。
 * checked 状态由 Role.permCodes 推导，不由接口重复返回。
 */
export interface PermissionNode {
  key: string
  title: string
  permCode?: string
  children?: PermissionNode[]
}
