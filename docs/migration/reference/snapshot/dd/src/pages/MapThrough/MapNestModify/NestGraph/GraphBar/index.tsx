/**
 * @description 地图下方的操作按钮
 * @date 2025-7-8
 */
import { useMemo, memo } from "react";
import Konva from "konva";
import styles from "./index.less";
import ZoomIn from "./ZoomIn";
import ZoomOut from "./ZoomOut";
import FitView from "@/components/FitView";
import RotateMap from "@/components/RotateMap";
import { useI18n } from "@/hooks/useI18n";

interface GraphBarProps {
    stage: Konva.Stage | null;
    mapId: string;
}

export default memo((props: GraphBarProps) => {
/* 国际化翻译方法 */ const { t } = useI18n();

    const { stage, mapId } = props;

    const items = useMemo(() => {
        const items = [
            {
                key: "zoom-in",
                title: t("放大"),
                component: <ZoomIn stage={stage} />,
                ellipsis: { showTitle: true }
            },
            {
                key: "zoom-out",
                title: t("缩小"),
                component: <ZoomOut stage={stage} />,
                ellipsis: { showTitle: true }
            },
            {
                key: "fit-view",
                title: t("聚焦"),
                component: <FitView stage={stage} />,
                ellipsis: { showTitle: true }
            },
            {
                key: "rotate-map",
                title: t("旋转"),
                component: <RotateMap stage={stage} mapId={mapId} />,
                ellipsis: { showTitle: true }
            }
        ];
        return items;
    }, [stage, mapId])

    return (
        <ul className={styles.graph_bar}>
            {
                items.map(item => (
                    <li key={item.key} title={item.title}>
                        {item.component}
                    </li>
                ))
            }
        </ul>
    )
});
