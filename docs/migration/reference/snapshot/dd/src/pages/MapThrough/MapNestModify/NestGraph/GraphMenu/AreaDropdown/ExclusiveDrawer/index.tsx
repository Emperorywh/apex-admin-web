/**
 * @description 独占区配置的抽屉
 * @date 2025-10-11
 */
import { useCallback, useMemo, useState } from "react";
import { Drawer, Space, Button, Collapse, Input, message } from "antd";
import type { CollapseProps } from "antd";
import CollapseExtra from "./CollapseExtra";
import PathDrawer from "./PathDrawer";
import type Konva from "konva";
import { sequenceStringArray, getRandomString } from "@/utils/public";
import { calcStagePosition } from "@/utils/bindStage";
import CollapseChildren from "./CollapseChildren";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
import { useI18n } from "@/hooks/useI18n";
import { blendColors, removeAreaHighlightFromShape } from "@/utils/areaHighlight";

const AREA_COLORS = [
    "#FF6F00", "#2979FF", "#00C853", "#AA00FF", "#FF1744",
    "#00BFA5", "#FFD600", "#F50057", "#00B0FF", "#76FF03",
    "#D500F9", "#FF9100",
];

// 用 id 哈希取色，避免数组下标变化（删除/重排）后颜色错乱
function getAreaColor(id: string): string {
    let h = 0;
    for (let i = 0; i < id.length; i++) {
        h = (h * 31 + id.charCodeAt(i)) >>> 0;
    }
    return AREA_COLORS[h % AREA_COLORS.length];
}

interface ExclusiveDrawerProps {
    stage: Konva.Stage | null;
    open: boolean;
    exclusiveGroups: NodeEdgeGroup[];
    setOpen: (value: React.SetStateAction<boolean>) => void;
    setSelectShapes: (value: React.SetStateAction<Konva.Shape[]>) => void;
    setExclusiveGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void;
}

export default function ExclusiveDrawer(props: ExclusiveDrawerProps) {

    const { stage, open, exclusiveGroups, setOpen, setSelectShapes, setExclusiveGroups } = props;

    /* 国际化翻译方法 */
    const { t } = useI18n();

    // 打开抽屉
    const [openLineDrawer, setOpenLineDrawer] = useState<boolean>(false);
    // 当前添加的独占区Key
    const [currentArea, setCurrentArea] = useState<string>("");
    // 当前高亮的独占区ID集合
    const [highlightedAreas, setHighlightedAreas] = useState<Set<string>>(new Set());
    // 当前激活的面板key
    const [activeKey, setActiveKey] = useState<string | string[]>("");
    const onCollapseChange: CollapseProps["onChange"] = useCallback((value: string | string[]) => {
        setActiveKey(value);
    }, []);

    // 递增新增独占区域
    const handleAddExclusiveArea = useCallback(() => {
        const exclusiveNames = exclusiveGroups?.map(item => item.name);
        const increaseNum = sequenceStringArray(exclusiveNames || []);
        const randomId: string = getRandomString();
        setExclusiveGroups(areas => [
            ...areas,
            {
                id: randomId,
                name: `${t("独占区")}${increaseNum}`,
                nodeIds: [],
                edgeIds: [],
                userDefinedProperties: {
                    nodeEdgeGroupType: "SINGLE_VEHICLE" // nodeEdgeGroupType = SINGLE_VEHICLE（独占区）TRIPARTITE_TRAFFIC（三方交管区）
                }
            }
        ]);
    }, [exclusiveGroups, setExclusiveGroups]);

    // 修改独占区的名字（重名校验需排除自身）
    const onAreaNameChange = useCallback((id: string, value?: string) => {
        const trimmed = (value || '').trim();
        if (trimmed) {
            const duplicated = exclusiveGroups.some(area => area.id !== id && area.name === trimmed);
            if (duplicated) {
                message.warning(t("区域名称不能重复"));
                return;
            }
        }
        setExclusiveGroups(areas => areas.map(area => ({
            ...area,
            name: area.id === id ? (value || '') : area.name
        })));
    }, [exclusiveGroups, setExclusiveGroups]);

    /**
     * 对指定形状应用某个区域的高亮（不更新 React state，仅操作 stage）
     */
    const applyHighlightToStage = useCallback((itemKey: string, checked: boolean) => {
        if (!stage) return [] as string[];
        const targetArea = exclusiveGroups.find(a => a.id === itemKey);
        if (!targetArea) return [] as string[];
        const allIds = [...targetArea.nodeIds, ...targetArea.edgeIds];
        const areaColor = getAreaColor(targetArea.id);
        if (checked) {
            // 勾选高亮：仅遍历当前成员上色（含"新增兜底"对账：已移除成员不会再上色）
            allIds.forEach(id => {
                const shape = stage.findOne(`#${id}`);
                if (!shape) return;
                const currentStyle = shape.attrs.shapeStyle || {};
                const isNode = shape.attrs.enableSelect === "node";
                const colorMap: Record<string, string> = { ...(shape.getAttr("highlightColorMap") || {}) };
                if (Object.keys(colorMap).length === 0) {
                    shape.setAttr("originalColors", {
                        fill: currentStyle.fill,
                        stroke: currentStyle.stroke,
                        labelFill: currentStyle.labelFill,
                    });
                }
                colorMap[itemKey] = areaColor;
                const blended = blendColors(Object.values(colorMap));
                shape.setAttrs({
                    highlightColorMap: colorMap,
                    shapeStyle: {
                        ...currentStyle,
                        fill: isNode ? blended : currentStyle.fill,
                        stroke: isNode ? currentStyle.stroke : blended,
                        labelFill: blended,
                    }
                });
            });
        } else {
            // 决策 D6：取消高亮时做全 stage 扫描兜底，清理所有持有该 areaId 的 shape
            //         （含已被移除出成员列表、但残留高亮色的 shape），用公共工具逐个精确移除
            const staleShapes = stage.find((node: Konva.Node) => {
                const map = node.getAttr("highlightColorMap");
                return !!map && Object.prototype.hasOwnProperty.call(map, itemKey);
            }) as Konva.Shape[];
            staleShapes.forEach(s => removeAreaHighlightFromShape(stage, itemKey, s.id()));
        }
        return allIds;
    }, [stage, exclusiveGroups]);

    /**
     * 高亮独占区
     * @param itemKey 独占区ID
     * @param checked 是否高亮
     */
    const handleHighlightExclusiveArea = useCallback((itemKey: string, checked: boolean) => {
        if (!stage) return;
        const allIds = applyHighlightToStage(itemKey, checked);
        stage.batchDraw();

        setHighlightedAreas(prev => {
            const next = new Set(prev);
            if (checked) next.add(itemKey);
            else next.delete(itemKey);
            return next;
        });

        if (checked && allIds.length > 0) {
            const firstElement = stage.findOne(`#${allIds[0]}`);
            if (firstElement) {
                const scaleX = stage.scaleX();
                const scaleY = stage.scaleY();
                const rotation = stage.rotation();
                const { x, y, data = {} } = firstElement.attrs as {
                    x?: number;
                    y?: number;
                    data?: { labelX?: number; labelY?: number };
                };
                const { labelX = 0, labelY = 0 } = data;
                // 用 ?? 避免 0 这种合法坐标被错误地 fallback 到 labelX/Y
                const targetX = x ?? labelX;
                const targetY = y ?? labelY;
                // 兼容地图旋转：用 calcStagePosition 同时考虑 translate/rotate/scale
                const pos = calcStagePosition(
                    targetX,
                    targetY,
                    scaleX,
                    scaleY,
                    rotation,
                    stage.width() / 2,
                    stage.height() / 2,
                );
                stage.to({
                    x: pos.x,
                    y: pos.y,
                    duration: 0.3,
                });
            }
        }
    }, [stage, applyHighlightToStage]);

    // 关闭抽屉时校验所有区域名称并取消所有高亮
    const handleClose = useCallback(() => {
        const emptyNames = exclusiveGroups.filter(area => !area.name?.trim());
        if (emptyNames.length > 0) {
            message.warning(t("存在未填写的区域名称，请补充完整"));
            return;
        }
        const nameSet = new Set<string>();
        for (const area of exclusiveGroups) {
            const name = area.name.trim();
            if (nameSet.has(name)) {
                message.warning(t("区域名称不能重复"));
                return;
            }
            nameSet.add(name);
        }
        // 直接操作 stage，避免逐个调用导致多次 setState
        if (stage) {
            highlightedAreas.forEach(areaId => {
                applyHighlightToStage(areaId, false);
            });
            stage.batchDraw();
        }
        setHighlightedAreas(new Set());
        setOpen(false);
    }, [exclusiveGroups, highlightedAreas, stage, applyHighlightToStage, setOpen]);

    const collapseItems = useMemo(() => (
        exclusiveGroups?.map(area => ({
            key: area.id,
            label: (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                        display: "inline-block",
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        backgroundColor: getAreaColor(area.id),
                        flexShrink: 0,
                        border: "1px solid rgba(0,0,0,0.15)",
                    }} />
                    <Input
                        variant="borderless"
                        placeholder={t("区域名称")}
                        value={area.name}
                        onChange={(e) => onAreaNameChange(area.id, e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                </div>
            ),
            children: (
                <CollapseChildren
                    stage={stage}
                    areaId={area.id}
                    nodeIds={area.nodeIds}
                    edgeIds={area.edgeIds}
                    setSelectShapes={setSelectShapes}
                    setExclusiveGroups={setExclusiveGroups}
                />
            ),
            extra: (
                <CollapseExtra
                    itemKey={area.id}
                    isHighlighted={highlightedAreas.has(area.id)}
                    onHighlightExclusiveArea={handleHighlightExclusiveArea}
                    setCurrentArea={setCurrentArea}
                    setExclusiveGroups={setExclusiveGroups}
                    setOpenLineDrawer={setOpenLineDrawer}
                />
            )
        }))
    ), [exclusiveGroups, stage, highlightedAreas, onAreaNameChange, handleHighlightExclusiveArea, setSelectShapes, setExclusiveGroups]);

    return (
        <Drawer
            title={t("独占区配置")}
            onClose={handleClose}
            open={open}
            mask={false}
            extra={
                <Space>
                    <Button
                        type="primary"
                        onClick={handleAddExclusiveArea}
                    >
                        {t("新增独占区")}
                    </Button>
                </Space>
            }
            width={500}
        >
            {/* 独占区列表 */}
            <Collapse
                activeKey={activeKey}
                bordered={false}
                items={collapseItems}
                collapsible="icon"
                onChange={onCollapseChange}
            />
            {/* 选择路径的抽屉 */}
            <PathDrawer
                stage={stage}
                currentArea={currentArea}
                openLineDrawer={openLineDrawer}
                exclusiveGroups={exclusiveGroups}
                setOpenLineDrawer={setOpenLineDrawer}
                setExclusiveGroups={setExclusiveGroups}
            />
        </Drawer>

    )
};
