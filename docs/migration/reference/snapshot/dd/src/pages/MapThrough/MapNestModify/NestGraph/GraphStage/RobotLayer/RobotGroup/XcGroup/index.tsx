/**
 * @description 叉车的模型
 * @date 2025-6-11
 */
import { memo } from "react";
import { Group, Line, Circle, Shape } from "react-konva/lib/ReactKonvaCore";
import type { RobotRect, ErrorEntry } from "@/utils/typing";
import { robotProperty } from "@/plugins/konva/nodes/robot";
import { useWarningBlink } from "@/hooks/useWarningBlink";
import { useI18n } from "@/hooks/useI18n";

interface XcGroupProps {
    x: number;
    y: number;
    agvKey: string;
    theta: number;
    agvName: string;
    length: number;
    centerOffset: number;
    width: number;
    loaded: boolean;
    orderTaskKey: string;
    robotFill: string;
    // pathFill: string;
    batteryCharge: number;
    vehicleProcStatus: string;
    pathFill: string;
    strokeStyle: string;
    omega: number;
    vx: number;
    vy: number;
    visible: boolean;
    /** 定位置信度，低于阈值时车体显示定位告警色 */
    localizationScore: number;
    errorEntryList: ErrorEntry[];
}

export default memo((props: XcGroupProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const {
        x,
        y,
        agvKey,
        theta,
        agvName,
        length,
        centerOffset,
        width,
        loaded,
        orderTaskKey,
        robotFill,
        pathFill,
        batteryCharge,
        vehicleProcStatus,
        strokeStyle,
        omega,
        vx,
        vy,
        visible,
        localizationScore,
        errorEntryList
    } = props;

    // 接入定位告警：与 Overlook 保持一致，定位置信度低于阈值时车体显示告警色
    const { locWarningVisible, errorWarningVisible } = useWarningBlink({ localizationScore, errorEntryList, vehicleProcStatus });

    return (
        <Shape
            x={x}
            y={y}
            id={agvKey}
            rotation={-theta}
            offsetX={-centerOffset}
            width={width}
            length={length}
            centerOffset={centerOffset}
            isRobot={true}
            isFocus={false}
            agvName={agvName}
            loaded={loaded}
            omega={omega}
            vx={vx}
            vy={vy}
            visible={visible}
            orderTaskKey={orderTaskKey}
            batteryCharge={batteryCharge}
            vehicleProcStatus={vehicleProcStatus}
            locWarningVisible={locWarningVisible}
            errorWarningVisible={errorWarningVisible}
            hitFunc={(context, shape) => {
                const { attrs: { width, length } } = shape;
                context.beginPath();
                context.rect(-length / 2, -width / 2, length, width);
                context.closePath();
                context.fillStrokeShape(shape);
            }}
            sceneFunc={(context, shape) => {
                const { attrs: { width, length, centerOffset, isFocus, agvName, loaded, vehicleProcStatus, locWarningVisible, errorWarningVisible } } = shape;
                // 画车体形状 叉车形状
                context.beginPath();
                const ltx = -length / 2;
                const lty = -width / 2;
                context.moveTo(ltx, lty + width / 6);
                const bodyX = -centerOffset; // 叉尺和车体交点的x
                // const forkWidth = width / 6; // 定义叉尺的宽度为总车宽的1/6
                context.lineTo(bodyX, lty + width / 6);
                context.lineTo(bodyX, lty);
                context.lineTo(length / 2, lty);
                context.lineTo(length / 2, width / 2);
                context.lineTo(bodyX, width / 2);
                context.lineTo(bodyX, width / 2 - width / 6);
                context.lineTo(ltx, width / 2 - width / 6);
                context.lineTo(ltx, width / 2 - width / 3);
                context.lineTo(bodyX, width / 2 - width / 3);
                context.lineTo(bodyX, lty + width / 3);
                context.lineTo(ltx, lty + width / 3);
                context.closePath();
                // 填充优先级与 Overlook 一致：定位告警 > 错误告警 > 状态色
                context.fillStyle = locWarningVisible ? robotProperty.localizationWarning.fill : errorWarningVisible ? robotProperty.errorWarning.fill : robotFill;
                context.strokeStyle = strokeStyle;
                context.lineWidth = robotProperty.strokeWidth;
                context.stroke();
                context.fill();
                // 画车体头部的黄色装饰
                context.beginPath();
                context.moveTo(length / 2, lty + width / 3);
                context.lineTo(length / 2, lty + width - width / 3);
                context.strokeStyle = "#FFFF00";
                context.lineWidth = robotProperty.strokeWidth;
                context.stroke();
                // 画车体的坐标系/充电标识
                const headerMidX = (length / 2 - centerOffset) / 2;
                context.beginPath();
                if (vehicleProcStatus === "CHARGE") {
                    const dw = width / 4;
                    const dl = (length / 2 + centerOffset) / 4;
                    context.moveTo(headerMidX + dl, 0);
                    context.lineTo(headerMidX, dw);
                    context.lineTo(headerMidX, -dw);
                    context.lineTo(headerMidX - dl, 0);
                    context.closePath();
                    context.fillStyle = pathFill;
                    context.strokeStyle = pathFill;
                    context.lineWidth = robotProperty.strokeWidth;
                    context.fill();
                    context.stroke();
                } else {
                    context.moveTo(headerMidX, lty + width / 2);
                    context.lineTo(headerMidX, lty + width / 3);
                    context.moveTo(headerMidX, lty + width / 2);
                    context.lineTo(headerMidX + (length / 2 + centerOffset) / 4, lty + width / 2);
                    context.strokeStyle = pathFill;
                    context.lineWidth = robotProperty.strokeWidth;
                    context.stroke();
                }
                if (loaded) {
                    // 画车辆的载货状态
                    context.beginPath();
                    context.moveTo(bodyX + length / 12, lty + width / 6);
                    context.lineTo(bodyX + length / 12, lty + width - width / 6);
                    context.strokeStyle = robotProperty.load.stroke;
                    context.lineWidth = robotProperty.load.strokeWidth;
                    context.stroke();
                }
                if (orderTaskKey) {
                    // 画叉车的任务状态
                    const radius = width / 6;
                    context.beginPath();
                    context.arc(bodyX, 0, radius, 0, Math.PI * 2);
                    context.fillStyle = robotProperty.order.fill;
                    context.fill();
                }
                // 画车辆的名称文本（始终水平显示在屏幕正下方，不随车体旋转）
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
                if (isFocus) {
                    // 画车辆选中时的圆
                    const radius = Math.max(width, length);
                    context.beginPath();
                    context.arc(0, 0, radius, 0, Math.PI * 2);
                    context.setLineDash(robotProperty.focus.lineDash);
                    context.strokeStyle = robotProperty.focus.stroke;
                    context.lineWidth = robotProperty.focus.strokeWidth;
                    context.stroke();
                    context.fillStrokeShape(shape);
                }
            }}
        />
    )
});
