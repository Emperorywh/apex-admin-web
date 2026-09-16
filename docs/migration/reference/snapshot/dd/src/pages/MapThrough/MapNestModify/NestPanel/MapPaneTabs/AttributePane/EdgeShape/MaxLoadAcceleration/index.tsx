/**
 * @description 
 * @date 2025-1-12
 */
import { useEffect } from "react";
import { Form, InputNumber } from "antd";
import type { InputNumberProps } from "antd";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface MaxLoadAccelerationProps {
    selectShapes: Konva.Shape[];
}

export default (props: MaxLoadAccelerationProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const onMaxLoadAccelerationChange: InputNumberProps["onChange"] = (value) => {
        if (!selectShapes?.length) return;
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    maxLoadAcceleration: value
                }
            })
        })
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data: { maxLoadAcceleration } } } = shape;
        form.setFieldValue("maxLoadAcceleration", maxLoadAcceleration);
    }, [selectShapes])

    return (
        <Form.Item
            name="maxLoadAcceleration"
            label={t("最大载货加速度")}
        >
            <InputNumber
                placeholder={t("请输入最大载货加速度")}
                style={{ width: "100%" }}
                min={0}
                onChange={onMaxLoadAccelerationChange}
            />
        </Form.Item>
    )
};
