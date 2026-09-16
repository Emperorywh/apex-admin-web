/**
 * @description 复制元素的弹窗
 * @date 2025-7-14
 */
import { memo } from "react";
import { Modal, Form, InputNumber, message } from "antd";
import Konva from "konva";
import { nextNameByShapes } from "@/utils/graph";
import { getRandomString } from "@/utils/public";
import { computeCubicArrowPoints, computeLineArrowPoints, computeBezierLabelPoint, computeLinePoint } from "@/utils/math";
import type { LinePoint, BezierPoints } from "@/utils/typing";
import { sleep } from "@/utils/public";
import { selectedState } from "@/plugins/konva/state/selected";
import { saveSnapshot } from "@/utils/undoHistory";
import { visualOffsetToWorld } from "@/utils/bindStage";
import { useI18n } from "@/hooks/useI18n";

type FieldType = {
    count: number;
    offsetX: number;
    offsetY: number;
};

interface CopyModalProps {
    open: boolean;
    stage: Konva.Stage | null;
    selectShapes: Konva.Shape[];
    setOpenCopy: (value: React.SetStateAction<boolean>) => void;
}

export default memo((props: CopyModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, stage, selectShapes, setOpenCopy } = props;

    const [form] = Form.useForm<FieldType>();

    // 准备一个节点的映射
    const getNodeIdMap = (shapes: Konva.Shape[]) => {
        // 准备一个节点映射
        const nodeMapped: Record<string, string> = {};
        shapes.forEach(shape => {
            const { enableSelect, id } = shape.attrs;
            if (enableSelect === "node") {
                const newId = getRandomString();
                // 节点
                nodeMapped[id] = newId;
            }
        })
        return nodeMapped;
    };

    // 根据节点准备路径的映射
    const getEdgeMap = (shapes: Konva.Shape[], nodeMapped: Record<string, string>) => {
        // 准备一个路径的映射
        const edgeMapped: Record<string, { newId: string, snodeId: string, enodeId: string }> = {};
        shapes.forEach(shape => {
            const { enableSelect, id, data: { snodeId, enodeId } } = shape.attrs;
            if (enableSelect === "edge") {
                const newId = getRandomString();
                // 路径 要路径本身的映射和起点终点的映射
                edgeMapped[id] = {
                    newId,
                    snodeId: nodeMapped[snodeId] || "",
                    enodeId: nodeMapped[enodeId] || ""
                };
            }
        })
        return edgeMapped;
    };

    const copySelectShapes = (shapes: Konva.Shape[], offset: Omit<FieldType, "count">) => {
        if (!shapes?.length) return;
        const { offsetX, offsetY } = offset;
        /**
         * 将用户输入的视觉偏移量（屏幕方向）转换为世界坐标偏移量
         * 当地图有旋转时，视觉上的"右"和"上"与世界坐标轴不对齐，
         * 需要根据 stage 的旋转角度反向旋转偏移向量
         */
        const { dx, dy } = stage ? visualOffsetToWorld(offsetX, offsetY, stage.rotation()) : { dx: offsetX, dy: offsetY };
        // 节点的映射
        const nodeMapped = getNodeIdMap(shapes);
        // 路径的映射
        const edgeMapped = getEdgeMap(shapes, nodeMapped);
        shapes.forEach(shape => {
            // 找到所有的节点，节点名称要唯一
            const nodeShapes: Konva.Shape[] = stage?.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "node") || [];
            const attrs = shape.getAttrs();
            const layer = shape.getLayer();
            const { id = "", x = 0, y = 0, enableSelect, data: { sx, sy, cx = null, cy = null, dx: dataDx = null, dy: dataDy = null, ex, ey, name = "" } } = attrs;
            const originalStyle = attrs.state === "selected" ? {
                ...attrs.shapeStyle,
                ...(enableSelect === "node" ? { radius: attrs.shapeStyle.radius / selectedState.radius } : {}),
                lineWidth: attrs.shapeStyle.lineWidth / selectedState.lineWidth
            } : attrs.shapeStyle;
            if (enableSelect === "node") {
                // 是节点
                const nextName = nextNameByShapes(nodeShapes, name);
                const copyShape = new Konva.Shape({
                    ...attrs,
                    id: nodeMapped[id],
                    x: x + dx,
                    y: y - dy,
                    state: "",
                    shapeStyle: originalStyle,
                    data: {
                        ...attrs.data,
                        name: nextName
                    }
                })
                layer?.add(copyShape);
            }
            // 所有的路径，为了路径名称递归
            const edgeShapes: Konva.Shape[] = stage?.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "edge") || [];
            if (enableSelect === "edge") {
                // 是路径
                const nextName = nextNameByShapes(edgeShapes, name);
                if (cx === null || cy === null || dataDx === null || dataDy === null) {
                    // 是直线，复制直线
                    const points: LinePoint = [sx + dx, -sy - dy, ex + dx, -ey - dy];
                    // 计算直线的箭头位置
                    const arrowPoints = computeLineArrowPoints(points);
                    // 计算直线的label位置
                    const label = computeLinePoint(points);
                    const copyShape = new Konva.Shape({
                        ...attrs,
                        id: edgeMapped[id].newId,
                        state: "",
                        shapeStyle: originalStyle,
                        data: {
                            ...(attrs?.data || {}),
                            name: nextName,
                            sx: sx + dx,
                            sy: sy + dy,
                            ex: ex + dx,
                            ey: ey + dy,
                            arrowPoints,
                            labelX: label.x,
                            labelY: label.y,
                            snodeId: edgeMapped[id].snodeId,
                            enodeId: edgeMapped[id].enodeId
                        }
                    });
                    layer?.add(copyShape);
                } else {
                    // 是曲线，复制曲线
                    const points: BezierPoints = [sx + dx, -sy - dy, cx + dx, -cy - dy, dataDx + dx, -dataDy - dy, ex + dx, -ey - dy];
                    // 计算曲线的箭头
                    const arrowPoints = computeCubicArrowPoints(points);
                    // 计算曲线的label位置
                    const label = computeBezierLabelPoint(points);
                    const copyShape = new Konva.Shape({
                        ...attrs,
                        id: edgeMapped[id].newId,
                        state: "",
                        shapeStyle: originalStyle,
                        data: {
                            ...(attrs?.data || {}),
                            name: nextName,
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
                            labelY: label.y,
                            snodeId: edgeMapped[id].snodeId,
                            enodeId: edgeMapped[id].enodeId
                        }
                    });
                    layer?.add(copyShape);
                }
            }
        })
    };

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        message.info(t("复制元素中..."));
        saveSnapshot();
        await sleep();
        const formValues = form.getFieldsValue();
        const { count, offsetX, offsetY } = formValues;
        for (let i = 1; i <= count; i++) {
            const offset = {
                offsetX: offsetX * i,
                offsetY: offsetY * i
            };
            // 循环复制
            copySelectShapes(selectShapes, offset);
        }
        setOpenCopy(false);
        message.success(t("复制节点成功"));
    };

    const handleCancel = () => {
        form.resetFields();
        setOpenCopy(false);
    };

    return (
        <Modal
            title={t("复制元素")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
        >
            <Form
                name="copyShapes"
                labelCol={{ span: 8 }}
                wrapperCol={{ span: 16 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<FieldType>
                    label={t("复制目标数量")}
                    name="count"
                    tooltip={t("复制前请确认路径与节点的对应关系")}
                    rules={[{ required: true, message: t("请输入复制目标数量") }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入复制目标数量")}
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                </Form.Item>

                <Form.Item<FieldType>
                    label={t("横向偏移量")}
                    name="offsetX"
                    tooltip="m"
                    rules={[{ required: true, message: t("请输入横向偏移量") }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入横向偏移量")}
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                </Form.Item>

                <Form.Item<FieldType>
                    label={t("纵向偏移量")}
                    name="offsetY"
                    tooltip="m"
                    rules={[{ required: true, message: t("请输入纵向偏移量") }]}
                >
                    <InputNumber
                        style={{ width: "100%" }}
                        placeholder={t("请输入纵向偏移量")}
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                </Form.Item>
            </Form>
        </Modal>
    )
});
