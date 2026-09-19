/**
 * 充电桩设备（P16）协议 DTO（owner=P16，contracts.md 第 5 节）。
 *
 * 逐字段核对 default_OpenAPI.json（DeviceChargePile / PageDeviceChargePile /
 * ChargePileParam / DeviceParam / DeviceDriver / ChargePileState / StatusInfo），
 * 文档未标 required 一律可选，消费侧按留白处理；int64 主键（id）保持 JSON
 * number 承载（G10 纪律同 P09/P10/P14/P15）。
 *
 * 与电梯/自动门（P14/P15）同族差异：OpenAPI 无 getChargePileState 独立状态
 * 查询——充电桩状态随分页行记录内嵌（deviceChargePileState）下发，列表列即
 * 状态呈现（旧实现同形态）；命令族仅开始/停止充电（无开关门/清占用/呼叫语义，
 * DeviceParam 的 doorWay 为电梯前后门语义，本页不携带）。
 */

/** 充电桩状态明细（OpenAPI StatusInfo；协议原样承载，展示层仅消费 state 主值） */
export interface ChargePileStatusInfo {
  fault?: boolean
  working?: boolean
  chargingComplete?: boolean
  manualMode?: boolean
  agvInPosition?: boolean
  moduleFault?: boolean
  acFault?: boolean
  rodExtending?: boolean
  rodRetracting?: boolean
  rodChargingExtending?: boolean
  rodAtZero?: boolean
  chargerId?: number
  /** byte 语义的原始信息串 */
  rawInfo?: string
}

/** 充电桩实时状态（OpenAPI ChargePileState）。
 * state 协议枚举：ERROR/IDLE/CHARGING/FULL/FAULT/OFFLINE——旧系统
 * ChargeState 枚举已建立语义映射（错误/空闲/充电中/充满/错误/离线），
 * 已知枚举按映射展示，未知枚举显示协议原值不猜语义。 */
export interface ChargePileStateDto {
  /** 桩体状态主值（协议原值；已知六枚举经页面映射展示） */
  state?: string
  /** 状态明细（旧页面未消费，协议原样保留承载） */
  statusInfo?: ChargePileStatusInfo
}

/** 行记录内嵌状态容器（OpenAPI DeviceChargePileState：
 * deviceChargePileState.chargePileState 才是 ChargePileState 本体）。 */
export interface DeviceChargePileStateDto {
  /** 充电桩状态本体 */
  chargePileState?: ChargePileStateDto
}

/** 充电桩记录（GET pageChargePiles 行记录；OpenAPI DeviceChargePile）。
 * 旧记录类型未使用 id/审计字段，协议按文档原样保留承载能力。 */
export interface ChargePileDto {
  /** 技术主键（int64） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 设备唯一 key（业务定位键：编辑/删除/控制命令均按它寻址） */
  deviceKey?: string
  /** 设备名称 */
  deviceName?: string
  /** 设备状态：true 启用 / false 禁用（false 是明确状态，不是缺失） */
  deviceStatus?: boolean
  /** 驱动唯一 key（展示时经驱动集合映射为驱动名称） */
  driverKey?: string
  /** 设备 ip 地址 */
  ip?: string
  /** 设备端口号 */
  port?: number
  /** 设备配置信息（驱动协议实例，任意 JSON 对象） */
  deviceConfig?: Record<string, unknown>
  /** 充电桩实时状态（随行记录内嵌下发；无独立状态查询 operation） */
  deviceChargePileState?: DeviceChargePileStateDto
}

/** 充电桩分页数据（PageDeviceChargePile，My-Plus 形态：records/total/size/current） */
export interface ChargePilePageDto {
  records?: ChargePileDto[]
  total?: number
  size?: number
  current?: number
}

/** 充电桩分页查询参数（GET query 平铺，pageNo 从 1 计数；G04 同款） */
export interface ChargePilePageParam {
  pageNo: number
  pageSize: number
  /** 按名称模糊查询（旧实现同参数） */
  query?: string
}

/** 新增/编辑充电桩提交参数（POST addChargePile/updateChargePile；
 * OpenAPI ChargePileParam。编辑以原 deviceKey 定位并整体提交（旧实现同语义：
 * 表单无 deviceKey 输入框，提交时回带 setFieldsValue 存入的原值）。 */
export interface ChargePileSaveParam {
  /** 设备唯一 key（编辑时必传=原值；新增不传由后端生成） */
  deviceKey?: string
  deviceName: string
  driverKey: string
  deviceStatus: boolean
  ip: string
  port: number
  /** 设备配置（表单 JSON 文本解析后的对象） */
  deviceConfig: Record<string, unknown>
}

/** 设备定位参数（POST deleteChargePile/startCharge/stopCharge；
 * OpenAPI DeviceParam：deviceKey 必要。doorWay 为电梯前后门语义的可选字段，
 * 充电桩无门体语义，本服务层类型保留字段但不传值（旧实现同语义）。 */
export interface ChargePileDeviceParam {
  /** 设备唯一 key */
  deviceKey: string
  /** 门位置（电梯语义；充电桩不携带） */
  doorWay?: string
}

/** 充电桩驱动（GET getChargePileDrivers 行记录；OpenAPI DeviceDriver）。
 * driverProtocol 为该驱动的协议模板：选中驱动后作为设备配置的初始 JSON。 */
export interface ChargePileDriverDto {
  /** 驱动唯一名称 */
  name?: string
  /** 驱动唯一 key */
  key?: string
  /** 驱动协议（任意 JSON 对象） */
  driverProtocol?: Record<string, unknown>
}
