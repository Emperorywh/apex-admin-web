/**
 * @description 到点后在节点前进或后退的距离
 * @date 2025-12-15
 */
import { useEffect } from "react";
import { Form, InputNumber } from "antd";
import type { InputNumberProps } from "antd";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface PointOffsetProps {
    selectShapes: Konva.Shape[];
}

export default (props: PointOffsetProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    // 节点类型（TypeItem）通过 Konva shape.setAttrs 命令式写入 data.type，
    // 既不改 selectShapes 引用、也不触发 React state 更新，
    // 因此下方基于 shape.attrs.data.type 的显隐判断不会刷新——
    // 用户切换类型后必须重新选中节点，到点距离才会出现/消失。
    // 这里订阅 Form 的 type 字段：TypeItem 的 Select 被 Form.Item name="type" 包裹，
    // 类型变化会同步到 form 字段并触发本组件重渲染；
    // 重渲染时命令式写入的 shape.attrs.data.type 已是最新值，显隐判断即可生效。
    // 做法与 EnterChargeStationId / ThirdDevice / ShelfLayers 保持一致。
    Form.useWatch("type", form);

    // 到点距离的改变事件
    const onAddDisChange: InputNumberProps["onChange"] = (value) => {
        selectShapes.forEach(shape => {
            const { attrs: { data } } = shape;
            shape.setAttrs({
                data: {
                    ...(data || {}),
                    addDis: value
                }
            });
        })
    };

    useEffect(() => {
        const [shape] = selectShapes;
        const { attrs: { data: { addDis } } } = shape;
        form.setFieldValue("addDis", typeof addDis === "number" ? addDis : null);
    }, [selectShapes])

    if (selectShapes.length === 1 && selectShapes.every(shape => shape.attrs?.data?.type !== "charge")
        && selectShapes.every(shape => shape.attrs?.data?.type !== "park")
        && selectShapes.every(shape => shape.attrs?.data?.type !== "node")) {
        return (
            <Form.Item
                label={t("到点距离")}
                name="addDis"
            >
                <InputNumber
                    style={{ width: "100%" }}
                    placeholder={t("请选择车辆到点的偏移距离")}
                    precision={5}
                    onChange={onAddDisChange}
                />
            </Form.Item>
        )
    }
    return null;
};
