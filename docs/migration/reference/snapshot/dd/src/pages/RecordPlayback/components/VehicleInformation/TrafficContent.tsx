import { useState, memo } from "react";
import { Popover, message, Descriptions, Button } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import type { PopoverProps, DescriptionsProps } from "antd";
import { getLocalTrafficReason, clearVehicleTraffics } from "@/api";
import { useI18n } from "@/hooks/useI18n";

interface TrafficContentProps {
    vehicleKey?: string;
    vehicleProcStatus?: string;
    mapId?: string;
    ts?: number;
    recordId?: number;
}

// 交管原因查看组件
const TrafficContent = memo((props: TrafficContentProps) => {
    const { vehicleKey, vehicleProcStatus, mapId, ts, recordId } = props;
    /* 国际化翻译方法 */ const { t } = useI18n();
    // 交管详情描述列表
    const [trafficItems, setTrafficItems] = useState<DescriptionsProps["items"]>([]);

    // 弹出框打开时查询交管原因
    const onPopoverOpenChange: PopoverProps["onOpenChange"] = (open) => {
        if (!open || !vehicleKey || !mapId || !ts) return;
        getLocalTrafficReason({ mapId, vehicleKey, ts, ...(recordId != null ? { recordId } : {}) }).then(res => {
            if (res.code === 200 && res.data) {
                setTrafficItems([
                    {
                        key: "trafficType",
                        label: t("类型"),
                        children: res.data.trafficTypeName
                    },
                    {
                        key: "params",
                        label: t("位置"),
                        children: res.data.params?.toString()
                    },
                    {
                        key: "time",
                        label: t("时间"),
                        children: res.data.time
                    },
                    {
                        key: "trafficDetail",
                        label: t("详情"),
                        children: res.data.trafficDetail
                    },
                    {
                        key: "lockedVehicle",
                        label: t("占用车辆"),
                        children: res.data.lockedVehicle?.name
                    },
                    {
                        key: "lockedVehicleKey",
                        label: t("占用标识"),
                        children: res.data.lockedVehicle?.key
                    }
                ]);
            } else {
                message.warning(t("查询交管原因出错") + (res.message ? `: ${res.message}` : ''));
            }
        }).catch(err => {
            message.error(t("查询交管原因出错") + (err?.message ? `: ${err.message}` : ''));
        });
    };

    return (
        <Popover
            content={
                <Descriptions
                    style={{ width: 300 }}
                    column={1}
                    items={trafficItems}
                    size="small"
                    title={t("交管原因")}
                />
            }
            trigger="click"
            onOpenChange={onPopoverOpenChange}
        >
            <QuestionCircleOutlined
                style={{ visibility: vehicleProcStatus === "TRAFFIC" ? "visible" : "hidden", cursor: 'pointer' }}
            />
        </Popover>
    );
});

export default TrafficContent;
