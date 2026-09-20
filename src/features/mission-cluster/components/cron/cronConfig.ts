/**
 * cron 时间表达式（6 位：秒 分 时 日 月 周）编辑组件的共享配置。
 *
 * 语义契约（P21 等价迁移，逐项对照旧 CronExpress/CronTabs 实现）：
 * - 表达式恒为 6 段空格分隔，第 6 位（周）可为 `?`（不指定），与第 3 位（日）
 *   的 `?` 互斥由用户在 Tab 中自行切换，前端不做联动强约束（旧同边界）；
 * - cronRegex 只校验「6 段非空白」形态（旧同款正则），不校验取值域——
 *   越界值由后端调度器拒绝并如实反馈，前端不臆造校验规则；
 * - 调度时区为部署配置时区（后端解释），前端不做任何时区换算或
 *   「下一次执行时间」推算（未确认调度器语义不展示猜测）。
 */

/** 六段字段的下标查找表（键=旧组件 text 约定：小时字段用「小时」） */
export const CRON_FIELD_INDEX: Record<string, number> = {
  秒: 0,
  分: 1,
  小时: 2,
  日: 3,
  月: 4,
  周: 5,
}

/** 各字段的可指定值数量（「指定」勾选组长度） */
export const CRON_FIELD_COUNT: Record<string, number> = {
  秒: 60,
  分: 60,
  小时: 24,
  日: 31,
  月: 12,
  周: 7,
}

/** 表达式整体形态校验：恰好 6 段非空白（旧 cronRegex 同款） */
export const CRON_EXPRESSION_PATTERN = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/

/** cron 表达式默认值（6 位全通配、周位不指定；旧 CronExpress 初始态同款） */
export const CRON_DEFAULT_EXPRESSION = '* * * * * ?'

/** 日/月/周字段的「指定」勾选组取值从 1 起（秒/分/小时从 0 起，旧同款） */
const ONE_BASED_FIELDS = ['日', '月', '周']

/**
 * 构建单个字段「指定」勾选组的选项。
 * 日/月/周 → 标签与值均为 1..N；秒/分/小时 → 标签两位补零、值为 0..N-1。
 */
export function buildCronCheckboxOptions(field: string): { label: string; value: string }[] {
  const count = CRON_FIELD_COUNT[field] ?? 0
  const oneBased = ONE_BASED_FIELDS.includes(field)
  return Array.from({ length: count }, (_, index) =>
    oneBased
      ? { label: String(index + 1), value: String(index + 1) }
      : { label: String(index).padStart(2, '0'), value: String(index) },
  )
}

/**
 * 通用分段替换：把表达式第 fieldIndex 段替换为 piece，其余段原样保留。
 * 旧实现用 toSpliced（ES2023），此处以 map 等价改写（不改动未涉及段）。
 */
export function spliceCronSegment(expression: string, fieldIndex: number, piece: string): string {
  return expression
    .split(' ')
    .map((segment, index) => (index === fieldIndex ? piece : segment))
    .join(' ')
}

/**
 * 前置通配收敛：把目标字段之前所有 `*` 段替换为 `0`（旧 replaceToZero 同款）。
 * 语义：为「分及之后」字段指定具体值时，前置高位不能停留在通配（否则语义矛盾），
 * 旧实现以 0 收敛，本迁移逐位等价保留。
 */
export function collapseLeadingWildcards(expression: string, fieldIndex: number): string {
  return expression
    .split(' ')
    .map((segment, index) => (segment === '*' && fieldIndex > index ? '0' : segment))
    .join(' ')
}

/** 解析分段数值：取分隔符前的整数部分；不可解析返回 null（控件显示为空） */
export function parseCronSegmentNumber(segment: string, separator: string, part: 0 | 1): number | null {
  const raw = (segment ?? '').split(separator)?.[part]
  if (raw === undefined || raw === '') return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? null : parsed
}

// ─── 字段行为配置（置于本共享配置文件：fast-refresh 只允许组件文件导出组件，
// P12 同款手法；逐字段对照旧 Second/Minute/Hour/Day/MonthTab）───

/** 单个 cron 字段的行为配置（逐字段对照旧五个 Tab 的差异点） */
export interface CronFieldConfig {
  /** 字段名（CRON_FIELD_INDEX 查找键；小时字段用「小时」，Tab 标签另用 tabLabel） */
  field: string
  /** Tab 标签（旧 items label：秒/分/时/日/月） */
  tabLabel: string
  /** 「每 X」选项文案（每秒/每分/每小时/每天/每月） */
  everyLabel: string
  /** 是否提供「不指定 ?」选项（日/月有） */
  supportUnspecified: boolean
  /** 是否提供「范围 -」选项（五字段均有；周没有，由周组件单独实现） */
  supportRange: boolean
  rangeMin: number
  rangeMax: number
  intervalMin: number
  intervalMax: number
  /** 切换到「指定」时的默认片段（秒/分/小时=0、日/月=1，旧 useRef 同值） */
  defaultCheckbox: string
  /** 切「每 X」是否整表重置（仅秒=true，旧 SecondTab case "*" 同款） */
  everyResetsAll: boolean
}

/** 五个通用字段的配置表 */
export const CRON_FIELD_CONFIGS: Record<string, CronFieldConfig> = {
  second: {
    field: '秒',
    tabLabel: '秒',
    everyLabel: '每秒',
    supportUnspecified: false,
    supportRange: true,
    rangeMin: 1,
    rangeMax: 59,
    intervalMin: 0,
    intervalMax: 59,
    defaultCheckbox: '0',
    everyResetsAll: true,
  },
  minute: {
    field: '分',
    tabLabel: '分',
    everyLabel: '每分',
    supportUnspecified: false,
    supportRange: true,
    rangeMin: 1,
    rangeMax: 59,
    intervalMin: 0,
    intervalMax: 59,
    defaultCheckbox: '0',
    everyResetsAll: false,
  },
  hour: {
    field: '小时',
    tabLabel: '时',
    everyLabel: '每小时',
    supportUnspecified: false,
    supportRange: true,
    rangeMin: 0,
    rangeMax: 23,
    intervalMin: 0,
    intervalMax: 23,
    defaultCheckbox: '0',
    everyResetsAll: false,
  },
  day: {
    field: '日',
    tabLabel: '日',
    everyLabel: '每天',
    supportUnspecified: true,
    supportRange: true,
    rangeMin: 1,
    rangeMax: 31,
    intervalMin: 1,
    intervalMax: 31,
    defaultCheckbox: '1',
    everyResetsAll: false,
  },
  month: {
    field: '月',
    tabLabel: '月',
    everyLabel: '每月',
    supportUnspecified: true,
    supportRange: true,
    rangeMin: 1,
    rangeMax: 12,
    intervalMin: 1,
    intervalMax: 12,
    defaultCheckbox: '1',
    everyResetsAll: false,
  },
}
