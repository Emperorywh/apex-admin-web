/**
 * 故障告警报表服务（P36 整页交付；owner=P36，contracts.md 系统告警报表节）。
 *
 * 接口族（逐 operation 核对 OpenAPI，method/path/请求体形态与旧实现一致）：
 * - POST /fms/v1/report/systemAlarmRecord/alarmStatistics
 *   告警统计聚合（body=AlarmStatisticsParam → AlarmStatisticsVO）：
 *   每日告警计数 + 指定日期 Top10 车辆告警（topAgvDate 不传则不查该维度）
 * - POST /fms/v1/report/systemAlarmRecord/pageSystemAlarmRecords
 *   系统告警明细分页（body=SystemAlarmRecordPageParam → 分页 records/total）
 *
 * 两个 POST 均为纯查询语义（统计报表/分页查询，无任何副作用），
 * 按 TASKS §1「查询性质 POST 按业务语义分类」归入只读查询，可安全重查/自动恢复；
 * 响应解包/业务码/取消统一由请求层完成，本层不重复处理。
 *
 * 时间参数纪律（规格 11.3 部署时区）：统计窗口与筛选时间均为
 * "yyyy-MM-dd HH:mm:ss" 墙钟字符串，由调用方（页面层）按部署时区格式化；
 * 文本条件在服务层做一次 trim 归一化：空白串视为不筛选（不传该参数）。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type {
  AlarmStatisticsParam,
  AlarmStatisticsVo,
  SystemAlarmRecordPage,
  SystemAlarmRecordPageParam,
} from '@/services/report-fault/report-fault.service.types'

/** 系统告警报表控制器统一前缀（request 层 baseURL 已含 /fms/v1） */
const SYSTEM_ALARM_BASE = '/report/systemAlarmRecord'

/** 文本条件归一化：去首尾空白，空白串视为不筛选（不传该参数，旧实现同口径） */
function trimQueryParam(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** 文本条件集合的统一 trim（仅筛选类字段；pageNo/pageSize/isClosed 等原样直传） */
function normalizePageParam(
  param: SystemAlarmRecordPageParam,
): SystemAlarmRecordPageParam {
  return {
    ...param,
    sourceKey: trimQueryParam(param.sourceKey),
    sourceName: trimQueryParam(param.sourceName),
    alarmCode: trimQueryParam(param.alarmCode),
    alarmType: trimQueryParam(param.alarmType),
    orderKey: trimQueryParam(param.orderKey),
  }
}

/** 告警统计聚合：KPI（故障次数/未关闭/关闭率/平均时长）与图表共用一次请求 */
export async function alarmStatistics(
  param: AlarmStatisticsParam,
  options?: RequestOptions,
): Promise<AlarmStatisticsVo> {
  return api.post<AlarmStatisticsVo>(`${SYSTEM_ALARM_BASE}/alarmStatistics`, param, {
    signal: options?.signal,
  })
}

/** 系统告警明细分页：服务端分页 + 全部接口筛选条件直传（接口无排序参数，G09） */
export async function pageSystemAlarmRecords(
  param: SystemAlarmRecordPageParam,
  options?: RequestOptions,
): Promise<SystemAlarmRecordPage> {
  return api.post<SystemAlarmRecordPage>(
    `${SYSTEM_ALARM_BASE}/pageSystemAlarmRecords`,
    normalizePageParam(param),
    { signal: options?.signal },
  )
}
