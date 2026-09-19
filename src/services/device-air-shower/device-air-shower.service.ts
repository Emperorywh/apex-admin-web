/**
 * 风淋门设备服务（P18 整页重写交付；owner 归 P18，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 与旧实现，method/path/请求体形态一致）：
 * - GET  /fms/v1/device/airShowerDoor/pageAirShowerDoors      分页查询风淋门（GET + query 平铺，G04）
 * - GET  /fms/v1/device/airShowerDoor/getAirShowerDoorDrivers 驱动集合（全量，驱动下拉数据源）
 * - GET  /fms/v1/device/airShowerDoor/getAirShowerDoorState   风淋门实时状态（deviceKey query）
 * - POST /fms/v1/device/airShowerDoor/addAirShowerDoor        新增风淋门（AirShowerDoorParam）
 * - POST /fms/v1/device/airShowerDoor/updateAirShowerDoor     编辑风淋门（原 deviceKey 定位 + 全量提交）
 * - POST /fms/v1/device/airShowerDoor/deleteAirShowerDoor     删除风淋门（DeviceParam）
 * - POST /fms/v1/device/airShowerDoor/openDoor                风淋门开门命令（doorWay=FRONT/BACK 必填）
 * - POST /fms/v1/device/airShowerDoor/closeDoor               风淋门关门命令（doorWay=FRONT/BACK 必填）
 *
 * 不落地的 OpenAPI operation（旧仓库无活跃 UI 消费者，纪律同 P16/P17 先例）：
 * - shower（风淋命令）：旧实现 AirShowerDoor_back 操作菜单 items 已无此项
 *   （handleMenuClick 残留 case 但不可达），不迁 UI 不落地；
 * - clearAirShowerDoorOccupy（清占用）：旧实现 items 中显式注释（不可达），
 *   不迁 UI 不落地；
 * - getAirShowerDoors（全量选项）：旧仓库唯一消费者为 H02 暂缓页地图编辑器
 *   （ThirdDevice 属性面板），与 P16 getAllChargePiles 同例不落地，后续消费者
 *   出现时按 contracts.md 选项 owner 纪律落地。
 *
 * 协议纪律：
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - 命令类写操作（开/关门）受理 ≠ 设备动作完成，最终状态以 getAirShowerDoorState
 *   重新查询为准；页面 confirmCommand 确认后调用，本层不做自动重试、不伪造结果；
 * - A06 纪律：不依赖英文 success 文案判断成败，统一由请求层业务码判定。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  AirShowerDoorDeviceParam,
  AirShowerDoorDriverDto,
  AirShowerDoorPageDto,
  AirShowerDoorPageParam,
  AirShowerDoorSaveParam,
  AirShowerDoorStateDto,
} from '@/services/device-air-shower/device-air-shower.service.types'

/** 风淋门设备控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const AIR_SHOWER_DOOR_BASE = '/device/airShowerDoor'

/**
 * 分页查询风淋门：pageNo 从 1 计数（页面用 toBackendPage 换算），
 * query 为名称/标识模糊条件（旧实现同参数，GET + query 平铺）。
 */
export async function pageAirShowerDoors(
  params: AirShowerDoorPageParam,
  options?: RequestOptions,
): Promise<AirShowerDoorPageDto> {
  return api.get<AirShowerDoorPageDto>(`${AIR_SHOWER_DOOR_BASE}/pageAirShowerDoors`, {
    params,
    signal: options?.signal,
  })
}

/**
 * 获取风淋门驱动集合（GET 无参全量）：新增/编辑弹窗的驱动下拉数据源；
 * 选中驱动后以其 driverProtocol 作为设备配置的初始 JSON（旧实现同语义）。
 */
export async function fetchAirShowerDoorDrivers(
  options?: RequestOptions,
): Promise<AirShowerDoorDriverDto[]> {
  return api.get<AirShowerDoorDriverDto[]>(`${AIR_SHOWER_DOOR_BASE}/getAirShowerDoorDrivers`, {
    signal: options?.signal,
  })
}

/**
 * 获取风淋门实时状态（GET + query deviceKey）：「状态」按钮按需查询；
 * 返回可空——设备不存在时后端可能返回 data=null，由页面按查询失败语义区分。
 */
export async function fetchAirShowerDoorState(
  deviceKey: string,
  options?: RequestOptions,
): Promise<AirShowerDoorStateDto | null> {
  return api.get<AirShowerDoorStateDto | null>(`${AIR_SHOWER_DOOR_BASE}/getAirShowerDoorState`, {
    params: { deviceKey },
    signal: options?.signal,
  })
}

/**
 * 新增风淋门（命令外普通写操作）：deviceConfig 为表单 JSON 文本解析后的对象
 * （解析校验由页面负责，本层接收已解析对象原样提交）；提交体不含
 * deviceStatus/showerStatus（OpenAPI AirShowerDoorParam 无此字段，旧表单同边界）。
 */
export async function addAirShowerDoor(
  params: AirShowerDoorSaveParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${AIR_SHOWER_DOOR_BASE}/addAirShowerDoor`, params, {
    signal: options?.signal,
  })
}

/**
 * 编辑风淋门：以原 deviceKey 定位并整体提交全部字段（旧实现同语义：
 * 表单不含 deviceKey 输入框，提交时回带原值）。
 */
export async function updateAirShowerDoor(
  params: AirShowerDoorSaveParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${AIR_SHOWER_DOOR_BASE}/updateAirShowerDoor`, params, {
    signal: options?.signal,
  })
}

/**
 * 删除风淋门（破坏性写操作，页面 confirmCommand 确认后调用）：
 * 按 deviceKey 定位（旧实现同参数；命令类接口 doorWay 不携带）。
 */
export async function deleteAirShowerDoor(
  params: AirShowerDoorDeviceParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${AIR_SHOWER_DOOR_BASE}/deleteAirShowerDoor`, params, {
    signal: options?.signal,
  })
}

/**
 * 风淋门开门命令（页面 confirmCommand 确认后调用）：受理 ≠ 门已打开，
 * 结果以 getAirShowerDoorState 重新查询为准；前/后双门设备 doorWay 必填
 * （FRONT 前门 / BACK 后门，旧实现 ControlModal 强制选择）。
 */
export async function openDoor(
  params: AirShowerDoorDeviceParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${AIR_SHOWER_DOOR_BASE}/openDoor`, params, {
    signal: options?.signal,
  })
}

/**
 * 风淋门关门命令（页面 confirmCommand 确认后调用）：受理 ≠ 门已关闭，
 * 结果以 getAirShowerDoorState 重新查询为准；前/后双门设备 doorWay 必填。
 */
export async function closeDoor(
  params: AirShowerDoorDeviceParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${AIR_SHOWER_DOOR_BASE}/closeDoor`, params, {
    signal: options?.signal,
  })
}
