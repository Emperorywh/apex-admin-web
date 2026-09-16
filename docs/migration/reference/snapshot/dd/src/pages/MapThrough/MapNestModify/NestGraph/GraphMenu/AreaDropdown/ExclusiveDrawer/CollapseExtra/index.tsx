/**
 * @description 独占区列表的右侧操作按钮
 * @date 2025-10-11
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
     * 高亮独占区
     * @param value 
     * @returns 
     */
    onHighlightExclusiveArea: (value: string, checked: boolean) => void;
    setCurrentArea: (value: React.SetStateAction<string>) => void;
    setExclusiveGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void;
    setOpenLineDrawer: (value: React.SetStateAction<boolean>) => void;
}

export default memo((props: CollapseExtraProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { itemKey, isHighlighted, onHighlightExclusiveArea, setCurrentArea, setExclusiveGroups, setOpenLineDrawer } = props;
    // 删除当前独占区，需要先取消高亮，避免 stage 上的颜色残留无法恢复
    const handleDelClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isHighlighted) {
            onHighlightExclusiveArea(itemKey, false);
        }
        setExclusiveGroups(areas => areas?.filter(area => area.id !== itemKey));
    };

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
            <Checkbox checked={isHighlighted} onChange={(e) => onHighlightExclusiveArea(itemKey, e.target.checked)}>{t("高亮")}</Checkbox>
        </Space>
    )
});
