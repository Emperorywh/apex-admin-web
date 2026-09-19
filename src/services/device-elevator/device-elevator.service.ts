/**
 * 电梯设备服务（P14 整页重写交付；owner 归 P14，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 与旧实现，method/path/请求体形态一致）：
 * - GET  /fms/v1/device/elevator/pageElevators        分页查询电梯（GET + query 平铺，G04）
 * - GET  /fms/v1/device/elevator/getElevatorDrivers   驱动集合（全量，驱动下拉数据源）
 * - GET  /fms/v1/device/elevator/getElevatorState     电梯实时状态（deviceKey query）
 * - POST /fms/v1/device/elevator/addElevator          新增电梯（ElevatorParam）
 * - POST /fms/v1/device/elevator/updateElevator       编辑电梯（原 deviceKey 定位 + 全量提交）
 * - POST /fms/v1/device/elevator/deleteElevator       删除电梯（DeviceParam）
 * - POST /fms/v1/device/elevator/outerCall            呼叫电梯（外呼命令）
 * - POST /fms/v1/device/elevator/openDoor             电梯开门命令
 * - POST /fms/v1/device/elevator/closeDoor            电梯关门命令
 * - POST /fms/v1/device/elevator/clearElevatorOccupy  清除占用电梯的车辆（命令）
 *
 * 协议纪律：
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - 命令类写操作（外呼/开关门/清占用）受理 ≠ 设备动作完成，最终状态以
 *   getElevatorState 重新查询为准；页面 confirmCommand 确认后调用，本层不做
 *   自动重试、不伪造结果；
 * - G06：旧「内呼」innerCall 未出现在 OpenAPI，本层不提供——页面禁用入口说明，
 *   不用 outerCall 的 targetFloor 字段猜替（ElevatorOperationParam 中
 *   targetFloor 语义为内呼，外呼请求不携带）。
 * - 电梯下拉选项（GET getElevators）的共享服务归 P10
 *   （services/cross-map fetchElevatorOptions），本页列表走分页接口，不重复落地。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  DeviceParam,
  ElevatorDriverDto,
  ElevatorOuterCallParam,
  ElevatorPageDto,
  ElevatorPageParam,
  ElevatorSaveParam,
  ElevatorStateDto,
} from '@/services/device-elevator/device-elevator.service.types'

/** 电梯设备控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const ELEVATOR_BASE = '/device/elevator'

/**
 * 分页查询电梯：pageNo 从 1 计数（页面用 toBackendPage 换算），
 * query 为名称/标识模糊条件（旧实现同参数，GET + query 平铺）。
 */
export async function pageElevators(
  params: ElevatorPageParam,
  options?: RequestOptions,
): Promise<ElevatorPageDto> {
  return api.get<ElevatorPageDto>(`${ELEVATOR_BASE}/pageElevators`, {
    params,
    signal: options?.signal,
  })
}

/**
 * 获取电梯驱动集合（GET 无参全量）：新增/编辑弹窗的驱动下拉数据源；
 * 选中驱动后以其 driverProtocol 作为设备配置的初始 JSON（旧实现同语义）。
 */
export async function fetchElevatorDrivers(
  options?: RequestOptions,
): Promise<ElevatorDriverDto[]> {
  return api.get<ElevatorDriverDto[]>(`${ELEVATOR_BASE}/getElevatorDrivers`, {
    signal: options?.signal,
  })
}

/**
 * 获取电梯实时状态（GET + query deviceKey）：「状态」按钮按需查询；
 * 返回可空——设备不存在时后端可能返回 data=null，由页面按查询失败语义区分。
 */
export async function fetchElevatorState(
  deviceKey: string,
  options?: RequestOptions,
): Promise<ElevatorStateDto | null> {
  return api.get<ElevatorStateDto | null>(`${ELEVATOR_BASE}/getElevatorState`, {
    params: { deviceKey },
    signal: options?.signal,
  })
}

/**
 * 新增电梯（命令外普通写操作）：deviceConfig 为表单 JSON 文本解析后的对象
 * （解析校验由页面负责，本层接收已解析对象原样提交）。
 */
export async function addElevator(
  params: ElevatorSaveParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${ELEVATOR_BASE}/addElevator`, params, {
    signal: options?.signal,
  })
}

/**
 * 编辑电梯：以原 deviceKey 定位并整体提交全部字段（旧实现同语义：
 * 表单不含 deviceKey 输入框，提交时回带原值）。
 */
export async function updateElevator(
  params: ElevatorSaveParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${ELEVATOR_BASE}/updateElevator`, params, {
    signal: options?.signal,
  })
}

/**
 * 删除电梯（破坏性写操作，页面 confirmCommand 确认后调用）：
 * 按 deviceKey 定位（旧实现同参数）。
 */
export async function deleteElevator(
  params: DeviceParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${ELEVATOR_BASE}/deleteElevator`, params, {
    signal: options?.signal,
  })
}

/**
 * 呼叫电梯（外呼命令，页面 confirmCommand 确认后调用）：
 * 受理 ≠ 电梯到达，结果以 getElevatorState 重新查询为准。
 */
export async function outerCall(
  params: ElevatorOuterCallParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${ELEVATOR_BASE}/outerCall`, params, {
    signal: options?.signal,
  })
}

/**
 * 电梯开门命令（页面 confirmCommand 确认后调用；doorWay=FRONT/BACK）。
 */
export async function openDoor(
  params: DeviceParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${ELEVATOR_BASE}/openDoor`, params, {
    signal: options?.signal,
  })
}

/**
 * 电梯关门命令（页面 confirmCommand 确认后调用；doorWay=FRONT/BACK）。
 */
export async function closeDoor(
  params: DeviceParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${ELEVATOR_BASE}/closeDoor`, params, {
    signal: options?.signal,
  })
}

/**
 * 清除占用电梯的车辆（命令类写操作，页面 confirmCommand 确认后调用）：
 * 释放该电梯的占用车辆（影响现场调度），结果以状态查询/列表核实为准。
 */
export async function clearElevatorOccupy(
  params: DeviceParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${ELEVATOR_BASE}/clearElevatorOccupy`, params, {
    signal: options?.signal,
  })
}
