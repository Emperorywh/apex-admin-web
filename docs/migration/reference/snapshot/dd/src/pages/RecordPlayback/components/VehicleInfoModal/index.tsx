/**
 * @description 录制回放-车辆详情弹窗
 *              录制回放场景下，车辆详情不走接口，直接取当前帧（vehicles）里对应车辆的状态，
 *              随着播放帧的推进，弹窗内容也会跟随更新。
 * @date 2026-4-17
 */
import { useMemo } from "react";
import { Descriptions, Modal } from "antd";
import type { DescriptionsProps } from "antd";
import { transformVehicleInfo } from "@/utils/public";
import type { SimpleVehiclePushRecord } from "@/types/PlaybackTypings";
import type { GetVehicleStateData } from "@/types/OverLook";
import { useI18n } from "@/hooks/useI18n";

interface VehicleInfoModalProps {
    open: boolean;
    vehicleKey: string;
    vehicles?: SimpleVehiclePushRecord[];
    onClose: () => void;
    getContainer?: () => HTMLElement;
}

// 不适合在描述列表中展示的字段（数据量大或展示意义不大）
const EXCLUDE_KEYS: Array<keyof SimpleVehiclePushRecord> = ["trafficShapeResources"];

export default (props: VehicleInfoModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, vehicleKey, vehicles, onClose, getContainer } = props;

    const items = useMemo<DescriptionsProps["items"]>(() => {
        if (!open || !vehicleKey || !vehicles?.length) return [];
        const vehicle = vehicles.find(v => v.agvKey === vehicleKey);
        if (!vehicle) return [];
        const filtered: Record<string, unknown> = {};
        (Object.keys(vehicle) as Array<keyof SimpleVehiclePushRecord>).forEach(key => {
            if (!EXCLUDE_KEYS.includes(key)) {
                filtered[key] = vehicle[key];
            }
        });
        return transformVehicleInfo(filtered as unknown as GetVehicleStateData).map(item => ({
            ...item,
            label: t(item.label as string),
            children: typeof item.children === "string" ? t(item.children) : item.children
        }));
    }, [open, vehicleKey, vehicles]);

    return (
        <Modal
            title={t("车辆详情（当前帧）")}
            open={open}
            onCancel={onClose}
            footer={null}
            width={1000}
            destroyOnClose
            getContainer={getContainer}
        >
            <Descriptions
                size="small"
                bordered
                column={2}
                items={items}
            />
        </Modal>
    );
};
