/**
 * useECharts 测试（规格 §9.2/§15）：
 * - init/dispose 生命周期与 option 应用（notMerge 整体替换）；
 * - 激活（含重新激活）后下一 animation frame resize，同步阶段不 resize；
 * - 隐藏暂停 ResizeObserver 监听并取消挂起任务；重新激活实例保留；
 * - ResizeObserver trailing 防抖；
 * - 主题变化（antd token）：激活立即销毁重建，隐藏只标记、激活时延迟重建。
 * echarts 固定 SVG renderer（jsdom 可渲染）；色值字面量仅作为测试夹具（规格 §10.2）。
 * 注：echarts 实例的 _disposed 初始未赋值，未销毁实例的 isDisposed() 返回 undefined。
 */
import { act, render } from '@testing-library/react'
import { ConfigProvider } from 'antd'
import { useRef } from 'react'
import type { RefObject } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EChartsCoreOption, EChartsType } from 'echarts/core'
import { useECharts } from './useECharts'

// ── 可控 ResizeObserver 桩：记录实例与 observe/disconnect 调用 ──────────────────────

class TestResizeObserver {
  static instances: TestResizeObserver[] = []
  readonly observe = vi.fn()
  readonly disconnect = vi.fn()
  readonly unobserve = vi.fn()
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    TestResizeObserver.instances.push(this)
  }

  /** 模拟一次尺寸变化通知（真实浏览器中由 ResizeObserver 触发） */
  emit(): void {
    this.callback([], this as unknown as ResizeObserver)
  }
}

/** 最近创建的 observer：即当前图表实例挂接的监听 */
function lastObserver(): TestResizeObserver {
  const observer = TestResizeObserver.instances.at(-1)
  expect(observer).toBeDefined()
  return observer!
}

// ── 测试探针：useECharts 必须在 ConfigProvider 内调用，token 变化才能到达 Hook ───────

// 测试夹具色值（规格 §10.2 允许）：仅在测试文件中出现
const PRIMARY_A = '#1677ff'
const PRIMARY_B = '#722ed1'

function ChartProbeInner({
  option,
  active,
  chartRef,
}: {
  option: EChartsCoreOption | null
  active: boolean
  chartRef: RefObject<EChartsType | null>
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chart = useECharts(containerRef, option, { active })
  chartRef.current = chart
  return <div ref={containerRef} data-testid="chart-container" />
}

function ChartProbe(props: {
  option: EChartsCoreOption | null
  active?: boolean
  primaryColor: string
  chartRef: RefObject<EChartsType | null>
}) {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: props.primaryColor } }}>
      <ChartProbeInner
        option={props.option}
        active={props.active ?? true}
        chartRef={props.chartRef}
      />
    </ConfigProvider>
  )
}

function lineOption(data: number[]): EChartsCoreOption {
  return {
    xAxis: { type: 'category', data: data.map((_, index) => `d${index}`) },
    yAxis: { type: 'value' },
    series: [{ type: 'line', data }],
  }
}

/** 读取第一个系列的数据（单断言用途） */
function seriesData(chart: EChartsType): number[] {
  const option = chart.getOption() as { series: Array<{ data: number[] }> }
  return option.series[0].data
}

/** 下一 animation frame：fake timers 下 rAF 于 16ms 触发 */
function flushAnimationFrame(): void {
  act(() => {
    vi.advanceTimersByTime(16)
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] })
  TestResizeObserver.instances = []
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useECharts（规格 §9.2/§15）', () => {
  it('挂载创建实例并应用 option；卸载销毁', () => {
    const chartRef: RefObject<EChartsType | null> = { current: null }
    const { unmount } = render(
      <ChartProbe option={lineOption([1, 2, 3])} primaryColor={PRIMARY_A} chartRef={chartRef} />,
    )
    const chart = chartRef.current
    expect(chart).not.toBeNull()
    expect(seriesData(chart!)).toEqual([1, 2, 3])
    expect(chart!.isDisposed()).not.toBe(true)

    unmount()
    expect(chart!.isDisposed()).toBe(true)
  })

  it('激活后下一 animation frame resize；同步阶段不 resize', () => {
    const chartRef: RefObject<EChartsType | null> = { current: null }
    render(<ChartProbe option={lineOption([1])} primaryColor={PRIMARY_A} chartRef={chartRef} />)
    const chart = chartRef.current!
    const resizeSpy = vi.spyOn(chart, 'resize')
    // 同步阶段（挂载后、下一 frame 前）不 resize（§20 闸门 ③ 契约）
    expect(resizeSpy).not.toHaveBeenCalled()
    flushAnimationFrame()
    expect(resizeSpy).toHaveBeenCalled()
  })

  it('option 更新以 notMerge 整体应用：旧系列不残留', () => {
    const chartRef: RefObject<EChartsType | null> = { current: null }
    const twoSeries: EChartsCoreOption = {
      xAxis: { type: 'category', data: ['a', 'b'] },
      yAxis: { type: 'value' },
      series: [
        { type: 'line', data: [1, 2] },
        { type: 'bar', data: [3, 4] },
      ],
    }
    const { rerender } = render(
      <ChartProbe option={twoSeries} primaryColor={PRIMARY_A} chartRef={chartRef} />,
    )
    const chart = chartRef.current!
    expect((chart.getOption() as { series: unknown[] }).series).toHaveLength(2)

    rerender(<ChartProbe option={lineOption([9])} primaryColor={PRIMARY_A} chartRef={chartRef} />)
    const option = chartRef.current!.getOption() as { series: Array<{ data: number[] }> }
    // notMerge：两个系列被一个整体替换，而不是合并保留
    expect(option.series).toHaveLength(1)
    expect(option.series[0].data).toEqual([9])
  })

  it('隐藏暂停 resize 监听；重新激活实例保留并在下一 frame resize', () => {
    const chartRef: RefObject<EChartsType | null> = { current: null }
    const { rerender } = render(
      <ChartProbe option={lineOption([1])} primaryColor={PRIMARY_A} chartRef={chartRef} />,
    )
    const chart = chartRef.current!
    const observerCountBeforeHide = TestResizeObserver.instances.length
    const resizeSpy = vi.spyOn(chart, 'resize')

    // 隐藏（active=false）：监听断开，实例保留（§9.2 隐藏时暂停而非销毁）
    rerender(<ChartProbe option={lineOption([1])} active={false} primaryColor={PRIMARY_A} chartRef={chartRef} />)
    expect(lastObserver().disconnect).toHaveBeenCalled()
    expect(chartRef.current).toBe(chart)
    expect(chart.isDisposed()).not.toBe(true)
    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(resizeSpy).not.toHaveBeenCalled()

    // 重新激活：同步阶段不 resize，实例未被重建，下一 frame 才 resize
    rerender(<ChartProbe option={lineOption([1])} primaryColor={PRIMARY_A} chartRef={chartRef} />)
    expect(chartRef.current).toBe(chart)
    expect(resizeSpy).not.toHaveBeenCalled()
    expect(TestResizeObserver.instances.length).toBeGreaterThan(observerCountBeforeHide)
    flushAnimationFrame()
    expect(resizeSpy).toHaveBeenCalled()
  })

  it('ResizeObserver 尺寸变化经 trailing 防抖只触发一次 resize', () => {
    const chartRef: RefObject<EChartsType | null> = { current: null }
    render(<ChartProbe option={lineOption([1])} primaryColor={PRIMARY_A} chartRef={chartRef} />)
    // 先消耗挂载时的激活 resize（下一 animation frame），再观察防抖路径
    flushAnimationFrame()
    const chart = chartRef.current!
    const resizeSpy = vi.spyOn(chart, 'resize')
    const observer = lastObserver()

    // 连续两次尺寸变化：防抖窗口内合并（150ms trailing）
    act(() => {
      observer.emit()
      observer.emit()
    })
    act(() => {
      vi.advanceTimersByTime(149)
    })
    expect(resizeSpy).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(resizeSpy).toHaveBeenCalledTimes(1)
  })

  it('主题变化（激活）：销毁旧实例并立即重建，option 已应用', () => {
    const chartRef: RefObject<EChartsType | null> = { current: null }
    const { rerender } = render(
      <ChartProbe option={lineOption([1, 2])} primaryColor={PRIMARY_A} chartRef={chartRef} />,
    )
    const first = chartRef.current!

    rerender(<ChartProbe option={lineOption([1, 2])} primaryColor={PRIMARY_B} chartRef={chartRef} />)
    const second = chartRef.current!
    expect(second).not.toBe(first)
    expect(first.isDisposed()).toBe(true)
    expect(second.isDisposed()).not.toBe(true)
    expect(seriesData(second)).toEqual([1, 2])
  })

  it('主题变化（隐藏）：只标记延迟，激活时重建', () => {
    const chartRef: RefObject<EChartsType | null> = { current: null }
    const { rerender } = render(
      <ChartProbe option={lineOption([1, 2])} primaryColor={PRIMARY_A} chartRef={chartRef} />,
    )
    const first = chartRef.current!

    // 先隐藏，再发生主题变化：实例销毁并标记，激活前不重建
    rerender(<ChartProbe option={lineOption([1, 2])} active={false} primaryColor={PRIMARY_A} chartRef={chartRef} />)
    rerender(<ChartProbe option={lineOption([1, 2])} active={false} primaryColor={PRIMARY_B} chartRef={chartRef} />)
    expect(first.isDisposed()).toBe(true)
    expect(chartRef.current).toBeNull()

    // 重新激活：延迟重建落点，新实例应用既有 option
    rerender(<ChartProbe option={lineOption([1, 2])} primaryColor={PRIMARY_B} chartRef={chartRef} />)
    const second = chartRef.current!
    expect(second).not.toBe(first)
    expect(second.isDisposed()).not.toBe(true)
    expect(seriesData(second)).toEqual([1, 2])
  })

  it('option 相同引用的重复渲染不重复 setOption（主题未变时实例保持）', () => {
    const chartRef: RefObject<EChartsType | null> = { current: null }
    const option = lineOption([5])
    const { rerender } = render(<ChartProbe option={option} primaryColor={PRIMARY_A} chartRef={chartRef} />)
    const first = chartRef.current!
    const setOptionSpy = vi.spyOn(first, 'setOption')

    rerender(<ChartProbe option={option} primaryColor={PRIMARY_A} chartRef={chartRef} />)
    expect(chartRef.current).toBe(first)
    expect(setOptionSpy).not.toHaveBeenCalled()
  })
})
