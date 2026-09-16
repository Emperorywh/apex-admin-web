/**
 * @description 路径的控制点B坐标
 * @date 2025-8-13
 */
import { useEffect } from "react";
import { Form, Row, Col } from "antd";
import type Konva from "konva";
import DX from "./DX";
import DY from "./DY";
import { useI18n } from "@/hooks/useI18n";

interface ControlPointBProps {
    selectShapes: Konva.Shape[];
}

export default (props: ControlPointBProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const onControlPointDragMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
        const { target, evt } = event;
        evt.preventDefault();
        if (target === target.getStage() || event.evt.button === 2) return;
        form.setFieldsValue({
            dx: target.x(),
            dy: -target.y()
        });
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const stage = shape.getStage();
        const controlPointB = stage?.findOne("#controlPointB");
        controlPointB?.on("dragmove", onControlPointDragMove);
    }, [selectShapes])

    return (
        <Form.Item
            label={t("控制点B")}
        >
            <Row
                align="middle"
                gutter={[10, 0]}
                justify="space-between"
                wrap={false}
            >
                <Col span={12}>
                    <DX
                        selectShapes={selectShapes}
                    />
                </Col>
                <Col span={12}>
                    <DY
                        selectShapes={selectShapes}
                    />
                </Col>
            </Row>
        </Form.Item>
    )
};
