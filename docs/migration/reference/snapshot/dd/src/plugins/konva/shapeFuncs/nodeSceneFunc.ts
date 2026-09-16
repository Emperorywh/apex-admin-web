/**
 * @description 节点（Node）的场景绘制函数和碰撞检测函数
 * @date 2026-5-27
 *
 * 所有节点 Shape 共享此函数，通过 shape.getStage().getAttr() 读取运行时参数，
 * 不依赖闭包捕获，保证函数引用稳定（Konva 最佳实践）。
 */
import type Konva from "konva";
import { MAP_NEST_STAGE_ATTR } from "../runtime/constants";

/**
 * 节点场景绘制函数
 * 负责绘制：圆圈、方向箭头、站点标签
 */
export const nodeSceneFunc = (context: Konva.Context, shape: Konva.Shape) => {
    const stage = shape.getStage();
    const visualScale = stage?.getAttr(MAP_NEST_STAGE_ATTR.visualScale) ?? 1;
    const labelVisible = stage?.getAttr(MAP_NEST_STAGE_ATTR.labelVisible)?.node ?? true;

    const { attrs: {
        shapeStyle: { radius, fill, stroke, lineWidth, labelFill },
        data: { name, arrowPoints }
    } } = shape;

    // 画元素的圆圈
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fillStyle = fill;
    context.strokeStyle = stroke;
    context.lineWidth = lineWidth;
    context.stroke();
    context.fill();

    if (arrowPoints) {
        // 画元素的箭头
        context.beginPath();
        const [[tx, ty], [rx, ry], [bx, by]] = arrowPoints;
        context.moveTo(tx, ty);
        context.lineTo(rx, ry);
        context.lineTo(bx, by);
        context.strokeStyle = stroke;
        context.lineWidth = lineWidth;
        context.stroke();
    }

    /**
     * AddNode 的预览 Shape 设置 forceShowLabel=true，
     * 始终显示标签（不受 labelVisible 控制）。
     * 常规节点通过 stage attr 的 labelVisible 控制。
     */
    const forceShowLabel = shape.attrs?.forceShowLabel;
    if (forceShowLabel || labelVisible) {
        context.textAlign = "left";
        context.font = `bold ${0.2 * visualScale}px Arial`;
        context.textBaseline = "top";
        context.fillStyle = labelFill;
        context.fillText(name, 0, radius * 1.5, radius * 4);
    }
    context.fillStrokeShape(shape);
};

/**
 * 节点碰撞检测函数
 * 以节点圆心为原点，radius 为半径的圆形区域
 */
export const nodeHitFunc = (context: Konva.Context, shape: Konva.Shape) => {
    const { attrs: { shapeStyle: { radius } } } = shape;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.closePath();
    context.fillStrokeShape(shape);
};
