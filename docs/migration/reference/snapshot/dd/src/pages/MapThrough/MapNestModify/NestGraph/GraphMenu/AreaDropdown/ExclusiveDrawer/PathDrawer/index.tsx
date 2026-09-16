/**
 * @description 选择路径的抽屉
 * @date 2025-10-13
 */
import { useEffect, useState, memo } from "react";
import { Drawer, Checkbox } from "antd";
import type { GetProp, CheckboxOptionType } from "antd";
import type Konva from "konva";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
import { useI18n } from "@/hooks/useI18n";
import { removeAreaHighlightFromShape } from "@/utils/areaHighlight";

interface PatnDrawerProps {
    stage: Konva.Stage | null;
    currentArea: string;
    openLineDrawer: boolean;
    exclusiveGroups: NodeEdgeGroup[];
    setOpenLineDrawer: (value: React.SetStateAction<boolean>) => void;
    setExclusiveGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void;
}

export default memo((props: PatnDrawerProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { stage, currentArea, openLineDrawer, exclusiveGroups, setOpenLineDrawer, setExclusiveGroups } = props;

    // 所有的路径节点数组
    const [elementList, setElementList] = useState<CheckboxOptionType<string>[]>([]);
    // 已经选择了的路径
    const [checkedElements, setCheckedElements] = useState<string[]>([]);

    // 关闭抽屉
    const onCloseDrawer = () => {
        setCheckedElements([]);
        setOpenLineDrawer(false)
    };

    const onCheckboxChange: GetProp<typeof Checkbox.Group, "onChange"> = (checkedValues) => {
        console.log("选中的项", checkedValues)
        // 把选中的ids分组 分为节点组和路径组
        const nodeIds = checkedValues.filter(value => {
            const shape = stage?.findOne(`#${value}`)
            return shape?.attrs?.enableSelect === "node"
        });
        const edgeIds = checkedValues.filter(value => {
            const shape = stage?.findOne(`#${value}`)
            return shape?.attrs?.enableSelect === "edge"
        });
        // 决策 D1：计算被移除成员(旧成员 \ 新勾选)，立即褪色；新增成员遵循"新增兜底"，不在此处理
        if (stage && currentArea) {
            const prev = exclusiveGroups.find(a => a.id === currentArea);
            const prevIds = prev ? [...prev.nodeIds, ...prev.edgeIds] : [];
            const newSet = new Set<string>([...nodeIds, ...edgeIds] as string[]);
            prevIds.filter(id => !newSet.has(id)).forEach(id => {
                removeAreaHighlightFromShape(stage, currentArea, id);
            });
            stage.batchDraw();
        }
        setExclusiveGroups(areas => {
            return areas.map(area => ({
                ...area,
                nodeIds: area.id === currentArea ? [...new Set(nodeIds)] as string[] : area.nodeIds,
                edgeIds: area.id === currentArea ? [...new Set(edgeIds)] as string[] : area.edgeIds
            }))
        });
    };

    useEffect(() => {
        if (!stage || !openLineDrawer) return;
        // 查找当前地图的所有路径
        const elements = stage.find((shape: Konva.Shape) => shape.attrs?.enableSelect === "edge" || shape.attrs?.enableSelect === "node");
        const elementOpts: CheckboxOptionType<string>[] = elements.map(element => ({
            label: element.attrs?.data?.name + `【${element.attrs?.enableSelect === "node" ? t("节点") : t("路径")}】`,
            type: element.attrs?.enableSelect,
            value: element.attrs?.id
        }))
        setElementList(elementOpts);
    }, [openLineDrawer])

    useEffect(() => {
        if (!exclusiveGroups?.length || !currentArea) return;
        const target = exclusiveGroups.find(area => area.id === currentArea);
        console.log("拿到的目标", target)
        if (!target) return;
        setCheckedElements([...target?.edgeIds, ...target?.nodeIds]);
    }, [exclusiveGroups, currentArea])

    return (
        <Drawer
            title={t("选择元素")}
            onClose={onCloseDrawer}
            open={openLineDrawer}
            mask={false}
        >
            <Checkbox.Group
                style={{ display: "flex", flexDirection: "column" }}
                value={checkedElements}
                options={elementList}
                onChange={onCheckboxChange}
            />
        </Drawer>
    )
});
