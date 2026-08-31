/**
 * 迷你趋势图（SPEC_UI2 §8）：自绘 SVG sparkline 小组件——无新依赖、无 Effect 负担，
 * 避开 Activity 隐藏页 Effect 清理与多 ECharts 实例开销；静态呈现（无 mount 触发动效，
 * SPEC_UI2 §10 Activity 红线：缓存页内动效只能是纯 CSS 或交互响应式）。
 * 颜色由调用方经 CSS 变量/token 派生传入，本组件不出现色值字面量（SPEC_UI2 §4.3）。
 */
export interface SparklineProps {
  /** 趋势序列（按时间升序）；至少 2 个点才有可绘制折线 */
  data: readonly number[]
  /** 画布宽度，单位 px */
  width?: number
  /** 画布高度，单位 px */
  height?: number
  /** 折线颜色（CSS color，来自 token 派生） */
  color?: string
  /** 折线下方浅色填充开关 */
  filled?: boolean
}

/** 折线内边距，单位 px：避免线贴边裁剪 */
const SPARKLINE_PADDING_PX = 2

export function Sparkline({
  data,
  width = 96,
  height = 32,
  color = 'var(--ant-color-primary)',
  filled = true,
}: SparklineProps) {
  if (data.length < 2) {
    return null
  }
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min
  const innerWidth = width - SPARKLINE_PADDING_PX * 2
  const innerHeight = height - SPARKLINE_PADDING_PX * 2
  const stepX = innerWidth / (data.length - 1)
  const points = data.map((value, index) => {
    const x = SPARKLINE_PADDING_PX + index * stepX
    // 全等序列画中线；否则按值域归一（翻转 y 轴：值大在上）
    const ratio = span === 0 ? 0.5 : (value - min) / span
    const y = SPARKLINE_PADDING_PX + innerHeight - ratio * innerHeight
    return [x, y] as const
  })
  const linePath = `M ${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')}`
  const areaPath = `${linePath} L ${points[points.length - 1][0].toFixed(2)} ${height} L ${points[0][0].toFixed(2)} ${height} Z`

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      focusable="false"
    >
      {filled && <path d={areaPath} fill={color} opacity={0.12} />}
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
