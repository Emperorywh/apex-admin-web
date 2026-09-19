/**
 * 自动门设备（P15）协议 DTO（owner=P15，contracts.md 第 5 节）。
 *
 * 逐字段核对 default_OpenAPI.json（DeviceAutoDoor / PageDeviceAutoDoor /
 * AutoDoorAddParam / AutoDoorUpdateParam / DeviceParam / DeviceDriver /
 * AutoDoorState），文档未标 required 一律可选，消费侧按留白处理；
 * int64 主键（id）保持 JSON number 承载（G10 纪律同 P09/P10/P14）。
 *
 * 与电梯（P14）同族差异：自动门为单门设备——openDoor/closeDoor 请求体
 * （DeviceParam）中的 doorWay 为可选字段，本页语义无消费者不携带（旧实现
 * 同语义只传 deviceKey）；「呼叫电梯（外呼/内呼）」为电梯独有能力，
 * 自动门命令族仅开门/关门/清占用。
 */

/** 自动门记录（GET pageAutoDoors 行记录；OpenAPI DeviceAutoDoor）。
 * 旧记录类型未使用 id/审计字段，协议按文档原样保留承载能力。 */
export interface AutoDoorDto {
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
  /** 占用设备的车辆集合（可空/空数组=未被占用；清占用确认层列明影响用） */
  vehicleNames?: string[]
  /** 网络状态（ONLINE/OFFLINE；未知枚举显示原值） */
  onlineState?: string
}

/** 自动门分页数据（PageDeviceAutoDoor，My-Plus 形态：records/total/size/current） */
export interface AutoDoorPageDto {
  records?: AutoDoorDto[]
  total?: number
  size?: number
  current?: number
}

/** 自动门分页查询参数（GET query 平铺，pageNo 从 1 计数；G04 同款） */
export interface AutoDoorPageParam {
  pageNo: number
  pageSize: number
  /** 按名称/标识模糊查询 */
  query?: string
}

/** 新增/编辑自动门提交参数（POST addAutoDoor/updateAutoDoor；
 * OpenAPI AutoDoorAddParam/AutoDoorUpdateParam 同构，后者多 deviceKey 定位字段。
 * 编辑以原 deviceKey 定位并整体提交（旧实现同语义：表单无 deviceKey 输入框）。 */
export interface AutoDoorSaveParam {
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

/** 设备定位参数（POST deleteAutoDoor/openDoor/closeDoor/clearAutoDoorOccupy；
 * OpenAPI DeviceParam：deviceKey 必要。doorWay 为电梯前后门语义的可选字段，
 * 自动门单门无消费者，本服务层类型保留字段但不传值（旧实现同语义）。 */
export interface AutoDoorDeviceParam {
  /** 设备唯一 key */
  deviceKey: string
  /** 门位置（电梯语义；自动门不携带） */
  doorWay?: string
}

/** 自动门驱动（GET getAutoDoorDrivers 行记录；OpenAPI DeviceDriver）。
 * driverProtocol 为该驱动的协议模板：选中驱动后作为设备配置的初始 JSON。 */
export interface AutoDoorDriverDto {
  /** 驱动唯一名称 */
  name?: string
  /** 驱动唯一 key */
  key?: string
  /** 驱动协议（任意 JSON 对象） */
  driverProtocol?: Record<string, unknown>
}

/** 自动门实时状态（GET getAutoDoorState 响应 data；OpenAPI AutoDoorState）。
 * doorState 协议枚举：UNKNOWN/ERROR/DOOR_OPENED/DOOR_OPENING/DOOR_CLOSED/
 * DOOR_CLOSING——展示协议原值（旧实现同形态），未知枚举不猜语义。 */
export interface AutoDoorStateDto {
  /** 自动门门状态（协议原值展示） */
  doorState?: string
  /** 网络状态（ONLINE/OFFLINE；未知枚举显示原值） */
  onlineState?: string
}
