/**
 * @description 离开三方设备的释放动作
 * @date 2025-7-24
 * @argument 三方设备对应的释放操作 autoDoor  => CLOSE_DOOR, airShowerDoor:   CLOSE_FONT_DOOR/CLOSE_BACK_DOOR , elevator: CLOSE_ELEVATOR_DOOR
 */
import { useEffect } from "react";
import { Form, Select } from "antd";
import type { SelectProps } from "antd";
import { releaseDeviceAirShowerDoorTypes, releaseDeviceAutoDoorTypes, releaseDeviceElevatorTypes } from "@/constants/mapThrough";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface ReleaseDeviceOperationTypeProps {
    selectShapes: Konva.Shape[];
}

export default (props: ReleaseDeviceOperationTypeProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();
    const deviceType = Form.useWatch("deviceType", form);

    const onReleaseChange: SelectProps["onChange"] = (value) => {
        if (!selectShapes?.length) return;
        selectShapes.forEach(shape => {
            const { attrs: { data: { userDefinedProperties } } } = shape;
            shape.setAttrs({
                data: {
                    ...(shape.attrs?.data || {}),
                    userDefinedProperties: {
                        ...(userDefinedProperties || {}),
                        releaseDeviceOperationType: value || undefined
                    }
                }
            });
        })
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data: { userDefinedProperties } } } = shape;
        form.setFieldValue("releaseDeviceOperationType", userDefinedProperties?.releaseDeviceOperationType || undefined);
    }, [selectShapes])

    return (
        <Form.Item
            noStyle
            shouldUpdate={(preValues, curValues) => preValues.deviceKey !== curValues.deviceKey}
        >
            {
                ({ getFieldValue }) => (
                    getFieldValue("deviceType") !== "chargePile" && getFieldValue("deviceType") !== "trafficLight" && getFieldValue("deviceKey") ? (
                        <Form.Item
                            label={t("释放动作")}
                            name="releaseDeviceOperationType"
                            /**
                             * 释放动作必填：选择了三方设备类型与设备 Key 后，
                             * 若未配置释放动作，调度交管会缺失离开设备的动作指令，
                             * 可能导致设备状态未复位而引发安全隐患，故强制必填。
                             */
                            rules={[{ required: true, message: t("请选择释放动作") }]}
                        >
                            <Select
                                allowClear
                                placeholder={t("请选择离开设备时的动作")}
                                options={
                                    (deviceType === "autoDoor" ? releaseDeviceAutoDoorTypes : deviceType === "elevator" ? releaseDeviceElevatorTypes : releaseDeviceAirShowerDoorTypes)?.map(o => ({ ...o, label: t(o.label as string) }))
                                }
                                onChange={onReleaseChange}
                            />
                        </Form.Item>
                    ) : null
                )
            }
        </Form.Item>
    )
};
