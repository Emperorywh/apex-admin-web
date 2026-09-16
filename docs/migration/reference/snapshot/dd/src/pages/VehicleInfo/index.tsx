/**
 * @description 车辆详情
 * @date 2025-6-24
 */
import { useEffect, useState } from "react";
import { useLocation } from "@umijs/max";
import { Descriptions, message } from "antd";
import type { DescriptionsProps } from "antd";
import { transformStringToJson } from "@/utils/format";
import { transformVehicleInfo } from "@/utils/public";
import { getVehicleState } from "@/api";
import { GetVehicleStateData } from "@/types/OverLook";
import { useI18n } from "@/hooks/useI18n";

export default () => {

    /* 国际化翻译方法，用于将车辆详情页的文案进行多语言转换 */
    const { t } = useI18n();

    const [items, setItems] = useState<DescriptionsProps["items"]>([]);
    const location = useLocation();

    useEffect(() => {
        if (location.search) {
            const vehicleKey = location.search.substring(1);
            if (!vehicleKey) return;
            getVehicleState({ vehicleKey }).then(res => {
                if (res.code === 200 && res.message === "success") {
                    const data: GetVehicleStateData = res?.data;
                    const desctiptions = transformVehicleInfo(data);
                    /* 将描述列表中的标签翻译为当前语言 */
                    const translated = desctiptions.map(item => ({
                        ...item,
                        label: t(item.label as string),
                        children: typeof item.children === "string" ? t(item.children) : item.children
                    }));
                    setItems(translated);
                } else {
                    message.warning(t("查询车辆信息出错") + res?.message);
                }
            }).catch(err => {
                if (err) {
                    message.error(t("查询车辆信息出错") + err?.message);
                }
            })
        }
    }, [location.search])

    return (
        <Descriptions
            style={{ padding: 20 }}
            title={t("车辆详情")}
            size="small"
            column={3}
            bordered
            items={items}
        />
    )
};
