/**
 * @description 曲线路径里面的
 * @date 2025-8-13
 */
import { useEffect } from "react";
import { Form, InputNumber } from "antd";
import type Konva from "konva";
import type { InputNumberProps } from "antd";
import { computeCubicArrowPoints, computeBezierLabelPoint } from "@/utils/math";
import { findReverseEdgeShape, isBezierOverlapped } from "@/utils/edgePair";
import type { BezierPoints } from "@/utils/typing";
import { useI18n } from "@/hooks/useI18n";

interface CYProps {
    selectShapes: Konva.Shape[];
}

export default (props: CYProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const onCYChange: InputNumberProps["onChange"] = (value) => {
        if (!selectShapes?.length || typeof value !== "number") return;
        selectShapes.forEach(shape => {
            // 改变画布中的控制点A的坐标
            const stage = shape.getStage();
            const target = stage?.findOne("#controlPointA");
            target?.y(-value);
            // 改变控制点A的文本坐标
            const controlText = stage?.findOne("#controlTextA");
            controlText?.y(-value + 150);
            // 改变画布中的控制点辅助线的坐标
            const controlLine = stage?.findOne("#controlLine");
            const { attrs: { points: [ssx, ssy, csx, _, dsx, dsy, esx, esy] } } = controlLine as Konva.Shape;
            controlLine?.setAttr("points", [ssx, ssy, csx, -value, dsx, dsy, esx, esy]);
            /**
             * 反向边联动判定（基于变更前的 attrs.data）：
             *   - 若当前边与反向边轨迹重合，则同步把 cy 写入反向边的 dy；
             *   - 否则反向边保持原状。
             */
            const reverseShape = findReverseEdgeShape(stage, shape.attrs?.data);
            const shouldSyncReverse = !!(
                reverseShape &&
                isBezierOverlapped(shape.attrs?.data, reverseShape.attrs?.data)
            );
            // 改变贝塞尔曲线的箭头和标签
            const { attrs: { data: { sx, sy, cx, cy, dx, dy, ex, ey, ...rest } } } = shape;
            // 贝塞尔曲线
            const points: BezierPoints = [sx, -sy, cx, -value, dx, -dy, ex, -ey];
            // 计算贝塞尔曲线的箭头坐标
            const arrowPoints = computeCubicArrowPoints(points);
            // 计算贝塞尔曲线的Label的2/3位置
            const { x, y } = computeBezierLabelPoint(points);
            shape.setAttrs({
                data: {
                    ...(rest || {}),
                    sx,
                    sy,
                    cx,
                    cy: value,
                    dx,
                    dy,
                    ex,
                    ey,
                    labelX: x,
                    labelY: y,
                    arrowPoints
                }
            });
            /**
             * 反向边镜像写入：cy 改变 → 反向边的 dy 同步为 value，
             * 重新计算反向边自身的 arrowPoints 与 labelX/Y。
             */
            if (shouldSyncReverse && reverseShape) {
                const rd = reverseShape.attrs?.data;
                if (rd) {
                    const reversePoints: BezierPoints = [
                        rd.sx, -rd.sy,
                        rd.cx, -rd.cy,
                        rd.dx, -value,
                        rd.ex, -rd.ey
                    ];
                    const reverseArrowPoints = computeCubicArrowPoints(reversePoints);
                    const reverseLabel = computeBezierLabelPoint(reversePoints);
                    reverseShape.setAttrs({
                        data: {
                            ...rd,
                            dy: value,
                            arrowPoints: reverseArrowPoints,
                            labelX: reverseLabel.x,
                            labelY: reverseLabel.y
                        }
                    });
                }
            }
        });
    };

    // 监听 selectShapes 变化，实时把当前选中 edge 的 cy 同步到表单
    // 之前依赖项为 [] 只在挂载时执行一次，导致切换选中 edge 后表单 cy 仍停在旧值
    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const { attrs: { data } } = shape;
        if (data?.cy !== null) {
            form.setFieldValue("cy", data?.cy);
        }
    }, [selectShapes])

    return (
        <Form.Item
            noStyle
            name="cy"
        >
            <InputNumber
                style={{ width: "100%" }}
                placeholder={t("控制点A的y坐标")}
                onChange={onCYChange}
                step={100}
                precision={3}
            />
        </Form.Item>
    )
};
