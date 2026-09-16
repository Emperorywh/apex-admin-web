/**
 * @description 曲线的两个控制点组件
 * @date 2025-8-13
 */
import { Form } from "antd";
import ControlPointA from "./ControlPointA";
import type Konva from "konva";
import ControlPointB from "./ControlPointB";

interface ControlPointsProps {
    selectShapes: Konva.Shape[];
}

export default (props: ControlPointsProps) => {

    const { selectShapes } = props;

    if (selectShapes?.length === 1 && selectShapes.every(shape => shape.attrs?.enableSelect === "edge" && shape.attrs?.data?.edgeType === "BEZIER")) {
        return (
            <Form.Item
                noStyle
            >
                <ControlPointA
                    selectShapes={selectShapes}
                />
                <ControlPointB
                    selectShapes={selectShapes}
                />
            </Form.Item>
        )
    }
    return null;
};
