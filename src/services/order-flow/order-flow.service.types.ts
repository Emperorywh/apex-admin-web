/**
 * 工艺管理（订单工艺）DTO（P21 整页重写交付；owner=P21）。
 *
 * 协议来源：OpenAPI schemas OrderFlow / SubOrderFlow / OrderFlowParam /
 * OperationParam / OrderFlowPageParamOrderFlow / PageOrderFlow，字段与旧实现
 * types/MissionCluster/MissionFlow.d.ts 逐项核对一致。
 */

/** 工艺控制操作类型（OperationParam.operation 枚举，后端受控） */
export type OrderFlowOperationType = 'PAUSE' | 'CONTINUE' | 'CANCEL'

/** 工艺控制命令参数（主工艺与子工艺共用 OperationParam：int64 id 定位） */
export interface OrderFlowOperationParam {
  /** 数据库 id（int64，JSON number 承载——G10 与 P22/P23/P24 同口径） */
  id: number
  operation: OrderFlowOperationType
}

/** 子工艺（SubOrderFlow schema）：工艺展开行内的一行 */
export interface SubOrderFlowDto {
  /** 数据库 id（int64，展开子表行 ID 与控制命令定位共用） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 所属工艺唯一 key */
  orderFlowKey?: string
  /** 子工艺唯一 key */
  subOrderFlowKey?: string
  /** 来源订单模板名称/标识 */
  orderTemplateName?: string
  orderTemplateKey?: string
  /** 预约车辆（与车辆分组互斥，可均空） */
  appointVehicleKey?: string | null
  appointVehicleName?: string | null
  appointVehicleGroupKey?: string | null
  appointVehicleGroupName?: string | null
  /** 子任务列表（模板快照结构，本页不展开消费） */
  subOrderMissions?: unknown[]
  /**
   * 子工艺执行状态（后端受控枚举）：EXECUTING=执行中 / PAUSED=已暂停 /
   * ABNORMAL=异常 / CANCELLED=已取消 / FAILED=失败 / COMPLETED=已完成；
   * 未知枚举按纪律显示协议原值不臆造映射
   */
  subOrderFlowState?: string
}

/** 工艺（OrderFlow schema）：分页主表行 */
export interface OrderFlowDto {
  /** 数据库 id（int64，主表行 ID 与主工艺控制命令定位共用） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 工艺名称 */
  orderFlowName?: string
  /** 工艺唯一 key（调度系统标识） */
  orderFlowKey?: string
  /** 子工艺集合（展开行子表数据源） */
  subOrderFlows?: SubOrderFlowDto[]
  /** 触发方式：0=并行触发（周期到达即创建任务）/ 1=串行触发（等待上个任务终止） */
  triggerType?: number
  /** 触发次数（-1 表示无限循环） */
  triggerTimes?: number
  /** 触发的时间表达式（6 位 cron：秒 分 时 日 月 周，部署时区语义由后端解释） */
  cronExpression?: string
}

/** 分页查询参数（GET query 平铺：pageNo 从 1 计数；query=工艺名称模糊） */
export interface OrderFlowPageParam {
  pageNo: number
  pageSize: number
  query?: string
}

/** 分页响应（PageOrderFlow：records/total/size/current/pages） */
export interface OrderFlowPageDto {
  records?: OrderFlowDto[]
  total?: number
  size?: number
  current?: number
  pages?: number
}

/** 创建工艺参数（OrderFlowParam；重发=按行回显后走同一创建接口） */
export interface OrderFlowCreateParam {
  /** 工艺名称 */
  orderFlowName: string
  /** 订单模板 key 集合（顺序=穿梭框添加顺序，原样提交） */
  orderTemplateKeys: string[]
  /** cron 时间表达式（保留旧 6 位秒位与 ? 语义） */
  cronExpression: string
  /** 触发次数（-1=无限循环） */
  triggerTimes: number
  /** 触发方式：0=并行 / 1=串行 */
  triggerType: number
}
