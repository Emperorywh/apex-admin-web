/**
 * @description 路径的载货状态 支持批量设置
 * @date 2025-7-23
 */
import { useEffect } from "react";
import { Form, Select } from "antd";
import type { SelectProps } from "antd";
import { loadTypes } from "@/constants/mapThrough";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface LoadTypeProps {
    selectShapes: Konva.Shape[];
}

export default (props: LoadTypeProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const onLoadTypeChange: SelectProps["onChange"] = (value) => {
        if (!selectShapes?.length) return;
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape;
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    loadType: value || 0
                }
            });
        })
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data: { loadType } } } = shape;
        form.setFieldValue("loadType", loadType);
    }, [selectShapes])

    return (
        <Form.Item
            label={t("载货状态")}
            name="loadType"
        >
            <Select
                placeholder={t("请选择路径的载货状态")}
                options={loadTypes?.map(o => ({ ...o, label: t(o.label as string) }))}
                onChange={onLoadTypeChange}
            />
        </Form.Item>
    )
};
