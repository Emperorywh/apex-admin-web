/**
 * @description 三方交管的额外操作
 * @date 2026-1-15
 */
import { memo } from "react";
import { Checkbox, Space, Tooltip } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
import { useI18n } from "@/hooks/useI18n";

interface CollapseExtraProps {
    itemKey: string;
    isHighlighted: boolean;
    /**
     * 高亮三方交管区域
     * @param value 区域ID
     * @param checked 是否高亮
     * @returns 
     */
    onHighlightTrafficArea: (value: string, checked: boolean) => void;
    setCurrentArea: (value: React.SetStateAction<string>) => void;
    setTrafficGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void;
    setOpenLineDrawer: (value: React.SetStateAction<boolean>) => void;
}

export default memo((props: CollapseExtraProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { itemKey, isHighlighted, onHighlightTrafficArea, setCurrentArea, setTrafficGroups, setOpenLineDrawer } = props;

    /**
     * 删除当前三方交管区域，需要先取消高亮，避免 stage 上的颜色残留无法恢复
     * @param e 鼠标点击事件
     */
    const handleDelClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isHighlighted) {
            onHighlightTrafficArea(itemKey, false);
        }
        setTrafficGroups(areas => areas?.filter(area => area.id !== itemKey));
    };

    /**
     * 新增三方交管区域的路径
     * @param e 鼠标点击事件
     */
    const handleAddClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentArea(itemKey);
        setOpenLineDrawer(true);
    };

    return (
        <Space onClick={(e) => e.stopPropagation()}>
            <Tooltip placement="top" title={t("新增")}>
                <PlusOutlined onClick={handleAddClick} />
            </Tooltip>
            <Tooltip placement="top" title={t("删除")}>
                <DeleteOutlined onClick={handleDelClick} />
            </Tooltip>
            <Checkbox checked={isHighlighted} onChange={(e) => onHighlightTrafficArea(itemKey, e.target.checked)}>{t("高亮")}</Checkbox>
        </Space>
    )
});
