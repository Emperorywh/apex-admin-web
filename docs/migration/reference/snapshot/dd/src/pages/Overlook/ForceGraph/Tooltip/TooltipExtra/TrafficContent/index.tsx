/**
 * @description 交管原因的内容
 * @date 2025-9-26
 */
import { useState, memo } from "react";
import { Popover, message } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import type { PopoverProps, DescriptionsProps } from "antd";
import { getTrafficReason } from "@/api";
import ContentDesc from "./ContentDesc";
import { useI18n } from "@/hooks/useI18n";

interface TrafficContentProps {
    vehicleKey?: string;
    vehicleProcStatus?: string;
}

export default memo((props: TrafficContentProps) => {

    const { vehicleKey, vehicleProcStatus } = props;

    /* 国际化翻译方法，用于将交管原因描述列表的标签进行多语言转换 */
    const { t } = useI18n();

    const [trafficItems, setTrafficItems] = useState<DescriptionsProps["items"]>([]);

    // 查看当前车的交管原因
    const onPopoverOpenChange: PopoverProps["onOpenChange"] = (open) => {
        if (!open || !vehicleKey) return;
        getTrafficReason({ vehicleKey }).then(res => {
            if (res.code === 200 && res.message === "success") {
                setTrafficItems([
                    {
                        key: "trafficType",
                        label: t("类型"),
                        children: res?.data?.trafficTypeName
                    },
                    {
                        key: "params",
                        label: t("位置"),
                        children: res?.data?.params?.toString()
                    },
                    {
                        key: "time",
                        label: t("时间"),
                        children: res?.data?.time
                    },
                    {
                        key: "trafficDetail",
                        label: t("详情"),
                        children: res?.data?.trafficDetail
                    },
                    {
                        key: "lockedVehicle",
                        label: t("占用车辆"),
                        children: res?.data?.lockedVehicle?.name
                    },
                    {
                        key: "lockedVehicleKey",
                        label: t("占用标识"),
                        children: res?.data?.lockedVehicle?.key
                    }
                ]);
            } else {
                message.warning(t("查询交管原因出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询交管原因出错") + err?.message);
            }
        })
    };

    return (
        <Popover
            content={() => <ContentDesc trafficItems={trafficItems} />}
            trigger="click"
            onOpenChange={onPopoverOpenChange}
        >
            <QuestionCircleOutlined
                style={{ visibility: vehicleProcStatus === "TRAFFIC" ? "visible" : "hidden" }}
            />
        </Popover>
    )
});
