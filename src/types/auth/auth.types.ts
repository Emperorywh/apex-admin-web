/**
 * 认证域跨层实体：旧协议身份快照与权限树节点。
 *
 * 身份模型对齐旧系统（SPEC §6.2、D06）：
 * - 唯一会话来源是旧后端 /fms/v1/auth/authorize/*；
 * - 权限双源分算：permissionsTree（菜单源）与 permissions（按钮源）不互相兜底；
 * - 本快照只含非敏感数据，token 不进 Redux（由 identity.storage + setLegacyToken 管理）。
 */

/** 后端权限树节点结构（与登录/详情接口 data.permissionsTree 一一对应） */
export interface PermissionNode {
  id: number
  /** 权限码，唯一标识，如 "overview:view" */
  code: string
  /** 展示名，如 "调度监控" */
  name: string
  type: 'MENU' | 'BUTTON'
  /** 父节点 code；顶级为空串 */
  parentCode: string
  /** 前端路由路径（分组节点为空串） */
  path: string
  /** 图标名（仅顶级节点有值） */
  icon: string
  /** 排序值 */
  sort: number
  /** 状态，如 "ENABLED" */
  state: string
  childPermissions: PermissionNode[] | null
}

/**
 * 唯一身份快照：登录 / 刷新恢复 / 详情核查共用同一结构。
 * permissionsTree 原样保留后端树（菜单判定与后续角色授权编辑的消费源）；
 * flatPermissions 为后端 data.permissions 平铺数组（按钮判定源）。
 */
export interface IdentitySnapshot {
  /** 登录账号名；root/administrator 走源特权分支（permission.model.isRootUser） */
  username: string
  /**
   * 软件激活状态；源判定为严格 `activated === false` 才进授权流程，
   * 字段缺失视为已激活（true），与源行为一致。
   */
  activated: boolean
  /** 菜单权限源：后端权限树原样存储 */
  permissionsTree: PermissionNode[]
  /** 按钮权限源：后端平铺权限码数组（含 MENU + BUTTON + 祖先分组码全集） */
  flatPermissions: string[]
}
