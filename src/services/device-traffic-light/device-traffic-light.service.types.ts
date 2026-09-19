/**
 * 交通灯设备（P17）协议 DTO（owner=P17，contracts.md 第 5 节）。
 *
 * 逐字段核对 default_OpenAPI.json（DeviceTrafficLight / PageDeviceTrafficLight /
 * DeviceTrafficLightAddParam / DeviceTrafficLightUpdateParam /
 * DeviceTrafficLightParam / DeviceDriver / DeviceTrafficLightPageParamDeviceTrafficLight），
 * 文档未标 required 一律可选，消费侧按留白处理；int64 主键（id）保持 JSON
 * number 承载（G10 纪律同 P09–P16）。
 *
 * 与旧实现的形态差异（等价迁移按旧 UI 字段集，不因契约新增扩张页面）：
 * - 新 DTO 顶层含 ip/port/deviceStatus 三字段（旧 UI 无此三列、表单亦无此三项，
 *   AddParam 未要求，本页不发明 UI）；
 * - 旧 UI 的设备配置三项（url/requestParam/responseSuccessExpression）承载于
 *   deviceConfig 通用 map（additionalProperties: object）——旧提交形态即其合法
 *   键集，等价迁移原样保留。
 */

/** 交通灯记录（GET pageTrafficLights 行记录；OpenAPI DeviceTrafficLight）。
 * 旧记录类型未使用 id/审计/ip/port/deviceStatus 字段，协议按文档原样保留承载能力。 */
export interface TrafficLightDto {
  /** 技术主键（int64） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 设备唯一 key（业务定位键：编辑/删除/测试均按它寻址） */
  deviceKey?: string
  /** 交通灯名称 */
  deviceName?: string
  /** 设备状态：true 启用 / false 禁用（旧 UI 无此列，本页不消费） */
  deviceStatus?: boolean
  /** 驱动唯一 key */
  driverKey?: string
  /** 设备 ip 地址（旧 UI 无此字段，协议原样承载） */
  ip?: string
  /** 设备端口号（旧 UI 无此字段，协议原样承载） */
  port?: number
  /** 设备配置信息（通用 map；旧 UI 三项 url/requestParam/responseSuccessExpression 为其键集） */
  deviceConfig?: Record<string, unknown>
  /** 是否同步等待响应（旧 UI 列「同步等待响应」与表单开关的数据源） */
  syncWaitResponse?: boolean
}

/** 交通灯分页数据（PageDeviceTrafficLight，My-Plus 形态：records/total/size/current） */
export interface TrafficLightPageDto {
  records?: TrafficLightDto[]
  total?: number
  size?: number
  current?: number
}

/** 交通灯分页查询参数（GET query 平铺，pageNo 从 1 计数；G04 同款） */
export interface TrafficLightPageParam {
  pageNo: number
  pageSize: number
  /** 按名称或唯一 key 查询（旧实现同参数） */
  query?: string
}

/** 新增/编辑交通灯提交参数（POST addTrafficLight/updateTrafficLight；
 * OpenAPI DeviceTrafficLightAddParam/UpdateParam。旧实现提交形态：
 * {deviceName, deviceConfig:{url,requestParam,responseSuccessExpression},
 *   syncWaitResponse, driverKey}，编辑多回带原 deviceKey 定位）。
 * deviceConfig 为通用 map，服务层以 Record 承载，键集构造由表单负责。 */
export interface TrafficLightSaveParam {
  /** 设备唯一 key（编辑时必传=原值；新增不传由后端生成） */
  deviceKey?: string
  deviceName: string
  driverKey: string
  syncWaitResponse: boolean
  /** 设备配置（requestParam 已在表单层 JSON 解析为对象） */
  deviceConfig: Record<string, unknown>
}

/** 设备定位参数（POST deleteTrafficLight/testTrafficLight；OpenAPI DeviceTrafficLightParam） */
export interface TrafficLightDeviceParam {
  /** 设备唯一 key */
  deviceKey: string
}

/** 交通灯驱动（GET getDrivers 行记录；OpenAPI DeviceDriver）。
 * driverProtocol 为该驱动的协议模板：选中驱动后作为请求参数的初始 JSON。 */
export interface TrafficLightDriverDto {
  /** 驱动唯一名称 */
  name?: string
  /** 驱动唯一 key */
  key?: string
  /** 驱动协议（任意 JSON 对象） */
  driverProtocol?: Record<string, unknown>
}
