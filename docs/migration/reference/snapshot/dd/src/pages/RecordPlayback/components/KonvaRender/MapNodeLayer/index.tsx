import { memo } from 'react';
import { Layer, Shape } from 'react-konva';
import { MountNode } from '@/utils/typing';
import { OverlayVisible } from '@/types/OverLook';

interface MapNodeLayerProps {
	mountNodes: MountNode[];
	overlayVisible: OverlayVisible;
	/** 自适应视觉倍率（来自 KonvaRender 的 useMemo 派生值） */
	visualScale: number;
	/** 区域高亮索引：shapeId → 混色（SPEC_area_highlight_monitoring_playback §4.2） */
	areaColorIndex: Map<string, string>;
}

const MapNodeLayer = ({ mountNodes, overlayVisible, visualScale, areaColorIndex }: MapNodeLayerProps) => {
	return (
		<Layer listening={false}>
			{
				mountNodes.map((node: MountNode) => {

					const { id, x, y, shapeStyle, data } = node;

					return (
						<Shape
							key={id}
							id={id}
							shapeStyle={shapeStyle}
							data={data}
							x={x}
							y={y}
							enableSelect="node"
							perfectDrawEnabled={false}
							shadowForStrokeEnabled={false}
							sceneFunc={(context, shape) => {
								const { attrs: { shapeStyle: { radius, fill, stroke, lineWidth, labelFill }, data: { name, arrowPoints } } } = shape;
								// 区域高亮覆盖（D5/D7）：仅覆盖 fill 与 labelFill，stroke 不动
								//（节点朝向箭头以 stroke 绘制，随其保持原色）
								const areaColor = areaColorIndex.get(shape.id());
								const nodeFill = areaColor ?? fill;
								const nodeLabelFill = areaColor ?? labelFill;
								// 节点半径 / 描边随 visualScale 等比缩放（D1/D5）
								const scaledRadius = radius * visualScale;
								const scaledLineWidth = lineWidth * visualScale;
								// 画元素的圆圈
								context.beginPath();
								context.arc(0, 0, scaledRadius, 0, Math.PI * 2);
								context.fillStyle = nodeFill;
								context.strokeStyle = stroke;
								context.lineWidth = scaledLineWidth;
								context.stroke();
								context.fill();
								if (arrowPoints) {
									// 画元素的箭头（D5：节点朝向箭头随 visualScale）。
									// arrowPoints 关于 radius 线性（computeRotateArrow），整体乘 visualScale 等价于按 scaledRadius 重算。
									// 原 `!false` 系拷贝遗留（Overlook 为 `!enableOptimize`，本画布无此概念），已清理（D8）。
									context.beginPath();
									// 分别对应箭头的顶点，左，右
									const [[tx, ty], [rx, ry], [bx, by]] = arrowPoints;
									context.moveTo(tx * visualScale, ty * visualScale);
									context.lineTo(rx * visualScale, ry * visualScale);
									context.lineTo(bx * visualScale, by * visualScale);
									context.strokeStyle = stroke;
									context.lineWidth = scaledLineWidth;
									context.stroke();
								}
								if (overlayVisible.nodeLabel) {
									// 开始画站点标签（D4：字号随缩放）；标签位置用 scaledRadius 保持与圆的相对间距
									context.textAlign = "left";
									context.font = `bold ${0.2 * visualScale}px Arial`;
									context.textBaseline = "top";
									context.fillStyle = nodeLabelFill;
									context.fillText(name, 0, scaledRadius * 1.5, scaledRadius * 4);
								}
								context.fillStrokeShape(shape);
							}}
						/>
					)
				})
			}
		</Layer>
	);
};

// 默认浅比较：mountNodes（useMemo 稳定）/ overlayVisible（state 稳定）/ visualScale（原始值）/ areaColorIndex（useMemo 稳定）
export default memo(MapNodeLayer);
