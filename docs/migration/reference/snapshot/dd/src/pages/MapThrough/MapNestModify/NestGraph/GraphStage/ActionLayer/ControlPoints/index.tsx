/**
 * @description 调整一个曲线的控制点的组件
 * @date 2025-7-15
 */
import { useEffect, useState, useRef, memo } from "react";
import { Circle, Line, Text } from "react-konva";
import type Konva from "konva";
import { computeCubicArrowPoints, computeBezierLabelPoint } from "@/utils/math";
import { computeBezierControlPointSnap } from "@/utils/angle";
import { findReverseEdgeShape, isBezierOverlapped } from "@/utils/edgePair";
import { saveSnapshot } from "@/utils/undoHistory";
import { refreshDeviceIcons } from "@/plugins/konva/devices";
import { refreshActionBadges } from "@/plugins/konva/actions";
import type { BezierPoints } from "@/utils/typing";

interface ControlPointsProps {
    selectShapes: Konva.Shape[];
    /** 自适应视觉倍率（来源于 visualScaleForReact，声明式组件需要 re-render 更新尺寸） */
    visualScale: number;
}

export default memo((props: ControlPointsProps) => {

    const { selectShapes, visualScale } = props;

    const [selectedShape, setSelectedShape] = useState<Konva.Shape | undefined>(undefined);
    const [auxLinePoints, setAuxLinePoints] = useState<Konva.LineConfig["points"]>([]);
    const lockedReverseShapeRef = useRef<Konva.Shape | null>(null);

    const onControlPointDragStart = () => {
        if (!selectedShape) {
            lockedReverseShapeRef.current = null;
            return;
        }
        saveSnapshot();
        const stage = selectedShape.getStage();
        const reverseShape = findReverseEdgeShape(stage, selectedShape.attrs?.data);
        if (
            reverseShape &&
            isBezierOverlapped(selectedShape.attrs?.data, reverseShape.attrs?.data)
        ) {
            lockedReverseShapeRef.current = reverseShape;
        } else {
            lockedReverseShapeRef.current = null;
        }
    };

    /**
     * 拖拽控制点结束时：清空锁定状态，不再需要 syncEdgeData
     * EdgesLayer 不再依赖 visualScale 触发 useMemo 重算
     */
    const onControlPointDragEnd = () => {
        lockedReverseShapeRef.current = null;
    };

    // 控制点A
    const onControlPointADragMove = (event: Konva.KonvaEventObject<DragEvent>) => {
        if (!selectedShape) return;
        if (!event.evt.altKey) {
            const stage = event.target.getStage();
            if (stage) {
                const snapped = computeBezierControlPointSnap(
                    stage,
                    selectedShape,
                    "A",
                    event.target.x(),
                    -event.target.y()
                );
                if (snapped) {
                    event.target.position({ x: snapped.x, y: -snapped.y });
                }
            }
        }
        const targetPos = {
            x: event.target.x(),
            y: event.target.y()
        };
        const { attrs } = selectedShape;
        const { data: { sx, sy, dx, dy, ex, ey } } = attrs;
        const points: BezierPoints = [sx, -sy, targetPos.x, targetPos.y, dx, -dy, ex, -ey];
        setAuxLinePoints(points);
        const arrowPoints = computeCubicArrowPoints(points);
        const label = computeBezierLabelPoint(points);
        selectedShape?.setAttrs({
            data: {
                ...(attrs?.data || {}),
                cx: targetPos.x,
                cy: -targetPos.y,
                arrowPoints,
                labelX: label.x,
                labelY: label.y
            }
        });
        if (lockedReverseShapeRef.current) {
            const reverseShape = lockedReverseShapeRef.current;
            const reverseAttrs = reverseShape.attrs;
            const rd = reverseAttrs?.data;
            if (rd) {
                const reversePoints: BezierPoints = [
                    rd.sx, -rd.sy,
                    rd.cx, -rd.cy,
                    targetPos.x, targetPos.y,
                    rd.ex, -rd.ey
                ];
                const reverseArrowPoints = computeCubicArrowPoints(reversePoints);
                const reverseLabel = computeBezierLabelPoint(reversePoints);
                reverseShape.setAttrs({
                    data: {
                        ...rd,
                        dx: targetPos.x,
                        dy: -targetPos.y,
                        arrowPoints: reverseArrowPoints,
                        labelX: reverseLabel.x,
                        labelY: reverseLabel.y
                    }
                });
            }
        }
        // 控制点A拖动改变了贝塞尔几何，同步刷新三方设备图标与动作角标位置
        const stage = selectedShape.getStage();
        if (stage) {
            refreshDeviceIcons(stage);
            refreshActionBadges(stage);
        }
    };

    // 控制点B
    const onControlPointBDragMove = (event: Konva.KonvaEventObject<DragEvent>) => {
        if (!selectedShape) return;
        if (!event.evt.altKey) {
            const stage = event.target.getStage();
            if (stage) {
                const snapped = computeBezierControlPointSnap(
                    stage,
                    selectedShape,
                    "B",
                    event.target.x(),
                    -event.target.y()
                );
                if (snapped) {
                    event.target.position({ x: snapped.x, y: -snapped.y });
                }
            }
        }
        const targetPos = {
            x: event.target.x(),
            y: event.target.y()
        };
        const { attrs } = selectedShape;
        const { data: { sx, sy, cx, cy, ex, ey } } = attrs;
        const points: BezierPoints = [sx, -sy, cx, -cy, targetPos.x, targetPos.y, ex, -ey];
        setAuxLinePoints(points);
        const arrowPoints = computeCubicArrowPoints(points);
        const label = computeBezierLabelPoint(points);
        selectedShape?.setAttrs({
            data: {
                ...(attrs?.data || {}),
                dx: targetPos.x,
                dy: -targetPos.y,
                arrowPoints,
                labelX: label.x,
                labelY: label.y
            }
        });
        if (lockedReverseShapeRef.current) {
            const reverseShape = lockedReverseShapeRef.current;
            const reverseAttrs = reverseShape.attrs;
            const rd = reverseAttrs?.data;
            if (rd) {
                const reversePoints: BezierPoints = [
                    rd.sx, -rd.sy,
                    targetPos.x, targetPos.y,
                    rd.dx, -rd.dy,
                    rd.ex, -rd.ey
                ];
                const reverseArrowPoints = computeCubicArrowPoints(reversePoints);
                const reverseLabel = computeBezierLabelPoint(reversePoints);
                reverseShape.setAttrs({
                    data: {
                        ...rd,
                        cx: targetPos.x,
                        cy: -targetPos.y,
                        arrowPoints: reverseArrowPoints,
                        labelX: reverseLabel.x,
                        labelY: reverseLabel.y
                    }
                });
            }
        }
        // 控制点B拖动改变了贝塞尔几何，同步刷新三方设备图标与动作角标位置
        const stage = selectedShape.getStage();
        if (stage) {
            refreshDeviceIcons(stage);
            refreshActionBadges(stage);
        }
    };

    useEffect(() => {
        if (selectShapes?.length !== 1) {
            setSelectedShape(undefined);
            setAuxLinePoints([]);
            return;
        }
        const [shape] = selectShapes;
        const sd = shape.attrs?.data;
        const isBezier = !!(
            sd
            && sd.cx !== null && sd.cy !== null
            && sd.dx !== null && sd.dy !== null
            && sd.cx !== undefined && sd.cy !== undefined
            && sd.dx !== undefined && sd.dy !== undefined
        );
        if (shape.attrs?.enableSelect === "edge" && isBezier) {
            setSelectedShape(shape);
            setAuxLinePoints([
                sd.sx, -sd.sy,
                sd.cx, -sd.cy,
                sd.dx, -sd.dy,
                sd.ex, -sd.ey
            ]);
        } else {
            setSelectedShape(undefined);
            setAuxLinePoints([]);
        }
    }, [selectShapes]);

    return (
        <>
            {/**
              * 辅助控制线仅作展示，必须关闭监听：
              * ActionLayer 已上移到节点之上，若线可监听，没按准控制点圆点时命中会落在线上，
              * 穿透到可拖动的 Stage 引发整块画布平移（表现为"一拖控制点地图就跑"）。
              */}
            <Line
                id="controlLine"
                listening={false}
                visible={!!selectedShape}
                points={auxLinePoints}
                stroke="#808000"
                strokeWidth={.05 * visualScale}
                dash={[.03 * visualScale, .03 * visualScale, 0, .03 * visualScale]}
            />
            <Circle
                id="controlPointA"
                visible={!!selectedShape}
                x={selectedShape?.attrs?.data?.cx || 0}
                y={-selectedShape?.attrs?.data?.cy || 0}
                radius={.1 * visualScale}
                fill="#FF8C00"
                stroke="#B8860B"
                strokeWidth={.1 * visualScale}
                draggable
                onDragStart={onControlPointDragStart}
                onDragMove={onControlPointADragMove}
                onDragEnd={onControlPointDragEnd}
            />
            <Text
                id="controlTextA"
                visible={!!selectedShape}
                listening={false}
                x={selectedShape?.attrs?.data?.cx || 0}
                y={-selectedShape?.attrs?.data?.cy + .2 * visualScale || 0}
                fill={"#8B4513"}
                text="A"
                fontSize={.5 * visualScale}
                align="center"
                width={.5 * visualScale}
            />
            <Circle
                id="controlPointB"
                visible={!!selectedShape}
                x={selectedShape?.attrs?.data?.dx || 0}
                y={-selectedShape?.attrs?.data?.dy || 0}
                radius={.1 * visualScale}
                fill="#FF8C00"
                stroke="#B8860B"
                strokeWidth={.1 * visualScale}
                draggable
                onDragStart={onControlPointDragStart}
                onDragMove={onControlPointBDragMove}
                onDragEnd={onControlPointDragEnd}
            />
            <Text
                id="controlTextB"
                visible={!!selectedShape}
                listening={false}
                x={selectedShape?.attrs?.data?.dx || 0}
                y={-selectedShape?.attrs?.data?.dy + .2 * visualScale || 0}
                fill={"#8B4513"}
                text="B"
                fontSize={.5 * visualScale}
                align="center"
                width={.5 * visualScale}
            />
        </>
    );
});
