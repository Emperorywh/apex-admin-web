/**
 * 服务器资源监控的共享常量与纯函数（P40 owner，旧 model/policy.ts 等价迁移）。
 *
 * 与旧实现（C:\code\dd ServerRealtimeResources/model/policy.ts）的差异（差异登记
 * tasks/P40.md，不静默偏离）：
 * - 轮询节奏交由 useVisiblePolling（约 5 秒，规格 8.2/D14），本文件不再定义
 *   POLL_MS；趋势窗口仍 90 点（约 7.5 分钟窗口，页面脚注按常量现算）；
 * - normRate 纪律修正：旧实现「非法值按 0 处理」会把缺失/异常冒充成真实 0%，
 *   违反 DoD 14（0≠缺失/未知）与任务卡「未知容量不显示虚假 0%」——缺失/非法
 *   统一归一为 null（不可计算），显示「--」；真实 0 仍显示 0；
 * - 配色新增浅色主题档：旧大屏为纯深色配色，新页面为工作区页签双主题形态，
 *   序列色/严重程度色双主题共用（中饱和度在浅深背景均可读），仅网格/文字/
 *   十字线等环境色按主题分档（Canvas 不能消费 CSS 变量，hex 由组件注入）。
 */

/** 趋势窗口点数：90 × 约 5s ≈ 7.5 分钟（窗口时长随轮询节奏变化，页面脚注现算） */
export const MAX_HIST = 90

/** 趋势序列 key（CPU / 内存 / JVM 堆） */
export type SeriesKey = 'cpu' | 'mem' | 'jvm'

/** 趋势历史采样点（t 为采集时刻的毫秒时间戳；值域 0~100，null=该点不可计算） */
export interface TrendPoint {
  t: number
  cpu: number | null
  mem: number | null
  jvm: number | null
}

/**
 * 趋势序列配色（旧实现已通过 CVD / 对比度校验，双主题共用不随意改色）；
 * 名称由页面按语言注入，颜色固定。
 */
export const SERIES: readonly { key: SeriesKey; color: string }[] = [
  { key: 'cpu', color: '#3987e5' },
  { key: 'mem', color: '#d95926' },
  { key: 'jvm', color: '#199e70' },
] as const

/** 严重程度档位：c 主色 / t 文案 key（简中，组件层 t() 翻译）/ dot 状态点颜色 */
export interface Severity {
  c: string
  t: string
  dot: string
}

const SEV_NORMAL: Severity = { c: '#3987e5', t: '正常', dot: '#1fd08a' }
const SEV_WARN: Severity = { c: '#fab219', t: '偏高', dot: '#fab219' }
const SEV_CRIT: Severity = { c: '#d03b3b', t: '危险', dot: '#d03b3b' }

/** 按使用率取严重程度档位（旧实现同阈值）：<70 正常 / 70~89 偏高 / ≥90 危险 */
export function sevOf(v: number): Severity {
  return v >= 90 ? SEV_CRIT : v >= 70 ? SEV_WARN : SEV_NORMAL
}

/**
 * 使用率归一化为 0~100；返回 null 表示不可计算（缺失/非数值/无穷）。
 * 数值口径兼容两种后端形态（旧实现同规则）：0~1 视为比例（×100），
 * 其余视为百分数；越界值收拢到 0~100。真实口径以后端样本为准（G15 登记）。
 */
export function normRate(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (n >= 0 && n <= 1) return Math.min(100, Math.max(0, n * 100))
  return Math.min(100, Math.max(0, n))
}

/** 两位补零（时钟与趋势时间标签用） */
export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 十六进制颜色转 rgba（趋势图渐变、仪表辉光用） */
export function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/** 趋势图（Canvas）双主题环境色档：序列色共用，网格/文字/十字线按主题分档 */
export interface TrendThemeColors {
  /** Y 轴网格线 */
  grid: string
  /** 轴标签 / 占位文字 */
  text: string
  /** 悬停十字线 */
  hoverLine: string
  /** 序列端点圆点的底色环（深色主题用深底、浅色主题用白底衬托） */
  endpointRing: string
}

export const TREND_THEME: Record<'light' | 'dark', TrendThemeColors> = {
  light: {
    grid: 'rgba(90, 110, 150, 0.18)',
    text: '#7d879b',
    hoverLine: 'rgba(40, 60, 100, 0.32)',
    endpointRing: '#ffffff',
  },
  dark: {
    grid: 'rgba(140, 170, 220, 0.12)',
    text: '#66779c',
    hoverLine: 'rgba(220, 235, 255, 0.35)',
    endpointRing: '#0a1830',
  },
}

/** 悬浮提示的单行内容（颜色条 + 名称 + 数值） */
export interface TipRow {
  color: string
  name: string
  value: string
}

/** 页面级悬浮提示状态（x/y 为鼠标视口坐标） */
export interface TipState {
  x: number
  y: number
  title: string
  rows: TipRow[]
}
