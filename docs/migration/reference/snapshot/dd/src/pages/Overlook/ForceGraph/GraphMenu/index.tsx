/**
 * @description 画布顶部右侧的菜单
 * @date 2025-6-19
 */
import { memo, useState } from "react";
import { Menu, Popover } from "antd";
import type { MenuProps } from "antd";
import { SearchOutlined, EyeOutlined, ShareAltOutlined, SisternodeOutlined, FullscreenOutlined, FullscreenExitOutlined, BlockOutlined } from "@ant-design/icons";
import { useFullscreen, useKeyPress } from "ahooks";
import { useI18n } from "@/hooks/useI18n";
import { useAccess } from "@/hooks/useAccess";
import { PERM_BUTTON } from "@/constants/permission";
import styles from "./index.less";
import GlobalSearch from "./GlobalSearch";
import DisplayElements from "./DisplayElements";
import type { OverlayVisible } from "@/types/OverLook";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
import AreaHighlightPanel from "@/components/AreaHighlightPanel";
import Konva from "konva";
import VerifyConnectModal from "./VerifyConnectModal";
import CreateOrderModal from "@/components/CreateOrderModal";

type MenuItem = Required<MenuProps>["items"][number];

interface GraphMenuProps {
    stage: Konva.Stage | null;
    focusId?: string;
    graphRef: React.RefObject<HTMLDivElement>;
    gridSpacing: number;
    setFocusId: (value: React.SetStateAction<string | undefined>) => void;
    setOverlayVisible: (value: React.SetStateAction<OverlayVisible>) => void;
    setGridSpacing: (value: React.SetStateAction<number>) => void;
    /** 独占区分组（ForceGraph 已按类型拆分） */
    exclusiveGroups: NodeEdgeGroup[];
    /** 三方交管分组 */
    trafficGroups: NodeEdgeGroup[];
    /** 当前高亮中的区域ID集合 */
    highlightedAreaIds: Set<string>;
    /** 勾选/取消区域高亮（实现在 ForceGraph，此处透传） */
    onToggleHighlight: (areaId: string, checked: boolean) => void;
}

export default memo((props: GraphMenuProps) => {

    const { stage, focusId, graphRef, gridSpacing, setFocusId, setOverlayVisible, setGridSpacing, exclusiveGroups, trafficGroups, highlightedAreaIds, onToggleHighlight } = props;

    /* 国际化翻译方法，用于将菜单项文案进行多语言转换 */
    const { t } = useI18n();

    /* 按钮级权限判定（SPEC §8.3）：创建任务 / 路径校验 菜单项 */
    const { hasPerm } = useAccess();
    const canCreateOrder = hasPerm(PERM_BUTTON.OVERVIEW_ORDER_RECORD_CREATE); // 任务菜单项（§7.1）
    const canVerify = hasPerm(PERM_BUTTON.OVERVIEW_MAP_CHECK); // 校验菜单项（§7.1）

    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

    // 全局搜索下拉
    const [openSearch, setOpenSearch] = useState<boolean>(false);
    // 是否打开展示菜单
    const [openDisplays, setOpenDisplays] = useState<boolean>(false);
    // 是否打开区域面板
    const [openAreas, setOpenAreas] = useState<boolean>(false);
    // 网格间距输入框是否聚焦
    const [inputFocused, setInputFocused] = useState<boolean>(false);
    // 校验路径连通性的弹窗
    const [openVerifyModal, setOpenVerifyModal] = useState<boolean>(false);
    // 创建订单的弹窗
    const [openCreateOrder, setOpenCreateOrder] = useState<boolean>(false);

    // 画布全屏操作
    const [isFullscreen, { enterFullscreen, exitFullscreen }] = useFullscreen(graphRef, {
        pageFullscreen: { zIndex: 100 }
    })

    // ESC退出画布全屏
    useKeyPress("Esc", () => {
        isFullscreen && exitFullscreen();
    });

    const onClick: MenuProps["onClick"] = (event) => {
        console.log('click ', event);
        const key = event.key;
        switch (key) {
            case "globalSearch":
                setOpenSearch(true);
                break;
            case "displayElements":
                setOpenDisplays(true);
                break;
            case "areas":
                setOpenAreas(true);
                break;
            case "verifyConnectPath":
                setOpenVerifyModal(true);
                break;
            case "createOrder":
                setOpenCreateOrder(true);
                break;
            case "fullscreen":
                isFullscreen ? exitFullscreen() : enterFullscreen();
                break;
            default:
                setSelectedKeys([]);
                break;
        }
        // setCurrent(e.key);
    };

    const items: MenuItem[] = [
        {
            label: (
                <GlobalSearch
                    stage={stage}
                    focusId={focusId}
                    openSearch={openSearch}
                    setFocusId={setFocusId}
                />
            ),
            key: "globalSearch",
            icon: <SearchOutlined />,
            onMouseEnter: () => setOpenSearch(true),
            onMouseLeave: () => setOpenSearch(false)

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
            onMouseLeave: () => !inputFocused && setOpenDisplays(false)
        },
        {
            // 区域面板（SPEC_area_highlight_monitoring_playback §4.3）：悬停开合与其它项一致；
            // 面板收起后高亮保留（D2），取消高亮随时可再悬停打开操作
            label: (
                <Popover
                    open={openAreas}
                    placement="bottomRight"
                    trigger={[]}
                    content={
                        <AreaHighlightPanel
                            exclusiveGroups={exclusiveGroups}
                            trafficGroups={trafficGroups}
                            highlightedIds={highlightedAreaIds}
                            onToggle={onToggleHighlight}
                        />
                    }
                >
                    <span>{t("区域")}</span>
                </Popover>
            ),
            key: "areas",
            icon: <BlockOutlined />,
            onMouseEnter: () => setOpenAreas(true),
            onMouseLeave: () => setOpenAreas(false)
        },
        /* 路径校验菜单项：无权限隐藏（§7.1，对应 VerifyConnectModal） */
        ...(canVerify ? [{
            label: t("校验"),
            key: "verifyConnectPath",
            icon: <ShareAltOutlined />
        }] : []),
        /* 创建任务菜单项：无权限隐藏（§7.1，对应 CreateOrderModal） */
        ...(canCreateOrder ? [{
            label: t("任务"),
            key: "createOrder",
            icon: <SisternodeOutlined />
        }] : []),
        {
            label: t("全屏"),
            key: "fullscreen",
            icon: isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />
        }
    ];

    return (
        <>
            <Menu
                className={styles.graph_menu}
                style={{ background: "none" }}
                onClick={onClick}
                selectedKeys={focusId ? ["globalSearch"] : selectedKeys}
                mode="horizontal"
                multiple
                items={items}
            />
            {/* 校验路径连通性的弹窗 */}
            <VerifyConnectModal
                open={openVerifyModal}
                setOpenVerifyModal={setOpenVerifyModal}
            />
            {/* 创建订单的弹窗 */}
            <CreateOrderModal
                open={openCreateOrder}
                setOpenCreateOrder={setOpenCreateOrder}
            />
        </>
    )
});