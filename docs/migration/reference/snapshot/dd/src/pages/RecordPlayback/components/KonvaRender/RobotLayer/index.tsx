/**
 * 车辆图层，需要频繁更新
 */
import { useEffect, useState, memo } from "react";
import { Layer } from "react-konva";
import { transformTrafficInfo } from "@/utils/graph";
import type { RobotRect, TrafficPath } from "@/utils/typing";
import type { OverlayVisible } from "@/types/OverLook";
import Coordinate from "@/components/Coordinate";
import { PlaybackFrameDTO } from "@/types/PlaybackTypings";
import RobotGroup from "@/pages/Overlook/ForceGraph/GraphStage/RobotLayer/RobotGroup";
import TrafficGroup from "@/pages/Overlook/ForceGraph/GraphStage/RobotLayer/TrafficGroup";

interface RobotLayerProps {
    overlayVisible: OverlayVisible;
    currentFrame: PlaybackFrameDTO | null;
    /** 当前锁定/聚焦的车辆 agvKey */
    focusId?: string;
    /**
     * 交管白名单：仅渲染 agvKey ∈ 此集合的交管路径。
     * 空 / undefined = 全显（TrafficGroup 内短路）。
     * 共用 Overlook 的 TrafficGroup，改一处覆盖两页（SPEC §5.2）。
     */
    visibleAgvKeys?: string[];
}

export default memo((props: RobotLayerProps) => {

    const { overlayVisible, currentFrame, focusId, visibleAgvKeys } = props;

    // 车辆的运行状态
    const [robotsState, setRobotsState] = useState<RobotRect[]>([]);
    // 申请区
    const [applyingPath, setApplyingPath] = useState<TrafficPath[]>([]);
    // 解锁区
    const [lockedPath, setLockedPath] = useState<TrafficPath[]>([]);

    // 当前帧变化时，解析车辆和交管数据
    useEffect(() => {
        if (currentFrame) {
            const { robots, applyingPath, lockedPath } = transformTrafficInfo({
                vehicles: currentFrame.vehicles as any,
                orderRecords: [],
            });
            setRobotsState(robots);
            setApplyingPath(applyingPath);
            setLockedPath(lockedPath);
        } else {
            setRobotsState([]);
            setApplyingPath([]);
            setLockedPath([]);
        }
    }, [currentFrame])

    return (
        <Layer listening={true}>
            <RobotGroup
                robotsState={robotsState}
                overlayVisible={overlayVisible.robot}
                focusId={focusId}
            />
            <TrafficGroup
                applyingPath={applyingPath}
                lockedPath={lockedPath}
                overlayVisible={overlayVisible}
                visibleAgvKeys={visibleAgvKeys}
            />
            <Coordinate />
        </Layer>
    )
});
