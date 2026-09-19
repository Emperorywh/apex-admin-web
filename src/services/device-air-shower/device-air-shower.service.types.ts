/**
 * 风淋门设备（P18）协议 DTO（owner=P18，contracts.md 第 5 节）。
 *
 * 逐字段核对 default_OpenAPI.json（DeviceAirShowerDoor / PageDeviceAirShowerDoor /
 * AirShowerDoorParam / DeviceParam / DeviceDriver / AirShowerDoorState），文档未标
 * required 一律可选，消费侧按留白处理；int64 主键（id）保持 JSON number 承载
 * （G10 纪律同 P09/P10/P14–P17）。
 *
 * 与自动门（P15）同族差异：风淋门为前/后双门设备——openDoor/closeDoor 请求体
 * （DeviceParam）的 doorWay（FRONT 前门 / BACK 后门）在本页语义中必填（旧实现
 * ControlModal 强制选择门类型）；记录额外携带 showerStatus（风淋状态启用/禁用）
 * 与状态接口五字段（showerState/failed/frontDoorState/backDoorState/onlineState）。
 */

/** 风淋门记录（GET pageAirShowerDoors 行记录；OpenAPI DeviceAirShowerDoor）。
 * 旧记录类型未使用 id/审计字段，协议按文档原样保留承载能力。 */
export interface AirShowerDoorDto {
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
  /** 风淋状态：true 启用 / false 禁用（false 是明确状态，不是缺失） */
  showerStatus?: boolean
  /** 驱动唯一 key */
  driverKey?: string
  /** 设备 ip 地址 */
  ip?: string
  /** 设备端口号 */
  port?: number
  /** 设备配置信息（驱动协议实例，任意 JSON 对象） */
  deviceConfig?: Record<string, unknown>
  /** 占用设备的车辆集合（旧 UI 无清占用入口，字段仅按协议承载） */
  vehicleNames?: string[]
  /** 网络状态（ONLINE/OFFLINE；未知枚举显示原值） */
  onlineState?: string
}

/** 风淋门分页数据（PageDeviceAirShowerDoor，My-Plus 形态：records/total/size/current） */
export interface AirShowerDoorPageDto {
  records?: AirShowerDoorDto[]
  total?: number
  size?: number
  current?: number
}

/** 风淋门分页查询参数（GET query 平铺，pageNo 从 1 计数；G04 同款） */
export interface AirShowerDoorPageParam {
  pageNo: number
  pageSize: number
  /** 按名称/标识模糊查询 */
  query?: string
}

/** 新增/编辑风淋门提交参数（POST addAirShowerDoor/updateAirShowerDoor；
 * OpenAPI AirShowerDoorParam 仅此六字段——无 deviceStatus/showerStatus，
 * 旧表单同样无此二字段输入，不发明 UI。编辑以原 deviceKey 定位并整体提交
 * （旧实现同语义：表单无 deviceKey 输入框）。 */
export interface AirShowerDoorSaveParam {
  /** 设备唯一 key（编辑时必传=原值；新增不传由后端生成） */
  deviceKey?: string
  deviceName: string
  driverKey: string
  ip: string
  port: number
  /** 设备配置（表单 JSON 文本解析后的对象） */
  deviceConfig: Record<string, unknown>
}

/** 风淋门设备命令参数（POST deleteAirShowerDoor/openDoor/closeDoor；
 * OpenAPI DeviceParam：deviceKey + doorWay（FRONT/BACK）。删除只传 deviceKey；
 * 开/关门为前/后双门设备语义，doorWay 必填（旧实现 ControlModal 强制选择）。 */
export interface AirShowerDoorDeviceParam {
  /** 设备唯一 key */
  deviceKey: string
  /** 门位置：FRONT 前门 / BACK 后门（协议枚举；开/关门命令必填） */
  doorWay?: 'FRONT' | 'BACK'
}

/** 风淋门驱动（GET getAirShowerDoorDrivers 行记录；OpenAPI DeviceDriver）。
 * driverProtocol 为该驱动的协议模板：选中驱动后作为设备配置的初始 JSON。 */
export interface AirShowerDoorDriverDto {
  /** 驱动唯一名称 */
  name?: string
  /** 驱动唯一 key */
  key?: string
  /** 驱动协议（任意 JSON 对象） */
  driverProtocol?: Record<string, unknown>
}

/** 风淋门实时状态（GET getAirShowerDoorState 响应 data；OpenAPI AirShowerDoorState）。
 * 枚举全部协议原值展示（旧实现同形态），未知枚举不猜语义：
 * - showerState：UNKNOWN / AIRING / AIRED
 * - frontDoorState / backDoorState：UNKNOWN / ERROR / DOOR_OPENED / DOOR_OPENING /
 *   DOOR_CLOSED / DOOR_CLOSING
 * - onlineState：ONLINE / OFFLINE
 */
export interface AirShowerDoorStateDto {
  /** 网络状态（ONLINE/OFFLINE；未知枚举显示原值） */
  onlineState?: string
  /** 风淋状态（协议原值） */
  showerState?: string
  /** 是否故障：true 是 / false 否（false 是明确状态，不是缺失） */
  failed?: boolean
  /** 前门状态（协议原值） */
  frontDoorState?: string
  /** 后门状态（协议原值） */
  backDoorState?: string
}
