/**
 * 任务管理域 DTO（P03 重写，逐字段核对 OpenAPI schema，接口族
 * dispatcher/orderRecord、dispatcher/orderTask；模板遗留的假协议类型已删除）。
 *
 * 时间约定：后端时间均为「yyyy-MM-dd HH:mm:ss」墙钟字符串（部署时区，
 * 真实响应已实证该形状），前端不做时区换算，展示统一走 datetimeDisplay 工具。
 * 精度约定（G10）：int64 字段（id/total/size/current/pages 等）按 JSON number
 * 承载并登记联调核实项；表格行 ID 一律取字符串业务键（orderKey/orderMissionKey），
 * 不依赖数值 id，规避精度丢失后的选择/展开错位。
 */

import type { BackendPageQuery, BackendPageResult } from '@/services/request/request.types'

/** 任务类型（OpenAPI OrderRecord.orderType 枚举） */
export type OrderType = 'WORK' | 'CHARGE' | 'PARK' | 'BATTERY_MAINTAIN'

/** 任务状态（OpenAPI OrderRecord.orderState 枚举） */
export type OrderState =
  | 'IN_QUEUE'
  | 'OUT_QUEUE'
  | 'PROCESSING'
  | 'HANG'
  | 'CANCELLED'
  | 'SUCCEEDED'
  | 'FAILED'

/** 任务操作命令（OpenAPI OrderTaskOperate.operate 枚举，与旧实现逐一对应） */
export type OrderTaskOperateCommand =
  | 'CMD_ORDER_CANCEL'
  | 'CMD_ORDER_IN_QUEUE_TO_OUT_QUEUE'
  | 'CMD_ORDER_OUT_QUEUE_TO_IN_QUEUE'
  | 'CMD_ORDER_HANG_TO_SKIP'
  | 'CMD_ORDER_HANG_TO_CONTINUE'

/** 任务记录（OpenAPI OrderRecord schema；列表行与详情主体同形） */
export interface OrderRecordDto {
  /** 后端自增主键（int64；行 ID 用 orderKey，不用本字段） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 工艺唯一 key（工艺链路创建的订单携带） */
  processKey?: string | null
  /** 外部接口唯一 id（可能为 null，如充电类订单） */
  taskId?: string | null
  /** 订单 key：创建时自动生成的稳定业务标识（表格行 ID） */
  orderKey?: string
  orderName?: string
  orderType?: OrderType
  priority?: number
  /** 优先级升序值（null 不参与计算；后端排序口径字段，前端不提交） */
  priorityAsc?: number | null
  appointVehicleKey?: string | null
  appointVehicleName?: string | null
  appointVehicleGroupKey?: string | null
  appointVehicleGroupName?: string | null
  /** 订单扩展参数（键值集合，原样透传） */
  extendParameters?: { key: string; value: unknown }[]
  executeVehicleKey?: string | null
  executeVehicleName?: string | null
  orderState?: OrderState
  /** 开始执行时间（未执行为 null） */
  executeTime?: string | null
  /** 终止时间：完成/取消/失败时刻（未终止为 null） */
  finalTime?: string | null
  hangReason?: string | null
  cancelReason?: string | null
  failReason?: string | null
  /** 子任务列表：列表接口不返回内容（详情走 getOrderRecordDetail 分页），类型保留协议形状 */
  orderMissions?: unknown[]
}

/** 任务列表查询参数（OpenAPI OrderRecordPageParamOrderRecord；GET 平铺 query，G04 联调核实项） */
export interface OrderRecordPageParam extends BackendPageQuery {
  /** 订单编号或名称模糊查询 */
  query?: string
  orderType?: OrderType
  orderState?: OrderState
  /** 执行车辆 key（筛选车辆维度） */
  vehicleKey?: string
  /** 各时间区间起止（含边界），格式 yyyy-MM-dd HH:mm:ss；仅传有值字段 */
  startCreateTime?: string
  endCreateTime?: string
  startExecutionTime?: string
  endExecutionTime?: string
  startFinalTime?: string
  endFinalTime?: string
}

/** 任务记录分页响应 data（OpenAPI PageOrderRecord，MyBatis-Plus 形状） */
export type OrderRecordPage = BackendPageResult<OrderRecordDto>

/** 任务状态统计（OpenAPI OrderRecordStateStatistic；七个计数均 int64→number，G10） */
export interface OrderRecordStateStatisticDto {
  totalNumber?: number
  successNumber?: number
  executingNumber?: number
  queuingNumber?: number
  hangNumber?: number
  cancelNumber?: number
  failNumber?: number
}

/** 子任务动作（详情响应内嵌动作集合，OpenAPI ActionOrder schema） */
export interface OrderActionDto {
  /** 动作唯一 id（后端生成字符串，非 int64） */
  actionId?: string
  /** 动作类型（协议原值） */
  actionType?: string
  /** 动作描述（后端原文） */
  actionDescription?: string
  blockingType?: 'NONE' | 'SOFT' | 'HARD'
  /** 动作参数（键值对，value 原样） */
  actionParameters?: { key: string; value: unknown }[]
  actionStatus?: 'WAITING' | 'INITIALIZING' | 'RUNNING' | 'FINISHED' | 'FAILED'
  /** 执行结果说明（如扫码结果；未产生为空） */
  resultDescription?: string | null
  /** 生效条件原文（空=无条件生效） */
  conditionStr?: string | null
  startTime?: string | null
  finalTime?: string | null
}

/** 子任务/mission（OpenAPI OrderMission schema；详情分页行） */
export interface OrderMissionDto {
  /** 后端自增主键（int64；行 ID 用 orderMissionKey） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 子任务 key（稳定业务标识，表格行 ID） */
  orderMissionKey?: string
  /** 上层业务 key */
  upperKey?: string
  orderRecordKey?: string
  mapId?: string
  mapName?: string
  stationId?: string
  stationName?: string
  /** AGV 动作集合 */
  actions?: OrderActionDto[]
  /** 附属系统动作集合（调度端执行） */
  parallelActions?: OrderActionDto[]
  /** 子任务执行类型：默认/附属并行 */
  executionType?: 'DEFAULT' | 'ATTACHED'
  /** 子任务状态（NA/PROCESSING/HANG/CANCELLED/FINISHED；未知值原样展示） */
  missionState?: string
  extendParameters?: { key: string; value: unknown }[]
  executeTime?: string | null
  finalTime?: string | null
}

/** 子任务分页（详情响应 data.missionPage） */
export type OrderMissionPage = BackendPageResult<OrderMissionDto>

/** 任务详情响应 data（OpenAPI OrderRecordDetailDTO：主体 + mission 分页） */
export interface OrderRecordDetailDto {
  orderRecord: OrderRecordDto
  missionPage: OrderMissionPage
}

/** 详情查询参数（OpenAPI OrderRecordDetailParam；POST body） */
export interface OrderRecordDetailParam {
  orderTaskKey: string
  pageNo: number
  pageSize: number
}

/** 创建任务子任务动作（OpenAPI ActionParam：提交形状，剥离选项对象的 id/审计字段） */
export interface OrderActionParam {
  actionType?: string
  actionDescription?: string
  blockingType?: 'NONE' | 'SOFT' | 'HARD'
  /** 生效条件（选项对象无此字段，保留协议形状） */
  conditionStr?: string
  actionParameters?: { key: string; value: unknown }[]
}

/** 创建任务子任务（OpenAPI OrderMissionParam） */
export interface OrderMissionParam {
  /** 上层业务 key（后端生成语义，前端不填；保留协议形状） */
  upperKey?: string
  /** 地图唯一 id（必填业务约束在前端表单校验） */
  mapId?: string
  /** 站点 id（必填业务约束在前端表单校验） */
  stationId?: string
  /** AGV 动作集合（选动作时单动作数组，选分组时组内全量） */
  actions?: OrderActionParam[]
  /** 附属系统动作（旧可达实现未提供编辑入口，保留协议形状） */
  parallelActions?: OrderActionParam[]
  /** 执行类型：默认/附属并行（旧可达实现未提供编辑入口，保留协议形状） */
  executionType?: 'DEFAULT' | 'ATTACHED'
}

/** 创建任务参数（OpenAPI OrderRecordParam；指定车辆与分组互斥，至少一项） */
export interface CreateOrderRecordParam {
  /** 工艺唯一 id（旧可达实现未提供工艺选择入口，保留协议形状） */
  processKey?: string
  /** 外部任务唯一 id（旧可达实现未提供入口，保留协议形状） */
  taskId?: string
  orderName: string
  /** 优先级 0-999，值越大越高 */
  priority?: number
  appointVehicleKey?: string
  appointVehicleGroupKey?: string
  orderMissions: OrderMissionParam[]
}

/** 任务操作参数（OpenAPI OrderTaskOperate；取消命令必须携带 cancelReason） */
export interface OrderTaskOperateParam {
  /** 目标任务 key（列表行 orderKey） */
  orderTaskKey: string
  /** 取消原因（仅取消命令需要，后端语义） */
  cancelReason: string
  operate: OrderTaskOperateCommand
}

/**
 * 任务操作响应 data 的调度状态码（OpenAPI ResultDispatcherStatusCode.data 枚举，114 项）。
 * 语义（联调核实项）：code=200 且 data 为空视为命令已接受；data 携带状态码时
 * 代表调度子系统拒绝（如状态已终态/车辆不存在），按业务拒绝呈现、不当成功。
 * 任务操作直接相关的码做文案映射，其余原值展示（规格 18.3：未知枚举显示原值）。
 */
export type DispatcherStatusCode = string

/** 任务操作直接相关状态码 → 中文说明（未列出的码由页面显示原值） */
export const DISPATCHER_STATUS_TEXT: Record<string, string> = {
  ORDER_TASK_IS_NULL: '任务不存在',
  ORDER_TASK_IS_FINIAL: '任务已终态，不能操作',
  ORDER_RECORD_NOT_FOUND: '任务记录不存在',
  ORDER_TASK_STATE_NOT_IN_QUEUE: '任务不在队列中，不能执行该操作',
  ORDER_TASK_STATE_NOT_OUT_QUEUE: '任务不在队列外，不能执行该操作',
  ORDER_TASK_STATE_NOT_PROCESSING: '任务不在执行中，不能执行该操作',
  ORDER_TASK_STATE_NOT_HANG: '任务不在挂起状态，不能执行该操作',
  TASK_NOT_EXIST: '任务不存在',
  VEHICLE_NOT_EXIST: '车辆不存在',
  VEHICLE_IS_OFFLINE: '车辆已离线',
  ORDER_TASK_NOT_FOUND_PROCESS_VEHICLE: '未找到可处理该任务的车辆',
  SEND_ORDER_TO_MQTT_ERROR: '命令下发失败，请稍后重试',
}

/** 模拟分配参数（OpenAPI MockDispatcherParam；真实仿真接口，明确标注仿真） */
export interface MockDispatchParam {
  /** 模拟分配的目标订单 key */
  orderTaskKey: string
  /** 模拟分配执行的车辆 key */
  vehicleKey: string
}
