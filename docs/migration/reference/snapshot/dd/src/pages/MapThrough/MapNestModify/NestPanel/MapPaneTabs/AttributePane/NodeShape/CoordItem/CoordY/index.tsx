/**
 * @description 节点的Y坐标
 * @date 2025-7-9
 */
import { useEffect, memo } from "react";
import { Form, InputNumber } from "antd";
import Konva from "konva";
import { computeLineArrowPoints, computeLinePoint, computeCubicArrowPoints, computeBezierLabelPoint } from "@/utils/math";
import { useI18n } from "@/hooks/useI18n";

interface PositionYProps {
    selectShapes: Konva.Shape[];
}

export default memo((props: PositionYProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const onShapeYChange = (value: number | null) => {
        if (typeof value !== "number") return;
        const [shape] = selectShapes;
        shape.setAttrs({
            y: -value
        });
        // 找到相关联的边
        const stage = shape.getStage();
        const { id } = shape.attrs;
        const edges: Konva.Shape[] | undefined = stage?.find((shape: Konva.Shape) => shape.attrs.enableSelect === "edge" && (shape.attrs?.data?.snodeId === id || shape.attrs?.data?.enodeId === id));
        // 修改相关联的边的坐标
        edges?.forEach((edgeShape: Konva.Shape) => {
            const { data: { sx, sy, cx, cy, dx, dy, ex, ey, snodeId, enodeId, ...rest } } = edgeShape.attrs;
            if (snodeId === id) {
                // 起点相同，修改路径的 sy
                if (cx === null || cy === null || dx === null || dy === null) {
                    // 是直线
                    // 计算直线的箭头坐标
                    const arrowPoints = computeLineArrowPoints([sx, -value, ex, -ey]);
                    // 计算直线的标签坐标
                    const label = computeLinePoint([sx, -value, ex, -ey]);
                    // 更新直线
                    edgeShape.setAttrs({
                        data: {
                            ...rest,
                            sx,
                            sy: value,
                            cx,
                            cy,
                            dx,
                            dy,
                            ex,
                            ey,
                            snodeId,
                            enodeId,
                            labelX: label.x,
                            labelY: label.y,
                            arrowPoints
                        }
                    })
                } else {
                    // 是贝塞尔曲线
                    // 计算曲线的箭头坐标
                    const arrowPoints = computeCubicArrowPoints([sx, -value, cx, -cy, dx, -dy, ex, -ey]);
                    // 计算贝塞尔曲线的标签坐标
                    const label = computeBezierLabelPoint([sx, -value, cx, -cy, dx, -dy, ex, -ey]);
                    // 更新直线
                    edgeShape.setAttrs({
                        data: {
                            ...rest,
                            sx,
                            sy: value,
                            cx,
                            cy,
                            dx,
                            dy,
                            ex,
                            ey,
                            snodeId,
                            enodeId,
                            labelX: label.x,
                            labelY: label.y,
                            arrowPoints
                        }
                    })
                }
            }
            // 终点相同，修改路径的 ey
            if (enodeId === id) {
                if (cx === null || cy === null || dx === null || dy === null) {
                    // 是直线
                    // 计算直线的箭头坐标
                    const arrowPoints = computeLineArrowPoints([sx, -sy, ex, -value]);
                    // 计算直线的标签坐标
                    const label = computeLinePoint([sx, -sy, ex, -value]);
                    // 更新直线
                    edgeShape.setAttrs({
                        data: {
                            ...rest,
                            sx,
                            sy,
                            cx,
                            cy,
                            dx,
                            dy,
                            ex,
                            ey: value,
                            snodeId,
                            enodeId,
                            labelX: label.x,
                            labelY: label.y,
                            arrowPoints
                        }
                    })
                } else {
                    // 是贝塞尔曲线
                    // 计算曲线的箭头坐标
                    const arrowPoints = computeCubicArrowPoints([sx, -sy, cx, -cy, dx, -dy, ex, -value]);
                    // 计算贝塞尔曲线的标签坐标
                    const label = computeBezierLabelPoint([sx, -sy, cx, -cy, dx, -dy, ex, -value]);
                    // 更新直线
                    edgeShape.setAttrs({
                        data: {
                            ...rest,
                            sx,
                            sy,
                            cx,
                            cy,
                            dx,
                            dy,
                            ex,
                            ey: value,
                            snodeId,
                            enodeId,
                            labelX: label.x,
                            labelY: label.y,
                            arrowPoints
                        }
                    })
                }
            }
        })
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { y } = shape.attrs;
        form.setFieldValue("y", -y);
    }, [selectShapes])

    return (
        <Form.Item
            // label="Y"
            noStyle
            name="y"
            rules={[{ required: true, message: "" }]}
        >
            <InputNumber
                style={{ width: "100%" }}
                placeholder={t("元素Y坐标")}
                onChange={onShapeYChange}
            />
        </Form.Item>
    )
});
