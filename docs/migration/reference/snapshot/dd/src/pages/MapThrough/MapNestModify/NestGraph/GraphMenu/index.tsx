/**
 * @description 地图编辑右上角的菜单选项
 * @date 2025-10-11
 */
import { memo, useState } from "react";
import { Menu, Tooltip, message } from "antd";
import type { MenuProps } from "antd";
import { InboxOutlined, EyeOutlined, UndoOutlined, RedoOutlined } from "@ant-design/icons";
import AreaDropdown from "./AreaDropdown";
import type Konva from "konva";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
import DisplayElements from "./DisplayElements";
import type { OverlayVisible } from "@/types/OverLook";
import { canUndo, canRedo } from "@/utils/undoHistory";
import { useI18n } from "@/hooks/useI18n";

type MenuItem = Required<MenuProps>["items"][number];

interface GraphMenuProps {
    stage: Konva.Stage | null;
    enableModify: boolean;
    trafficGroups: NodeEdgeGroup[];
    exclusiveGroups: NodeEdgeGroup[];
    gridSpacing: number;
    setSelectShapes: (value: React.SetStateAction<Konva.Shape[]>) => void;
    setOverlayVisible: (value: React.SetStateAction<OverlayVisible>) => void;
    setGridSpacing: (value: React.SetStateAction<number>) => void;
    setTrafficGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void;
    setExclusiveGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void;
    onUndo: () => void;
    /**
     * 触发恢复操作的上层回调。
     * GraphMenu 不直接维护恢复栈，只通过该回调把用户意图交给画布历史模块处理。
     */
    onRedo: () => void;
}

export default memo((props: GraphMenuProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { stage, enableModify, trafficGroups, exclusiveGroups, gridSpacing, setSelectShapes, setOverlayVisible, setGridSpacing, setTrafficGroups, setExclusiveGroups, onUndo, onRedo } = props;

    // 选中的菜单项
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    // 是否显示隐藏菜单
    const [openDisplays, setOpenDisplays] = useState<boolean>(false);
    // InputNumber 是否聚焦
    const [inputFocused, setInputFocused] = useState<boolean>(false);

    const handleUndo = () => {
        if (!canUndo()) {
            message.info(t("没有可撤销的操作"));
            return;
        }
        onUndo();
    };

    /**
     * 恢复菜单的点击入口
     * 菜单组件只做可用性提示和事件转发，真正的恢复状态流仍由 useUndoHistory 管理。
     */
    const handleRedo = () => {
        if (!canRedo()) {
            message.info(t("没有可恢复的操作"));
            return;
        }
        onRedo();
    };

    /**
     * 顶部菜单统一点击入口
     * 根据菜单 key 将撤销/恢复意图分发到各自处理函数，其他菜单项保持原有交互。
     */
    const onClick: MenuProps["onClick"] = ({ key }) => {
        if (key === "undo") {
            handleUndo();
        }
        if (key === "redo") {
            handleRedo();
        }
        setSelectedKeys([]);
    };

    const items: MenuItem[] = [
        {
            label: (
                <AreaDropdown
                    stage={stage}
                    enableModify={enableModify}
                    trafficGroups={trafficGroups}
                    exclusiveGroups={exclusiveGroups}
                    setSelectShapes={setSelectShapes}
                    setTrafficGroups={setTrafficGroups}
                    setExclusiveGroups={setExclusiveGroups}
                />
            ),
            key: "exclusiveGroup",
            icon: <InboxOutlined />
        },
        {
            label: (
                <DisplayElements
                    openDisplays={openDisplays}
                    gridSpacing={gridSpacing}
                    setOverlayVisible={setOverlayVisible}
                    setGridSpacing={setGridSpacing}
                    onInputFocus={() => setInputFocused(true)}
                    onInputBlur={() => setInputFocused(false)}
                />
            ),
            key: "displayElements",
            icon: <EyeOutlined />,
            onMouseEnter: () => setOpenDisplays(true),
            onMouseLeave: () => {
                if (!inputFocused) setOpenDisplays(false);
            }
        },
        {
            label: (
                <Tooltip title={t("撤销上一步 (最多10步)")}>
                    {t("撤销")}
                </Tooltip>
            ),
            key: "undo",
            icon: <UndoOutlined />,
            disabled: !enableModify
        },
        /**
         * 恢复菜单项与撤销菜单项保持同级。
         * 禁用条件只依赖编辑模式，可恢复性由点击时的 canRedo 提示负责。
         */
        {
            label: (
                <Tooltip title={t("恢复下一步 (最多10步)")}>
                    {t("恢复")}
                </Tooltip>
            ),
            key: "redo",
            icon: <RedoOutlined />,
            disabled: !enableModify
        }
    ];

    return (
        <Menu
            style={{
                position: "absolute",
                right: "1rem",
                top: "1rem",
                width: "30%",
                background: "none"
            }}
            onClick={onClick}
            selectedKeys={selectedKeys}
            mode="horizontal"
            items={items}
        />
    )
});
