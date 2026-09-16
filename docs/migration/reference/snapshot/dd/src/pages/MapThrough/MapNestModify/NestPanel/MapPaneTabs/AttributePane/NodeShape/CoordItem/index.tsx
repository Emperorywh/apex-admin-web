/**
 * @description 元素坐标组件
 * @date 2025-7-18
 */
import { memo, useEffect } from "react";
import { Form, Row, Col } from "antd";
import CoordX from "./CoordX";
import CoordY from "./CoordY";
import Konva from "konva";
import { useI18n } from "@/hooks/useI18n";

interface CoordItemProps {
    selectShapes: Konva.Shape[];
}

export default memo((props: CoordItemProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { selectShapes } = props;

    const form = Form.useFormInstance();

    const onNodeDragMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
        event.evt.preventDefault();
        const { target } = event;
        if (target === target.getStage() || event.evt.button === 2) return;
        form.setFieldsValue({
            x: target.x(),
            y: -target.y()
        });
    };

    useEffect(() => {
        if (selectShapes?.length !== 1) return;
        const [shape] = selectShapes;
        shape.on("dragmove", onNodeDragMove);
    }, [selectShapes])

    if (selectShapes?.length === 1) {
        return (
            <Form.Item
                label={t("坐标")}
            >
                <Row
                    align="middle"
                    gutter={[10, 0]}
                    justify="space-between"
                    wrap={false}
                >
                    <Col span={12}>
                        <CoordX
                            selectShapes={selectShapes}
                        />
                    </Col>
                    <Col span={12}>
                        <CoordY
                            selectShapes={selectShapes}
                        />
                    </Col>
                </Row>
            </Form.Item>
        )
    }
    return null;
});
