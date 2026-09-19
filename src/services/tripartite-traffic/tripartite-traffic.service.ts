/**
 * 三方交管服务（P19 三方交管页；owner 归 P19，contracts.md 第 5 节）。
 *
 * 接口族（逐 operation 核对最新 OpenAPI，method/path/请求体形态一致）：
 * - GET  /fms/v1/dispatcher/tripartiteTraffic/pageTripartiteTraffics
 *         分页查询（GET + query 平铺 pageParam；OpenAPI 文档仅写 param 占位
 *         对象，与 P31 pageUsers / P32 pageRoles 同款已实证平铺可用）
 * - POST /fms/v1/dispatcher/tripartiteTraffic/addTripartiteTraffic
 *         新增（POST + JSON body 完整实体）
 * - POST /fms/v1/dispatcher/tripartiteTraffic/updateTripartiteTraffic
 *         编辑（POST + JSON body 完整实体，含 id 定位——与 P32 updateRole 同
 *         「body 定位」族，区别于 ?id= query 族）
 * - POST /fms/v1/dispatcher/tripartiteTraffic/deleteTripartiteTraffic
 *         删除（POST + JSON body 完整实体——旧实现 deleteTripartiteTraffic
 *         (record) 整行提交同形态；区别于 P31/P32 的「POST+?id=」族勿混淆）
 * - GET  /fms/v1/dispatcher/map/getSimpleTripartiteTrafficEdgeGroups
 *         点边组合选项（GET 无参；路径归属 dispatcher/map 控制器但消费者仅
 *         本页，owner=P19 落本服务，不复用 P11 的 getAllSimpleNodeEdgeGroups
 *         ——两者是不同 operation，本接口响应多 mapId/mapName 字段）
 * - POST /fms/v1/dispatcher/tripartiteTraffic/testCommunication
 *         通信模拟测试（POST + JSON body applyType/areaCode/systemCode；
 *         仿真语义：向三方仲裁系统模拟发起占用申请/释放通信，非车辆动、
 *         非本系统数据变更，A21 合法真实仿真接口保留并标识）
 *
 * 协议纪律：
 * - systemCode 固定 'rxx'（旧实现同款常量；仲裁方按此标识本系统）；
 * - 响应解包/业务码/取消统一由请求层完成，本层不重复处理（A06：不依赖英文
 *   success 文案判断成败——旧实现 res.message === "success" 判断方式废弃）；
 * - 写操作（含模拟测试）不自动重试：失败由页面如实反馈（message），后端拒绝
 *   不当成功；查询失败由表格内建错误态呈现（重试入口在表格内部，按钮纪律）。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  SimpleMapNodeEdgeGroup,
  TripartiteTrafficApplyRequest,
  TripartiteTrafficPageParam,
  TripartiteTrafficPageResult,
  TripartiteTrafficRecord,
} from '@/services/tripartite-traffic/tripartite-traffic.service.types'

/** 三方交管控制类统一前缀（request 层 baseURL 已含 /fms/v1） */
const TRAFFIC_BASE = '/dispatcher/tripartiteTraffic'
/** 点边组合选项端点（路径挂在 dispatcher/map 控制器下，契约如此不归并前缀） */
const EDGE_GROUP_URL = '/dispatcher/map/getSimpleTripartiteTrafficEdgeGroups'

/** 本系统在仲裁方的系统编号（旧实现 onTestCommunicationClick 同款硬编码） */
export const TRIPARTITE_SYSTEM_CODE = 'rxx'

/** 分页查询三方交管：GET + query 平铺（pageNo 从 1 计数） */
export async function pageTripartiteTraffics(
  params: TripartiteTrafficPageParam,
  options?: RequestOptions,
): Promise<TripartiteTrafficPageResult> {
  return api.get<TripartiteTrafficPageResult>(`${TRAFFIC_BASE}/pageTripartiteTraffics`, {
    signal: options?.signal,
    params,
  })
}

/** 新增三方交管：POST + JSON body（完整实体形态） */
export async function addTripartiteTraffic(
  body: TripartiteTrafficRecord,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${TRAFFIC_BASE}/addTripartiteTraffic`, body, {
    signal: options?.signal,
  })
}

/** 编辑三方交管：POST + JSON body 完整实体（含 id 定位，旧实现同形态） */
export async function updateTripartiteTraffic(
  body: TripartiteTrafficRecord,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${TRAFFIC_BASE}/updateTripartiteTraffic`, body, {
    signal: options?.signal,
  })
}

/** 删除三方交管：POST + JSON body 完整实体（旧实现整行提交同形态） */
export async function deleteTripartiteTraffic(
  body: TripartiteTrafficRecord,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${TRAFFIC_BASE}/deleteTripartiteTraffic`, body, {
    signal: options?.signal,
  })
}

/** 查询点边组合选项：GET 无参（全部地图扁平集合） */
export async function getSimpleTripartiteTrafficEdgeGroups(
  options?: RequestOptions,
): Promise<SimpleMapNodeEdgeGroup[]> {
  return api.get<SimpleMapNodeEdgeGroup[]>(EDGE_GROUP_URL, {
    signal: options?.signal,
  })
}

/** 通信模拟测试：POST + JSON body（仿真语义，结果由后端真实反馈） */
export async function testCommunication(
  body: TripartiteTrafficApplyRequest,
  options?: RequestOptions,
): Promise<void> {
  await api.post<void>(`${TRAFFIC_BASE}/testCommunication`, body, {
    signal: options?.signal,
  })
}
