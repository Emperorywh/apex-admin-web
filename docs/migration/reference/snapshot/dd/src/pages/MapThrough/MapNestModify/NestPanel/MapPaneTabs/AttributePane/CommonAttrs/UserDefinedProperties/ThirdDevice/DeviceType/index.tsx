/**
 * @description 三方设备类型 可以批量设置
 * @date 2025-7-24
 */
import { useEffect } from "react";
import { Form, Select } from "antd";
import type { SelectProps } from "antd";
import { deviceTypes, chargeStationDeviceTypes } from "@/constants/mapThrough";
import { refreshDeviceIcons } from "@/plugins/konva/devices";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface DeviceTypeProps {
    selectShapes: Konva.Shape[];
}

export default (props: DeviceTypeProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const onDeviceTypeChange: SelectProps["onChange"] = (value) => {
        /**
         * 改变设备类型的时候要把设备，申请动作，释放动作置空
         * 当选择交通灯时，自动设置隐藏字段 applyDeviceOperationType 为 TRAFFIC_LIGHT
         */
        const isTrafficLight = value === "trafficLight";
        form.setFieldsValue({
            deviceKey: undefined,
            applyDeviceOperationType: isTrafficLight ? "TRAFFIC_LIGHT" : undefined,
            releaseDeviceOperationType: undefined,
            // 风淋门专属「是否离开」字段：选风淋门时默认 false，切到其他类型时清空避免脏数据残留
            leavedEdge: value === "airShowerDoor" ? "false" : undefined
        });
        selectShapes.forEach(shape => {
            const { attrs: { data: { userDefinedProperties } } } = shape;
            shape.setAttrs({
                data: {
                    ...(shape.attrs?.data || {}),
                    userDefinedProperties: {
                        ...(userDefinedProperties || {}),
                        deviceType: value || undefined,
                        deviceKey: undefined,
                        applyDeviceOperationType: isTrafficLight ? "TRAFFIC_LIGHT" : undefined,
                        releaseDeviceOperationType: undefined,
                        // 风淋门默认 false，其他类型清空
                        leavedEdge: value === "airShowerDoor" ? "false" : undefined
                    }
                }
            });
        })
        // 修改设备类型后立即重绘三方设备图标（新增/删除/更换类型）。
        // 命令式 setAttrs 不会触发 React edges 重建，必须主动刷新设备图标 Layer，
        // 否则需刷新页面重新加载地图才会出现/消失图标。
        const stage = selectShapes[0]?.getStage();
        if (stage) refreshDeviceIcons(stage);
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data: { userDefinedProperties } } } = shape;
        form.setFieldValue("deviceType", userDefinedProperties?.deviceType || undefined);
    }, [selectShapes])

    return (
        <Form.Item
            label={t("设备类型")}
            name="deviceType"
        >
            <Select
                placeholder={t("请选择三方设备类型")}
                allowClear
                options={(selectShapes.every(shape => shape.attrs?.data?.type === "charge") ? chargeStationDeviceTypes : deviceTypes)?.map(o => ({ ...o, label: t(o.label as string) }))}
                onChange={onDeviceTypeChange}
            />
        </Form.Item>
    )
};
