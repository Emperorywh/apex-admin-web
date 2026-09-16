/**
 * @description 节点是否启用虚拟避让点
 * @date 2026-05-19
 */
import { useEffect } from "react";
import { Form, Radio } from "antd";
import type { RadioGroupProps } from "antd";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface VirtualAvoidStationProps {
    selectShapes: Konva.Shape[];
}

export default (props: VirtualAvoidStationProps) => {
    /* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    /**
     * 将单选框的布尔值写回每一个被选中的节点。
     * attrs.data 是节点属性保存边界，保存地图时会从这里汇总节点数据。
     */
    const onVirtualAvoidStationChange: RadioGroupProps["onChange"] = ({ target: { value } }) => {
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape;
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    enableVirtualAvoidStation: value
                }
            });
        });
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        /**
         * 字段的领域默认值为 false
         * 表单始终回显明确布尔值，避免单选框出现无选中状态。
         */
        const { data: { enableVirtualAvoidStation = false } } = shape.attrs;
        /**
         * 属性面板以第一个选中节点作为回显来源。
         * 变更时再同步到所有选中节点，保持和其它批量属性项一致。
         */
        form.setFieldValue("enableVirtualAvoidStation", enableVirtualAvoidStation === true);
    }, [selectShapes]);

    // 只有非普通节点时才显示
    if (!selectShapes?.length || selectShapes.every(shape => shape.attrs?.data?.type === "node")) {
        return null;
    }

    return (
        <Form.Item
            noStyle
            shouldUpdate={(preValues, curValues) => preValues.type !== curValues.type}
        >
            <Form.Item
                label={t("是否可解锁")}
                name="enableVirtualAvoidStation"
            >
                <Radio.Group
                    name="enableVirtualAvoidStation"
                    options={[
                        { value: true, label: t("是") },
                        { value: false, label: t("否") }
                    ]}
                    onChange={onVirtualAvoidStationChange}
                />
            </Form.Item>
        </Form.Item>
    );
};
