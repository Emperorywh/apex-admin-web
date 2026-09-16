/**
 * @description 三方交管
 * @date 2026-1-15
 */
import { useMemo } from "react";
import { List } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
import type Konva from "konva";
import { unSelectedShape, updateShapeStyle } from "@/utils/graph";
import { useI18n } from "@/hooks/useI18n";
import { removeAreaHighlightFromShape } from "@/utils/areaHighlight";


interface CollapseChildrenProps {
    stage: Konva.Stage | null;
    areaId: string;
    nodeIds: string[];
    edgeIds: string[];
    setSelectShapes: (value: React.SetStateAction<Konva.Shape[]>) => void;
    setTrafficGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void;
}

export default (props: CollapseChildrenProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { stage, areaId, nodeIds, edgeIds, setSelectShapes, setTrafficGroups } = props;

    // 节点列表
    const nodeList = useMemo(() => {
        return nodeIds.map(nodeId => ({
            id: nodeId,
            type: "节点",
            name: stage?.findOne("#" + nodeId)?.attrs?.data?.name || nodeId
        }))
    }, [nodeIds])

    // 路径列表
    const edgeList = useMemo(() => {
        return edgeIds.map(edgeId => ({
            id: edgeId,
            type: "路径",
            name: stage?.findOne("#" + edgeId)?.attrs?.data?.name || edgeId
        }))
    }, [edgeIds])

    const handleDelClick = ({ id, type }: { id: string, type: string, name: string }) => {
        setTrafficGroups(areas => {
            return areas.map(area => ({
                ...area,
                nodeIds: area.id === areaId && type === "节点" ? area.nodeIds.filter(groupId => groupId !== id) : area.nodeIds,
                edgeIds: area.id === areaId && type === "路径" ? area.edgeIds.filter(groupId => groupId !== id) : area.edgeIds
            }));
        });
        // 决策 D1：从高亮区域删除成员，立即褪色(区域未高亮时 util 幂等空操作)
        if (stage) {
            removeAreaHighlightFromShape(stage, areaId, id);
            stage.batchDraw();
        }
    };

    // 聚焦屏幕元素
    const handleTargetClick = (id: string) => {
        if (!stage) return;
        unSelectedShape(stage);
        const element = stage?.findOne(`#${id}`);
        if (!element) return;
        updateShapeStyle(element);
        setSelectShapes([element] as Konva.Shape[]);
        const scaleX = stage.scaleX();
        const scaleY = stage.scaleY();
        // 节点聚焦到坐标，路径聚焦到label的坐标
        const { attrs: { x, y, data: { labelX = 0, labelY = 0 } } } = element;
        // 聚焦到该元素的坐标
        const focusPos = {
            x: -(x || labelX) * scaleX + stage.width() / 2,
            y: -(y || labelY) * scaleY + stage.height() / 2
        };
        stage.to({
            ...focusPos,
            duration: 1
        })
    };

    return (
        <List
            dataSource={[...nodeList, ...edgeList]}
            rowKey={r => r.id}
            renderItem={(item) => (
                <List.Item
                    actions={[
                        <DeleteOutlined onClick={() => handleDelClick(item)} />
                    ]}
                >
                    <span
                        onClick={() => handleTargetClick(item.id)}
                        style={{ flex: 1, cursor: "pointer" }}
                    >
                        {item.name}
                    </span>
                    <List.Item.Meta
                        title={`【${t(item.type)}】`}
                    />
                </List.Item>
            )}
        />
    )
};
