/**
 * @description 车辆详情弹窗组件，基于 VehicleInfo 页面抽离
 * @date 2026-4-8
 */
import { useEffect, useState } from "react";
import { Descriptions, message, Modal } from "antd";
import type { DescriptionsProps } from "antd";
import { transformVehicleInfo } from "@/utils/public";
import { getVehicleState } from "@/api";
import { GetVehicleStateData } from "@/types/OverLook";
import { useWebSocketContext } from "@/socket";
import type { SocketDispatcherState, VehicleType } from "@/utils/typing";
import { useI18n } from "@/hooks/useI18n";

interface VehicleInfoModalProps {
    open: boolean;
    vehicleKey: string;
    onClose: () => void;
}

export default (props: VehicleInfoModalProps) => {

    const { open, vehicleKey, onClose } = props;

    const { t } = useI18n();

    const [items, setItems] = useState<DescriptionsProps["items"]>([]);
    // 车辆完整信息，首屏由接口填充，websocket 负责增量刷新
    const [vehicleState, setVehicleState] = useState<GetVehicleStateData>();
    // 订阅 websocket 推送
    const { lastMessage } = useWebSocketContext();

    useEffect(() => {
        if (open && vehicleKey) {
            getVehicleState({ vehicleKey }).then(res => {
                if (res.code === 200 && res.message === "success") {
                    setVehicleState(res?.data);
                } else {
                    message.warning(t("查询车辆信息出错") + res?.message);
                }
            }).catch(err => {
                if (err) {
                    message.error(t("查询车辆信息出错") + err?.message);
                }
            });
        }
        if (!open) {
            setVehicleState(undefined);
            setItems([]);
        }
    }, [open, vehicleKey]);

    // 监听 websocket 推送，合并实时字段到 vehicleState
    useEffect(() => {
        if (!open || !vehicleKey || !lastMessage) return;
        let data: SocketDispatcherState;
        try {
            data = JSON.parse(lastMessage.data);
        } catch (error) {
            return;
        }
        const vehicle: VehicleType | undefined = data?.vehicles?.find(v => v.agvKey === vehicleKey);
        if (!vehicle) return;
        setVehicleState(prev => ({
            ...(prev || {} as GetVehicleStateData),
            agvKey: vehicle.agvKey,
            agvName: vehicle.agvName,
            type: vehicle.type,
            connectionState: vehicle.connectionState,
            dispatchState: vehicle.dispatchState,
            paused: vehicle.paused,
            loaded: vehicle.loaded,
            vehicleProcStatus: vehicle.vehicleProcStatus,
            batteryState: { ...(prev?.batteryState || {} as GetVehicleStateData["batteryState"]), ...vehicle.batteryState },
            agvDimension: { ...(prev?.agvDimension || {} as GetVehicleStateData["agvDimension"]), ...vehicle.agvDimension },
            agvPosition: { ...(prev?.agvPosition || {} as GetVehicleStateData["agvPosition"]), ...vehicle.agvPosition }
        } as GetVehicleStateData));
    }, [lastMessage, open, vehicleKey]);

    // vehicleState 变化后重算 Descriptions 列表
    useEffect(() => {
        if (!vehicleState) return;
        /* 将车辆详情描述列表的标签与枚举型取值统一翻译为当前语言 */
        setItems(transformVehicleInfo(vehicleState).map(item => ({
            ...item,
            label: t(item.label as string),
            children: typeof item.children === "string" ? t(item.children) : item.children
        })));
    }, [vehicleState]);

    return (
        <Modal
            title={t("车辆详情")}
            open={open}
            onCancel={onClose}
            footer={null}
            width={1000}
            destroyOnClose
        >
            <Descriptions
                size="small"
                bordered
                column={2}
                items={items}
            />
        </Modal>
    )
};
