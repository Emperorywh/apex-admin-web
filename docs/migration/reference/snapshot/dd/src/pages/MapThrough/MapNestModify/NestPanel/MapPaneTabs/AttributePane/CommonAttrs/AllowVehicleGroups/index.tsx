/**
 * @description 允许通过的车辆分组，可以批量编辑
 * @date 2025-8-7
 */
import { useEffect, useState } from "react";
import { Form, Select, message } from "antd";
import { getVehicleGroups } from "@/api";
import { edgeHighlightColors } from "@/plugins/konva/path/edgeHighlightColors";
import type Konva from "konva";
import type { SelectProps } from "antd";
import type { Records } from "@/types/VehicleDeploy/GroupType";
import { useI18n } from "@/hooks/useI18n";

interface AllowVehicleGroupsPorps {
    selectShapes: Konva.Shape[];
}

export default (props: AllowVehicleGroupsPorps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    // 车辆分组的选项
    const [vehicleGroups, setVehicleGroups] = useState<Records[]>([]);

    const form = Form.useFormInstance();

    // 节点类型（TypeItem）通过 Konva shape.setAttrs 命令式写入 data.type，
    // 既不改 selectShapes 引用、也不触发 React state 更新，
    // 因此下方基于 shape.attrs.data.type 的显隐判断不会刷新——
    // 用户切换类型后必须重新选中节点，车辆分组才会出现/消失。
    // 这里订阅 Form 的 type 字段：TypeItem 的 Select 被 Form.Item name="type" 包裹，
    // 类型变化会同步到 form 字段并触发本组件重渲染；
    // 重渲染时命令式写入的 shape.attrs.data.type 已是最新值，显隐判断即可生效。
    // 做法与 EnterChargeStationId / ThirdDevice / ShelfLayers 保持一致。
    Form.useWatch("type", form);

    const onAllowVehicleGroupsChange: SelectProps["onChange"] = (value) => {
        if (!selectShapes?.length) return;
        selectShapes.forEach(shape => {
            const { data } = shape.attrs;
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    allowVehicleGroups: value || null
                }
            });
        })
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { data: { allowVehicleGroups } } = shape.attrs;
        form.setFieldValue("allowVehicleGroups", allowVehicleGroups);
    }, [selectShapes, vehicleGroups])

    useEffect(() => {
        getVehicleGroups().then(res => {
            if (res.code === 200 && res.message === "success") {
                setVehicleGroups(res?.data || []);
            } else {
                message.warning(t("查询车辆分组列表出错") + res?.message);
            }
        }).catch(err => {
            if (err) {
                message.error(t("查询车辆分组列表出错") + err?.message);
            }
        })
    }, [])

    // 全是充电点或者停车点的时候 || 前世路径的时候显示分组
    if (selectShapes.every(shape => shape.attrs?.data?.type === "charge" || shape.attrs?.data?.type === "park") || selectShapes.every(shape => shape.attrs?.enableSelect === "edge")) {
        return (
            <Form.Item
                label={
                    <span>
                        {t("车辆分组")}
                        <span style={{ display: "inline-block", width: 12, height: 12, backgroundColor: edgeHighlightColors.allowVehicleGroups, borderRadius: 2, verticalAlign: "middle", marginLeft: 4 }} />
                    </span>
                }
                name="allowVehicleGroups"
            >
                <Select
                    mode="multiple"
                    maxTagCount="responsive"
                    placeholder={t("路径允许通过的车辆组")}
                    options={vehicleGroups}
                    allowClear
                    showSearch
                    optionFilterProp="agvGroupName"
                    fieldNames={{ label: "agvGroupName", value: "agvGroupKey" }}
                    onChange={onAllowVehicleGroupsChange}
                />
            </Form.Item>
        )
    }
    return null;
};
