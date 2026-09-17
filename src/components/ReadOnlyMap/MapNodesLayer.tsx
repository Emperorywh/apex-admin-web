/**
 * 地图节点渲染层（T00.7，迁移自旧 KonvaMap/layers/NodesLayer）。
 *
 * 每个节点是一个自定义 sceneFunc 的 Shape：圆体 + 方向箭头 + 名称标签 +
 * 选中态青色双环（内实外虚 + 辉光）。命中区域为整圆（hitFunc），
 * 保证小半径节点也容易点中；禁选类型正常渲染但不可点击。
 */

import type Konva from 'konva'
import { memo, useCallback, useMemo } from 'react'
import { Layer, Shape } from 'react-konva'
import type { MapNodeDto } from '@/services/map/map.service.types'
import type { MapMountNode } from '@/components/ReadOnlyMap/ReadOnlyMap.types'
import { hoverMapNodeStyle, selectedMapNodeStyle } from '@/components/ReadOnlyMap/mapGraphStyles'

export interface MapNodesLayerProps {
  mountNodes: MapMountNode[]
  /** 是否显示节点名称标签 */
  showLabels: boolean
  /** 是否显示方向箭头 */
  showArrows: boolean
  /** 节点是否可选中（selectMode 含 node 时开启） */
  selectable: boolean
  /** 禁选的节点类型（不可点击选中，仍正常渲染） */
  disabledNodeTypes?: MapNodeDto['type'][]
  /** 判定是否选中 */
  isSelected: (id: string) => boolean
  /** 当前悬停的节点 ID */
  hoveredId: string | null
  /** 点击节点回调 */
  onNodeClick: (id: string) => void
  /** 悬停回调 */
  onNodeHover: (id: string | null) => void
}

interface MapNodeShapeProps {
  id: string
  x: number
  y: number
  shapeStyle: MapMountNode['shapeStyle']
  data: MapMountNode['data']
  selected: boolean
  hovered: boolean
  showLabel: boolean
  showArrow: boolean
  selectable: boolean
  onClick: (id: string) => void
  onHover: (id: string | null) => void
}

const MapNodeShape = memo((props: MapNodeShapeProps) => {
  const { id, x, y, shapeStyle, data, selected, hovered, showLabel, showArrow, selectable, onClick, onHover } = props

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!selectable) return
      // cancelBubble：阻止冒泡到 Stage 被判为"空白点击"清空选中
      e.cancelBubble = true
      onClick(id)
    },
    [selectable, onClick, id],
  )

  const handleTap = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      if (!selectable) return
      e.cancelBubble = true
      onClick(id)
    },
    [selectable, onClick, id],
  )

  const handleMouseEnter = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!selectable) return
      const container = e.target.getStage()?.container()
      if (container) container.style.cursor = 'pointer'
      onHover(id)
    },
    [selectable, onHover, id],
  )

  const handleMouseLeave = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!selectable) return
      const container = e.target.getStage()?.container()
      if (container) container.style.cursor = 'default'
      onHover(null)
    },
    [selectable, onHover],
  )

  const stroke = hovered ? hoverMapNodeStyle.stroke : shapeStyle.stroke
  const lineWidth = hovered ? hoverMapNodeStyle.lineWidth : shapeStyle.lineWidth

  return (
    <Shape
      id={id}
      x={x}
      y={y}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
      listening={selectable}
      onClick={handleClick}
      onTap={handleTap}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      // 命中区域为整圆：视觉描边可能为 0（普通节点无线宽），命中不应随之消失
      hitFunc={(context, shape) => {
        const { radius } = shapeStyle
        context.beginPath()
        context.arc(0, 0, radius, 0, Math.PI * 2)
        context.fillStrokeShape(shape)
      }}
      sceneFunc={(context, shape) => {
        const { radius, fill, labelFill } = shapeStyle

        // 圆体
        context.beginPath()
        context.arc(0, 0, radius, 0, Math.PI * 2)
        context.fillStyle = fill
        context.strokeStyle = stroke
        context.lineWidth = lineWidth
        context.fill()
        context.stroke()

        // 方向箭头（挂载层已按朝向角计算好顶点）
        if (showArrow && data.arrowPoints) {
          context.beginPath()
          const [[tx, ty], [rx, ry], [bx, by]] = data.arrowPoints
          context.moveTo(tx, ty)
          context.lineTo(rx, ry)
          context.lineTo(bx, by)
          context.strokeStyle = stroke
          context.lineWidth = lineWidth
          context.stroke()
        }

        // 选中态：青色双环（内环实线 + 外环虚线 + 辉光）
        if (selected) {
          const {
            color,
            innerLineWidth,
            outerLineWidth,
            innerGap,
            outerGap,
            dashLength,
            dashGap,
            glowColor,
            glowBlur,
          } = selectedMapNodeStyle

          context.save()
          context.shadowColor = glowColor
          context.shadowBlur = glowBlur

          context.beginPath()
          context.arc(0, 0, radius + innerGap, 0, Math.PI * 2)
          context.strokeStyle = color
          context.lineWidth = innerLineWidth
          context.stroke()

          context.setLineDash([dashLength, dashGap])
          context.beginPath()
          context.arc(0, 0, radius + outerGap, 0, Math.PI * 2)
          context.strokeStyle = color
          context.lineWidth = outerLineWidth
          context.stroke()
          context.setLineDash([])

          context.restore()
        }

        // 名称标签（世界坐标字号 .2px，随视口缩放呈现为固定视觉密度）
        if (showLabel && data.name) {
          context.textAlign = 'left'
          context.font = 'bold .2px Arial'
          context.textBaseline = 'top'
          context.fillStyle = labelFill
          context.fillText(data.name, radius * 1.2, radius * 1.2, radius * 6)
        }

        context.fillStrokeShape(shape)
      }}
    />
  )
})

MapNodeShape.displayName = 'MapNodeShape'

function MapNodesLayerComponent(props: MapNodesLayerProps) {
  const { mountNodes, showLabels, showArrows, selectable, disabledNodeTypes, isSelected, hoveredId, onNodeClick, onNodeHover } =
    props

  // 禁选类型 Set 化：避免每个节点渲染时线性查找
  const disabledTypeSet = useMemo(
    () => (disabledNodeTypes ? new Set<string>(disabledNodeTypes) : null),
    [disabledNodeTypes],
  )

  return (
    <Layer listening>
      {mountNodes.map((node) => {
        const { id, x, y, shapeStyle, data } = node
        const selected = isSelected(id)
        const hovered = hoveredId === id && !selected
        const nodeSelectable = selectable && !(disabledTypeSet && disabledTypeSet.has(data.type))

        return (
          <MapNodeShape
            key={id}
            id={id}
            x={x}
            y={y}
            shapeStyle={shapeStyle}
            data={data}
            selected={selected}
            hovered={hovered}
            showLabel={showLabels}
            showArrow={showArrows}
            selectable={nodeSelectable}
            onClick={onNodeClick}
            onHover={onNodeHover}
          />
        )
      })}
    </Layer>
  )
}

export const MapNodesLayer = memo(MapNodesLayerComponent)
