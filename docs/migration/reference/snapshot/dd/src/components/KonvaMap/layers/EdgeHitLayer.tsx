/**
 * @description 路径点击命中层（不可见）
 * 用不可见的粗 hitRegion 提高路径点击命中率
 */
import type Konva from "konva";
import { memo } from "react";
import { Layer, Shape } from "react-konva/lib/ReactKonvaCore";
import type { MountEdge } from "../KonvaMap.types";
import { HIT_REGION_LINE_WIDTH } from "../utils/styles";

export interface EdgeHitLayerProps {
  mountEdges: MountEdge[];
  /** 是否可选 */
  selectable: boolean;
  /** 点击路径回调 */
  onEdgeClick: (id: string) => void;
  /** hover 回调 */
  onEdgeHover: (id: string | null) => void;
}

const EdgeHitLayer: React.FC<EdgeHitLayerProps> = memo((props) => {
  const { mountEdges, selectable, onEdgeClick, onEdgeHover } = props;

  return (
    <Layer listening={selectable}>
      {mountEdges.map((edge) => {
        const { id, data } = edge;
        return (
          <Shape
            key={`hit-${id}`}
            id={`hit-${id}`}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
            opacity={0}
            listening={selectable}
            onClick={(e: Konva.KonvaEventObject<MouseEvent>) => {
              if (!selectable) return;
              e.cancelBubble = true;
              onEdgeClick(id);
            }}
            onTap={(e: Konva.KonvaEventObject<MouseEvent>) => {
              if (!selectable) return;
              e.cancelBubble = true;
              onEdgeClick(id);
            }}
            onMouseEnter={() => {
              if (!selectable) return;
              onEdgeHover(id);
            }}
            onMouseLeave={() => {
              if (!selectable) return;
              onEdgeHover(null);
            }}
            sceneFunc={(context, shape) => {
              const { sx, sy, cx, cy, dx, dy, ex, ey } = data;
              context.beginPath();
              if (cx === null || cy === null || dx === null || dy === null) {
                context.moveTo(sx, -sy);
                context.lineTo(ex, -ey);
              } else {
                context.moveTo(sx, -sy);
                context.bezierCurveTo(cx, -cy, dx, -dy, ex, -ey);
              }
              context.lineWidth = HIT_REGION_LINE_WIDTH;
              context.strokeStyle = "transparent";
              context.stroke();
              context.fillStrokeShape(shape);
            }}
            // 自定义命中区域（保证点击检测有效；命中只需描边路径，用不到 shape 形参）
            hitFunc={(context) => {
              const { sx, sy, cx, cy, dx, dy, ex, ey } = data;
              context.beginPath();
              if (cx === null || cy === null || dx === null || dy === null) {
                context.moveTo(sx, -sy);
                context.lineTo(ex, -ey);
              } else {
                context.moveTo(sx, -sy);
                context.bezierCurveTo(cx, -cy, dx, -dy, ex, -ey);
              }
              context.lineWidth = HIT_REGION_LINE_WIDTH;
              context.stroke();
            }}
          />
        );
      })}
    </Layer>
  );
});

EdgeHitLayer.displayName = "EdgeHitLayer";

export default EdgeHitLayer;
