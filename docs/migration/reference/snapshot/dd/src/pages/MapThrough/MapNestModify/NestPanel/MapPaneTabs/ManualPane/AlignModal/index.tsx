/**
 * @description 连线对齐的弹窗
 * @date 2025-7-28
 */
import { useEffect, useState } from "react";
import { Modal, Form, Select, message } from "antd";
import type { SelectProps } from "antd";
import type Konva from "konva";
import { pointInABline } from "@/utils/math";
import { screenToWorld, worldToScreen } from "@/utils/bindStage";
import { syncNodePositionWithEdges } from "@/utils/nodeEdgeGeometry";
import { saveSnapshot } from "@/utils/undoHistory";
import { useI18n } from "@/hooks/useI18n";

type FieldType = {
    source: string;
    target: string;
}

interface AlignModalProps {
    open: boolean;
    selectShapes: Konva.Shape[];
    setOpenAlign: (value: React.SetStateAction<boolean>) => void;
}

export default (props: AlignModalProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { open, selectShapes, setOpenAlign } = props;

    const [nodeOpts, setNodeOpts] = useState<SelectProps[]>([]);

    const [form] = Form.useForm<FieldType>();

    const handleOk = async () => {
        const validate = await form.validateFields();
        if (!validate) return;
        const { source, target } = form.getFieldsValue();
        const sourceNode = selectShapes.find(shape => shape.id() === source);
        const targetNode = selectShapes.find(shape => shape.id() === target);
        const restNodes = selectShapes.filter(shape => shape.attrs?.enableSelect === "node" && shape.id() !== source && shape.id() !== target);
        if (!sourceNode || !targetNode) return;
        const stage = sourceNode.getStage();
        if (!stage) return;
        const sourceVisualPoint = worldToScreen(sourceNode.x(), sourceNode.y(), stage);
        const targetVisualPoint = worldToScreen(targetNode.x(), targetNode.y(), stage);
        /**
         * 投影计算需要一条有效的视觉线段。
         * 使用极小阈值兜住同坐标或几乎重合的基准点，
         * 避免 pointInABline 中除以接近 0 的长度平方。
         */
        const visualLineLength = Math.hypot(sourceVisualPoint.x - targetVisualPoint.x, sourceVisualPoint.y - targetVisualPoint.y);
        if (visualLineLength < 1e-6) {
            message.warning(t("起点和终点的视觉位置不能重合"));
            return;
        }
        saveSnapshot();
        const sourcePoint: [number, number] = [sourceVisualPoint.x, sourceVisualPoint.y];
        const targetPoint: [number, number] = [targetVisualPoint.x, targetVisualPoint.y];
        /**
         * 两点连线对齐的“线”应当是用户屏幕上看到的线。
         * 因此先在屏幕坐标系里做点到直线投影，再反解回 Stage 本地坐标；
         * 起点和终点作为视觉基准不移动，只移动剩余节点并同步关联路径。
         */
        restNodes.forEach(shape => {
            const shapeVisualPoint = worldToScreen(shape.x(), shape.y(), stage);
            const shapePoint: [number, number] = [shapeVisualPoint.x, shapeVisualPoint.y];
            const projectedPoint = pointInABline(sourcePoint, targetPoint, shapePoint);
            const nextPosition = screenToWorld(projectedPoint.x, projectedPoint.y, stage);
            syncNodePositionWithEdges(shape, nextPosition);
        });
        // 整个流程都是直接 setAttrs，没有触发 Konva drag/mouse 事件，
        // AnglesLayer 感知不到几何变化；主动派发一次 angles:refresh 让夹角层立刻重算
        stage?.fire("angles:refresh", {} as any);
        form.resetFields();
        setOpenAlign(false);
    };

    const handleCancel = () => {
        form.resetFields();
        setOpenAlign(false);
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const nodeShapes = selectShapes.filter(shape => shape.attrs?.enableSelect === "node");
        const selectedNodes = nodeShapes.map(shape => ({
            label: shape.attrs?.data?.name,
            value: shape.id()
        }));
        setNodeOpts(selectedNodes);
    }, [selectShapes])

    return (
        <Modal
            title={t("连线对齐")}
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText={t("确定")}
            cancelText={t("取消")}
        >
            <Form
                name="alignForm"
                labelCol={{ span: 4 }}
                wrapperCol={{ span: 20 }}
                autoComplete="off"
                form={form}
            >
                <Form.Item<FieldType>
                    label={t("起点")}
                    name="source"
                    validateFirst
                    rules={[
                        { required: true, message: t("请选择起点") },
                        ({ getFieldValue }) => ({
                            validator(_, value) {
                                const target = getFieldValue("target");
                                if (target === value) {
                                    return Promise.reject(new Error(t("起点不能和终点相同")));
                                }
                                return Promise.resolve();
                            }
                        })
                    ]}
                >
                    <Select
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder={t("请选择连线起点")}
                        options={nodeOpts}
                    />
                </Form.Item>

                <Form.Item<FieldType>
                    label={t("终点")}
                    name="target"
                    validateFirst
                    rules={[
                        { required: true, message: t("请选择终点") },
                        ({ getFieldValue }) => ({
                            validator(_, value) {
                                const source = getFieldValue("source");
                                if (source === value) {
                                    return Promise.reject(new Error(t("起点不能和终点相同")));
                                }
                                return Promise.resolve();
                            }
                        })
                    ]}
                >
                    <Select
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder={t("请选择连线终点")}
                        options={nodeOpts}
                    />
                </Form.Item>

            </Form>
        </Modal>
    )
};
