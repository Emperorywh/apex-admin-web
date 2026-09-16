/**
 * @description 边（Edge）的 Canvas 绘制函数，供 AddEdge、ContextMenu 等多处复用
 * @date 2025-7-14
 */
import Konva from "konva";
import { Context } from "konva/lib/Context";
import { getEdgeStrokeColor } from "./edgeHighlightColors";
import { MAP_NEST_STAGE_ATTR } from "../runtime/constants";
import { resolveDeviceType, computeDeviceLabelPos, DEVICE_BASE_RADIUS, DEVICE_NORMAL_OFFSET_RATIO } from "../devices";
import { computeEdgeTangentAngle } from "@/utils/math";

/**
 * 边（Edge）的场景绘制函数
 * 负责在 Canvas 上绘制一条完整的边，包括：
 * 1. 路径本身（直线或贝塞尔曲线，根据控制点是否存在判断）
 * 2. 箭头（由三个顶点构成的三角形）
 * 3. 边的名称标签（显示在路径中点附近）
 *
 * 通过 shape.getStage().getAttr() 读取 visualScale 和 labelVisible，
 * 不依赖闭包捕获，保证函数引用稳定。
 */
export const edgeSceneFunc = (context: Context, shape: Konva.Shape) => {
    const stage = shape.getStage();
    const visualScale = stage?.getAttr(MAP_NEST_STAGE_ATTR.visualScale) ?? 1;
    const labelVisible = stage?.getAttr(MAP_NEST_STAGE_ATTR.labelVisible)?.edge ?? true;
    // 读取路径属性着色开关状态（默认全 false = 不着色，SPEC edge_attribute_color_toggle）
    const edgeColorVisible = stage?.getAttr(MAP_NEST_STAGE_ATTR.edgeColorVisible)
        ?? { loadSecurity: false, freeSecurity: false, allowVehicleGroups: false };

    const { shapeStyle: { labelFill, stroke, lineWidth }, data } = shape.getAttrs();
    const { sx, sy, cx = null, cy = null, dx = null, dy = null, ex, ey, name, labelX, labelY, arrowPoints, isBackEdge, userDefinedProperties } = data;
    context.beginPath();
    if (cx === null || cy === null || dx === null || dy === null) {
        context.moveTo(sx, -sy);
        context.lineTo(ex, -ey);
    } else {
        context.moveTo(sx, -sy);
        context.bezierCurveTo(cx, -cy, dx, -dy, ex, -ey);
    }
    /** 箭头的三个顶点坐标：左顶点、尖端顶点、右顶点 */
    const [lx, ly, tx, ty, rx, ry] = arrowPoints;
    context.moveTo(lx, ly);
    context.lineTo(tx, ty);
    context.lineTo(rx, ry);
    context.strokeStyle = getEdgeStrokeColor(data, stroke, edgeColorVisible);
    context.lineWidth = lineWidth;
    context.stroke();

    if (labelVisible) {
        context.fillStyle = labelFill;
        context.textAlign = "center";
        context.font = `bold ${0.2 * visualScale}px Arial`;
        // 有设备的边，name 标签沿法线对侧让位，避免与设备图标重叠（SPEC §3.7）
        let textX = labelX + .2;
        let textY = labelY + .2;
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
};

/**
 * 边（Edge）的碰撞检测绘制函数
 * 仅使用 strokeShape 进行碰撞检测，不填充。
 * 原因：对开放贝塞尔曲线调用 fill 会隐式闭合路径（终点→起点直线），
 * 形成包含控制点凸包的大面积填充区域，导致远离曲线的点击也能命中。
 * strokeShape 仅以 hitStrokeWidth 为宽度沿路径描边，选中范围精确。
 */
export const edgeHitFunc = (context: Context, shape: Konva.Shape) => {
    const { data: { sx, sy, cx = null, cy = null, dx = null, dy = null, ex, ey, arrowPoints } } = shape.getAttrs();
    context.beginPath();
    if (cx === null || cy === null || dx === null || dy === null) {
        context.moveTo(sx, -sy);
        context.lineTo(ex, -ey);
    } else {
        context.moveTo(sx, -sy);
        context.bezierCurveTo(cx, -cy, dx, -dy, ex, -ey);
    }
    const [lx, ly, tx, ty, rx, ry] = arrowPoints;
    context.moveTo(lx, ly);
    context.lineTo(tx, ty);
    context.lineTo(rx, ry);
    context.strokeShape(shape);
};
