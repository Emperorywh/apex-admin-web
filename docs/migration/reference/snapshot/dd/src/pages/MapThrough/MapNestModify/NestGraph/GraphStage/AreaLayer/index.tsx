/**
 * @description 功能区的layer
 * @date 2025-10-11
 */
import {} from "react";
import { Layer, Shape } from "react-konva";
import type Konva from "konva";

export default () => {

    const onShapeClick = (event: Konva.KonvaEventObject<MouseEvent>) => {

    };

    return (
        <Layer>
            <Shape
                id="test"
                fill={"red"}
                stroke={"#000"}
                strokeWidth={.2}
                data={{
                    points: [2, 5, 22, 8, 10, 15]
                }}
                onClick={onShapeClick}
                sceneFunc={(context, shape) => {
                    const { attrs: { data: { points } } } = shape;
                    context.beginPath();
                    context.moveTo(points[0], points[1]);
                    context.closePath();
                    context.fillStrokeShape(shape);
                }}
            />
        </Layer>
    )
};
