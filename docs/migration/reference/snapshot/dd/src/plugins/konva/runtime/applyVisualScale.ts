/**
 * @description 运行时样式应用：将 visualScale 应用到画布上所有节点和路径的视觉样式
 * @date 2026-5-27
 */
import Konva from "konva";
import { getNodeStyle } from "../nodes";
import { selectedState } from "../state/selected";
import { forwardPath } from "../path/forwardPath";
import { reversePath } from "../path/reversePath";
import { computeRotateArrow } from "@/utils/graph";
import { MAP_NEST_STAGE_ATTR, MAP_NEST_LAYER_NAME } from "./constants";

/**
 * 将 visualScale 应用到画布上所有节点和路径的视觉样式。
 * 通过 layer name 直接查找，避免遍历 RobotLayer、AreaLayer 等无关节点。
 */
export const applyVisualScaleToAllShapes = (stage: Konva.Stage, visualScale: number) => {
    const nodesLayer = stage.findOne(`.${MAP_NEST_LAYER_NAME.nodes}`) as Konva.Layer | undefined;
    const edgesLayer = stage.findOne(`.${MAP_NEST_LAYER_NAME.edges}`) as Konva.Layer | undefined;

    if (nodesLayer) {
        (nodesLayer.find("Shape") as Konva.Shape[]).forEach((shape) => {
            const nodeType = shape.attrs?.data?.type;
            if (!nodeType) return;
            const { radius, lineWidth, showArrow } = getNodeStyle(nodeType);
            const scaledRadius = radius * visualScale;
            const scaledLineWidth = lineWidth * visualScale;
            const isSelected = shape.attrs?.state === "selected";
            const currentStyle = shape.attrs?.shapeStyle || {};
            shape.setAttr("shapeStyle", {
                ...currentStyle,
                radius: isSelected ? scaledRadius * selectedState.radius : scaledRadius,
                lineWidth: isSelected ? scaledLineWidth * selectedState.lineWidth : scaledLineWidth,
            });
            const angle = shape.attrs?.data?.angle;
            if (showArrow && angle !== null && angle !== undefined) {
                shape.setAttr("data", {
                    ...shape.attrs.data,
                    arrowPoints: computeRotateArrow(isSelected ? scaledRadius * selectedState.radius : scaledRadius, -angle),
                });
            }
        });
    }

    if (edgesLayer) {
        (edgesLayer.find("Shape") as Konva.Shape[]).forEach((shape) => {
            const isBackEdge = shape.attrs?.data?.isBackEdge;
            const baseLineWidth = isBackEdge ? reversePath.lineWidth : forwardPath.lineWidth;
            const scaledLineWidth = baseLineWidth * visualScale;
            const isSelected = shape.attrs?.state === "selected";
            shape.setAttr("shapeStyle", {
                ...shape.attrs.shapeStyle,
                lineWidth: isSelected ? scaledLineWidth * selectedState.lineWidth : scaledLineWidth,
            });
            shape.setAttr("hitStrokeWidth", Math.max(scaledLineWidth * 5, 0.1));
        });
    }
};
