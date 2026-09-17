/**
 * 地图路径点击命中层（T00.7，迁移自旧 KonvaMap/layers/EdgeHitLayer）。
 *
 * 不可见（opacity=0）的加宽描边形状只承担路径的点击/悬停检测：
 * 视觉层线宽仅 0.05（世界坐标），直接点击几乎无法命中；
 * 命中层以 HIT_REGION_LINE_WIDTH 加宽后细路径也容易点中。
 */

import type Konva from 'konva'
import { memo } from 'react'
import { Layer, Shape } from 'react-konva'
import type { MapMountEdge } from '@/components/ReadOnlyMap/ReadOnlyMap.types'
import { HIT_REGION_LINE_WIDTH } from '@/components/ReadOnlyMap/mapGraphStyles'

export interface MapEdgeHitLayerProps {
  mountEdges: MapMountEdge[]
  /** 是否可选中（selectMode 含 edge 时开启） */
  selectable: boolean
  /** 点击路径回调 */
  onEdgeClick: (id: string) => void
  /** 悬停回调（驱动视觉层高亮） */
  onEdgeHover: (id: string | null) => void
}

function MapEdgeHitLayerComponent(props: MapEdgeHitLayerProps) {
  const { mountEdges, selectable, onEdgeClick, onEdgeHover } = props

  return (
    // 不可选中时整层关闭事件，节省命中计算
    <Layer listening={selectable}>
      {mountEdges.map((edge) => {
        const { id, data } = edge
        return (
          <Shape
            key={`hit-${id}`}
            id={`hit-${id}`}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
            opacity={0}
            listening={selectable}
            onClick={(e: Konva.KonvaEventObject<MouseEvent>) => {
              if (!selectable) return
              e.cancelBubble = true
              onEdgeClick(id)
            }}
            onTap={(e: Konva.KonvaEventObject<TouchEvent>) => {
              if (!selectable) return
              e.cancelBubble = true
              onEdgeClick(id)
            }}
            onMouseEnter={() => {
              if (!selectable) return
              onEdgeHover(id)
            }}
            onMouseLeave={() => {
              if (!selectable) return
              onEdgeHover(null)
            }}
            sceneFunc={(context, shape) => {
              context.beginPath()
              if (data.cx === null || data.cy === null || data.dx === null || data.dy === null) {
                context.moveTo(data.sx, -data.sy)
                context.lineTo(data.ex, -data.ey)
              } else {
                context.moveTo(data.sx, -data.sy)
                context.bezierCurveTo(data.cx, -data.cy, data.dx, -data.dy, data.ex, -data.ey)
              }
              context.lineWidth = HIT_REGION_LINE_WIDTH
              context.strokeStyle = 'transparent'
              context.stroke()
              context.fillStrokeShape(shape)
            }}
            // 命中区域与可见描边同形：仅描边路径参与检测
            hitFunc={(context) => {
              context.beginPath()
              if (data.cx === null || data.cy === null || data.dx === null || data.dy === null) {
                context.moveTo(data.sx, -data.sy)
                context.lineTo(data.ex, -data.ey)
              } else {
                context.moveTo(data.sx, -data.sy)
                context.bezierCurveTo(data.cx, -data.cy, data.dx, -data.dy, data.ex, -data.ey)
              }
              context.lineWidth = HIT_REGION_LINE_WIDTH
              context.stroke()
            }}
          />
        )
      })}
    </Layer>
  )
}

export const MapEdgeHitLayer = memo(MapEdgeHitLayerComponent)
