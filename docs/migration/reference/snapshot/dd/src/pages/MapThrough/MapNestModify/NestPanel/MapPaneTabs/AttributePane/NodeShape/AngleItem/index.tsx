/**
 * @description 节点的角度
 * @date 2025-7-11
 */
import { useEffect } from "react";
import { Form, InputNumber } from "antd";
import type { InputNumberProps } from "antd";
import Konva from "konva";
import { radToDeg, degToRad } from "@/utils/public";
import { computeRotateArrow } from "@/utils/graph";
import { selectedState } from "@/plugins/konva/state/selected";
import { useI18n } from "@/hooks/useI18n";

interface AngleItemProps {
    selectShapes: Konva.Shape[];
}

export default (props: AngleItemProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const onAngleChange: InputNumberProps["onChange"] = (value) => {
        const rad = degToRad(value as number || 0);
        selectShapes.forEach(shape => {
            const { shapeStyle: { radius }, data: { angle, arrowPoints, ...rest } } = shape.attrs;
            const updateArrowPoints = computeRotateArrow(radius / selectedState.radius, -(rad || 0));
            shape.setAttrs({
                data: {
                    ...rest,
                    angle: rad || value,
                    arrowPoints: value === null ? null : updateArrowPoints
                }
            });
        })
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { data: { angle } } = shape.attrs;
        form.setFieldValue("angle", angle === 0 ? 0 : radToDeg(angle) || null);
    }, [selectShapes])

    return (
        <Form.Item
            noStyle
            shouldUpdate={(preValues, curValues) => preValues.type !== curValues.type}
        >
            {
                ({ getFieldValue }) => (
                    getFieldValue("type") !== "node" ? (
                        <Form.Item
                            label={t("角度")}
                            name="angle"
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                min={-180}
                                max={180}
                                precision={5}
                                onChange={onAngleChange}
                            />
                        </Form.Item>
                    ) : null
                )
            }
        </Form.Item>
    )
};
