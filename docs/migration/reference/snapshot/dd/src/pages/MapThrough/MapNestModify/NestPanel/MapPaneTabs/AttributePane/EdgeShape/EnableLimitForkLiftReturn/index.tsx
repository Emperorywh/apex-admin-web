/**
 * @description 限制车辆回归开关，控制路径是否限制车辆回归
 * @date 2026-5-29
 */
import { useEffect } from "react";
import { Form, Switch } from "antd";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface EnableLimitForkLiftReturnProps {
    selectShapes: Konva.Shape[];
}

export default (props: EnableLimitForkLiftReturnProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const onChange = (value: boolean) => {
        if (!selectShapes?.length) return;
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape;
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    enableLimitForkLiftReturn: value
                }
            });
        });
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data } } = shape;
        form.setFieldValue("enableLimitForkLiftReturn", data?.enableLimitForkLiftReturn ?? false);
    }, [selectShapes]);

    return (
        <Form.Item
            label={t("限制车辆回归")}
            name="enableLimitForkLiftReturn"
            valuePropName="checked"
        >
            <Switch onChange={onChange} checkedChildren={t("是")} unCheckedChildren={t("否")}/>
        </Form.Item>
    );
};
