/**
 * 地图路径视觉层（T00.7，迁移自旧 KonvaMap/layers/EdgesLayer）。
 *
 * listening=false：本层只负责视觉渲染，点击检测由 MapEdgeHitLayer
 * 的加宽命中区承担（细线在画布上几乎无法用原描边命中）。
 * 选中/hover 态通过替代描边色呈现（青色选中、蓝色悬停）。
 */

import { memo } from 'react'
import { Layer, Shape } from 'react-konva'
import type { MapMountEdge } from '@/components/ReadOnlyMap/ReadOnlyMap.types'
import { HOVER_EDGE_COLOR, SELECTED_EDGE_COLOR } from '@/components/ReadOnlyMap/mapGraphStyles'

export interface MapEdgesLayerProps {
  mountEdges: MapMountEdge[]
  /** 是否显示路径名称标签 */
  showLabels: boolean
  /** 是否显示方向箭头 */
  showArrows: boolean
  /** 判定是否选中（选中路径描边变青色） */
  isSelected: (id: string) => boolean
  /** 当前悬停的路径 ID */
  hoveredId: string | null
}

function MapEdgesLayerComponent(props: MapEdgesLayerProps) {
  const { mountEdges, showLabels, showArrows, isSelected, hoveredId } = props

  return (
    // 不可交互层：关闭 listening 让事件穿透到命中层与节点层
    <Layer listening={false}>
      {mountEdges.map((edge) => {
        const { id, shapeStyle, data } = edge
        const selected = isSelected(id)
        const hovered = hoveredId === id && !selected
        const stroke = selected ? SELECTED_EDGE_COLOR : hovered ? HOVER_EDGE_COLOR : shapeStyle.stroke
        const lineWidth = selected ? 0.1 : shapeStyle.lineWidth

        return (
          <Shape
            key={id}
            id={id}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
            sceneFunc={(context, shape) => {
              // 线体：挂载层 data 保留原始世界坐标，此处统一 y 取反
              context.beginPath()
              if (data.cx === null || data.cy === null || data.dx === null || data.dy === null) {
                context.moveTo(data.sx, -data.sy)
                context.lineTo(data.ex, -data.ey)
              } else {
                context.moveTo(data.sx, -data.sy)
                context.bezierCurveTo(data.cx, -data.cy, data.dx, -data.dy, data.ex, -data.ey)
              }
              context.strokeStyle = stroke
              context.lineWidth = lineWidth
              context.stroke()

              // 方向箭头（挂载层已按线型计算好顶点）
              if (showArrows && data.arrowPoints) {
                const [lx, ly, tx, ty, rx, ry] = data.arrowPoints
                context.beginPath()
                context.moveTo(lx, ly)
                context.lineTo(tx, ty)
                context.lineTo(rx, ry)
                context.strokeStyle = stroke
                context.lineWidth = lineWidth
                context.stroke()
              }

              // 路径名称标签（锚点为曲线/直线 t 处坐标）
              if (showLabels && data.name) {
                context.textAlign = 'center'
                context.font = 'bold .2px Arial'
                context.textBaseline = 'top'
                context.fillStyle = shapeStyle.labelFill
                context.fillText(data.name, data.labelX + 0.2, data.labelY + 0.2)
              }

              context.fillStrokeShape(shape)
            }}
          />
        )
      })}
    </Layer>
  )
}

export const MapEdgesLayer = memo(MapEdgesLayerComponent)
