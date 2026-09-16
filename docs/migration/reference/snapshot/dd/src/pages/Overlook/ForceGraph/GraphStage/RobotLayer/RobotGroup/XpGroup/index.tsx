/**
 * @description 小车的模型
 * @date 2025-6-11
 */
import { memo } from "react";
import { Shape } from "react-konva/lib/ReactKonvaCore";
import { robotProperty } from "@/plugins/konva/nodes/robot";
import { useWarningBlink } from "@/hooks/useWarningBlink";
import { ErrorEntry } from "@/utils/typing";

interface XpGroupProps {
    overlayVisible: boolean;
    x: number;
    y: number;
    agvKey: string;
    theta: number;
    agvName: string;
    length: number;
    centerOffset: number;
    width: number;
    batteryCharge: number;
    vehicleProcStatus: string;
    loaded: boolean,
    orderTaskKey: string;
    robotFill: string;
    pathFill: string;
    omega: number;
    vx: number;
    vy: number;
    strokeStyle: string;
    paused: boolean;
    localizationScore: number;
    errorEntryList: ErrorEntry[];
    /** 是否处于选中/聚焦状态，选中时在车辆四周绘制圆形虚线 */
    isFocus?: boolean;
}

export default memo((props: XpGroupProps) => {

    const {
        overlayVisible,
        x,
        y,
        agvKey,
        theta,
        agvName,
        length,
        centerOffset,
        width,
        batteryCharge,
        vehicleProcStatus,
        loaded,
        orderTaskKey,
        robotFill,
        pathFill,
        omega,
        vx,
        vy,
        strokeStyle,
        paused,
        localizationScore,
        errorEntryList,
        isFocus = false,
    } = props;

    const { locWarningVisible, errorWarningVisible } = useWarningBlink({ localizationScore, errorEntryList, vehicleProcStatus });

    return (
        <Shape
            x={x}
            y={y}
            id={agvKey}
            vx={vx}
            vy={vy}
            visible={overlayVisible}
            rotation={-theta}
            isRobot={true}
            isFocus={isFocus}
            agvName={agvName}
            width={width}
            length={length}
            loaded={loaded}
            omega={omega}
            centerOffset={centerOffset}
            offsetX={-centerOffset}
            batteryCharge={batteryCharge}
            orderTaskKey={orderTaskKey}
            vehicleProcStatus={vehicleProcStatus}
            paused={paused}
            perfectDrawEnabled={false}
            localizationScore={localizationScore}
            errorEntryList={errorEntryList}
            locWarningVisible={locWarningVisible}
            errorWarningVisible={errorWarningVisible}
            hitFunc={(context, shape) => {
                const { attrs: { width, length } } = shape;
                context.beginPath();
                const fx = -length / 2;
                const fy = -width / 2;
                context.rect(fx, fy, length, width);
                context.closePath();
                context.fillStrokeShape(shape);
            }}
            sceneFunc={(context, shape) => {
                const { attrs: { isFocus, width, length, loaded, locWarningVisible, errorWarningVisible } } = shape;
                context.beginPath();
                // 画车体矩形 车头有圆角
                const radius = .2;
                const fx = -length / 2;
                const fy = -width / 2;
                // context.rect(fx, fy, length, width); // 其实用正方形最简单
                context.moveTo(fx, fy);
                context.lineTo(fx + length - radius, fy);
                context.arcTo(fx + length, fy, fx + length, fy + radius, radius); // 右上角圆角
                context.lineTo(fx + length, fy + width - radius);
                context.arcTo(fx + length, fy + width, fx + length - radius, fy + width, radius);
                context.lineTo(fx, fy + width);
                context.closePath();
                context.fillStyle = locWarningVisible ? robotProperty.localizationWarning.fill : errorWarningVisible ? robotProperty.errorWarning.fill : robotFill;
                context.strokeStyle = strokeStyle;
                context.lineWidth = robotProperty.strokeWidth;
                context.fill()
                context.stroke();
                // 画车身的箭头/充电标识
                context.beginPath();
                if (vehicleProcStatus === "CHARGE") {
                    context.moveTo(length / 4, 0);
                    context.lineTo(0, width / 4);
                    context.lineTo(0, -width / 4);
                    context.lineTo(-length / 4, 0);
                    context.closePath();
                } else {
                    context.moveTo(0, 0);
                    context.lineTo(length / 4, 0);
                    context.moveTo(0, 0);
                    context.lineTo(0, -width / 4);
                }
                context.fillStyle = pathFill;
                context.lineWidth = robotProperty.strokeWidth;
                context.strokeStyle = pathFill;
                context.fill();
                context.stroke();
                // 添加车辆头部标识
                context.beginPath();
                context.moveTo(length / 2, -width / 4);
                context.lineTo(length / 2, width / 4);
                context.lineWidth = robotProperty.strokeWidth;
                context.strokeStyle = "#FFFF00";
                context.stroke();
                if (loaded) {
                    // 画车辆的载货状态 车身后部的横线
                    context.beginPath();
                    context.moveTo(-length / 4, -width / 4);
                    context.lineTo(-length / 4, width / 4);
                    context.strokeStyle = robotProperty.load.stroke;
                    context.lineWidth = robotProperty.load.strokeWidth;
                    context.stroke();
                }
                if (orderTaskKey) {
                    // 画车辆的任务样式
                    context.beginPath();
                    const cx = -length / 2;
                    const cy = 0;
                    const radius = width / 6;
                    context.arc(cx, cy, radius, 0, Math.PI * 2);
                    context.fillStyle = robotProperty.order.fill;
                    context.fill();
                }
                // 绘制车辆名称文本（始终水平显示在屏幕正下方，不随车体旋转）
                const nameText = agvName?.length > 10 ? agvName.substring(0, 4) + "..." + agvName.substring(agvName.length - 4) : agvName;
                context.save();
                // 撤销 Shape 的本地变换：先抵消 offsetX 引入的 T(centerOffset,0)，再抵消 rotation 的 R(-theta)
                // sceneFunc 内 context = Layer·T(x,y)·R(-theta)·T(centerOffset,0)，撤销后回到 Layer·T(x,y)
                // 项目设置了 Konva.angleDeg=false，rotation 与 context.rotate 均以弧度为单位，theta 本身就是弧度
                context.translate(-centerOffset, 0);
                context.rotate(theta);
                // 此时在 (0, width/1.5) 绘制 = Layer 坐标系车体锚点正下方 width/1.5 处，文字方向始终水平
                context.textAlign = "center";
                context.font = "bold .3px Arial";
                context.textBaseline = "top";
                context.fillStyle = robotProperty.textFill;
                // fillText(text, x, y, maxWidth)
                context.fillText(nameText, 0, width / 1.5, length);
                context.restore();
                if(isFocus) {
                    // 绘制车辆选中时的圆
                    const radius = Math.max(width, length);
                    context.beginPath();
                    context.arc(0, 0, radius, 0, Math.PI * 2);
                    context.setLineDash(robotProperty.focus.lineDash);
                    context.strokeStyle = robotProperty.focus.stroke;
                    context.lineWidth = robotProperty.focus.strokeWidth;
                    context.stroke();
                }
                context.fillStrokeShape(shape);
            }}
        />
    )
});
