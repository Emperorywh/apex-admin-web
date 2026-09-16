/**
 * @description 根据车辆的type显示不同的车体模型
 * @date 2025-5-27
 */
import { memo } from "react";
import type { RobotRect } from "@/utils/typing";
import XcGroup from "./XcGroup";
import XpGroup from "./XpGroup";

export interface RobotGroupProps {
    robotsState: RobotRect[];
    overlayVisible: boolean;
    /** 当前选中/锁定的车辆 agvKey，用于在车辆周围绘制虚线圆 */
    focusId?: string;
}

export default memo((props: RobotGroupProps) => {

    const { robotsState, overlayVisible, focusId } = props;

    return (
        <>
            {
                robotsState.map(robot => {
                    const {
                        x,
                        y,
                        type,
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
                        strokeStyle,
                        pathFill,
                        omega,
                        vx,
                        vy,
                        paused,
                        localizationScore,
                        errorEntryList
                    } = robot;

                    const isFocus = !!focusId && focusId === agvKey;

                    if (type === 1) {
                        // 叉车
                        return (
                            <XcGroup
                                key={robot.agvKey}
                                overlayVisible={overlayVisible}
                                agvKey={agvKey}
                                x={x}
                                y={y}
                                theta={theta}
                                agvName={agvName}
                                length={length}
                                centerOffset={centerOffset}
                                width={width}
                                batteryCharge={batteryCharge}
                                vehicleProcStatus={vehicleProcStatus}
                                loaded={loaded}
                                orderTaskKey={orderTaskKey}
                                robotFill={robotFill}
                                strokeStyle={strokeStyle}
                                pathFill={pathFill}
                                omega={omega}
                                vx={vx}
                                vy={vy}
                                paused={paused}
                                localizationScore={localizationScore}
                                errorEntryList={errorEntryList}
                                isFocus={isFocus}
                            />
                        )
                    } else {
                        // 非叉车
                        return (
                            <XpGroup
                                key={robot.agvKey}
                                overlayVisible={overlayVisible}
                                agvKey={agvKey}
                                x={x}
                                y={y}
                                theta={theta}
                                agvName={agvName}
                                length={length}
                                centerOffset={centerOffset}
                                width={width}
                                batteryCharge={batteryCharge}
                                vehicleProcStatus={vehicleProcStatus}
                                loaded={loaded}
                                orderTaskKey={orderTaskKey}
                                robotFill={robotFill}
                                pathFill={pathFill}
                                omega={omega}
                                vx={vx}
                                vy={vy}
                                strokeStyle={strokeStyle}
                                paused={paused}
                                localizationScore={localizationScore}
                                errorEntryList={errorEntryList}
                                isFocus={isFocus}
                            />
                        )
                    }
                })
            }
        </>
    )
});
