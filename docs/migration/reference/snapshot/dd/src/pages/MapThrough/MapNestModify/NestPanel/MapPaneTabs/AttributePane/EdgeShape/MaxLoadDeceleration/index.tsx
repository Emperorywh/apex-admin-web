/**
 * @description 最大载货减速度
 * @date 2026-1-12
 */
import { useEffect } from "react";
import { Form, InputNumber } from "antd";
import type { InputNumberProps } from "antd";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface MaxLoadDecelerationProps {
    selectShapes: Konva.Shape[];
}

export default (props: MaxLoadDecelerationProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const onMaxLoadDecelerationChange: InputNumberProps["onChange"] = (value) => {
        if (!selectShapes?.length) return;
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    maxLoadDeceleration: value
                }
            })
        })
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data: { maxLoadDeceleration } } } = shape;
        form.setFieldValue("maxLoadDeceleration", maxLoadDeceleration);
    }, [selectShapes])

    return (
        <Form.Item
            name="maxLoadDeceleration"
            label={t("最大载货减速度")}
        >
            <InputNumber
                placeholder={t("请输入最大载货减速度")}
                style={{ width: "100%" }}
                min={0}
                onChange={onMaxLoadDecelerationChange}
            />
        </Form.Item>
    )
};
