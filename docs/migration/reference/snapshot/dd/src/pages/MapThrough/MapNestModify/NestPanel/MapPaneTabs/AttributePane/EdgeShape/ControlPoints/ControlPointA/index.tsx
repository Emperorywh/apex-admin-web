/**
 * @description 曲线的控制点A cx, cy
 * @date 2025-8-13
 */
import { useEffect } from "react";
import { Form, Row, Col } from "antd";
import CX from "./CX";
import CY from "./CY";
import type Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface ControlPointAProps {
    selectShapes: Konva.Shape[];
}

export default (props: ControlPointAProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const onControlPointDragMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
        const { target, evt } = event;
        evt.preventDefault();
        if (target === target.getStage() || event.evt.button === 2) return;
        form.setFieldsValue({
            cx: target.x(),
            cy: -target.y()
        });
    };

    useEffect(() => {
        if (!selectShapes?.length) return;
        const [shape] = selectShapes;
        const stage = shape.getStage();
        const controlPointA = stage?.findOne("#controlPointA");
        controlPointA?.on("dragmove", onControlPointDragMove);
    }, [selectShapes])

    return (
        <Form.Item
            label={t("控制点A")}
        >
            <Row
                align="middle"
                gutter={[10, 0]}
                justify="space-between"
                wrap={false}
            >
                <Col span={12}>
                    <CX
                        selectShapes={selectShapes}
                    />
                </Col>
                <Col span={12}>
                    <CY
                        selectShapes={selectShapes}
                    />
                </Col>
            </Row>
        </Form.Item>
    )
};
