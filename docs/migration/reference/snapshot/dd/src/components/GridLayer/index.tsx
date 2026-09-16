/**
 * @description 网格图层 - 在画布最底层绘制辅助网格，以原点(0,0)为中心
 * @date 2026-4-9
 */
import { memo } from "react";
import { Layer, Shape } from "react-konva";

interface GridLayerProps {
    /** 网格是否可见 */
    visible: boolean;
    /** 网格间距，单位：米（1 Konva 单位 = 1 米） */
    gridSpacing: number;
}

/**
 * 网格覆盖范围的半径（米）
 * 以原点为中心，向四个方向各延伸 GRID_EXTENT 米
 * 200 米足以覆盖绝大多数 AGV 地图场景
 */
const GRID_EXTENT = 200;

/** 网格线颜色 */
const GRID_LINE_COLOR = "#CCCCCC";
/** 网格线宽度（世界坐标单位） */
const GRID_LINE_WIDTH = 0.02;

export default memo((props: GridLayerProps) => {

    const { visible, gridSpacing } = props;

    return (
        <Layer visible={visible}>
            <Shape
                listening={false}
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
                sceneFunc={(context) => {
                    /**
                     * 根据间距计算从原点到边界需要绘制多少条网格线
                     * 例如间距为 1m、范围 200m，则需要 200 条正方向 + 200 条负方向
                     */
                    const lineCount = Math.ceil(GRID_EXTENT / gridSpacing);

                    context.strokeStyle = GRID_LINE_COLOR;
                    context.lineWidth = GRID_LINE_WIDTH;

                    /** 绘制竖直方向的网格线（平行于 Y 轴） */
                    for (let i = -lineCount; i <= lineCount; i++) {
                        const x = i * gridSpacing;
                        context.beginPath();
                        context.moveTo(x, -GRID_EXTENT);
                        context.lineTo(x, GRID_EXTENT);
                        context.stroke();
                    }

                    /** 绘制水平方向的网格线（平行于 X 轴） */
                    for (let i = -lineCount; i <= lineCount; i++) {
                        const y = i * gridSpacing;
                        context.beginPath();
                        context.moveTo(-GRID_EXTENT, y);
                        context.lineTo(GRID_EXTENT, y);
                        context.stroke();
                    }
                }}
            />
        </Layer>
    );
});
