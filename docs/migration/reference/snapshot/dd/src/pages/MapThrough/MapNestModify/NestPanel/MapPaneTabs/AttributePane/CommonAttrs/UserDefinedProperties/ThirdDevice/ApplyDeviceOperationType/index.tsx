/**
 * @description 进入设备时需要做的申请操作
 * @date 2025-7-24
 * @argument 不同的三方设备对应的选项不同  autoDoor  => OPEN_DOOR, airShowerDoor:   OPEN_FONT_DOOR/OPEN_BACK_DOOR/SHOWER , elevator: OUTER_CALL
 */
import { useEffect } from "react";
import { Form, Select } from "antd";
import type { SelectProps } from "antd";
import { applyDeviceAirShowerDoorTypes, applyDeviceAutoDoorTypes, applyDeviceElevatorTypes } from "@/constants/mapThrough";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface ApplyDeviceOperationTypeProps {
    selectShapes: Konva.Shape[];
}

export default (props: ApplyDeviceOperationTypeProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();
    const deviceType = Form.useWatch("deviceType", form);

    const onApplyChange: SelectProps["onChange"] = (value) => {
        if (!selectShapes?.length) return;
        selectShapes.forEach(shape => {
            const { attrs: { data: { userDefinedProperties } } } = shape;
            shape.setAttrs({
                data: {
                    ...(shape.attrs?.data || {}),
                    userDefinedProperties: {
                        ...(userDefinedProperties || {}),
                        applyDeviceOperationType: value || undefined
                    }
                }
            });
        })
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data: { userDefinedProperties } } } = shape;
        form.setFieldValue("applyDeviceOperationType", userDefinedProperties?.applyDeviceOperationType);
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
                            label={t("申请动作")}
                            name="applyDeviceOperationType"
                            /**
                             * 申请动作必填：选择了三方设备类型与设备 Key 后，
                             * 若未配置申请动作，调度交管会缺失进入设备的动作指令，
                             * 可能引发碰撞/死锁等安全隐患，故强制必填。
                             */
                            rules={[{ required: true, message: t("请选择申请动作") }]}
                        >
                            <Select
                                allowClear
                                placeholder={t("请选择设备申请动作")}
                                options={
                                    (deviceType === "autoDoor" ? applyDeviceAutoDoorTypes : deviceType === "elevator" ? applyDeviceElevatorTypes : applyDeviceAirShowerDoorTypes)?.map(o => ({ ...o, label: t(o.label as string) }))
                                }
                                onChange={onApplyChange}
                            />
                        </Form.Item>
                    ) : null
                )
            }
        </Form.Item>
    )
};
