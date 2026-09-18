/**
 * 车辆动作共享 DTO（GET /action/agvAction/getAGVActions 与
 * GET /action/agvActionGroup/getAGVActionGroups，OpenAPI AGVAction / AGVActionGroup schema）。
 * contracts.md 第 5 节唯一 operation 登记：P03 代建、P24 动作管理页后续消费。
 */

/** 动作参数：键值对（value 为任意 JSON 对象，原样透传不解释） */
export interface ActionParameterDto {
  key?: string
  value?: unknown
}

/**
 * 车辆动作信息（AGVAction schema 全量字段）。
 * 创建任务提交时按 OpenAPI ActionParam 形状裁剪（剥离 id/审计字段），
 * 见 order-record 服务层的 toActionParam 转换。
 */
export interface AGVActionDto {
  /** 后端自增主键（int64，选项 value 用；G10 精度联调核实项） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 动作类型（协议原值） */
  actionType?: string
  /** 动作描述（展示用，后端原文） */
  actionDescription?: string
  /** 阻塞类型：NONE/SOFT/HARD */
  blockingType?: 'NONE' | 'SOFT' | 'HARD'
  /** 动作参数集合 */
  actionParameters?: ActionParameterDto[]
}

/** 车辆动作分组：组名称 + 组内动作完整集合（创建任务选分组时整组提交） */
export interface AGVActionGroupDto {
  /** 后端自增主键（int64，选项 value 用） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 动作组名称（展示用） */
  actionGroupName?: string
  /** 组内动作完整集合（OpenAPI AGVActionGroup.agvActions） */
  agvActions?: AGVActionDto[]
}
