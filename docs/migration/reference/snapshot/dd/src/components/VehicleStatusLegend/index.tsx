/**
 * @description 车辆状态图例（画布右下角，折叠式，默认收起）
 * @date 2026-7-29
 *
 * Overlook / MapNestModify / RecordPlayback 三画布共用（SPEC_vehicle_status_legend.md）。
 * 颜色数据全部来自 constants/vehicleLegend（单一数据源 robotProperty），画布改色图例自动跟随。
 * 纯静态说明：无实时计数、无悬停联动、条目不可点击；
 * 展开态仅存组件 state、不持久化，刷新/切页后回到收起；
 * 与车辆图层显隐无关，图层隐藏时图例保持显示。
 */
import { memo, useState, Fragment } from "react";
import { Button } from "antd";
import { DownOutlined, RightOutlined } from "@ant-design/icons";
import { useI18n } from "@/hooks/useI18n";
import {
    VEHICLE_LEGEND_GROUPS,
    type VehicleLegendDecorationItem,
} from "@/constants/vehicleLegend";
import styles from "./index.less";

export default memo(() => {

    /* 国际化翻译方法，常量中的中文 label 在此统一 t() 转换 */
    const { t } = useI18n();

    // 展开态：不持久化（SPEC §4.2）
    const [expanded, setExpanded] = useState(false);

    /**
     * 事件阻断：图例上的鼠标事件不穿透到画布 ——
     * 右键不得打开画布右键菜单、拖拽不得平移画布、滚轮不得缩放（SPEC §4.2）。
     */
    const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

    /**
     * 渲染装饰组条目的示意图形。
     * 几何形状由 less 按 glyph 类型绘制，颜色内联给定（来自常量）；
     * 白色图形（载货线/充电三角/车头竖线）需深灰底衬才可辨识，蓝色任务圆点无底衬。
     */
    const renderGlyph = (item: VehicleLegendDecorationItem) => {
        // 三角用 CSS border 技巧绘制，颜色作用于带色那条边；其余图形用 background
        const glyphStyle =
            item.glyph === "triangle"
                ? { borderRightColor: item.color }
                : { background: item.color };
        return (
            <span
                className={`${styles.swatch} ${item.glyph !== "dot" ? styles.backing : ""
                    }`}
            >
                <span className={styles[item.glyph]} style={glyphStyle} />
            </span>
        );
    };

    return (
        <div
            className={styles.vehicle_status_legend}
            onClick={stopPropagation}
            onMouseDown={stopPropagation}
            onContextMenu={stopPropagation}
            onWheel={stopPropagation}
        >
            {
                expanded &&
                <div className={styles.panel}>
                    {VEHICLE_LEGEND_GROUPS.map((group, groupIndex) => (
                        <Fragment key={group.key}>
                            {/* 组间仅用细分隔线，不加组标题（控制面板高度，SPEC §2） */}
                            {groupIndex > 0 && <div className={styles.divider} />}
                            {
                                group.key === "status" &&
                                group.items.map((item) => (
                                    <div className={styles.item} key={item.label}>
                                        {/* 填充 + 描边双色块，贴近画布车体观感；异常近黑填充靠亮粉描边辨识 */}
                                        <span
                                            className={`${styles.swatch} ${styles.status_swatch}`}
                                            style={{
                                                background: item.fill,
                                                borderColor: item.stroke,
                                            }}
                                        />
                                        <span>{t(item.label)}</span>
                                    </div>
                                ))
                            }
                            {
                                group.key === "warning" &&
                                group.items.map((item) => (
                                    <div className={styles.item} key={item.label}>
                                        {/* 告警覆盖色为纯色块，无描边概念 */}
                                        <span
                                            className={styles.swatch}
                                            style={{ background: item.fill }}
                                        />
                                        <span>{t(item.label)}</span>
                                    </div>
                                ))
                            }
                            {
                                group.key === "decoration" &&
                                group.items.map((item) => (
                                    <div className={styles.item} key={item.label}>
                                        {renderGlyph(item)}
                                        <span>{t(item.label)}</span>
                                    </div>
                                ))
                            }
                        </Fragment>
                    ))}
                </div>
            }
            {/* 收起/展开按钮：文字按钮形态，背景透明（antd type="text" 默认透明），面板向上展开后箭头向下 */}
            <Button
                type="text"
                size="small"
                icon={expanded ? <DownOutlined /> : <RightOutlined />}
                onClick={() => setExpanded((v) => !v)}
            >
                {t("车辆图例")}
            </Button>
        </div>
    );
});
