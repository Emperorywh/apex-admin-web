/**
 * 故障明细筛选模型（P36 私有；类型 + 常量 + 草稿→协议参数的纯函数，
 * 与筛选表单组件分离——fast-refresh 纪律：组件文件不导出运行时常量/函数）。
 */

import type { Dayjs } from 'dayjs'
import type { AlarmLevel, AlarmSourceType, SystemAlarmRecordPageParam } from '@/services/report-fault/report-fault.service.types'

/** 时间范围值（RangePicker 双值可为 null：半选时该侧不作为条件下发） */
export type TimeRangeValue = [Dayjs | null, Dayjs | null] | null

/** 表单草稿值形状（Form.Item name 与之一一对应） */
export interface FaultDetailFilterValues {
  /** 告警级别（协议枚举；undefined = 全部） */
  alarmLevel?: AlarmLevel
  /** 告警类型原文；undefined = 全部 */
  alarmType?: string
  /** 告警来源（协议枚举；undefined = 全部） */
  sourceType?: AlarmSourceType
  /** 关闭状态：'open' 仅未处理 / 'closed' 仅已关闭 / undefined 全部 */
  closedState?: 'open' | 'closed'
  /** 告警码 */
  alarmCode?: string
  /** 来源标识 */
  sourceKey?: string
  /** 来源名称 */
  sourceName?: string
  /** 关联任务 key */
  orderKey?: string
  /** 发生时间范围 */
  startTimeRange?: TimeRangeValue
  /** 恢复时间范围 */
  endTimeRange?: TimeRangeValue
}

/** 空草稿常量（重置时整对象替换，切勿原地修改） */
export const EMPTY_FILTER_VALUES: FaultDetailFilterValues = {}

/** 秒级时间串格式（与接口 date-time 墙钟约定一致，规格 11.3） */
export const FILTER_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'

/** 时间范围取侧：半选（仅一侧有值）时该侧不作为条件下发 */
function rangeBound(range: TimeRangeValue | undefined, side: 0 | 1): string | undefined {
  const value = range?.[side]
  return value ? value.format(FILTER_DATE_TIME_FORMAT) : undefined
}

/** 筛选草稿 → 明细分页协议参数（不含分页字段；isClosed 三态映射保留 false） */
export function buildDetailFilterParam(values: FaultDetailFilterValues): SystemAlarmRecordPageParam {
  return {
    alarmLevel: values.alarmLevel,
    alarmType: values.alarmType,
    sourceType: values.sourceType,
    sourceKey: values.sourceKey,
    sourceName: values.sourceName,
    alarmCode: values.alarmCode,
    orderKey: values.orderKey,
    // 状态三态映射：open → false（仅未关闭）/ closed → true（仅已关闭）/ 不传查全部；
    // false 是有效筛选值，禁止用 `|| undefined` 兜底（会吞掉 false）
    isClosed:
      values.closedState === 'open'
        ? false
        : values.closedState === 'closed'
          ? true
          : undefined,
    startTimeBegin: rangeBound(values.startTimeRange, 0),
    startTimeEnd: rangeBound(values.startTimeRange, 1),
    endTimeBegin: rangeBound(values.endTimeRange, 0),
    endTimeEnd: rangeBound(values.endTimeRange, 1),
  }
}
