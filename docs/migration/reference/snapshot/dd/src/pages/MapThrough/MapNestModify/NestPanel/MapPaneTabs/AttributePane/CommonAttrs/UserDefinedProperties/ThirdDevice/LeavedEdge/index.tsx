/**
 * @description 风淋门专属配置：是否离开（leavedEdge）
 * 仅当三方设备类型为风淋门（airShowerDoor）时展示，
 * 用于控制机器人执行完风淋动作后是否需要离开当前边，默认「否」(false)
 * @date 2026-7-13
 */
import { useEffect } from "react";
import { Form, Radio } from "antd";
import type { RadioChangeEvent } from "antd";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface LeavedEdgeProps {
    selectShapes: Konva.Shape[];
}

export default (props: LeavedEdgeProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    // 是否离开的单选选项：是 / 否（对应 boolean 值），默认「否」
    const leaveOptions: { label: string; value: string }[] = [
        { label: t("是"), value: "true" },
        { label: t("否"), value: "false" }
    ];

    // 修改「是否离开」时同步写入所选 shape 的 userDefinedProperties.leavedEdge
    const onLeaveChange = (e: RadioChangeEvent) => {
        const value = e.target.value;
        if (!selectShapes?.length) return;
        selectShapes.forEach(shape => {
            const { attrs: { data: { userDefinedProperties } } } = shape;
            shape.setAttrs({
                data: {
                    ...(shape.attrs?.data || {}),
                    userDefinedProperties: {
                        ...(userDefinedProperties || {}),
                        leavedEdge: value
                    }
                }
            });
        })
    };

    // 选中 shape 变化时，用首个 shape 的现有值回填表单；无值时取默认 false
    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data: { userDefinedProperties } } } = shape;
        form.setFieldValue("leavedEdge", userDefinedProperties?.leavedEdge ?? "false");
    }, [selectShapes])

    return (
        <Form.Item
            noStyle
            shouldUpdate={(preValues, curValues) => preValues.deviceType !== curValues.deviceType}
        >
            {
                ({ getFieldValue }) => (
                    getFieldValue("deviceType") === "airShowerDoor" ? (
                        <Form.Item
                            label={t("是否离开")}
                            name="leavedEdge"
                            // 字段未设值时的兜底默认值（string 类型，与选项值保持一致）
                            initialValue="false"
                        >
                            <Radio.Group
                                options={leaveOptions}
                                onChange={onLeaveChange}
                            />
                        </Form.Item>
                    ) : null
                )
            }
        </Form.Item>
    )
};
