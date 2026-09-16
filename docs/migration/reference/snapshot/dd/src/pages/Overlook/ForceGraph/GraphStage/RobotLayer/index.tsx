/**
 * @description 显示车辆图层的Layer 需要频繁更新
 * @date 2025-5-26
 */
import { useEffect, useState, memo } from "react";
import { message } from "antd";
import { useModel } from "@umijs/max";
import { useI18n } from "@/hooks/useI18n";
import { Layer } from "react-konva";
import { useWebSocketContext } from "@/socket";
import { transformTrafficInfo } from "@/utils/graph";
import type { SocketDispatcherState, RobotRect, TrafficPath } from "@/utils/typing";
import RobotGroup from "./RobotGroup";
import TrafficGroup from "./TrafficGroup";
import type { OverlayVisible } from "@/types/OverLook";
import Coordinate from "@/components/Coordinate";

interface RobotLayerProps {
    overlayVisible: OverlayVisible;
    /**
     * 交管白名单：下传给 TrafficGroup 做交管过滤。
     * 空 / undefined = 全显（TrafficGroup 内短路）。
     */
    visibleAgvKeys?: string[];
    /**
     * 车辆列表上报回调：WebSocket 解析出当前车辆后回调父组件，
     * 供顶部「交管筛选」Select 构建 options（在线 ∪ 已选）。
     * 调用方必须用 useCallback 稳定引用（本组件为 memo，引用变化会击穿），
     * 并在 set 前做 agvKey 集合去抖，避免高频 WS 推送反复重渲染（SPEC §5.4）。
     */
    onVehiclesChange?: (vehicles: { agvKey: string; agvName?: string }[]) => void;
}

export default memo((props: RobotLayerProps) => {

    const { overlayVisible, visibleAgvKeys, onVehiclesChange } = props;

    const { lastMessage, sendMessage, readyState } = useWebSocketContext();
    const { currentMapInfo } = useModel("currentMapInfo");

    /* 国际化翻译方法，用于将 WebSocket 解析错误提示文案进行多语言转换 */
    const { t } = useI18n();

    // 车辆的运行状态
    const [robotsState, setRobotsState] = useState<RobotRect[]>([]);
    // 申请区
    const [applyingPath, setApplyingPath] = useState<TrafficPath[]>([]);
    // 解锁区
    const [lockedPath, setLockedPath] = useState<TrafficPath[]>([]);

    useEffect(() => {
        if (lastMessage) {
            try {
                const data: SocketDispatcherState = JSON.parse(lastMessage.data);
                // console.log("websocket收到的消息", data);
                const { robots, applyingPath, lockedPath } = transformTrafficInfo(data);
                setRobotsState(robots);
                setApplyingPath(applyingPath);
                setLockedPath(lockedPath);
                // 上报当前车辆列表给父组件，供顶部「交管筛选」Select 构建 options（SPEC §5.4）
                onVehiclesChange?.(robots.map(r => ({ agvKey: r.agvKey, agvName: r.agvName })));
            } catch (error) {
                message.warning(t("解析车辆数据失败") + error);
            }
        }
    }, [lastMessage, onVehiclesChange])

    useEffect(() => {
        if (currentMapInfo?.mapId && readyState === 1) {
            sendMessage(currentMapInfo.mapId)
        }
    }, [currentMapInfo?.mapId, readyState])

    return (
        <Layer listening={true}>
            <RobotGroup
                robotsState={robotsState}
                overlayVisible={overlayVisible.robot}
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
