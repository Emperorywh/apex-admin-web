/**
 * @description 节点的类型
 * @date 2025-7-9
 */
import { useEffect, useState } from "react";
import { Form, Select } from "antd";
import { NodeType } from "@/utils/enum";
import { enumToObject, objectToOptions } from "@/utils/public";
import type { SelectProps } from "antd";
import Konva from "konva";
import { getNodeStyle } from "@/plugins/konva/nodes";
import type { MapNode } from "@/utils/typing";
import { selectedState } from "@/plugins/konva/state/selected";
import { useI18n } from "@/hooks/useI18n";

interface TypeItemProps {
    selectShapes: Konva.Shape[];
}

export default (props: TypeItemProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const [nodeTypes, setNodeTypes] = useState<SelectProps["options"]>([]);

    const form = Form.useFormInstance();

    const handleShapeTypeChange = (type: MapNode["type"]) => {
        if (!selectShapes?.length) return;
        // 批量修改元素的类型
        selectShapes.forEach(shape => {
            // 从 shape.attrs 解构样式和数据；data 兜底 {} 防止无 data 字段时解构崩溃
            const { shapeStyle: { ...restStyle }, data = {} } = shape.attrs;
            // 2.0.0 用 getNodeStyle(type) 取代 nodeStyles[type]，自带类型未命中时的兜底保护
            const { radius, fill, stroke, lineWidth, labelFill } = getNodeStyle(type);
            /*
             * 切换类型时清掉所有与类型强相关的字段，避免旧类型配置残留到新类型节点上。
             * 字段归属：
             *   userDefinedProperties 中的三方设备四件套（deviceType/deviceKey/applyDeviceOperationType/releaseDeviceOperationType）
             *     —— 仅 charge 节点用；这里从 udp 中剔除，保留其余用户自定义键值对（DefinedProperties，与类型无关）。
             *   enterChargeStationId —— 仅 charge 用
             *   shelf                —— 仅 shelf 用（2.0.0 已废弃 shelf 类型，但旧地图数据可能残留，仍一并清理）
             *   addDis               —— 仅非 charge/park/node 用
             *   allowVehicleGroups   —— 仅 charge/park 用
             * 策略：切换即全新配置，一律清空，保证 shape 与 form 字段一致，避免脏数据被保存提交。
             */
            const {
                deviceType,
                deviceKey,
                applyDeviceOperationType,
                releaseDeviceOperationType,
                ...restUdp
            } = data.userDefinedProperties || {};
            // 改变了，但是还是选中状态 angle 重置为 null，箭头也同步置空
            shape.setAttrs({
                shapeStyle: {
                    ...restStyle,
                    radius: radius * selectedState.radius,
                    fill,
                    stroke,
                    lineWidth: lineWidth * selectedState.lineWidth,
                    labelFill
                },
                data: {
                    ...data,
                    angle: null,
                    type,
                    arrowPoints: undefined,
                    // 清空所有 type 相关字段，防止旧类型配置残留
                    userDefinedProperties: restUdp,
                    enterChargeStationId: undefined,
                    shelf: undefined,
                    addDis: undefined,
                    allowVehicleGroups: undefined
                }
            });
        });
        // 同步重置 type 相关的 form 字段，保持表单与 shape 一致
        form.setFieldsValue({
            angle: null,
            deviceType: undefined,
            deviceKey: undefined,
            applyDeviceOperationType: undefined,
            releaseDeviceOperationType: undefined,
            enterChargeStationId: undefined,
            addDis: undefined,
            allowVehicleGroups: undefined
        });
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { data: { type } } = shape.attrs;
        form.setFieldValue("type", type);
    }, [selectShapes])

    // 转化枚举为选项
    useEffect(() => {
        const typeObj = enumToObject(NodeType);
        const options = objectToOptions(typeObj).map(o => ({ ...o, label: t(o.label as string) }));
        setNodeTypes(options);
    }, [])

    return (
        <Form.Item
            label={t("类型")}
            name="type"
            rules={[{ required: true, message: t("请选择节点类型") }]}
        >
            <Select
                placeholder={t("请选择节点类型")}
                onChange={handleShapeTypeChange}
                options={nodeTypes}
            />
        </Form.Item>
    )
};
