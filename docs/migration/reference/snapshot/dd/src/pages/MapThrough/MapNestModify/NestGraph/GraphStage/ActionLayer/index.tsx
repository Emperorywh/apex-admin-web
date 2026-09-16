/**
 * @description 存放静态元素和功能型组件的Layer
 * @date 2025-7-8
 */
import { Layer } from "react-konva";
import type Konva from "konva";
import BrushSelect from "./BrushSelect";
import AddNode from "./AddNode";
import AddEdge from "./AddEdge";
import ControlPoints from "./ControlPoints";
import Ranging from "./Ranging";
import Transformer from "./Transformer";
import Coordinate from "@/components/Coordinate";

interface ActionLayerProps {
    stage: Konva.Stage | null;
    useMapId: string;
    manualKey: string;
    selectShapes: Konva.Shape[];
    enableModify: boolean;
    /**
     * 自适应视觉倍率（来源于 visualScaleForReact state）
     * 透传给声明式消费者：AddNode、ControlPoints、AddEdge、Ranging
     */
    visualScale: number;
    setSelectShapes: (value: React.SetStateAction<Konva.Shape[]>) => void;
    /**
     * 框选同向路径一次性模式退出用（SPEC brush_same_direction_contextmenu v2 §6.7）：
     * GraphStage → ActionLayer → BrushSelect 透传，有效框选/基准失效时由 BrushSelect 调用
     */
    setManualKey: (value: React.SetStateAction<string>) => void;
}

export default (props: ActionLayerProps) => {

    const { stage, useMapId, manualKey, selectShapes, enableModify, visualScale, setSelectShapes, setManualKey } = props;

    return (
        <Layer>
            <Coordinate />
            <BrushSelect
                stage={stage}
                manualKey={manualKey}
                setSelectShapes={setSelectShapes}
                setManualKey={setManualKey}
            />
            <AddNode
                stage={stage}
                useMapId={useMapId}
                manualKey={manualKey}
                visualScale={visualScale}
            />
            <AddEdge
                stage={stage}
                useMapId={useMapId}
                manualKey={manualKey}
                visualScale={visualScale}
            />
            <ControlPoints
                selectShapes={selectShapes}
                visualScale={visualScale}
            />
            <Ranging
                stage={stage}
                manualKey={manualKey}
                enableModify={enableModify}
                visualScale={visualScale}
            />
            <Transformer
                selectShapes={selectShapes}
            />
        </Layer>
    )
};
