/**
 * @description 平移的弹窗
 * @date 2025-7-11
 */
import { useState, memo } from "react";
import { Modal, Form, InputNumber } from "antd";
import Konva from "konva";
import { computeLineArrowPoints, computeLinePoint, computeCubicArrowPoints, computeBezierLabelPoint } from "@/utils/math";
import type { BezierPoints, LinePoint } from "@/utils/typing";
import { saveSnapshot } from "@/utils/undoHistory";
import { visualOffsetToWorld } from "@/utils/bindStage";
import { useI18n } from "@/hooks/useI18n";

type FieldType = {
    offsetX: number;
    offsetY: number;
};

interface TranslateModalProps {
    open: boolean;
    stage: Konva.Stage | null;
    selectShapes: Konva.Shape[];
    setOpenTranslate: (value: React.SetStateAction<boolean>) => void;
}

export default memo((props: TranslateModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, stage, selectShapes, setOpenTranslate } = props;

    const [confirmLoading, setConfirmLoading] = useState<boolean>(false);

    const [form] = Form.useForm();

    // 平移选中的元素
    const translateSelectShapes = (shapes: Konva.Shape[], offset: FieldType) => {
        if (!shapes?.length) return;
        const { offsetX, offsetY } = offset;
        /**
         * 将用户输入的视觉偏移量（屏幕方向）转换为世界坐标偏移量
         * 当地图有旋转时，视觉上的"右"和"上"与世界坐标轴不对齐，
         * 需要根据 stage 的旋转角度反向旋转偏移向量
         */
        const stg = stage || shapes[0].getStage();
        const { dx, dy } = stg ? visualOffsetToWorld(offsetX, offsetY, stg.rotation()) : { dx: offsetX, dy: offsetY };
        /**
         * "安全路径"：两端节点都在本次选中集合中的路径。
         * 只有安全路径才参与整体平移（sx/sy/ex/ey/控制点 同步偏移）；
         * "悬挂路径"（至少一端节点未选中）不整体平移，改由下方节点平移逻辑
         * 自动同步其对应端点，避免路径端点和未选中节点断连。
         */
        const selectedNodeIds = new Set(
            shapes.filter(s => s.attrs?.enableSelect === "node").map(s => s.attrs?.id)
        );
        const safeEdgeIds = new Set(
            shapes
                .filter(s => {
                    if (s.attrs?.enableSelect !== "edge") return false;
                    const { snodeId, enodeId } = s.attrs?.data || {};
                    return selectedNodeIds.has(snodeId) && selectedNodeIds.has(enodeId);
                })
                .map(s => s.attrs?.id)
        );
        shapes.forEach(shape => {
            const { enableSelect, data: { sx, sy, cx = null, cy = null, dx: dataDx = null, dy: dataDy = null, ex, ey, ...rest } } = shape.attrs;
            if (enableSelect === "node") {
                // 还要改变关联路径的起始点
                const { id, x, y } = shape.attrs;
                // 修改节点的位置（dx 是世界 X 偏移，dy 是世界 Y 偏移）
                shape.setAttrs({
                    x: x + dx,
                    y: y - dy
                });
                // 因为贝塞尔曲线控制点的问题，这里只能找到路径的起始点，无法判断贝塞尔曲线是否被选中，
                // 安全路径（两端节点都选中）在下方 edge 分支单独整体平移，所以这里排除安全路径；
                // 悬挂路径（至少一端节点未选中）不整体平移，改由这里同步其对应端点，避免与未选中节点断连
                const relatedShapes: Konva.Shape[] | undefined = stg?.find((shape: Konva.Shape) => shape.attrs.enableSelect === "edge" && (shape.attrs?.data?.snodeId === id || shape.attrs?.data?.enodeId === id) && !safeEdgeIds.has(shape.attrs?.id));
                if (!relatedShapes?.length) return;
                relatedShapes?.forEach(edgeShape => {

                    const { data: { sx, sy, cx = null, cy = null, dx: edgeDx = null, dy: edgeDy = null, ex, ey, snodeId, enodeId, ...rest } } = edgeShape.attrs;
                    if (snodeId === id) {
                        // 起点相同，修改路径的sx,sy
                        if (cx === null || cy === null || edgeDx === null || edgeDy === null) {
                            // 是直线，用直线的计算方法
                            const points: LinePoint = [sx + dx, -sy - dy, ex, -ey];
                            // 计算直线的箭头坐标
                            const arrowPoints = computeLineArrowPoints(points);
                            // 计算直线的标签坐标
                            const label = computeLinePoint(points);
                            // 更新直线
                            edgeShape.setAttrs({
                                data: {
                                    ...rest,
                                    sx: sx + dx,
                                    sy: sy + dy,
                                    cx,
                                    cy,
                                    dx: edgeDx,
                                    dy: edgeDy,
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
                            const points: BezierPoints = [sx + dx, -sy - dy, cx, -cy, edgeDx, -edgeDy, ex, -ey];
                            // 计算曲线的箭头坐标
                            const arrowPoints = computeCubicArrowPoints(points);
                            // 计算贝塞尔曲线的标签坐标
                            const label = computeBezierLabelPoint(points);
                            // 更新直线
                            edgeShape.setAttrs({
                                data: {
                                    ...rest,
                                    sx: sx + dx,
                                    sy: sy + dy,
                                    cx,
                                    cy,
                                    dx: edgeDx,
                                    dy: edgeDy,
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
                    // 终点相同，修改路径的ex, ey
                    if (enodeId === id) {
                        if (cx === null || cy === null || edgeDx === null || edgeDy === null) {
                            // 是直线，用直线的计算方法
                            const points: LinePoint = [sx, -sy, ex + dx, -ey - dy];
                            // 计算直线的箭头坐标
                            const arrowPoints = computeLineArrowPoints(points);
                            // 计算直线的标签坐标
                            const label = computeLinePoint(points);
                            // 更新直线
                            edgeShape.setAttrs({
                                data: {
                                    ...rest,
                                    sx,
                                    sy,
                                    cx,
                                    cy,
                                    dx: edgeDx,
                                    dy: edgeDy,
                                    ex: ex + dx,
                                    ey: ey + dy,
                                    snodeId,
                                    enodeId,
                                    labelX: label.x,
                                    labelY: label.y,
                                    arrowPoints
                                }
                            })
                        } else {
                            // 是贝塞尔曲线
                            const points: BezierPoints = [sx, -sy, cx, -cy, edgeDx, -edgeDy, ex + dx, -ey - dy];
                            // 计算曲线的箭头坐标
                            const arrowPoints = computeCubicArrowPoints(points);
                            // 计算贝塞尔曲线的标签坐标
                            const label = computeBezierLabelPoint(points);
                            // 更新直线
                            edgeShape.setAttrs({
                                data: {
                                    ...rest,
                                    sx,
                                    sy,
                                    cx,
                                    cy,
                                    dx: edgeDx,
                                    dy: edgeDy,
                                    ex: ex + dx,
                                    ey: ey + dy,
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
            }
            if (enableSelect === "edge") {
                // 悬挂路径（至少一端节点未选中）不整体平移，其端点由上方节点平移逻辑自动同步
                if (!safeEdgeIds.has(shape.attrs?.id)) return;
                if (cx === null || cy === null || dataDx === null || dataDy === null) {
                    // 是直线 => 平移起点，终点，箭头，label
                    const points: LinePoint = [sx + dx, -sy - dy, ex + dx, -ey - dy];
                    // 计算直线的箭头坐标
                    const arrowPoints = computeLineArrowPoints(points);
                    // 计算直线的label坐标
                    const label = computeLinePoint(points);
                    shape.setAttrs({
                        data: {
                            ...rest,
                            sx: sx + dx,
                            sy: sy + dy,
                            cx,
                            cy,
                            dx: dataDx,
                            dy: dataDy,
                            ex: ex + dx,
                            ey: ey + dy,
                            arrowPoints,
                            labelX: label.x,
                            labelY: label.y
                        }
                    });
                } else {
                    // 是曲线 =》 改变曲线的起点，终点，控制点，箭头，label
                    const points: BezierPoints = [sx + dx, -sy - dy, cx + dx, -cy - dy, dataDx + dx, -dataDy - dy, ex + dx, -ey - dy];
                    // 计算曲线的箭头坐标
                    const arrowPoints = computeCubicArrowPoints(points);
                    // 计算曲线的箭头坐标
                    const label = computeBezierLabelPoint(points);
                    shape.setAttrs({
                        data: {
                            ...rest,
                            sx: sx + dx,
                            sy: sy + dy,
                            cx: cx + dx,
                            cy: cy + dy,
                            dx: dataDx + dx,
                            dy: dataDy + dy,
                            ex: ex + dx,
                            ey: ey + dy,
                            arrowPoints,
                            labelX: label.x,
                            labelY: label.y
                        }
                    });
                }
            }
        })
        /**
         * 平移完成后触发 angles:refresh 让夹角层重算。
         * 不再需要 shapes:sync 回写 React state（已移除 sync-back 逻辑）。
         */
        stg?.fire("angles:refresh", {} as any);
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        setConfirmLoading(true);
        saveSnapshot();
        const offset = form.getFieldsValue();
        translateSelectShapes(selectShapes, offset);
        setConfirmLoading(false);
        setOpenTranslate(false);
        form.resetFields();
    };

    const handleCancel = () => {
        setOpenTranslate(false);
        form.resetFields();
    };

    return (
        <Modal
            title={t("平移元素")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
            confirmLoading={confirmLoading}
        >
            <Form
                name="translateShapes"
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<FieldType>
                    label={t("x轴偏移量")}
                    name="offsetX"
                    tooltip="m"
                    rules={[{ required: true, message: t("请输入x轴偏移量") }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入x轴偏移量")}
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                </Form.Item>

                <Form.Item<FieldType>
                    label={t("y轴偏移量")}
                    name="offsetY"
                    tooltip="m"
                    rules={[{ required: true, message: t("请输入y轴偏移量") }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入y轴偏移量")}
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                </Form.Item>
            </Form>
        </Modal>
    )
});
