/**
 * @description 新增边的组件
 * @date 2025-7-14
 * @Line 创建的时候永远当作一条直线，创建Shape的时候再定义成贝塞尔曲线
 */
import { useEffect, useRef, useState, memo } from "react";
import { Shape } from "react-konva";
import Konva from "konva";
import { getRandomString } from "@/utils/public";
import { defaultPathProperty } from "@/plugins/konva/path/defaultPathProperty";
import { forwardPath } from "@/plugins/konva/path/forwardPath";
import { reversePath } from "@/plugins/konva/path/reversePath";
import { nextNameByShapes } from "@/utils/graph";
import { computeCubicArrowPoints, computeLineArrowPoints, computeBezierLabelPoint, computeLinePoint, computeParallelLine } from "@/utils/math";
import type { LinePoint, BezierPoints } from "@/utils/typing";
import { saveSnapshot } from "@/utils/undoHistory";
import { edgeSceneFunc, edgeHitFunc } from "@/plugins/konva/path/edgeDrawFuncs";
import { screenToWorld } from "@/utils/bindStage";
import { MAP_NEST_STAGE_ATTR, MAP_NEST_LAYER_NAME } from "@/plugins/konva/runtime/constants";

/**
 * AddEdge 组件的属性接口
 */
interface AddEdgeProps {
    /** Konva 舞台实例，用于监听鼠标事件和查找已有图形 */
    stage: Konva.Stage | null;
    /** 当前使用的地图 ID，创建边时作为边的 mapId 属性 */
    useMapId: string;
    /**
     * 当前操作模式的键值
     * 可选值：forwardLine（正向直线）、reverseLine（反向直线）、
     * forwardBezier（正向贝塞尔）、reverseBezier（反向贝塞尔）
     */
    manualKey: string;
    /** 自适应视觉倍率（来源于 visualScaleForReact，预览线视觉参数据此等比缩放） */
    visualScale: number;
}

/**
 * 新增边（Edge）组件
 */
export default memo((props: AddEdgeProps) => {

    const { stage, useMapId, manualKey, visualScale } = props;

    const [points, setPoints] = useState<Konva.LineConfig["points"]>([]);
    const [snodeId, setSnodeId] = useState<string>("");
    const isHandleing = useRef<boolean>(false);
    const isPanning = useRef<boolean>(false);
    const lastPointerPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const enterShapeId = useRef<string>("");
    const lineRef = useRef<Konva.Line>(null);
    const manualKeyRef = useRef<string>("");
    const useMapIdRef = useRef<string>("");

    const getCreateShapeAttribute = (target: Konva.Shape | Konva.Stage) => {
        const { points } = lineRef.current?.attrs;
        if (!points) return;
        const [sx, sy] = points;
        const { attrs } = target;

        const isBackEdge = ["reverseLine", "reverseBezier"].includes(manualKeyRef.current);
        const bezier = ["forwardBezier", "reverseBezier"].includes(manualKeyRef.current);
        const id = getRandomString();

        const stroke = isBackEdge ? reversePath.stroke : forwardPath.stroke;
        const labelFill = isBackEdge ? reversePath.labelFill : forwardPath.labelFill;
        /**
         * 从 stage attr 读取当前 visualScale，计算初始 lineWidth。
         * 不再依赖 prop 或闭包中的 visualScale。
         */
        const visualScale = stage?.getAttr(MAP_NEST_STAGE_ATTR.visualScale) ?? 1;
        const lineWidth = (isBackEdge ? reversePath.lineWidth : forwardPath.lineWidth) * visualScale;
        const style = {
            labelFill,
            stroke,
            lineWidth
        };

        const edgeShapes: Konva.Shape[] = stage?.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "edge") || [];
        const nextName = nextNameByShapes(edgeShapes);

        const linePoints: LinePoint = [sx, sy, attrs.x, attrs.y];
        const { x: cx, y: cy } = computeLinePoint(linePoints, 1 / 3);
        const { x: dx, y: dy } = computeLinePoint(linePoints, 2 / 3);
        const bezierPoints: BezierPoints = [sx, sy, cx, cy, dx, dy, attrs.x, attrs.y];
        const arrowPoints = bezier ? computeCubicArrowPoints(bezierPoints) : computeLineArrowPoints(linePoints);
        const label = bezier ? computeBezierLabelPoint(bezierPoints) : computeLinePoint(linePoints);

        const data = {
            ...defaultPathProperty,
            id,
            name: nextName,
            mapId: useMapIdRef.current,
            edgeType: bezier ? "BEZIER" : "LINE",
            sx,
            sy: -sy,
            cx: bezier ? cx : null,
            cy: bezier ? -cy : null,
            dx: bezier ? dx : null,
            dy: bezier ? -dy : null,
            ex: attrs.x,
            ey: -attrs.y,
            isBackEdge,
            snodeId: enterShapeId.current,
            enodeId: attrs?.id,
            arrowPoints,
            labelX: label.x,
            labelY: label.y
        };

        const shape: Konva.ShapeConfig = {
            id,
            shapeStyle: style,
            data
        };
        return shape;
    };

    const onStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
        event.cancelBubble = true;
        const { target, evt } = event;
        if (!["forwardLine", "reverseLine", "forwardBezier", "reverseBezier"].includes(manualKeyRef.current) || evt.button === 2) return;
        const { attrs } = target;
        if (attrs?.enableSelect === "node") {
            const { id, x, y } = attrs;
            const points = [x, y];
            setPoints(points);
            setSnodeId(id);
            enterShapeId.current = id;
            isHandleing.current = true;
        } else if (stage) {
            const pointer = stage.getPointerPosition();
            if (pointer) {
                isPanning.current = true;
                lastPointerPos.current = { x: pointer.x, y: pointer.y };
            }
        }
    };

    const onStageMouseMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (isPanning.current && stage) {
            const pointer = stage.getPointerPosition();
            if (pointer) {
                const dx = pointer.x - lastPointerPos.current.x;
                const dy = pointer.y - lastPointerPos.current.y;
                stage.position({ x: stage.x() + dx, y: stage.y() + dy });
                lastPointerPos.current = { x: pointer.x, y: pointer.y };
            }
            return;
        }

        if (!stage || !isHandleing.current) return;
        event.cancelBubble = true;
        const { target } = event;
        const { attrs } = target;

        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const pointerPos = screenToWorld(pointer.x, pointer.y, stage);
        setPoints(([sx, sy]: any) => {
            return [sx, sy, pointerPos.x, pointerPos.y]
        });

        const lineType = ["forwardLine", "reverseLine"].includes(manualKeyRef.current) ? "LINE" : "BEZIER";

        const isUniquePath = stage.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "edge" && shape.attrs?.data?.snodeId === enterShapeId.current && shape.attrs?.data?.enodeId === attrs?.id && shape.attrs?.data?.edgeType === lineType);
        if (attrs?.enableSelect === "node" && attrs?.id !== enterShapeId.current && !isUniquePath?.length) {
            const shapeConfig = getCreateShapeAttribute(target);
            if (shapeConfig) {
                saveSnapshot();
                const edgesLayer = stage?.findOne(`.${MAP_NEST_LAYER_NAME.edges}`) as Konva.Layer | undefined;
                const layer = edgesLayer || lineRef.current?.getLayer();
                if (layer) {
                    const newShape = new Konva.Shape({
                        id: shapeConfig.id,
                        shapeStyle: shapeConfig.shapeStyle,
                        data: shapeConfig.data,
                        state: "",
                        enableSelect: "edge",
                        hitStrokeWidth: Math.max((shapeConfig.shapeStyle?.lineWidth || 0.05) * 5, 0.1),
                        perfectDrawEnabled: false,
                        shadowForStrokeEnabled: false,
                        sceneFunc: edgeSceneFunc,
                        hitFunc: edgeHitFunc
                    });
                    layer.add(newShape);
                }
            }
            setPoints([attrs.x, attrs.y]);
            setSnodeId(attrs?.id);
            enterShapeId.current = attrs?.id;
        }
    };

    const onStageMouseUp = (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (isPanning.current) {
            isPanning.current = false;
            return;
        }

        const { target } = event;
        if (!target.getStage() || !isHandleing.current) return;
        isHandleing.current = false;
        setPoints([]);
        setSnodeId("");
    };

    useEffect(() => {
        manualKeyRef.current = manualKey;
        useMapIdRef.current = useMapId;
    }, [manualKey, useMapId])

    useEffect(() => {
        if (!stage) return;
        stage.on("mousedown.mapNestAddEdge", onStageMouseDown);
        stage.on("mousemove.mapNestAddEdge", onStageMouseMove);
        stage.on("mouseup.mapNestAddEdge", onStageMouseUp);
        return () => {
            stage.off("mousedown.mapNestAddEdge", onStageMouseDown);
            stage.off("mousemove.mapNestAddEdge", onStageMouseMove);
            stage.off("mouseup.mapNestAddEdge", onStageMouseUp);
        }
    }, [])

    return (
        <Shape
            ref={lineRef}
            id="addEdgePreview"
            /**
             * 预览线仅作展示，必须关闭监听：
             * ActionLayer 已上移到节点之上，而预览线端点始终跟随指针，
             * 若可监听，hover 节点时命中的会是预览线而非节点，
             * onStageMouseMove 里 enableSelect === "node" 的判断失效，连续画边会断链。
             * 画边交互全部走 stage 级监听（mousedown/mousemove/mouseup），不依赖预览线命中。
             */
            listening={false}
            snodeId={snodeId}
            points={points}
            sceneFunc={(context, shape) => {
                const { points } = shape.attrs;
                const [sx, sy, ex, ey] = points;
                context.beginPath();
                context.moveTo(sx, sy);
                context.lineTo(ex, ey);
                context.strokeStyle = manualKey.startsWith("reverse") ? reversePath.stroke : forwardPath.stroke;
                context.lineWidth = 0.05 * visualScale;
                context.stroke();
                // 平行四边形的偏移量属于「视觉尺寸」而非几何数据，必须随 visualScale 等比缩放：
                // 否则放大时偏移在屏幕上 = 0.5 * stageScale 会变得极宽，
                // 距离标签（画在平行线中点）会被顶出可视区，导致看不到距离。
                const parallelPoints = computeParallelLine([sx, sy, ex, ey], 0.5 * visualScale);
                const [psx, psy, pex, pey] = parallelPoints;
                context.beginPath();
                context.moveTo(sx, sy);
                context.lineTo(psx, psy);
                context.lineTo(pex, pey);
                context.lineTo(ex, ey);
                context.strokeStyle = "#D50000";
                context.lineWidth = 0.05 * visualScale;
                context.setLineDash([0.03 * visualScale, 0.03 * visualScale, 0, 0.03 * visualScale]);
                context.stroke();
                const label = computeLinePoint(parallelPoints, 1 / 2);
                context.fillStyle = "#D50000";
                context.font = `bold ${0.2 * visualScale}px Arial`;
                context.textAlign = "center";
                context.fillText(label.length.toFixed(2) + "m", label.x + 0.2 * visualScale, label.y + 0.2 * visualScale);
                context.fillStrokeShape(shape);
            }}
        />
    )
});
