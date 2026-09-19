/**
 * 充电桩设备服务（P16 整页重写交付；owner 归 P16，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 与旧实现，method/path/请求体形态一致）：
 * - GET  /fms/v1/device/chargePile/pageChargePiles      分页查询充电桩（GET + query 平铺，G04）
 * - GET  /fms/v1/device/chargePile/getChargePileDrivers 驱动集合（全量，驱动下拉数据源）
 * - POST /fms/v1/device/chargePile/addChargePile        新增充电桩（ChargePileParam）
 * - POST /fms/v1/device/chargePile/updateChargePile     编辑充电桩（原 deviceKey 定位 + 全量提交）
 * - POST /fms/v1/device/chargePile/deleteChargePile     删除充电桩（DeviceParam）
 * - POST /fms/v1/device/chargePile/startCharge          开始充电命令
 * - POST /fms/v1/device/chargePile/stopCharge           停止充电命令
 *
 * 未落地 operation（旧仓库无本页可达消费者，不因 API 存在增加旧不可达业务）：
 * - GET getChargePileDetail：旧仓库全量无引用（连 api 层均未封装）；
 * - GET getAllChargePiles：旧仓库唯一消费者是 H02 暂缓页（地图编辑器第三方设备
 *   标识选择器），随其消费页面落地，本页列表走分页接口不重复落地（P15 同纪律）。
 *
 * 协议纪律：
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理；
 * - 命令类写操作（开始/停止充电）受理 ≠ 充电动作完成（A14：命令接受不显示成
 *   充电完成），最终状态以 pageChargePiles 行内 deviceChargePileState 重新查询
 *   （列表刷新）为准；页面 confirmCommand 确认后调用，本层不做自动重试、不伪造
 *   结果；现场副作用（真实充电/停止充电）留专用环境验收；
 * - 无独立 getChargePileState operation（与电梯/自动门差异）：状态随分页行记录
 *   内嵌下发，页面以列表刷新获取最新状态；
 * - A06 纪律：不依赖英文 success 文案判断成败，统一由请求层业务码判定。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  ChargePileDeviceParam,
  ChargePileDriverDto,
  ChargePilePageDto,
  ChargePilePageParam,
  ChargePileSaveParam,
} from '@/services/device-charge-pile/device-charge-pile.service.types'

/** 充电桩设备控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const CHARGE_PILE_BASE = '/device/chargePile'

/**
 * 分页查询充电桩：pageNo 从 1 计数（页面用 toBackendPage 换算），
 * query 为名称模糊条件（旧实现同参数，GET + query 平铺）。
 */
export async function pageChargePiles(
  params: ChargePilePageParam,
  options?: RequestOptions,
): Promise<ChargePilePageDto> {
  return api.get<ChargePilePageDto>(`${CHARGE_PILE_BASE}/pageChargePiles`, {
    params,
    signal: options?.signal,
  })
}

/**
 * 获取充电桩驱动集合（GET 无参全量）：新增/编辑弹窗的驱动下拉数据源；
 * 选中驱动后以其 driverProtocol 作为设备配置的初始 JSON（旧实现同语义）。
 */
export async function fetchChargePileDrivers(
  options?: RequestOptions,
): Promise<ChargePileDriverDto[]> {
  return api.get<ChargePileDriverDto[]>(`${CHARGE_PILE_BASE}/getChargePileDrivers`, {
    signal: options?.signal,
  })
}

/**
 * 新增充电桩（命令外普通写操作）：deviceConfig 为表单 JSON 文本解析后的对象
 * （解析校验由页面负责，本层接收已解析对象原样提交）。
 */
export async function addChargePile(
  params: ChargePileSaveParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${CHARGE_PILE_BASE}/addChargePile`, params, {
    signal: options?.signal,
  })
}

/**
 * 编辑充电桩：以原 deviceKey 定位并整体提交全部字段（旧实现同语义：
 * 表单不含 deviceKey 输入框，提交时回带 setFieldsValue 存入的原值）。
 */
export async function updateChargePile(
  params: ChargePileSaveParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${CHARGE_PILE_BASE}/updateChargePile`, params, {
    signal: options?.signal,
  })
}

/**
 * 删除充电桩（破坏性写操作，页面 confirmCommand 确认后调用）：
 * 按 deviceKey 定位（旧实现同参数）。
 */
export async function deleteChargePile(
  params: ChargePileDeviceParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${CHARGE_PILE_BASE}/deleteChargePile`, params, {
    signal: options?.signal,
  })
}

/**
 * 开始充电命令（页面 confirmCommand 确认后调用）：受理 ≠ 已开始充电
 * （充电状态的更新以列表「充电桩状态」列重新查询为准）；现场副作用
 * （真实充电动作）留专用环境验收，本层不自动重试。
 */
export async function startCharge(
  params: ChargePileDeviceParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${CHARGE_PILE_BASE}/startCharge`, params, {
    signal: options?.signal,
  })
}

/**
 * 停止充电命令（页面 confirmCommand 确认后调用）：受理 ≠ 已停止充电
 * （充电状态的更新以列表「充电桩状态」列重新查询为准）；现场副作用
 * （打断真实充电）留专用环境验收，本层不自动重试。
 */
export async function stopCharge(
  params: ChargePileDeviceParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${CHARGE_PILE_BASE}/stopCharge`, params, {
    signal: options?.signal,
  })
}
