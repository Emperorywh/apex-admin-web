/**
 * @description 传感器避障的选项
 * @date 2025-8-12
 */
import { useEffect } from "react";
import { Form, InputNumber } from "antd";
import type { InputNumberProps } from "antd";
import type Konva from "konva";
// import { avoidMapList } from "@/constants/MapNestModify";
import { useI18n } from "@/hooks/useI18n";

interface AvoidMapProps {
    selectShapes: Konva.Shape[];
}

export default (props: AvoidMapProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const onAvoidMapChange: InputNumberProps["onChange"] = (value) => {
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape;
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    avoidMap: value
                }
            });
        })
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data } } = shape;
        form.setFieldValue("avoidMap", data?.avoidMap || null);
    }, [selectShapes])

    return (
        <Form.Item
            label={t("避障范围")}
            name="avoidMap"
        >
            <InputNumber
                precision={0}
                placeholder={t("请选择避障范围")}
                style={{ width: "100%" }}
                onChange={onAvoidMapChange}
            />
        </Form.Item>
    )
};
