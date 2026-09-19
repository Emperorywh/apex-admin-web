/**
 * 授权状态派生纯函数（P29 软件信息页）。
 *
 * 旧版语义（SystemInvolve/SoftwareInformation getLicenseStatus）等价迁移：
 * - 以「过期日期当日零点 − 当前当日零点」的整天数差判定（当天到期 = 剩余 0 天）；
 * - 差值 <0 已过期；≤30 即将到期；>30 已激活；缺失/不可解析 = 未知；
 * - 时区口径按规格 11.3 升级为部署时区：旧版用浏览器本地时区取日界，跨时区
 *   访问时「还剩几天」可能漂移一天；新版过期日期与当前时刻统一经
 *   parseBackendDateTime / DEPLOY_TIMEZONE 解析（后端墙钟语义），日期原文展示不变；
 * - 剩余天数在「未知」状态返回 null：缺失不可计算，不冒充 0（DoD 14 /
 *   AGENTS 3 派生值缺失留白；旧版未知时显示 0，属空值纪律收敛，已在交接记录登记）。
 */

import type { Dayjs } from 'dayjs'
import { DEPLOY_TIMEZONE } from '@/constants/datetime'
import { parseBackendDateTime } from '@/utils/datetime/datetimeDisplay'
import { dayjs } from '@/utils/datetime/deployDayjs'

/** 授权状态四态（与旧版 Tag 语义一一对应） */
export type LicenseStatusKind = 'unknown' | 'expired' | 'expiring' | 'active'

export interface LicenseStatusInfo {
  kind: LicenseStatusKind
  /** 剩余整天数；expirationDate 缺失/不可解析时为 null（缺失不可计算） */
  restDays: number | null
}

/** 即将到期阈值（旧版同源：剩余 ≤30 天） */
const EXPIRING_SOON_DAYS = 30

/**
 * 由过期日期派生授权状态；now 缺省取部署时区当前时刻，参数化仅为派生逻辑
 * 与「当前时刻」来源解耦。
 */
export function deriveLicenseStatus(
  expirationDate: string | null | undefined,
  now: Dayjs = dayjs().tz(DEPLOY_TIMEZONE),
): LicenseStatusInfo {
  const expire = parseBackendDateTime(expirationDate)
  // 缺失或无法识别的时间：状态未知，剩余天数不可计算
  if (!expire) return { kind: 'unknown', restDays: null }
  const restDays = expire.startOf('day').diff(now.startOf('day'), 'day')
  if (restDays < 0) return { kind: 'expired', restDays }
  if (restDays <= EXPIRING_SOON_DAYS) return { kind: 'expiring', restDays }
  return { kind: 'active', restDays }
}
