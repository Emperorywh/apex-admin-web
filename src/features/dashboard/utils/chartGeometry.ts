/**
 * SVG 图表共享几何工具：坐标轴刻度与平滑曲线路径。
 */

export interface ChartPoint {
  x: number
  y: number
}

export interface AxisModel {
  max: number
  ticks: number[]
}

/** 把任意步长取整到 1/2/5 × 10ⁿ，保证刻度值可读 */
function niceStep(raw: number): number {
  const safe = Math.max(1e-6, raw)
  const base = 10 ** Math.floor(Math.log10(safe))
  const scaled = safe / base
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return nice * base
}

/** 依据数据最大值生成「零起点 + 整刻度」的纵轴：上限留出一档余量 */
export function buildAxis(rawMax: number): AxisModel {
  const safe = Math.max(1, rawMax)
  const step = niceStep(safe / 4)
  const max = step * Math.ceil(safe / step)
  const ticks: number[] = []
  for (let value = 0; value <= max; value += step) ticks.push(value)
  return { max, ticks }
}

/**
 * Catmull-Rom 转三次贝塞尔的平滑折线路径；
 * 少于 3 个点时退化为直线段，控制点按 1/6 张力计算。
 */
export function smoothLinePath(points: readonly ChartPoint[]): string {
  if (points.length === 0) return ''
  if (points.length < 3) {
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  }
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  return d
}

/** 极角（度，0 指向正上方、顺时针）→ 笛卡尔坐标 */
export function polarPoint(cx: number, cy: number, radius: number, angleDeg: number): ChartPoint {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
}

/** 环形分段路径（角度制；起止差 ≥ 360 时由调用方改用整圆） */
export function donutSlicePath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  const p1 = polarPoint(cx, cy, outerRadius, startAngle)
  const p2 = polarPoint(cx, cy, outerRadius, endAngle)
  const p3 = polarPoint(cx, cy, innerRadius, endAngle)
  const p4 = polarPoint(cx, cy, innerRadius, startAngle)
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ')
}
