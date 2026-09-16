/**
 * @description 路径的行驶方向
 * @date 2025-7-26
 */
import { useEffect } from "react";
import { Form, Radio } from "antd";
import type { RadioGroupProps } from "antd";
import type Konva from "konva";
import { forwardPath } from "@/plugins/konva/path/forwardPath";
import { reversePath } from "@/plugins/konva/path/reversePath";
import { selectedState } from "@/plugins/konva/state/selected";
import { useI18n } from "@/hooks/useI18n";

interface IsBackEdgeProps {
    selectShapes: Konva.Shape[];
}

export default (props: IsBackEdgeProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const onIsBackEdgeChange: RadioGroupProps["onChange"] = ({ target: { value } }) => {
        // 批量设置路径方向
        if (!selectShapes?.length) return;
        selectShapes.forEach(shape => {
            const { attrs: { shapeStyle, data } } = shape;
            const stroke = value ? reversePath.stroke : forwardPath.stroke;
            const labelFill = value ? reversePath.labelFill : forwardPath.labelFill;
            // 定义路径宽度
            const lineWidth = value ? reversePath.lineWidth : forwardPath.lineWidth;
            shape.setAttrs({
                shapeStyle: {
                    ...(shapeStyle || {}),
                    labelFill,
                    stroke,
                    lineWidth: lineWidth * selectedState.lineWidth
                },
                data: {
                    ...(data || {}),
                    isBackEdge: value
                }
            });
        })
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data: { isBackEdge } } } = shape;
        form.setFieldValue("isBackEdge", isBackEdge);
    }, [selectShapes])

    return (
        <Form.Item
            label={t("路径方向")}
            name="isBackEdge"
        >
            <Radio.Group
                name="isBackEdge"
                options={[
                    { value: false, label: t("正向路径") },
                    { value: true, label: t("反向路径") }
                ]}
                onChange={onIsBackEdgeChange}
            />
        </Form.Item>
    )
};
