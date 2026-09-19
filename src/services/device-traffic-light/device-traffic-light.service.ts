/**
 * 交通灯设备服务（P17 整页重写交付；owner 归 P17，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对 OpenAPI 与旧实现，method/path/请求体形态一致）：
 * - GET  /fms/v1/device/trafficLight/pageTrafficLights  分页查询交通灯（GET + query 平铺，G04）
 * - GET  /fms/v1/device/trafficLight/getDrivers         驱动集合（GET 无参全量，驱动下拉数据源）
 * - POST /fms/v1/device/trafficLight/addTrafficLight    新增交通灯（DeviceTrafficLightAddParam）
 * - POST /fms/v1/device/trafficLight/updateTrafficLight 编辑交通灯（原 deviceKey 定位 + 全量提交）
 * - POST /fms/v1/device/trafficLight/deleteTrafficLight 删除交通灯（DeviceTrafficLightParam）
 * - POST /fms/v1/device/trafficLight/testTrafficLight   连通性测试（DeviceTrafficLightParam）
 *
 * 未落地 operation（旧仓库无本页可达消费者，不因 API 存在增加旧不可达业务）：
 * - GET getTrafficLights：旧仓库仅 api 层有封装、全量页面无引用（P15/P16 同纪律）。
 *
 * 协议纪律：
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理（A06：不依赖英文
 *   success 文案判断成败）；
 * - testTrafficLight 是向现场交通灯设备发起的真实连通性请求（A21：设备控制类
 *   操作，不作为只读自动执行）——页面 confirmCommand 确认后调用；code=200 即
 *   「测试成功，连通性正常」，失败经 apiErrorMessage 透传后端诊断信息，本层
 *   不自动重试、不用动画假装测试通过；
 * - 删除为破坏性写操作，页面 confirmCommand（danger）确认后调用。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  TrafficLightDeviceParam,
  TrafficLightDriverDto,
  TrafficLightPageDto,
  TrafficLightPageParam,
  TrafficLightSaveParam,
} from '@/services/device-traffic-light/device-traffic-light.service.types'

/** 交通灯设备控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const TRAFFIC_LIGHT_BASE = '/device/trafficLight'

/**
 * 分页查询交通灯：pageNo 从 1 计数（页面用 toBackendPage 换算），
 * query 为名称或唯一 key 查询条件（旧实现同参数，GET + query 平铺）。
 */
export async function pageTrafficLights(
  params: TrafficLightPageParam,
  options?: RequestOptions,
): Promise<TrafficLightPageDto> {
  return api.get<TrafficLightPageDto>(`${TRAFFIC_LIGHT_BASE}/pageTrafficLights`, {
    params,
    signal: options?.signal,
  })
}

/**
 * 获取交通灯驱动集合（GET 无参全量）：新增/编辑弹窗的驱动下拉数据源；
 * 选中驱动后以其 driverProtocol 作为请求参数的初始 JSON（旧实现同语义）。
 */
export async function fetchTrafficLightDrivers(
  options?: RequestOptions,
): Promise<TrafficLightDriverDto[]> {
  return api.get<TrafficLightDriverDto[]>(`${TRAFFIC_LIGHT_BASE}/getDrivers`, {
    signal: options?.signal,
  })
}

/**
 * 新增交通灯（命令外普通写操作）：deviceConfig 为通用 map（旧实现键集
 * url/requestParam/responseSuccessExpression，requestParam 已解析为对象原样上送）。
 */
export async function addTrafficLight(
  params: TrafficLightSaveParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${TRAFFIC_LIGHT_BASE}/addTrafficLight`, params, {
    signal: options?.signal,
  })
}

/**
 * 编辑交通灯：以原 deviceKey 定位并整体提交全部字段（旧实现同语义：
 * 表单不含 deviceKey 输入框，提交时回带编辑行记录的原值）。
 */
export async function updateTrafficLight(
  params: TrafficLightSaveParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${TRAFFIC_LIGHT_BASE}/updateTrafficLight`, params, {
    signal: options?.signal,
  })
}

/**
 * 删除交通灯（破坏性写操作，页面 confirmCommand 确认后调用）：
 * 按 deviceKey 定位（旧实现同参数）。
 */
export async function deleteTrafficLight(
  params: TrafficLightDeviceParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${TRAFFIC_LIGHT_BASE}/deleteTrafficLight`, params, {
    signal: options?.signal,
  })
}

/**
 * 连通性测试（页面 confirmCommand 确认后调用）：向现场设备发起一次真实
 * 请求；code=200=连通性正常，失败透传后端诊断信息；现场副作用（设备收到
 * 测试请求）按 A21 归类为设备控制操作，本层不自动重试。
 */
export async function testTrafficLight(
  params: TrafficLightDeviceParam,
  options?: RequestOptions,
): Promise<unknown> {
  return api.post<unknown>(`${TRAFFIC_LIGHT_BASE}/testTrafficLight`, params, {
    signal: options?.signal,
  })
}
