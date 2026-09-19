/**
 * 动作分组管理 DTO（P24；owner 归 P24，contracts.md 第 5 节登记）。
 *
 * 与共享类型 AGVActionGroupDto（agv-action.service.types.ts）的差异：
 * 分页行直接消费 OpenAPI AGVAction schema 全量字段（组内动作完整对象），
 * 不裁剪审计字段——列表「动作组动作」列的拖拽 Tag 只消费
 * id/actionDescription 两个稳定字段，其余字段原样保留不解释。
 */

/** 组内动作条目（OpenAPI AGVAction；P23 管理页维护，本页只读消费） */
export interface AgvActionGroupItemDto {
  /** 后端自增主键（int64；拖拽排序与组内动作提交的稳定标识） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 动作类型（协议原值，本页不展示） */
  actionType?: string
  /** 动作描述（组内动作 Tag 的展示文本） */
  actionDescription?: string
  /** 阻塞类型：NONE/SOFT/HARD（本页不展示） */
  blockingType?: string
  /** 动作参数集合（本页不展示） */
  actionParameters?: { key?: string; value?: unknown }[]
}

/** 动作分组行（OpenAPI AGVActionGroup 全量字段） */
export interface AgvActionGroupRowDto {
  /** 后端自增主键（int64；行 ID/写操作定位标识） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 动作组名称（列表列 + 编辑回显） */
  actionGroupName?: string
  /** 组内动作完整集合（服务端权威顺序；拖拽重排按此数组求新顺序） */
  agvActions?: AgvActionGroupItemDto[]
}

/** 分页响应（OpenAPI PageAGVActionGroup；total int64 经 JSON number 接收） */
export interface AgvActionGroupPageDto {
  records?: AgvActionGroupRowDto[] | null
  total?: number
  size?: number
  current?: number
  pages?: number
}

/**
 * 分页查询参数（G04 平铺口径：OpenAPI 把 query 对象 AGVActionGroupPageParamAGVActionGroup
 * 声明在 query 位置，实际请求形如 ?pageNo=1&pageSize=10&query=…，前端平铺传参）。
 */
export interface AgvActionGroupPageParam {
  pageNo: number
  pageSize: number
  /** 动作组名称模糊查询（可选） */
  query?: string
}

/**
 * 新增/编辑/删除共用请求体（OpenAPI AGVActionGroupParam）。
 * - 新增：{agvActionGroupName, agvActionIds}；
 * - 编辑：另带 id（int64 定位）——名称与动作 id 集合整体提交；
 * - 删除：旧实现仅提交 {id}（body 参数类型的既有形态，P23 deleteAgvAction
 *   同款），本服务同形态。
 */
export interface AgvActionGroupParamDto {
  id?: number
  agvActionGroupName?: string
  /** 组内动作 id 集合（int64 数组；顺序即组内动作顺序） */
  agvActionIds?: number[]
}
