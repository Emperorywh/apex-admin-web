/**
 * @description 测量距离
 * @date 2025-7-28
 */
import { useEffect, useRef } from "react";
import { Shape } from "react-konva";
import type Konva from "konva";
import { computeLinePoint } from "@/utils/math";
import { screenToWorld } from "@/utils/bindStage";

interface RangingProps {
    stage: Konva.Stage | null;
    manualKey: string;
    enableModify: boolean;
    /** 自适应视觉倍率（来源于 visualScaleForReact，测距线视觉参数据此等比缩放） */
    visualScale: number;
}

export default (props: RangingProps) => {

    const { stage, manualKey, enableModify, visualScale } = props;

    // 操作的ref
    const manualKeyRef = useRef<string>("");
    // 是否已经开始测距了
    const isRanging = useRef<boolean>(false);
    // 直线的ref
    const shapeRef = useRef<Konva.Shape>(null);

    // 屏幕坐标到世界坐标必须用 screenToWorld 做含旋转的逆变换：
    // Stage 的真实变换是 translate · rotate · scale，
    // 旧实现仅做 (pointer - position) / scale，在 stage 旋转后测距起点和终点
    // 都会偏离鼠标位置，离原点越远偏移越严重，距离值也跟着失真。
    const onStageClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
        event.cancelBubble = true;
        const { target, evt } = event;
        if (shapeRef.current?.attrs?.visible || manualKeyRef.current !== "ranging") {
            shapeRef.current?.setAttr("visible", false);
            isRanging.current = false;
            return;
        };
        const stage = target.getStage();
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const { x: sx, y: sy } = screenToWorld(pointer.x, pointer.y, stage);
        shapeRef.current?.setAttrs({
            visible: true,
            data: {
                sx,
                sy,
                ex: sx,
                ey: sy,
                text: 0
            }
        });
        isRanging.current = true;
    };

    const onStageMouseMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (!isRanging.current) return;
        const { target } = event;
        const stage = target.getStage();
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const { x: ex, y: ey } = screenToWorld(pointer.x, pointer.y, stage);
        const { attrs } = shapeRef.current!;
        const { length } = computeLinePoint([attrs?.data?.sx, attrs?.data?.sy, ex, ey]);
        shapeRef.current?.setAttrs({
            data: {
                ...(attrs?.data || {}),
                ex,
                ey,
                text: length.toFixed(5)
            }
        });
    };

    useEffect(() => {
        manualKeyRef.current = manualKey;
        if (manualKey !== "ranging") {
            shapeRef.current?.setAttrs({
                visible: false
            });
        }
    }, [manualKey])

    useEffect(() => {
        // 这里必须按"事件名 + 同一个回调引用"精确卸载，避免使用 stage.off("click") 把
        // react-konva 自己注册在 Stage 上的 click 监听一并清掉。
        stage?.on("click", onStageClick);
        stage?.on("mousemove", onStageMouseMove);
        return () => {
            stage?.off("click", onStageClick);
            stage?.off("mousemove", onStageMouseMove);
        }
    }, [stage])

    return (
        // 注意：这里特意不在 JSX 上写 data 默认值，
        // 因为 data 是通过命令式 setAttrs 在 onStageClick / onStageMouseMove 中维护的；
        // 一旦在 JSX 上写了固定的 data={{sx:0,sy:0,...}}，父组件任意重渲染都会把 attrs.data 重置回 (0,0)，
        // 表现为测距过程中起点突然飘到坐标轴原点。
        <Shape
            id="ranging"
            ref={shapeRef}
            visible={enableModify && isRanging.current}
            sceneFunc={(context, shape) => {
                const { sx = 0, sy = 0, ex = 0, ey = 0, text = "" } = shape.attrs?.data || {};
                context.beginPath();
                context.moveTo(sx, sy);
                context.lineTo(ex, ey);
                context.lineWidth = 0.05 * visualScale;
                context.strokeStyle = "#FC5E5F";
                context.stroke();
                // 距离
                context.fillStyle = "#FE0101";
                context.font = `bold ${0.5 * visualScale}px Arial`;
                context.fillText(text + "m", ex + 0.5 * visualScale, ey);
                context.fillStrokeShape(shape);
            }}
        />
    )
};
