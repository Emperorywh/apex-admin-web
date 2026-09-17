/**
 * dayjs 时区插件的单点装配（T00.7 时间展示基础，迁移规格 11.3 / D23）。
 *
 * - 业务时间、按天统计区间、Cron 业务日期一律跟随后端部署时区展示与计算，
 *   不随使用者浏览器的时区漂移；部署时区唯一来源是 src/constants/datetime.ts
 *   的 DEPLOY_TIMEZONE（VITE_DEPLOY_TIMEZONE 注入，缺省 Asia/Shanghai）；
 * - utc / timezone 插件全站只在此扩展一次，重复 extend 无害但会散落装配点，
 *   其他模块一律从本文件导入装配后的 dayjs，禁止自行 import 'dayjs/plugin/*'；
 * - tz.setDefault 只影响 dayjs.tz() 的缺省时区上下文；解析后端"无时区字符串"
 *   必须显式 dayjs.tz(value, DEPLOY_TIMEZONE)（见 datetimeDisplay.ts），
 *   不能依赖浏览器本地时区的隐式行为。
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { DEPLOY_TIMEZONE } from '@/constants/datetime'

// 扩展 UTC 模式与时区转换能力（timezone 依赖 utc，顺序不可颠倒）
dayjs.extend(utc)
dayjs.extend(timezone)

// 全站缺省时区上下文固定为部署时区
dayjs.tz.setDefault(DEPLOY_TIMEZONE)

export { dayjs }
export type { Dayjs } from 'dayjs'
