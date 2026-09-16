/**
 * @description 节点的最大旋转角度
 * @date 2026-4-30
 */
import { useEffect } from "react";
import { Form, InputNumber } from "antd";
import type { InputNumberProps } from "antd";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface MaxRotateAngleProps {
    selectShapes: Konva.Shape[];
}

export default (props: MaxRotateAngleProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const onMaxRotateAngleChange: InputNumberProps["onChange"] = (value) => {
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape;
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    maxRotateAngle: value
                }
            });
        })
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { data: { maxRotateAngle } } = shape.attrs;
        form.setFieldValue("maxRotateAngle", typeof maxRotateAngle === "number" ? maxRotateAngle : null);
    }, [selectShapes])

    return (
        <Form.Item
            noStyle
            shouldUpdate={(preValues, curValues) => preValues.type !== curValues.type}
        >
            <Form.Item
                label={t("最大旋转角度")}
                name="maxRotateAngle"
            >
                <InputNumber
                    style={{ width: "100%" }}
                    min={0}
                    max={360}
                    step={1}
                    precision={0}
                    onChange={onMaxRotateAngleChange}
                />
            </Form.Item>
        </Form.Item>
    )
};
