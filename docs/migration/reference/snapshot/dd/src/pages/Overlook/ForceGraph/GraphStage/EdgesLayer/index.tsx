/**
 * @description 路径的Layer
 * @date 2025-5-26
 */
import { useMemo, memo } from "react";
import { Layer, Shape } from "react-konva/lib/ReactKonvaCore";
import { mountGraphEdges, } from "@/utils/graph";
import { MAP_NEST_STAGE_ATTR } from "@/plugins/konva/runtime/constants";
import { getEdgeStrokeColor } from "@/plugins/konva/path/edgeHighlightColors";
import { resolveDeviceType, computeDeviceLabelPos, DEVICE_BASE_RADIUS, DEVICE_NORMAL_OFFSET_RATIO } from "@/plugins/konva/devices";
import { computeEdgeTangentAngle } from "@/utils/math";
import type { MapEdge, MountLine } from "@/utils/typing";

export interface EdgeLayerProps {
    edges: MapEdge[];
    enableOptimize: boolean;
    edgeLabelVisible: boolean;
    /** 区域高亮索引：shapeId → 混色（SPEC_area_highlight_monitoring_playback §4.2） */
    areaColorIndex: Map<string, string>;
}

export default memo((props: EdgeLayerProps) => {

    const { edges, enableOptimize, edgeLabelVisible, areaColorIndex } = props;

    // 初始化加载路径时缓存计算结果
    const { mountEdges } = useMemo(() => {
        // 初始化处理路径
        const mountEdges = mountGraphEdges(edges);
        return {
            mountEdges
        }
    }, [edges])

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
                                // 运行时从 stage attr 读 visualScale（D1）
                                const stage = shape.getStage();
                                const visualScale = stage?.getAttr(MAP_NEST_STAGE_ATTR.visualScale) ?? 1;
                                // 读取路径属性着色开关状态（默认全 false = 不着色，SPEC edge_attribute_color_toggle）
                                const edgeColorVisible = stage?.getAttr(MAP_NEST_STAGE_ATTR.edgeColorVisible)
                                    ?? { loadSecurity: false, freeSecurity: false, allowVehicleGroups: false };
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
                                // 路径线宽随 visualScale；路径几何坐标（sx/sy/.../ex/ey）不变
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
                                // 画公共部分箭头：坐标不乘 visualScale（D7 边箭头不随），仅描边用 scaledLineWidth
                                const [lx, ly, tx, ty, rx, ry] = arrowPoints;
                                context.moveTo(lx, ly);
                                context.lineTo(tx, ty);
                                context.lineTo(rx, ry);
                                context.strokeStyle = areaColor ?? getEdgeStrokeColor(data, stroke, edgeColorVisible);
                                context.lineWidth = scaledLineWidth;
                                context.stroke();
                                if (edgeLabelVisible && !enableOptimize) {
                                    // 标签
                                    context.textAlign = "center";
                                    // 字号随缩放（D2）
                                    context.font = `bold ${0.2 * visualScale}px Arial`;
                                    context.textBaseline = "top";
                                    context.fillStyle = edgeLabelFill;
                                    // 有设备的边，name 标签沿法线对侧让位（SPEC §3.7）
                                    // 防压线偏移随 visualScale（与 AddEdge preview 同口径，§5.5）
                                    let textX = labelX + 0.2 * visualScale;
                                    let textY = labelY + 0.2 * visualScale;
                                    if (resolveDeviceType(userDefinedProperties)) {
                                        // 有设备的边，name 标签沿法线让位：偏移量随 visualScale，与设备图标 offset 同源
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
    )
});
