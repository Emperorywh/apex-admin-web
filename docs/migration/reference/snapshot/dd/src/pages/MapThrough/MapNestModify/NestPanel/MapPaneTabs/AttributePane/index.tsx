/**
 * @description 地图编辑中元素属性栏
 * @date 2025-7-8
 */
import { memo } from "react";
import { Alert } from "antd";
import NodeShape from "./NodeShape";
import Konva from "konva";
import EdgeShape from "./EdgeShape";
import { useI18n } from "@/hooks/useI18n";

interface AttributePaneProps {
    stage: Konva.Stage | null;
    selectShapes: Konva.Shape[];
    enableModify: boolean;
}

export default memo((props: AttributePaneProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { stage, selectShapes, enableModify } = props;

    // 全是node节点的时候展示节点表单
    if (enableModify && selectShapes?.length && selectShapes?.every(shape => shape.attrs?.enableSelect === "node")) {
        return (
            <NodeShape
                selectShapes={selectShapes}
            />
        )
    }
    // 全是路径的时候展示路径表单
    if (enableModify && selectShapes?.length && selectShapes?.every(shape => shape.attrs?.enableSelect === "edge")) {
        return (
            <EdgeShape
                stage={stage}
                selectShapes={selectShapes}
            />
        )
    }
    // 其他情况展示默认的
    return (
        <Alert
            message={t("元素属性")}
            type="info"
            showIcon
        />
    )
});
