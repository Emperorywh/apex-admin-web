/**
 * 业务时间解析与展示纯函数（T00.7，迁移规格 11.3 时间口径）。
 *
 * 已实证的后端时间形态（T00.3 联调：GET /systemLogos 的 createTime）：
 * - `yyyy-MM-dd HH:mm:ss` 字符串：后端未携带时区信息，含义是部署时区墙钟时间，
 *   必须按 DEPLOY_TIMEZONE 解释，绝不能丢进 dayjs() 被浏览器时区隐式接管；
 * - 带偏移的 date-time（ISO `...T...+08:00` / `...Z`）：绝对时刻明确，
 *   解析后统一换算到部署时区展示；
 * - 纯日期 `yyyy-MM-dd`：按部署时区的当日零点理解（统计区间 / 业务日期场景）。
 *
 * 纪律：
 * - 无法识别的时间字符串返回 null（不猜格式、不回退"当前时间"）；
 * - 所有展示输出部署时区墙钟，浏览器时区只影响 Intl 数值格式，不影响业务值；
 * - 具体 endpoint 若声明其他口径（统计天数等），由该页面服务自行适配并登记。
 */

import type { Dayjs } from 'dayjs'
import { DEPLOY_TIMEZONE } from '@/constants/datetime'
import { dayjs } from '@/utils/datetime/deployDayjs'

/** 后端墙钟时间（yyyy-MM-dd HH:mm:ss，可带 1–3 位毫秒） */
const BACKEND_DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,3})?$/

/** 纯业务日期（yyyy-MM-dd） */
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

/** 带时区偏移或 UTC 标记的 ISO date-time（绝对时刻明确） */
const OFFSET_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})$/

/** 展示层"不可解析/缺失"占位（视觉规范：单元格无数据一律留白，不用「—」；
 *  唯一例外是统计条缺失值，见 OrderStatisticsBar） */
export const UNPARSEABLE_DATETIME = ''

/**
 * 把后端返回的时间值解析为 Dayjs（部署时区上下文）。
 * 返回 null 表示输入为空或无法识别——调用方必须把 null 当"缺失/未知"呈现，
 * 不得转成 0、当前时间或空字符串冒充有效时间。
 */
export function parseBackendDateTime(value: string | number | null | undefined): Dayjs | null {
  if (value === null || value === undefined || value === '') return null

  // 毫秒时间戳（OpenAPI 中 timestamp 字段为 int64 毫秒）：绝对时刻明确
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return dayjs(value).tz(DEPLOY_TIMEZONE)
  }

  const text = value.trim()

  // 后端墙钟字符串：按部署时区解释（已实证格式，规格 11.3）
  if (BACKEND_DATETIME_RE.test(text)) {
    const parsed = dayjs.tz(text, DEPLOY_TIMEZONE)
    return parsed.isValid() ? parsed : null
  }

  // 带偏移 ISO：解析绝对时刻后换算到部署时区
  if (OFFSET_DATETIME_RE.test(text)) {
    const parsed = dayjs(text).tz(DEPLOY_TIMEZONE)
    return parsed.isValid() ? parsed : null
  }

  // 纯日期：部署时区当日零点（筛选区间起点等场景）
  if (DATE_ONLY_RE.test(text)) {
    const parsed = dayjs.tz(`${text} 00:00:00`, DEPLOY_TIMEZONE)
    return parsed.isValid() ? parsed : null
  }

  // 未知格式：不猜，显式缺失
  return null
}

/**
 * 按部署时区格式化为字符串；输入缺失/不可解析时返回 null。
 * pattern 默认秒级墙钟，与后端返回形态一致；需要毫秒/日期时由调用方传 pattern。
 */
export function formatInDeployTimezone(
  value: string | number | null | undefined,
  pattern: string = 'YYYY-MM-DD HH:mm:ss',
): string | null {
  const parsed = parseBackendDateTime(value)
  return parsed ? parsed.format(pattern) : null
}

/**
 * 展示层便捷封装：缺失/不可解析统一显示占位符（不显示空白或技术细节）。
 * 单元格、详情行等"必须有文字"的场景直接用本函数。
 */
export function displayDateTime(
  value: string | number | null | undefined,
  pattern: string = 'YYYY-MM-DD HH:mm:ss',
): string {
  return formatInDeployTimezone(value, pattern) ?? UNPARSEABLE_DATETIME
}
