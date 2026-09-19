/**
 * 自动门设备服务（P15 整页重写交付；owner 归 P15，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 与旧实现，method/path/请求体形态一致）：
 * - GET  /fms/v1/device/autoDoor/pageAutoDoors        分页查询自动门（GET + query 平铺，G04）
 * - GET  /fms/v1/device/autoDoor/getAutoDoorDrivers   驱动集合（全量，驱动下拉数据源）
 * - GET  /fms/v1/device/autoDoor/getAutoDoorState     自动门实时状态（deviceKey query）
 * - POST /fms/v1/device/autoDoor/addAutoDoor          新增自动门（AutoDoorAddParam）
 * - POST /fms/v1/device/autoDoor/updateAutoDoor       编辑自动门（原 deviceKey 定位 + 全量提交）
 * - POST /fms/v1/device/autoDoor/deleteAutoDoor       删除自动门（DeviceParam）
 * - POST /fms/v1/device/autoDoor/openDoor             自动门开门命令
 * - POST /fms/v1/device/autoDoor/closeDoor            自动门关门命令
 * - POST /fms/v1/device/autoDoor/clearAutoDoorOccupy  清除占用自动门的车辆（命令）
 *
 * 协议纪律：
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - 命令类写操作（开门/关门/清占用）受理 ≠ 设备动作完成，最终状态以
 *   getAutoDoorState 重新查询为准；页面 confirmCommand 确认后调用，本层不做
 *   自动重试、不伪造结果；
 * - 单门设备边界：openDoor/closeDoor 请求体（DeviceParam）中 doorWay 为电梯
 *   前后门语义的可选字段，自动门语义无消费者不携带（旧实现同语义只传 deviceKey）；
 * - 自动门下拉选项（GET getAutoDoors 全量）当前无活跃消费者（旧仓库仅历史
 *   AutoDoor 实现与 H02 暂缓页地图编辑器引用），本页列表走分页接口不重复落地；
 *   后续消费者出现时按 contracts.md 选项 owner 纪律落地；
 * - A06 纪律：不依赖英文 success 文案判断成败，统一由请求层业务码判定。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  AutoDoorDeviceParam,
  AutoDoorDriverDto,
  AutoDoorPageDto,
  AutoDoorPageParam,
  AutoDoorSaveParam,
  AutoDoorStateDto,
} from '@/services/device-auto-door/device-auto-door.service.types'

/** 自动门设备控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const AUTO_DOOR_BASE = '/device/autoDoor'

/**
 * 分页查询自动门：pageNo 从 1 计数（页面用 toBackendPage 换算），
 * query 为名称/标识模糊条件（旧实现同参数，GET + query 平铺）。
 */
export async function pageAutoDoors(
  params: AutoDoorPageParam,
  options?: RequestOptions,
): Promise<AutoDoorPageDto> {
  return api.get<AutoDoorPageDto>(`${AUTO_DOOR_BASE}/pageAutoDoors`, {
    params,
    signal: options?.signal,
  })
}

/**
 * 获取自动门驱动集合（GET 无参全量）：新增/编辑弹窗的驱动下拉数据源；
 * 选中驱动后以其 driverProtocol 作为设备配置的初始 JSON（旧实现同语义）。
 */
export async function fetchAutoDoorDrivers(
  options?: RequestOptions,
): Promise<AutoDoorDriverDto[]> {
  return api.get<AutoDoorDriverDto[]>(`${AUTO_DOOR_BASE}/getAutoDoorDrivers`, {
    signal: options?.signal,
  })
}

/**
 * 获取自动门实时状态（GET + query deviceKey）：「状态」按钮按需查询；
 * 返回可空——设备不存在时后端可能返回 data=null，由页面按查询失败语义区分。
 */
export async function fetchAutoDoorState(
  deviceKey: string,
  options?: RequestOptions,
): Promise<AutoDoorStateDto | null> {
  return api.get<AutoDoorStateDto | null>(`${AUTO_DOOR_BASE}/getAutoDoorState`, {
    params: { deviceKey },
    signal: options?.signal,
  })
}

/**
 * 新增自动门（命令外普通写操作）：deviceConfig 为表单 JSON 文本解析后的对象
 * （解析校验由页面负责，本层接收已解析对象原样提交）。
 */
export async function addAutoDoor(
  params: AutoDoorSaveParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${AUTO_DOOR_BASE}/addAutoDoor`, params, {
    signal: options?.signal,
  })
}

/**
 * 编辑自动门：以原 deviceKey 定位并整体提交全部字段（旧实现同语义：
 * 表单不含 deviceKey 输入框，提交时回带原值）。
 */
export async function updateAutoDoor(
  params: AutoDoorSaveParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${AUTO_DOOR_BASE}/updateAutoDoor`, params, {
    signal: options?.signal,
  })
}

/**
 * 删除自动门（破坏性写操作，页面 confirmCommand 确认后调用）：
 * 按 deviceKey 定位（旧实现同参数）。
 */
export async function deleteAutoDoor(
  params: AutoDoorDeviceParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${AUTO_DOOR_BASE}/deleteAutoDoor`, params, {
    signal: options?.signal,
  })
}

/**
 * 自动门开门命令（页面 confirmCommand 确认后调用）：受理 ≠ 门已打开，
 * 结果以 getAutoDoorState 重新查询为准；单门设备不携带 doorWay。
 */
export async function openDoor(
  params: AutoDoorDeviceParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${AUTO_DOOR_BASE}/openDoor`, params, {
    signal: options?.signal,
  })
}

/**
 * 自动门关门命令（页面 confirmCommand 确认后调用）：受理 ≠ 门已关闭，
 * 结果以 getAutoDoorState 重新查询为准；单门设备不携带 doorWay。
 */
export async function closeDoor(
  params: AutoDoorDeviceParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${AUTO_DOOR_BASE}/closeDoor`, params, {
    signal: options?.signal,
  })
}

/**
 * 清除占用自动门的车辆（命令类写操作，页面 confirmCommand 确认后调用）：
 * 释放该自动门的占用车辆（影响现场调度），结果以状态查询/列表核实为准。
 */
export async function clearAutoDoorOccupy(
  params: AutoDoorDeviceParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${AUTO_DOOR_BASE}/clearAutoDoorOccupy`, params, {
    signal: options?.signal,
  })
}
