import { memo } from 'react';
import { Layer, Shape } from 'react-konva';
import { MountLine } from '@/utils/typing';
import { OverlayVisible } from '@/types/OverLook';
import { getEdgeStrokeColor, type EdgeColorVisible } from '@/plugins/konva/path/edgeHighlightColors';
import { resolveDeviceType, computeDeviceLabelPos, DEVICE_BASE_RADIUS, DEVICE_NORMAL_OFFSET_RATIO } from '@/plugins/konva/devices';
import { computeEdgeTangentAngle } from '@/utils/math';

interface MapEdgeLayerProps {
	mountEdges: MountLine[];
	overlayVisible: OverlayVisible;
	/** 自适应视觉倍率（来自 KonvaRender 的 useMemo 派生值） */
	visualScale: number;
	/** 区域高亮索引：shapeId → 混色（SPEC_area_highlight_monitoring_playback §4.2） */
	areaColorIndex: Map<string, string>;
}

const MapEdgeLayer = ({ mountEdges, overlayVisible, visualScale, areaColorIndex }: MapEdgeLayerProps) => {
	// 从 overlayVisible 派生路径属性着色开关对象（SPEC edge_attribute_color_toggle）。
	// per-render 构造一次，供 sceneFunc 闭包直读，与现有闭包直读 overlayVisible.edgeLabel 同模式。
	const edgeColorVisible: EdgeColorVisible = {
		loadSecurity: overlayVisible.loadSecurityColor,
		freeSecurity: overlayVisible.freeSecurityColor,
		allowVehicleGroups: overlayVisible.allowVehicleGroupsColor,
	};
	return (
		<Layer listening={false}>
			{
				mountEdges.map((edge: MountLine) => {

					const { id, shapeStyle, data } = edge;

					return (
						<Shape
							key={id}
							id={id}
							shapeStyle={shapeStyle}
							data={data}
							enableSelect="edge"
							perfectDrawEnabled={false}
							shadowForStrokeEnabled={false}
							sceneFunc={(context, shape) => {
								const { attrs: {
									shapeStyle: { labelFill, stroke, lineWidth },
								} } = shape;
								// 区域高亮覆盖（D5/D7）：命中区域高亮时短路属性着色（区域高亮 > 属性着色），
								// 边公共箭头与路径共用同一 stroke 路径，随高亮一起变色——与编辑器 edgeSceneFunc 一致；
								// 覆盖只发生在 sceneFunc 读值之后，不写回 shapeStyle attrs
								const areaColor = areaColorIndex.get(shape.id());
								const edgeLabelFill = areaColor ?? labelFill;
								// 保留 data 对象引用（getEdgeStrokeColor 需读 data.loadSecurity 等完整字段）
								const { data } = shape.attrs;
								const { sx, sy, cx = null, cy = null, dx = null, dy = null, ex, ey, name, labelX, labelY, arrowPoints, isBackEdge, userDefinedProperties } = data;
								// 路径线宽随 visualScale；路径几何坐标（sx/sy/.../ex/ey）不变（D1）
								const scaledLineWidth = lineWidth * visualScale;
								context.beginPath();
								if (cx === null || cy === null || dx === null || dy === null) {
									// 直线
									context.moveTo(sx, -sy);
									context.lineTo(ex, -ey);
								} else {
									// 贝塞尔曲线
									context.moveTo(sx, -sy);
									context.bezierCurveTo(cx, -cy, dx, -dy, ex, -ey);
								}
								// 画公共部分箭头（D5：边公共箭头坐标不乘 visualScale，仅描边用 scaledLineWidth）
								const [lx, ly, tx, ty, rx, ry] = arrowPoints;
								context.moveTo(lx, ly);
								context.lineTo(tx, ty);
								context.lineTo(rx, ry);
								context.strokeStyle = areaColor ?? getEdgeStrokeColor(data, stroke, edgeColorVisible);
								context.lineWidth = scaledLineWidth;
								context.stroke();
								if (overlayVisible.edgeLabel) {
									// 标签（D4：字号随缩放）
									context.textAlign = "center";
									context.font = `bold ${0.2 * visualScale}px Arial`;
									context.textBaseline = "top";
									context.fillStyle = edgeLabelFill;
									// 防压线偏移随 visualScale（D6，与 AddEdge preview 同口径）
									let textX = labelX + 0.2 * visualScale;
									let textY = labelY + 0.2 * visualScale;
									// 有设备的边，name 标签沿法线对侧让位（D6：让位 offset 与设备图标同源，乘 visualScale）
									if (resolveDeviceType(userDefinedProperties)) {
										const angle = computeEdgeTangentAngle(sx, sy, cx, cy, dx, dy, ex, ey);
										const offset = DEVICE_BASE_RADIUS * DEVICE_NORMAL_OFFSET_RATIO * visualScale;
										const labelPos = computeDeviceLabelPos(labelX, labelY, angle, !!isBackEdge, offset);
										textX = labelPos.x;
										textY = labelPos.y;
									}
									context.fillText(name, textX, textY);
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

// 默认浅比较：mountEdges（useMemo 稳定）/ overlayVisible（state 稳定）/ visualScale（原始值）/ areaColorIndex（useMemo 稳定）
export default memo(MapEdgeLayer);
