/**
 * @description 关联充电点的节点 只有充电站点的时候才显示
 * @date 2025-7-23
 */
import { useEffect, useState } from "react";
import { Form, Select } from "antd";
import type { SelectProps } from "antd";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface EnterChargeStationIdProps {
    selectShapes: Konva.Shape[];
}

export default (props: EnterChargeStationIdProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    // 节点选项
    const [nodeOptions, setNodeOptions] = useState<SelectProps["options"]>([]);

    const form = Form.useFormInstance();

    const type = Form.useWatch("type", form);

    const onEnterChargeStationIdChange: SelectProps["onChange"] = (value) => {
        if (!selectShapes?.length) return;
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape;
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    enterChargeStationId: value || null
                }
            })
        })
    };

    useEffect(() => {
        if (!selectShapes?.length || !selectShapes.every(shape => shape.attrs?.data?.type === "charge")) return;
        const [shape] = selectShapes;
        const stage = shape.getStage();
        const { attrs: { data: { enterChargeStationId } } } = shape;
        enterChargeStationId && form.setFieldValue("enterChargeStationId", enterChargeStationId);
        // 初始化选项
        const nodeShapes: Konva.Shape[] | undefined = stage?.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "node");
        const options = nodeShapes?.map((shape: Konva.Shape) => ({
            name: shape.attrs?.data?.name,
            id: shape.id()
        }));
        setNodeOptions(options);
    }, [selectShapes, type])

    // 只有充电站点的时候才显示
    if (selectShapes.every(shape => shape.attrs?.data?.type === "charge") && selectShapes?.length === 1) {
        return (
            <Form.Item
                label={t("关联点")}
                name="enterChargeStationId"
            >
                <Select
                    placeholder={t("请选择充电关联的节点")}
                    allowClear
                    showSearch
                    optionFilterProp="name"
                    options={nodeOptions}
                    fieldNames={{ label: "name", value: "id" }}
                    onChange={onEnterChargeStationIdChange}
                />
            </Form.Item>
        )
    }

    return null;
};
