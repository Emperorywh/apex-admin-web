/**
 * ECharts 生命周期 Hook（规格 §9.2/§15）：
 * - 只从 echarts/core 及按需子路径注册用到的 Chart/Component/Renderer，禁止 import * as echarts；
 * - 负责 init/dispose、ResizeObserver 防抖 resize 与 Activity 恢复：隐藏（active=false）
 *   暂停 resize 监听并取消挂起的防抖任务，重新激活后在下一 animation frame 以当前
 *   容器尺寸 resize（display:none 恢复走同一路径，规格 §15）；
 * - 主题变化：以 antd token 签名感知——激活图表销毁后立即重建，隐藏图表只标记，
 *   延迟到激活时重建（规格 §15）；
 * - 图表配色由调用方从 theme.useToken() 读取并写入 option；本 Hook 只消费 token
 *   变化触发重建，不内置调色逻辑（颜色字面量规则见规格 §10.2）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { theme } from 'antd'
// use 起别名避免与 React Hook 命名冲突触发 react-hooks/rules-of-hooks
import { dispose, init, use as registerEChartsModules } from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import type { EChartsCoreOption, EChartsType } from 'echarts/core'

// 按需注册（规格 §15）：当前模板图表仅使用折线/柱形/饼（环）与 Grid/Tooltip/Legend；
// renderer 固定 SVG：无 Canvas 依赖，jsdom 测试环境同样可初始化渲染
registerEChartsModules([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer])

/** 防抖 resize 的 trailing 等待毫秒数：拖拽或连续窗口变化期间只保留最后一次 resize */
const CHART_RESIZE_DEBOUNCE_MS = 150

export interface UseEChartsOptions {
  /**
   * 所在缓存实例激活态（Activity mode='visible'），默认 true。
   * 隐藏时暂停 ResizeObserver 监听（规格 §9.2）；重新激活后下一 animation frame resize。
   */
  active?: boolean
}

type AntdToken = ReturnType<typeof theme.useToken>['token']

/** 参与重建判定的 token 签名：配色/字号/字体变化意味着图表样式需要重算 */
function buildChartThemeSignature(token: AntdToken): string {
  return [
    token.colorPrimary,
    token.colorText,
    token.colorTextDescription,
    token.colorBorderSecondary,
    token.colorBgContainer,
    token.fontSize,
    token.fontFamily,
  ].join('|')
}

export function useECharts(
  containerRef: RefObject<HTMLElement | null>,
  option: EChartsCoreOption | null,
  { active = true }: UseEChartsOptions = {},
): EChartsType | null {
  const themeSignature = buildChartThemeSignature(theme.useToken().token)
  const [instance, setInstance] = useState<EChartsType | null>(null)
  const instanceRef = useRef<EChartsType | null>(null)
  const optionRef = useRef<EChartsCoreOption | null>(option)
  /** 最近一次已应用至实例的 option 引用：避免主题重建后重复 setOption */
  const appliedOptionRef = useRef<EChartsCoreOption | null>(null)
  const activeRef = useRef(active)
  /** 隐藏期间发生主题变化：激活时销毁重建（规格 §15 延迟重建落点） */
  const rebuildPendingRef = useRef(false)
  optionRef.current = option
  activeRef.current = active

  const destroyInstance = useCallback(() => {
    if (instanceRef.current !== null) {
      dispose(instanceRef.current)
      instanceRef.current = null
      appliedOptionRef.current = null
      setInstance(null)
    }
  }, [])

  const createInstance = useCallback(() => {
    const container = containerRef.current
    if (container === null) {
      return
    }
    destroyInstance()
    const chart = init(container, undefined, { renderer: 'svg' })
    if (optionRef.current !== null) {
      chart.setOption(optionRef.current)
      appliedOptionRef.current = optionRef.current
    }
    instanceRef.current = chart
    setInstance(chart)
  }, [containerRef, destroyInstance])

  // 生命周期与主题重建（规格 §15）：激活时创建实例、主题变化立即销毁重建；
  // 隐藏时销毁实例并标记，延迟到激活重建；卸载销毁。
  useEffect(() => {
    if (!activeRef.current) {
      rebuildPendingRef.current = true
      destroyInstance()
      return undefined
    }
    createInstance()
    return destroyInstance
  }, [themeSignature, createInstance, destroyInstance])

  // 激活态迁移（规格 §15）：重新激活时完成延迟重建，或在下一 animation frame
  // 以当前容器尺寸 resize（display:none 恢复同路径，同步阶段不 resize）。
  useEffect(() => {
    if (!active) {
      return undefined
    }
    if (rebuildPendingRef.current) {
      rebuildPendingRef.current = false
      createInstance()
      return undefined
    }
    const frame = requestAnimationFrame(() => {
      instanceRef.current?.resize()
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [active, createInstance])

  // option 更新：非合并式整体替换，保证系列与配色随新 option 完整重算
  useEffect(() => {
    if (instance === null || option === null || appliedOptionRef.current === option) {
      return
    }
    instance.setOption(option, { notMerge: true })
    appliedOptionRef.current = option
  }, [instance, option])

  // ResizeObserver（规格 §9.2/§15）：仅激活且实例存在时监听；trailing 防抖 resize；
  // 隐藏时断开监听并取消挂起的防抖任务。
  useEffect(() => {
    if (!active || instance === null || typeof ResizeObserver === 'undefined') {
      return undefined
    }
    const container = containerRef.current
    if (container === null) {
      return undefined
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new ResizeObserver(() => {
      if (timer !== undefined) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => {
        timer = undefined
        instanceRef.current?.resize()
      }, CHART_RESIZE_DEBOUNCE_MS)
    })
    observer.observe(container)
    return () => {
      observer.disconnect()
      if (timer !== undefined) {
        clearTimeout(timer)
      }
    }
  }, [active, instance, containerRef])

  return instance
}
