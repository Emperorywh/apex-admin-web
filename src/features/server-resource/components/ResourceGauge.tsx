/**
 * 半圆仪表盘（P40，旧 Gauge.tsx 等价迁移 + 双主题化）。
 *
 *   - 半圆弧形 + 刻度线 + 双层旋转虚线环装饰，viewBox 固定 0 0 240 168；
 *   - 弧长用 pathLength=100 + strokeDasharray 表示百分比，CSS transition 平滑过渡；
 *   - 弧形颜色随严重程度档位（<70 蓝 / 70~89 黄 / ≥90 红）带同色辉光——
 *     严重程度色双主题共用（resourcePolicy），文字/刻度/轨道等环境色经
 *     CSS 变量由页面样式按 data-theme 切换；
 *   - 数值变化时 700ms 三次方缓动（rAF 驱动；IAB 冻结 rAF 时停在起点，
 *     为验证环境限制非页面缺陷，真实浏览器正常）；
 *   - value=null（缺失/不可计算）显示「--」并隐藏弧形，绝不显示虚假 0%。
 */
import { useEffect, useRef, useState } from 'react'
import { hexA, sevOf } from '../resourcePolicy'
import styles from './ResourceGauge.module.css'

export interface ResourceGaugeProps {
  /** 仪表名称（显示在弧内上方，已翻译） */
  name: string
  /** 0~100 使用率；null 表示缺失/不可计算（降级态） */
  value: number | null
}

const CX = 120
const CY = 142
const ARC_D = 'M28 142 A92 92 0 0 1 212 142'

/*
 * 刻度线为静态内容，模块级预生成一次即可：
 * 每 5% 一根，25% 整数倍为主刻度（更长更亮）；颜色走 CSS 变量随主题切换。
 */
const TICKS = Array.from({ length: 21 }, (_, i) => i * 5).map((a) => {
  const ang = Math.PI * (1 - a / 100)
  const major = a % 25 === 0
  const r1 = major ? 76 : 79.5
  const r2 = 83
  return (
    <line
      key={a}
      className={major ? styles.tickMajor : styles.tickMinor}
      x1={(CX + r1 * Math.cos(ang)).toFixed(1)}
      y1={(CY - r1 * Math.sin(ang)).toFixed(1)}
      x2={(CX + r2 * Math.cos(ang)).toFixed(1)}
      y2={(CY - r2 * Math.sin(ang)).toFixed(1)}
      strokeWidth={major ? 2 : 1}
    />
  )
})

export function ResourceGauge({ name, value }: ResourceGaugeProps) {
  // display 为缓动中的展示值；shownRef 记录当前已展示值，作为下一次缓动的起点
  const [display, setDisplay] = useState(0)
  const shownRef = useRef(0)
  const rafRef = useRef(0)

  // 数值变化时启动 700ms 三次方缓动；卸载或值变化时取消上一段动画
  useEffect(() => {
    if (value === null) return
    const from = shownRef.current
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.max(0, Math.min(1, (t - t0) / 700))
      const v = from + (value - from) * (1 - Math.pow(1 - k, 3))
      shownRef.current = v
      setDisplay(v)
      if (k < 1) rafRef.current = requestAnimationFrame(step)
    }
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value])

  const v = value ?? 0
  const sev = sevOf(v)
  return (
    <svg className={styles.gauge} viewBox="0 0 240 168" role="img" aria-label={name}>
      <circle className={`${styles.spinRing} ${styles.spin}`} cx={CX} cy={CY} r="108" />
      <circle className={`${styles.spinRing} ${styles.spinRev}`} cx={CX} cy={CY} r="99" />
      {TICKS}
      <path className={styles.track} d={ARC_D} />
      <path
        className={styles.valueArc}
        pathLength={100}
        d={ARC_D}
        style={{
          strokeDasharray: `${v} 100`,
          // 使用率过低时弧形几乎不可见，直接隐藏避免残留一小段色块
          visibility: value !== null && v >= 0.3 ? 'visible' : 'hidden',
          stroke: sev.c,
          filter: `drop-shadow(0 0 5px ${hexA(sev.c, 0.55)})`,
        }}
      />
      <text className={styles.gaugeName} x={CX} y="92">
        {name}
      </text>
      <text className={styles.gaugeNum} x={CX} y="130" textAnchor="middle">
        {/* 缺失/不可计算显示「--」，不显示 0（DoD 14：0≠缺失） */}
        <tspan className={styles.valueText}>{value === null ? '--' : display.toFixed(1)}</tspan>
        <tspan className={styles.percentText} dx="5">
          %
        </tspan>
      </text>
    </svg>
  )
}
