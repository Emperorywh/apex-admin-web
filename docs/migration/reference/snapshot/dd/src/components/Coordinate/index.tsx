/**
 * @description 地图坐标系公共组件
 * @date 2025-6-27
 */
import { memo } from "react";
import { Shape } from "react-konva";

export default memo(() => {

    const data = {
        name: "地图坐标系",
        type: "坐标系"
    }

    return (
        <Shape
            id="coordinate"
            style={{}}
            data={data}
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
            sceneFunc={(context, shape) => {
                context.beginPath();
                // x轴
                context.moveTo(0, 0);
                context.lineTo(5, 0);
                context.moveTo(5, 0);
                context.lineTo(4.8, .05);
                context.lineTo(4.8, -.05);
                context.closePath();
                context.strokeStyle = "#D50000";
                context.lineWidth = .06;
                context.stroke();
                context.fillStyle = "#D50000";
                context.font = "bold .2px Arial";
                context.fillText("X", 4.8, .3);
                // y轴
                context.beginPath();
                context.moveTo(0, 0);
                context.lineTo(0, -5);
                context.moveTo(0, -5);
                context.lineTo(.05, -4.8);
                context.lineTo(-.05, -4.8);
                context.closePath();
                context.strokeStyle = "#107C10";
                context.lineWidth = .06;
                context.stroke();
                context.fillStyle = "#107C10";
                context.font = "bold .2px Arial";
                context.fillText("Y", .3, -4.8);
                // 添加原点文字
                context.fillStyle = "#D50000";
                context.font = "bold .2px Arial";
                context.fillText("0, 0", 0, .2, .5);
                context.closePath();
                context.fillStrokeShape(shape);
            }}
        />
    )
});
