/**
 * 电梯设备（P14）协议 DTO（owner=P14，contracts.md 第 5 节）。
 *
 * 逐字段核对 default_OpenAPI.json（DeviceElevator / PageDeviceElevator /
 * ElevatorParam / ElevatorOperationParam / DeviceParam / DeviceDriver /
 * ElevatorDetail / SimpleAGV），文档未标 required 一律可选，消费侧按留白处理；
 * int64 主键（id）保持 JSON number 承载（G10 纪律同 P09/P10）。
 *
 * 契约边界（G06）：旧实现的「内呼」（/fms/v1/device/elevator/innerCall）未出现在
 * OpenAPI，本服务层不提供该 operation；页面对有权限用户保留禁用入口并说明原因，
 * 不用外呼接口猜测替代（TASKS.md P14 专项验收明文）。
 */

/** 电梯记录（GET pageElevators 行记录；OpenAPI DeviceElevator）。
 * 旧记录类型中的 agvKeys 字段 OpenAPI 未声明，协议按文档原样不迁。 */
export interface ElevatorDto {
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
  /** 电梯楼层 */
  floors?: number
  /** 电梯 ip 地址 */
  ip?: string
  /** 电梯端口号 */
  port?: number
  /** 设备配置信息（驱动协议实例，任意 JSON 对象） */
  deviceConfig?: Record<string, unknown>
  /** 网络状态（ONLINE/OFFLINE 等；未知枚举显示原值） */
  onlineState?: string
}

/** 电梯分页数据（PageDeviceElevator，My-Plus 形态：records/total/size/current） */
export interface ElevatorPageDto {
  records?: ElevatorDto[]
  total?: number
  size?: number
  current?: number
}

/** 电梯分页查询参数（GET query 平铺，pageNo 从 1 计数；G04 同款） */
export interface ElevatorPageParam {
  pageNo: number
  pageSize: number
  /** 按名称/标识模糊查询 */
  query?: string
}

/** 新增/编辑电梯提交参数（POST addElevator/updateElevator；OpenAPI ElevatorParam）。
 * 编辑以原 deviceKey 定位并整体提交（旧实现同语义：表单无 deviceKey 输入框）。 */
export interface ElevatorSaveParam {
  /** 设备唯一 key（编辑时必传=原值；新增不传由后端生成） */
  deviceKey?: string
  deviceName: string
  driverKey: string
  floors: number
  deviceStatus: boolean
  ip: string
  port: number
  /** 设备配置（表单 JSON 文本解析后的对象） */
  deviceConfig: Record<string, unknown>
}

/** 设备定位参数（POST deleteElevator/openDoor/closeDoor/clearElevatorOccupy；
 * OpenAPI DeviceParam：deviceKey 必要，doorWay 仅开门/关门时携带） */
export interface DeviceParam {
  /** 设备唯一 key */
  deviceKey: string
  /** 门位置：FRONT 前门 / BACK 后门（开门/关门命令用） */
  doorWay?: string
}

/** 呼叫电梯（外呼）参数（POST outerCall；OpenAPI ElevatorOperationParam）。
 * targetFloor 为内呼语义字段，外呼不传（G06：不用外呼猜替内呼）。 */
export interface ElevatorOuterCallParam {
  /** 设备唯一 key */
  deviceKey: string
  /** 当前楼层（呼叫电梯时生效） */
  currentFloor: number
}

/** 电梯驱动（GET getElevatorDrivers 行记录；OpenAPI DeviceDriver）。
 * driverProtocol 为该驱动的协议模板：选中驱动后作为设备配置的初始 JSON。 */
export interface ElevatorDriverDto {
  /** 驱动唯一名称 */
  name?: string
  /** 驱动唯一 key */
  key?: string
  /** 驱动协议（任意 JSON 对象） */
  driverProtocol?: Record<string, unknown>
}

/** 占用电梯的车辆摘要（ElevatorDetail.occupyAgv；OpenAPI SimpleAGV） */
export interface ElevatorOccupyAgvDto {
  /** agv 唯一 key */
  key?: string
  /** agv 名称 */
  name?: string
}

/** 电梯实时状态（GET getElevatorState 响应 data；OpenAPI ElevatorDetail）。
 * 各状态字段为后端下发的协议原值（未知枚举不猜语义，显示原值）。 */
export interface ElevatorStateDto {
  onlineState?: string
  currentFloor?: number
  runningState?: string
  frontDoorState?: string
  backDoorState?: string
  /** 当前占用电梯的车辆（可空：未被占用） */
  occupyAgv?: ElevatorOccupyAgvDto
}
