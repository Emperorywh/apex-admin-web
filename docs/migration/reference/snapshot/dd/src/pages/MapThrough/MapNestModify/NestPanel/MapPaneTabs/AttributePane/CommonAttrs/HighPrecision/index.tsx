/**
 * @description 高精度标记，标记元素是否为高精度定位点，可批量编辑
 * @date 2026-07-14
 */
import { useEffect } from "react";
import { Form, Radio } from "antd";
import type { RadioGroupProps } from "antd";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface HighPrecisionProps {
    selectShapes: Konva.Shape[];
}

export default (props: HighPrecisionProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    /**
     * 将单选框的布尔值写回每一个被选中的元素。
     * attrs.data 是属性保存边界，保存地图时会从这里汇总元素数据。
     */
    const onHighPrecisionChange: RadioGroupProps["onChange"] = ({ target: { value } }) => {
        if (!selectShapes?.length) return;
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape;
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    highPrecision: value
                }
            });
        });
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        /**
         * 字段的领域默认值为 false。
         * 表单始终回显明确布尔值，避免单选框出现无选中状态。
         * 属性面板以第一个选中元素作为回显来源，
         * 变更时再同步到所有选中元素，保持和其它批量属性项一致。
         */
        const { attrs: { data } } = shape;
        form.setFieldValue("highPrecision", data?.highPrecision ?? false);
    }, [selectShapes]);

    return (
        <Form.Item
            label={t("高精度标记")}
            name="highPrecision"
        >
            <Radio.Group
                name="highPrecision"
                options={[
                    { value: true, label: t("是") },
                    { value: false, label: t("否") }
                ]}
                onChange={onHighPrecisionChange}
            />
        </Form.Item>
    );
};
