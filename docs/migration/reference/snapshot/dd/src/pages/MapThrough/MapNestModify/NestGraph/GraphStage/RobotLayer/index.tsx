/**
 * @description 显示车辆图层的Layer 需要频繁更新
 * @date 2025-5-26
 */
import { useEffect, useState, memo } from "react";
import { message } from "antd";
import { Layer } from "react-konva";
import { useWebSocketContext } from "@/socket";
import { transformTrafficInfo } from "@/utils/graph";
import type { SocketDispatcherState, RobotRect } from "@/utils/typing";
import RobotGroup from "./RobotGroup";
import { useI18n } from "@/hooks/useI18n";

interface RobotLayerProps {
    useMapId: string;
    visible: boolean;
}

export default memo((props: RobotLayerProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { useMapId, visible } = props;

    const { lastMessage, sendMessage, readyState } = useWebSocketContext();

    // 车辆的运行状态
    const [robotsState, setRobotsState] = useState<RobotRect[]>([]);

    useEffect(() => {
        if (lastMessage) {
            try {
                const data: SocketDispatcherState = JSON.parse(lastMessage.data);
                // console.log("websocket收到的消息", data);
                const { robots } = transformTrafficInfo(data);
                setRobotsState(robots);
            } catch (error) {
                message.warning(t("解析车辆数据失败") + error);
            }
        }
    }, [lastMessage])

    useEffect(() => {
        if (useMapId && readyState === 1) {
            sendMessage(useMapId);
        }
    }, [useMapId, readyState])

    return (
        <Layer listening={true}>
            <RobotGroup
                visible={visible}
                robotsState={robotsState}
            />
            {/* <TrafficGroup
                applyingPath={applyingPath}
                lockedPath={lockedPath}
                overlayVisible={overlayVisible}
            /> */}
        </Layer>
    )
});
