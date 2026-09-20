/**
 * 仪表盘服务（P34 合并业务首页；owner=P34，contracts.md 实时看板节）。
 *
 * 接口族（逐 operation 核对 OpenAPI，method/path/请求体形态与旧实现一致）：
 * - POST /fms/v1/dispatcher/dashboard/board
 *   实时运行看板聚合（body=DashboardParam：days=2 覆盖今天+昨天；
 *   orderTypes 不传使用后端默认「工作任务」，与旧实现一致）
 * - POST /fms/v1/report/systemAlarmRecord/pageSystemAlarmRecords
 *   系统告警分页（body 含 isClosed=false 仅查未关闭，pageSize=100 上限取第一页，
 *   供看板「实时告警」滚动列表；与旧实现同参数形态）
 *
 * 两个 POST 均为纯查询语义（看板聚合读取 + 告警列表分页读取，无任何副作用），
 * 按 TASKS §1「查询性质 POST 按业务语义分类」归入只读查询，可安全轮询重查；
 * 响应解包 / 业务码 / 取消统一由请求层完成，本层不重复处理。
 *
 * 旧系统口径保留（HttpDashboardRepository.fetchRealtime 实证）：
 * - 聚合与告警两请求并行、独立成败——任一失败只清空各自区域，
 *   不以空列表/零 KPI 冒充成功（规格 8.2/D15，收敛在 features/dashboard hook 层）；
 * - 旧系统告警失败「静默降级为空列表」不再保留：空列表与查询失败必须可区分。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  DashboardBoardDto,
  DashboardBoardParam,
  PageSystemAlarmRecordDto,
  SystemAlarmRecordDto,
} from '@/services/dashboard/dashboard.service.types'

/** 看板聚合控制器前缀（request 层 baseURL 已含 /fms/v1） */
const DASHBOARD_BASE = '/dispatcher/dashboard'
/** 系统告警报表控制器前缀（与 P36 故障告警同接口族，本页仅消费未关闭第一页） */
const SYSTEM_ALARM_BASE = '/report/systemAlarmRecord'

/** 实时告警滚动列表规模上限（旧 REALTIME_LIST_MAX_ITEMS=100 等价保留） */
export const OPEN_ALERTS_PAGE_SIZE = 100

/**
 * 实时运行看板聚合：days=2（昨天+今天）。
 * 今日 KPI / 昨日同时刻基线 / 状态分布 / 小时趋势全部由该聚合一次下发，
 * 前端二次汇总口径集中在 features/dashboard/realtime.ts（页面 owner 纯计算）。
 */
export async function getDashboardBoard(
  param: DashboardBoardParam,
  options?: RequestOptions,
): Promise<DashboardBoardDto> {
  return api.post<DashboardBoardDto>(`${DASHBOARD_BASE}/board`, param, {
    signal: options?.signal,
  })
}

/**
 * 未关闭告警分页（看板「实时告警」面板专用）：
 * 固定第一页 + isClosed=false 仅未关闭；不传任何筛选（与旧实现一致），
 * 持续时长接口不下发，由消费方按 当前时刻 − startTime 现算。
 */
export async function pageOpenSystemAlarmRecords(
  options?: RequestOptions,
): Promise<SystemAlarmRecordDto[]> {
  const page = await api.post<PageSystemAlarmRecordDto>(
    `${SYSTEM_ALARM_BASE}/pageSystemAlarmRecords`,
    {
      pageNo: 1,
      pageSize: OPEN_ALERTS_PAGE_SIZE,
      isClosed: false,
    },
    { signal: options?.signal },
  )
  // 后端可能漏下发 records 数组：归一为空数组交给上层「真实空结果」呈现，
  // 不让结构缺失升级成查询失败（分页壳存在即查询成功）
  return Array.isArray(page?.records) ? page.records : []
}
