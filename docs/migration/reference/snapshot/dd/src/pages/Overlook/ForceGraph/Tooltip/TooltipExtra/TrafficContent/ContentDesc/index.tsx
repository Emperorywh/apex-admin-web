/**
 * @description 交管原因的描述列表
 * @date 2025-9-26
 */
import { Descriptions, Button, message } from "antd";
import type { DescriptionsProps } from "antd";
import { clearVehicleTraffics } from "@/api";
import { useI18n } from "@/hooks/useI18n";

interface ContentDescProps {
    trafficItems: DescriptionsProps["items"];
}

export default (props: ContentDescProps) => {

    const { trafficItems } = props;

    /* 国际化翻译方法，用于将交管原因描述列表的标题和按钮进行多语言转换 */
    const { t } = useI18n();

    const handleClearTargetVehicle = () => {
        const target = trafficItems?.find(item => item.key === "lockedVehicleKey");
        if (!target) return;
        clearVehicleTraffics({ vehicleKey: target?.children as string }).then(res => {
            if (res.code === 200 && res.message === "success") {
                message.success(t("清除车辆交管资源成功"));
            } else {
                message.warning(t("清除车辆交管资源出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("清除车辆交管资源出错") + err?.message);
            }
        })
    };

    return (
        <Descriptions
            style={{ width: 300 }}
            column={1}
            items={trafficItems}
            size="small"
            title={t("交管原因")}
            extra={
                <Button
                    type="dashed"
                    danger
                    // disabled={!(!!trafficItems?.find(i => i.key === "lockedVehicleKey")?.children)}
                    onClick={handleClearTargetVehicle}
                >
                    {t("清除占用车辆")}
                </Button>
            }
        />
    )
};
