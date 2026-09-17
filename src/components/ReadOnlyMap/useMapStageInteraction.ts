/**
 * 画布视口交互：滚轮缩放（以鼠标为中心）、空白点击、fitView、定位动画
 * （T00.7，迁移自旧 KonvaMap/hooks/useStageInteraction，行为一致）。
 *
 * 仅操作 Konva Stage 的位置/缩放（命令式），不进入 React 状态——
 * 平移缩放高频发生，走状态会导致整树重渲染。
 */

import type Konva from 'konva'
import { useCallback, useRef } from 'react'
import {
  DEFAULT_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  SCALE_BY,
} from '@/components/ReadOnlyMap/ReadOnlyMap.types'

interface UseMapStageInteractionOptions {
  stageRef: React.RefObject<Konva.Stage | null>
  onStageClick: () => void
  width: number
  height: number
}

/** 视口快照（位置 + 缩放），用于 resetView 回到初始视口 */
interface ViewportSnapshot {
  x: number
  y: number
  scaleX: number
  scaleY: number
}

export function useMapStageInteraction(options: UseMapStageInteractionOptions) {
  const { stageRef, onStageClick, width, height } = options

  const initialViewportRef = useRef<ViewportSnapshot | null>(null)

  /** 滚轮缩放：以指针位置为不动点，视觉中心不漂移 */
  const handleWheel = useCallback(
    (event: Konva.KonvaEventObject<WheelEvent>) => {
      event.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const scaleX = stage.scaleX()
      const scaleY = stage.scaleY()
      const direction = event.evt.deltaY > 0 ? -1 : 1
      const newScale = direction > 0 ? scaleX * SCALE_BY : scaleX / SCALE_BY
      if (newScale < MIN_SCALE || newScale > MAX_SCALE) return

      const mousePointTo = {
        x: (pointer.x - stage.x()) / scaleX,
        y: (pointer.y - stage.y()) / scaleY,
      }
      stage.scale({ x: newScale, y: newScale })
      stage.position({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      })
    },
    [stageRef],
  )

  /** 点击 Stage 自身（空白区域）：清空选中并上报 */
  const handleClick = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>) => {
      if (event.evt.button === 2) return
      const target = event.target
      if (target === target.getStage()) onStageClick()
    },
    [onStageClick],
  )

  /** 阻止画布右键默认菜单（右键保留给浏览器，不绑定业务菜单） */
  const handleContextMenu = useCallback((event: Konva.KonvaEventObject<MouseEvent>) => {
    event.evt.preventDefault()
  }, [])

  /** 适配内容包围盒：留 10% 边距居中展示（带 0.3s 动画） */
  const fitView = useCallback(
    (bbox?: { minX: number; minY: number; maxX: number; maxY: number }) => {
      const stage = stageRef.current
      if (!stage || !bbox) return
      const bboxWidth = bbox.maxX - bbox.minX
      const bboxHeight = bbox.maxY - bbox.minY
      if (bboxWidth === 0 && bboxHeight === 0) return

      const padding = 0.9
      const targetScale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, Math.min((width * padding) / bboxWidth, (height * padding) / bboxHeight)),
      )
      const centerX = (bbox.minX + bbox.maxX) / 2
      const centerY = (bbox.minY + bbox.maxY) / 2
      const next: ViewportSnapshot = {
        x: width / 2 - centerX * targetScale,
        y: height / 2 - centerY * targetScale,
        scaleX: targetScale,
        scaleY: targetScale,
      }
      stage.to({ ...next, duration: 0.3 })
      initialViewportRef.current = next
    },
    [stageRef, width, height],
  )

  /** 数据就绪后的初始视口：有包围盒走 fitView，否则兜底缩放居中 */
  const applyInitialView = useCallback(
    (bbox?: { minX: number; minY: number; maxX: number; maxY: number }) => {
      const stage = stageRef.current
      if (!stage) return
      if (bbox && (bbox.maxX - bbox.minX > 0 || bbox.maxY - bbox.minY > 0)) {
        fitView(bbox)
        return
      }
      const fallbackScale = DEFAULT_SCALE
      stage.scale({ x: fallbackScale, y: fallbackScale })
      stage.position({ x: width / 2, y: height / 2 })
      initialViewportRef.current = {
        x: width / 2,
        y: height / 2,
        scaleX: fallbackScale,
        scaleY: fallbackScale,
      }
    },
    [stageRef, width, height, fitView],
  )

  /** 放大一级（画布中心不动点，带动画） */
  const zoomIn = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const currentScale = stage.scaleX()
    const newScale = Math.min(currentScale * SCALE_BY, MAX_SCALE)
    const center = { x: width / 2, y: height / 2 }
    const mousePointTo = {
      x: (center.x - stage.x()) / currentScale,
      y: (center.y - stage.y()) / currentScale,
    }
    stage.to({
      x: center.x - mousePointTo.x * newScale,
      y: center.y - mousePointTo.y * newScale,
      scaleX: newScale,
      scaleY: newScale,
      duration: 0.2,
    })
  }, [stageRef, width, height])

  /** 缩小一级 */
  const zoomOut = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const currentScale = stage.scaleX()
    const newScale = Math.max(currentScale / SCALE_BY, MIN_SCALE)
    const center = { x: width / 2, y: height / 2 }
    const mousePointTo = {
      x: (center.x - stage.x()) / currentScale,
      y: (center.y - stage.y()) / currentScale,
    }
    stage.to({
      x: center.x - mousePointTo.x * newScale,
      y: center.y - mousePointTo.y * newScale,
      scaleX: newScale,
      scaleY: newScale,
      duration: 0.2,
    })
  }, [stageRef, width, height])

  /** 回到初始视口（数据加载后第一次 fitView 的位置） */
  const resetView = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    if (initialViewportRef.current) {
      stage.to({ ...initialViewportRef.current, duration: 0.3 })
    }
  }, [stageRef])

  /**
   * 平滑定位到指定世界坐标点（节点/路径聚焦的基础）。
 * scale 缺省 125：经验值，保证单个节点及其标签清晰可读。
   */
  const focusToPoint = useCallback(
    (focusX: number, focusY: number, scale: number = 125, duration: number = 1, onFinish?: () => void) => {
      const stage = stageRef.current
      if (!stage) return
      const targetScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale))
      stage.to({
        x: width / 2 - focusX * targetScale,
        y: height / 2 - focusY * targetScale,
        scaleX: targetScale,
        scaleY: targetScale,
        duration,
        onFinish,
      })
    },
    [stageRef, width, height],
  )

  return {
    handleWheel,
    handleClick,
    handleContextMenu,
    fitView,
    applyInitialView,
    zoomIn,
    zoomOut,
    resetView,
    focusToPoint,
  }
}
