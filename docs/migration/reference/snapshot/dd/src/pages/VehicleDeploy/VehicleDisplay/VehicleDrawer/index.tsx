/**
 * @description 显示车辆详情的抽屉
 * @date 2025-6-26
 */
import { Drawer, Descriptions } from "antd";
import type { DescriptionsProps } from "antd";
import { useI18n } from "@/hooks/useI18n";

interface VehicleDrawerProps {
    open: boolean;
    vehicleInfo: DescriptionsProps["items"];
    setOpenDrawer: (value: React.SetStateAction<boolean>) => void;
}

export default (props: VehicleDrawerProps) => {

    const { open, vehicleInfo, setOpenDrawer } = props;

    /* 国际化翻译方法 */
    const { t } = useI18n();

    const onDrawerClose = () => {
        setOpenDrawer(false);
    };

    return (
        <Drawer
            title={t("车辆详情")}
            onClose={onDrawerClose}
            open={open}
            width={600}
        >
            <Descriptions
                column={1}
                size="small"
                bordered
                items={vehicleInfo}
            />
        </Drawer>
    )
};
