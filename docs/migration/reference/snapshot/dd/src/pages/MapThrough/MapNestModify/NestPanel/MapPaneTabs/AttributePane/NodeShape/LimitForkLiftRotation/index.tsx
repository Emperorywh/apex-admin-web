/**
 * @description 节点是否限制叉车旋转
 * @date 2026-05-18
 */
import { useEffect } from "react";
import { Form, Radio } from "antd";
import type { RadioGroupProps } from "antd";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface LimitForkLiftRotationProps {
    selectShapes: Konva.Shape[];
}

export default (props: LimitForkLiftRotationProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    /**
     * 将单选框的布尔值写回每一个被选中的节点。
     * attrs.data 是节点属性保存边界，保存地图时会从这里汇总节点数据。
     */
    const onLimitForkLiftRotationChange: RadioGroupProps["onChange"] = ({ target: { value } }) => {
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape;
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    enableLimitForkLiftRotation: value
                }
            });
        });
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        /**
         * 字段的领域默认值为 true
         * 表单始终回显明确布尔值，避免单选框出现无选中状态。
         */
        const { data: { enableLimitForkLiftRotation = true } } = shape.attrs;
        /**
         * 属性面板以第一个选中节点作为回显来源。
         * 变更时再同步到所有选中节点，保持和其它批量属性项一致。
         */
        form.setFieldValue("enableLimitForkLiftRotation", enableLimitForkLiftRotation === false ? false : true);
    }, [selectShapes]);

    return (
        <Form.Item
            noStyle
            shouldUpdate={(preValues, curValues) => preValues.type !== curValues.type}
        >
            <Form.Item
                label={t("限制叉车旋转")}
                name="enableLimitForkLiftRotation"
            >
                <Radio.Group
                    name="enableLimitForkLiftRotation"
                    options={[
                        { value: true, label: t("是") },
                        { value: false, label: t("否") }
                    ]}
                    onChange={onLimitForkLiftRotationChange}
                />
            </Form.Item>
        </Form.Item>
    );
};
