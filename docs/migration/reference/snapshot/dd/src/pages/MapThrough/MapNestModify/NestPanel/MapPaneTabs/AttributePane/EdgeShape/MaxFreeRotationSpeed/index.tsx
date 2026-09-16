/**
 * @description 最大空载旋转速度
 * @date 2026-1-12
 */
import { useEffect } from "react";
import { Form, InputNumber } from "antd";
import type { InputNumberProps } from "antd";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface MaxFreeRotationSpeedProps {
    selectShapes: Konva.Shape[];
}

export default (props: MaxFreeRotationSpeedProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const onMaxFreeRotationSpeedChange: InputNumberProps["onChange"] = (value) => {
        if (!selectShapes?.length) return;
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    maxFreeRotationSpeed: value
                }
            })
        })
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data: { maxFreeRotationSpeed } } } = shape;
        form.setFieldValue("maxFreeRotationSpeed", maxFreeRotationSpeed);
    }, [selectShapes])

    return (
        <Form.Item
            name="maxFreeRotationSpeed"
            label={t("最大空载旋转速度")}
        >
            <InputNumber
                placeholder={t("请输入最大空载旋转速度")}
                style={{ width: "100%" }}
                min={0}
                onChange={onMaxFreeRotationSpeedChange}
            />
        </Form.Item>
    )
};
