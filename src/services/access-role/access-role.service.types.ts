/**
 * 角色管理服务类型（P32 角色管理页；OpenAPI「角色管理」+「权限资源管理」）。
 *
 * AuthRoleRecord 对应 OpenAPI schema AuthRole（pageRoles 返回 records 元素；
 * 与 access-user 的 AuthRoleDto 同源 schema——角色在用户管理侧是「选项」、在
 * 本页是「管理主体」，两侧类型各自独立映射同一契约，避免跨服务耦合）。
 * 契约要点：
 * - id 为 int64 主键（G10：行 ID 统一字符串化守卫精度，写操作按 Number 提交）；
 * - state 为受控枚举 ENABLED/DISABLED（旧实现同源）；未知枚举按原值呈现不猜
 *   语义（纪律收敛：旧版状态列把非 ENABLED 一律渲染为「禁用」，重写后未知
 *   枚举显示原值、缺失留白，差异登记 P32 交接记录）；
 * - createTime/updateTime 协议为时间字符串，展示层经共享 displayDateTime 转
 *   换（缺失留白），不改协议原值——时间语义遵循部署时区（G15）；
 * - AuthPermissionNode 对应 OpenAPI schema AuthPermission（getPermissions 返回
 *   data 元素，childPermissions 递归构成权限资源树；树规模为全部菜单/按钮权
 *   限码，实测量级百级以内，三态勾选算法按 SPEC_permission_modal_tri_state
 *   的 O(n) 遍历实现，无需索引优化）。
 */

/** 角色状态（旧实现同源受控枚举：启用 / 禁用） */
export type AuthRoleState = 'ENABLED' | 'DISABLED'

/** 角色记录（pageRoles 返回 records 元素；字段与 OpenAPI AuthRole 一致） */
export interface AuthRoleRecord {
  /** 角色主键（int64；行 ID 来源，协议原样） */
  id?: number | string | null
  /** 创建时间（展示层 displayDateTime 转换、缺失留白） */
  createTime?: string | null
  /** 更新时间（展示层 displayDateTime 转换、缺失留白） */
  updateTime?: string | null
  /** 创建人（契约字段；旧版页面未展示，保留类型完整） */
  createUser?: string | null
  /** 更新人（契约字段；旧版页面未展示，保留类型完整） */
  updateUser?: string | null
  /** 角色编码（删除确认对象展示用） */
  code?: string | null
  /** 角色名称 */
  name?: string | null
  /** 状态（ENABLED/DISABLED；未知枚举原值呈现） */
  state?: string | null
}

/** 角色分页查询参数（GET pageRoles，query 平铺；旧实现同形态不归一化） */
export interface AuthRolePageParam {
  /** 当前页码（从 1 计数；页面用 toBackendPage 从零基 pageIndex 换算） */
  pageNo: number
  /** 每页数量 */
  pageSize: number
  /** 关键字（按编码/名称模糊过滤；空条件裁剪不提交） */
  query?: string
}

/** 角色分页结果载体（与后端 ResultPageAuthRole.data 一致；仅消费业务字段） */
export interface AuthRolePageResult {
  records?: AuthRoleRecord[] | null
  total?: number | null
  size?: number | null
  current?: number | null
}

/** 新增角色参数（POST addRole JSON body；OpenAPI AuthRoleAddParam） */
export interface AuthRoleAddParam {
  /** 角色编码（必填，最长 64，前端 showCount） */
  code: string
  /** 角色名称（必填，最长 64，前端 showCount） */
  name: string
  /** 角色状态（ENABLED/DISABLED） */
  state: AuthRoleState
}

/** 更新角色参数（POST updateRole JSON body；OpenAPI AuthRoleUpdateParam，按 id 定位） */
export interface AuthRoleUpdateParam {
  /** 目标角色主键 */
  id: number
  /** 角色编码 */
  code: string
  /** 角色名称 */
  name: string
  /** 角色状态 */
  state: AuthRoleState
}

/** 按角色 id 定位的通用参数（deleteRole 共用） */
export interface AuthRoleIdParam {
  /** 角色主键 */
  id: number
}

/** 权限资源节点（getPermissions 返回 data 元素；childPermissions 递归成树） */
export interface AuthPermissionNode {
  /** 权限主键（int64；三态勾选集合 S 的 key 来源） */
  id?: number | string | null
  createTime?: string | null
  updateTime?: string | null
  createUser?: string | null
  updateUser?: string | null
  /** 权限编码（auth:* 码；树展示仅用 name，编码不渲染不提交——专项验收：
   *  勾选显示与提交值分离，提交的是权限 id 集合而非翻译标签） */
  code?: string | null
  /** 权限名称（树节点标题） */
  name?: string | null
  /** 权限类型（MENU/BUTTON；展示层不做类型区分渲染，等价旧版） */
  type?: string | null
  /** 父权限编码（树结构由 childPermissions 承载，本字段保留契约完整） */
  parentCode?: string | null
  /** 前端路由路径（菜单渲染侧消费；本页不消费） */
  path?: string | null
  /** 前端菜单图标（本页不消费） */
  icon?: string | null
  /** 排序（本页不消费） */
  sort?: number | null
  /** 状态（本页不消费；权限树不做状态过滤，等价旧版） */
  state?: string | null
  /** 子权限（递归构成权限资源树） */
  childPermissions?: AuthPermissionNode[] | null
}

/** 查询权限资源参数（GET getPermissions，query 平铺）。
 * 不带 roleId → 全部权限资源树（渲染候选）；带 roleId → 该角色已分配权限树
 * （回显勾选，含空半选父级——被独立授权的父节点原样返回，SPEC R3 契约）。 */
export interface AuthPermissionQueryParam {
  /** 目标角色主键（回显已分配权限时携带） */
  roleId?: number
}

/** 分配角色权限参数（POST assignPermissions JSON body；OpenAPI AssignRolePermissionsParam） */
export interface AssignRolePermissionsParam {
  /** 目标角色主键 */
  roleId: number
  /** 授权权限 id 集合（授权集合 S 直接展开：父级与子级 id 混存，空半选父级
   *  仅含自身 id=独立授权语义；整组提交=整体替换，未在集合中的权限即回收） */
  permissionIds: number[]
}
