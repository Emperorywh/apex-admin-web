/**
 * @description 只读区域高亮面板（独占区/三方交管），Overlook 与 RecordPlayback 共用。
 *              面板只是高亮开关载体：收起后高亮保留（D2），不持久化（D10）。
 *              色点颜色与画布染色同源（同哈希 + 同调色板），天然图例。
 * @date 2026-09-09
 */
import { memo } from "react";
import { Checkbox, Empty } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import type { NodeEdgeGroup } from "@/types/MapNestModify";
import { EXCLUSIVE_AREA_COLORS, TRAFFIC_AREA_COLORS, getAreaColor } from "@/utils/areaHighlight";
import { useI18n } from "@/hooks/useI18n";
import styles from "./index.less";

interface AreaHighlightPanelProps {
    /** 独占区分组列表 */
    exclusiveGroups: NodeEdgeGroup[];
    /** 三方交管分组列表 */
    trafficGroups: NodeEdgeGroup[];
    /** 当前高亮中的区域ID集合 */
    highlightedIds: Set<string>;
    /** 勾选/取消某区域高亮 */
    onToggle: (areaId: string, checked: boolean) => void;
    /** 底部提示（RecordPlayback 传版本提示文案，Overlook 不传） */
    footerHint?: React.ReactNode;
}

export default memo((props: AreaHighlightPanelProps) => {

    const { exclusiveGroups, trafficGroups, highlightedIds, onToggle, footerHint } = props;

    const { t } = useI18n();

    const renderGroup = (title: string, groups: NodeEdgeGroup[], palette: string[]) => {
        // 单组为空时该组标题不渲染（§4.5）
        if (!groups.length) return null;
        return (
            <>
                <div className={styles.section_title}>{title}</div>
                <div className={styles.area_list}>
                    {
                        groups.map(area => {
                            const nodeCount = area.nodeIds?.length ?? 0;
                            const edgeCount = area.edgeIds?.length ?? 0;
                            return (
                                <div key={area.id} className={styles.area_row}>
                                    <span
                                        className={styles.color_dot}
                                        style={{ backgroundColor: getAreaColor(area.id, palette) }}
                                    />
                                    <span className={styles.area_name} title={area.name}>{area.name}</span>
                                    <span className={styles.member_count}>{t("{nodeCount}节点/{edgeCount}路径", { nodeCount, edgeCount })}</span>
                                    <Checkbox
                                        className={styles.highlight_checkbox}
                                        checked={highlightedIds.has(area.id)}
                                        onChange={(e) => onToggle(area.id, e.target.checked)}
                                    >
                                        {t("高亮")}
                                    </Checkbox>
                                </div>
                            )
                        })
                    }
                </div>
            </>
        )
    };

    return (
        <div className={styles.panel_container}>
            {
                exclusiveGroups.length || trafficGroups.length
                    ? (
                        <>
                            {renderGroup(t("独占区"), exclusiveGroups, EXCLUSIVE_AREA_COLORS)}
                            {renderGroup(t("三方交管"), trafficGroups, TRAFFIC_AREA_COLORS)}
                        </>
                    )
                    : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("当前地图未配置区域")} />
            }
            {
                footerHint && (
                    <div className={styles.footer_hint}>
                        <InfoCircleOutlined />
                        <span>{footerHint}</span>
                    </div>
                )
            }
        </div>
    )
});
