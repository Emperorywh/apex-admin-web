/**
 * @description 路径渲染层（视觉层，listening: false）
 * 仅负责渲染路径视觉，不参与事件检测
 */
import { memo } from "react";
import { Layer, Shape } from "react-konva/lib/ReactKonvaCore";
import type { MountEdge } from "../KonvaMap.types";

export interface EdgesLayerProps {
  mountEdges: MountEdge[];
  /** 是否显示标签 */
  showLabels: boolean;
  /** 是否显示方向箭头 */
  showArrows: boolean;
  /** 判断是否选中（选中路径需改变视觉样式） */
  isSelected: (id: string) => boolean;
  /** hover 的路径 ID */
  hoveredId: string | null;
  /** 当前聚焦的路径 ID */
  focusedId?: string | null;
}

const EdgesLayer: React.FC<EdgesLayerProps> = memo((props) => {
  // focusedId 不从 props 解构：路径聚焦高亮由 useBlink 命令式闪烁承担，本层不消费
  const { mountEdges, showLabels, showArrows, isSelected, hoveredId } = props;

  return (
    <Layer listening={false}>
      {mountEdges.map((edge) => {
        const { id, shapeStyle, data } = edge;
        const selected = isSelected(id);
        const hovered = hoveredId === id && !selected;

        // 计算实际渲染样式
        const stroke = selected
          ? "#00E5FF"
          : hovered
          ? "#69B1FF"
          : shapeStyle.stroke;
        const lineWidth = selected
          ? 0.1
          : hovered
          ? shapeStyle.lineWidth
          : shapeStyle.lineWidth;

        return (
          <Shape
            key={id}
            id={id}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
            sceneFunc={(context, shape) => {
              const {
                sx,
                sy,
                cx,
                cy,
                dx,
                dy,
                ex,
                ey,
                name,
                labelX,
                labelY,
                arrowPoints,
              } = data;

              // 画路径
              context.beginPath();
              if (cx === null || cy === null || dx === null || dy === null) {
                // 直线（y 已经在 mountGraphEdges 中取反了）
                context.moveTo(sx, -sy);
                context.lineTo(ex, -ey);
              } else {
                // 贝塞尔曲线（y 已经在 mountGraphEdges 中取反了）
                context.moveTo(sx, -sy);
                context.bezierCurveTo(cx, -cy, dx, -dy, ex, -ey);
              }

              context.strokeStyle = stroke;
              context.lineWidth = lineWidth;
              context.stroke();

              // 方向箭头
              if (showArrows && arrowPoints) {
                const [lx, ly, tx, ty, rx, ry] = arrowPoints;
                context.beginPath();
                context.moveTo(lx, ly);
                context.lineTo(tx, ty);
                context.lineTo(rx, ry);
                context.strokeStyle = stroke;
                context.lineWidth = lineWidth;
                context.stroke();
              }

              // 标签
              if (showLabels && name) {
                context.textAlign = "center";
                context.font = "bold .2px Arial";
                context.textBaseline = "top";
                context.fillStyle = shapeStyle.labelFill;
                context.fillText(name, labelX + 0.2, labelY + 0.2);
              }

              context.fillStrokeShape(shape);
            }}
          />
        );
      })}
    </Layer>
  );
});

EdgesLayer.displayName = "EdgesLayer";

export default EdgesLayer;
