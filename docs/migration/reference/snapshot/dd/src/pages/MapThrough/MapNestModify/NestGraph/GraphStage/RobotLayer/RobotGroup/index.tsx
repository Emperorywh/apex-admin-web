/**
 * @description 根据车辆的type显示不同的车体模型
 * @date 2025-5-27
 */
import { memo } from "react";
import type { RobotRect } from "@/utils/typing";
import XcGroup from "./XcGroup";
import XpGroup from "./XpGroup";

export interface RobotGroupProps {
    visible: boolean;
    robotsState: RobotRect[];
}

export default memo((props: RobotGroupProps) => {

    const { visible, robotsState } = props;

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
                        pathFill,
                        strokeStyle,
                        omega,
                        vx,
                        vy,
                        localizationScore,
                        errorEntryList
                    } = robot;

                    if (type === 1) {
                        // 叉车
                        return (
                            <XcGroup
                                key={robot.agvKey}
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
                                strokeStyle={strokeStyle}
                                omega={omega}
                                vx={vx}
                                vy={vy}
                                visible={visible}
                                localizationScore={localizationScore}
                                errorEntryList={errorEntryList}
                            />
                        )
                    } else {
                        // 非叉车
                        return (
                            <XpGroup
                                key={robot.agvKey}
                                agvKey={agvKey}
                                x={x}
                                y={y}
                                theta={theta}
                                agvName={agvName}
                                length={length}
                                centerOffset={centerOffset}
                                width={width}
                                batteryCharge={batteryCharge}
                                loaded={loaded}
                                orderTaskKey={orderTaskKey}
                                robotFill={robotFill}
                                pathFill={pathFill}
                                strokeStyle={strokeStyle}
                                vehicleProcStatus={vehicleProcStatus}
                                visible={visible}
                                localizationScore={localizationScore}
                                errorEntryList={errorEntryList}
                            />
                        )
                    }
                })
            }
        </>
    )
});
