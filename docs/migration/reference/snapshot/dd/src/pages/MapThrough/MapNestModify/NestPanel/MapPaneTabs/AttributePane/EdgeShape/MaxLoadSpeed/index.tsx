/**
 * @description agv载货最大速度
 * @date 2026-1-12
 */
import { useEffect } from "react";
import { Form, InputNumber } from "antd";
import type { InputNumberProps } from "antd";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface MaxLoadSpeedProps {
    selectShapes: Konva.Shape[];
}

export default (props: MaxLoadSpeedProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const onMaxLoadSpeedChange: InputNumberProps["onChange"] = (value) => {
        if (!selectShapes?.length) return;
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    maxLoadSpeed: value
                }
            })
        })
    };

    /**
     * 选中路径时，将真实值回填到表单
     * 新建路径的默认值由 defaultPathProperty 控制（maxLoadSpeed=1）
     * 此处仅展示真实数据，不做伪装，避免界面显示1但数据库为null的问题
     */
    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data } } = shape;
        form.setFieldValue("maxLoadSpeed", data?.maxLoadSpeed);
    }, [selectShapes])

    return (
        <Form.Item
            name="maxLoadSpeed"
            label={t("agv载货最大速度")}
        >
            <InputNumber
                placeholder={t("请输入agv载货最大速度")}
                style={{ width: "100%" }}
                min={0}
                max={2}
                onChange={onMaxLoadSpeedChange}
            />
        </Form.Item>
    )
};
