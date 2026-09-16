/**
 * @description 放所有节点的Layer
 * @date 2025-5-26
 */
import { memo, useMemo } from "react";
import { Layer, Shape } from "react-konva/lib/ReactKonvaCore";
import type { MapNode, MountNode } from "@/utils/typing";
import { mountGraphNodes } from "@/utils/graph";
import { MAP_NEST_STAGE_ATTR } from "@/plugins/konva/runtime/constants";

export interface NodesLayerProps {
    nodes: MapNode[];
    enableOptimize: boolean;
    nodeLabelVisible: boolean;
    /** 区域高亮索引：shapeId → 混色（SPEC_area_highlight_monitoring_playback §4.2） */
    areaColorIndex: Map<string, string>;
}

export default memo((props: NodesLayerProps) => {

    const { nodes, enableOptimize, nodeLabelVisible, areaColorIndex } = props;

    const { mountNodes } = useMemo(() => {
        // 初始化所有的节点
        const mountNodes = mountGraphNodes(nodes);
        return { mountNodes }
    }, [nodes])

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
                                // 运行时从 stage attr 读 visualScale（D1）：缩放时 props 不变，memo 跳过 re-render，
                                // 仅靠 batchDraw 让此处重绘读最新 attr
                                const stage = shape.getStage();
                                const visualScale = stage?.getAttr(MAP_NEST_STAGE_ATTR.visualScale) ?? 1;
                                const { attrs: { shapeStyle: { radius, fill, stroke, lineWidth, labelFill }, data: { name, arrowPoints } } } = shape;
                                // 区域高亮覆盖（D5/D7）：仅覆盖 fill 与 labelFill，stroke 不动
                                //（节点朝向箭头以 stroke 绘制，随其保持原色）；命中区域高亮时覆盖属性色
                                const areaColor = areaColorIndex.get(shape.id());
                                const nodeFill = areaColor ?? fill;
                                const nodeLabelFill = areaColor ?? labelFill;
                                // 节点半径 / 描边随 visualScale 等比缩放
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
                                if (arrowPoints && !enableOptimize) {
                                    // 画元素的箭头 性能模式的时候不显示
                                    // 节点朝向箭头随 visualScale（D7）：arrowPoints 是相对圆心的向量，
                                    // 整体乘 visualScale ≡ 按 scaledRadius 重算（computeRotateArrow 关于 radius 线性）
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
                                if (nodeLabelVisible && !enableOptimize) {
                                    // 开始画站点标签 性能模式不显示标签
                                    // 字号随缩放（D2）；标签位置用 scaledRadius 保持与圆的相对间距
                                    context.textAlign = "left";
                                    context.font = `bold ${0.2 * visualScale}px Arial`;
                                    context.textBaseline = "top";
                                    context.fillStyle = nodeLabelFill;
                                    // fillText(text, x, y, maxWidth)：maxWidth 同步缩小，文字会更早压缩
                                    context.fillText(name, 0, scaledRadius * 1.5, scaledRadius * 4);
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
