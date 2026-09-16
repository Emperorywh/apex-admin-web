/**
 * @description 独占区的图标
 * @date 2025-10-11
 */
import { useState, memo } from "react";
import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import ExclusiveDrawer from "./ExclusiveDrawer";
import type Konva from "konva";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
import TrafficDrawer from "./TrafficDrawer"
import { useI18n } from "@/hooks/useI18n";

interface AreaDropdownPrpos {
    stage: Konva.Stage | null;
    enableModify: boolean;
    trafficGroups: NodeEdgeGroup[];
    exclusiveGroups: NodeEdgeGroup[];
    setSelectShapes: (value: React.SetStateAction<Konva.Shape[]>) => void;
    setTrafficGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void;
    setExclusiveGroups: (value: React.SetStateAction<NodeEdgeGroup[]>) => void;
}

export default memo((props: AreaDropdownPrpos) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { stage, enableModify, trafficGroups, exclusiveGroups, setSelectShapes, setTrafficGroups, setExclusiveGroups } = props;

    // 独占区的抽屉
    const [openExclusiveDrawer, setopenExclusiveDrawer] = useState<boolean>(false);
    // 外部交管抽屉
    const [openTrafficDrawer, setOpenTrafficDrawer] = useState<boolean>(false);

    const items: MenuProps["items"] = [
        {
            key: "exclusive",
            label: t("独占区")
        },
        {
            key: "traffic",
            label: t("三方交管")
        }
    ];

    const onMenuClick: MenuProps["onClick"] = ({ key }) => {
        switch (key) {
            case "exclusive":
                setopenExclusiveDrawer(true);
                break;
            case "traffic":
                setOpenTrafficDrawer(true);
                break;
            default:
                break;
        }
    };

    return (
        <>
            <Dropdown
                placement="bottomRight"
                menu={{
                    items,
                    onClick: onMenuClick,
                    disabled: !enableModify
                }}
            >
                {t("区域")}
            </Dropdown>
            <ExclusiveDrawer
                stage={stage}
                open={openExclusiveDrawer}
                exclusiveGroups={exclusiveGroups}
                setOpen={setopenExclusiveDrawer}
                setSelectShapes={setSelectShapes}
                setExclusiveGroups={setExclusiveGroups}
            />
            <TrafficDrawer
                stage={stage}
                open={openTrafficDrawer}
                trafficGroups={trafficGroups}
                setOpen={setOpenTrafficDrawer}
                setSelectShapes={setSelectShapes}
                setTrafficGroups={setTrafficGroups}
            />
        </>
    )
});