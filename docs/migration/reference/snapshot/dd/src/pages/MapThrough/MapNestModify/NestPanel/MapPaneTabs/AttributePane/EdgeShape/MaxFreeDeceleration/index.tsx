/**
 * @description 最大空载减速度
 * @date 2026-1-12
 */
import { useEffect } from "react";
import { Form, InputNumber } from "antd";
import type { InputNumberProps } from "antd";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface MaxFreeDecelerationProps {
    selectShapes: Konva.Shape[];
}

export default (props: MaxFreeDecelerationProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const onMaxFreeDecelerationChange: InputNumberProps["onChange"] = (value) => {
        if (!selectShapes?.length) return;
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    maxFreeDeceleration: value
                }
            })
        })
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data: { maxFreeDeceleration } } } = shape;
        form.setFieldValue("maxFreeDeceleration", maxFreeDeceleration);
    }, [selectShapes])

    return (
        <Form.Item
            name="maxFreeDeceleration"
            label={t("最大空载减速度")}
        >
            <InputNumber
                placeholder={t("请输入最大空载减速度")}
                style={{ width: "100%" }}
                min={0}
                onChange={onMaxFreeDecelerationChange}
            />
        </Form.Item>
    )
};
