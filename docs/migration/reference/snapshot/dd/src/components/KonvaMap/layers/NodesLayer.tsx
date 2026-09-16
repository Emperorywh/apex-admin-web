/**
 * @description 节点渲染层
 * 渲染所有地图节点，支持选中态和 hover 态
 */
import type Konva from "konva";
import { memo, useCallback, useMemo } from "react";
import { Layer, Shape } from "react-konva/lib/ReactKonvaCore";
import type { MapNodeType, MountNode } from "../KonvaMap.types";
import { hoverNodeStyle, selectedNodeStyleA } from "../utils/styles";

export interface NodesLayerProps {
  mountNodes: MountNode[];
  /** 是否显示标签 */
  showLabels: boolean;
  /** 是否显示方向箭头 */
  showArrows: boolean;
  /** 是否可选 */
  selectable: boolean;
  /** 禁选的节点类型列表 */
  disabledNodeTypes?: MapNodeType[];
  /** 判断是否选中 */
  isSelected: (id: string) => boolean;
  /** 判断是否 hover */
  hoveredId: string | null;
  /** 点击节点回调 */
  onNodeClick: (id: string) => void;
  /** hover 回调 */
  onNodeHover: (id: string | null) => void;
  /** 当前聚焦的节点 ID */
  focusedId?: string | null;
}

// ===== 单个节点 Shape =====
// NodeShape 定义在使用它的 NodesLayer 之前，规避 no-use-before-define

interface NodeShapeProps {
  id: string;
  x: number;
  y: number;
  shapeStyle: MountNode["shapeStyle"];
  data: MountNode["data"];
  selected: boolean;
  hovered: boolean;
  showLabel: boolean;
  showArrow: boolean;
  selectable: boolean;
  onClick: (id: string) => void;
  onHover: (id: string | null) => void;
  /** 是否是当前聚焦目标 */
  focused?: boolean;
}

const NodeShape: React.FC<NodeShapeProps> = memo((props) => {
  // focused 不从 props 解构：节点聚焦高亮由 useBlink 命令式闪烁承担，本组件不消费
  const {
    id,
    x,
    y,
    shapeStyle,
    data,
    selected,
    hovered,
    showLabel,
    showArrow,
    selectable,
    onClick,
    onHover,
  } = props;

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!selectable) return;
      e.cancelBubble = true;
      onClick(id);
    },
    [selectable, onClick, id],
  );

  const handleMouseEnter = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!selectable) return;
      const container = e.target.getStage()?.container();
      if (container) container.style.cursor = "pointer";
      onHover(id);
    },
    [selectable, onHover, id],
  );

  const handleMouseLeave = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!selectable) return;
      const container = e.target.getStage()?.container();
      if (container) container.style.cursor = "default";
      onHover(null);
    },
    [selectable, onHover],
  );

  // 计算实际渲染样式
  const stroke = hovered ? hoverNodeStyle.stroke : shapeStyle.stroke;
  const lineWidth = hovered ? hoverNodeStyle.lineWidth : shapeStyle.lineWidth;

  return (
    <Shape
      id={id}
      x={x}
      y={y}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
      listening={selectable}
      onClick={handleClick}
      onTap={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      // 自定义命中检测：整个圆区域都可点击
      hitFunc={(context, shape) => {
        const { radius } = shapeStyle;
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.fillStrokeShape(shape);
      }}
      sceneFunc={(context, shape) => {
        const { radius, fill, labelFill } = shapeStyle;

        // 画圆
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.fillStyle = fill;
        context.strokeStyle = stroke;
        context.lineWidth = lineWidth;
        context.fill();
        context.stroke();

        // 方向箭头
        if (showArrow && data.arrowPoints) {
          context.beginPath();
          const [[tx, ty], [rx, ry], [bx, by]] = data.arrowPoints;
          context.moveTo(tx, ty);
          context.lineTo(rx, ry);
          context.lineTo(bx, by);
          context.strokeStyle = stroke;
          context.lineWidth = lineWidth;
          context.stroke();
        }

        // ===== 选中态：HMI 青色脉冲双环 =====
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
          } = selectedNodeStyleA;

          context.save();
          context.shadowColor = glowColor;
          context.shadowBlur = glowBlur;

          // 内环（实线）
          context.beginPath();
          context.arc(0, 0, radius + innerGap, 0, Math.PI * 2);
          context.strokeStyle = color;
          context.lineWidth = innerLineWidth;
          context.stroke();

          // 外环（虚线）
          context.setLineDash([dashLength, dashGap]);
          context.beginPath();
          context.arc(0, 0, radius + outerGap, 0, Math.PI * 2);
          context.strokeStyle = color;
          context.lineWidth = outerLineWidth;
          context.stroke();
          context.setLineDash([]);

          context.restore();
        }

        // 标签
        if (showLabel && data.name) {
          context.textAlign = "left";
          context.font = "bold .2px Arial";
          context.textBaseline = "top";
          context.fillStyle = labelFill;
          context.fillText(data.name, radius * 1.2, radius * 1.2, radius * 6);
        }

        context.fillStrokeShape(shape);
      }}
    />
  );
});

NodeShape.displayName = "NodeShape";

const NodesLayer: React.FC<NodesLayerProps> = memo((props) => {
  const {
    mountNodes,
    showLabels,
    showArrows,
    selectable,
    disabledNodeTypes,
    isSelected,
    hoveredId,
    onNodeClick,
    onNodeHover,
    focusedId,
  } = props;

  // 构建 Set 提升查找性能
  const disabledTypeSet = useMemo(
    () => (disabledNodeTypes ? new Set(disabledNodeTypes) : null),
    [disabledNodeTypes],
  );

  return (
    <Layer listening={true}>
      {mountNodes.map((node) => {
        const { id, x, y, shapeStyle, data } = node;
        const selected = isSelected(id);
        const hovered = hoveredId === id && !selected;
        // 禁选类型的节点不可点击选中
        const nodeSelectable =
          selectable && !(disabledTypeSet && disabledTypeSet.has(data.type));

        return (
          <NodeShape
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
            focused={id === focusedId}
          />
        );
      })}
    </Layer>
  );
});

NodesLayer.displayName = "NodesLayer";

export default NodesLayer;
