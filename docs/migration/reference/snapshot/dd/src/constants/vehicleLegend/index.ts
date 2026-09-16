/**
 * @description 车辆状态图例的数据常量（VehicleStatusLegend 组件消费）
 * @date 2026-7-29
 *
 * 关键原则：颜色不复制字面量，直接引用 robotProperty ——
 * 画布（RobotGroup sceneFunc）改色时图例自动跟随，消除两套色表漂移风险。
 * 三组结构：status（填充+描边双色块）/ warning（纯色块）/ decoration（图形示意）。
 * 条目数组顺序即图例展示顺序（SPEC_vehicle_status_legend.md §4.1）。
 */
import { robotProperty } from "@/plugins/konva/nodes/robot";

/**
 * 装饰标识的图形类型：
 * dot 圆点（有任务）/ line 横线（载货）/ triangle 三角（充电标识）/ headline 竖线（车头方向）
 */
export type VehicleLegendGlyph = "dot" | "line" | "triangle" | "headline";

/** 状态组条目：填充 + 描边双色块（与画布车体结构一致） */
export interface VehicleLegendStatusItem {
    /** 文案 key（中文原文，组件层 t() 转换） */
    label: string;
    /** 车体填充色 */
    fill: string;
    /** 车体描边色 */
    stroke: string;
}

/** 告警组条目：纯色块（覆盖色会盖掉车体状态色，无描边概念） */
export interface VehicleLegendWarningItem {
    /** 文案 key（中文原文，组件层 t() 转换） */
    label: string;
    /** 告警覆盖色 */
    fill: string;
}

/** 装饰组条目：深灰底衬上画对应图形（白色图形在白色面板上不可见，故加底衬） */
export interface VehicleLegendDecorationItem {
    /** 文案 key（中文原文，组件层 t() 转换） */
    label: string;
    /** 示意图形类型 */
    glyph: VehicleLegendGlyph;
    /** 图形颜色 */
    color: string;
}

/** 图例分组（判别联合：组件层按 key 收窄 items 类型） */
export type VehicleLegendGroup =
    | { key: "status"; items: VehicleLegendStatusItem[] }
    | { key: "warning"; items: VehicleLegendWarningItem[] }
    | { key: "decoration"; items: VehicleLegendDecorationItem[] };

/**
 * 图例条目（14 行 3 组）。
 * 注意：
 * 1. 不含 PAUSED 暂停 —— 该色已在 robotProperty 定义，但画布颜色映射从不使用
 *    （transformTrafficInfo 只看 connectionState / vehicleProcStatus），图例只列画布真实会渲染的颜色；
 * 2. 离线/断连合并一行 —— CONNECTIONBROKEN 与 OFFLINE 在画布上统一渲染为离线灰。
 */
export const VEHICLE_LEGEND_GROUPS: VehicleLegendGroup[] = [
    {
        key: "status",
        items: [
            {
                label: "空闲",
                fill: robotProperty.robotFill.IDLE,
                stroke: robotProperty.strokeStyle.IDLE,
            },
            {
                label: "交管",
                fill: robotProperty.robotFill.TRAFFIC,
                stroke: robotProperty.strokeStyle.TRAFFIC,
            },
            {
                label: "执行中",
                fill: robotProperty.robotFill.PROCESSING,
                stroke: robotProperty.strokeStyle.PROCESSING,
            },
            {
                label: "充电",
                fill: robotProperty.robotFill.CHARGE,
                stroke: robotProperty.strokeStyle.CHARGE,
            },
            {
                label: "避障",
                fill: robotProperty.robotFill.AVOID,
                stroke: robotProperty.strokeStyle.AVOID,
            },
            {
                label: "异常",
                fill: robotProperty.robotFill.ERROR,
                stroke: robotProperty.strokeStyle.ERROR,
            },
            {
                label: "抱闸",
                fill: robotProperty.robotFill.BRAKE,
                stroke: robotProperty.strokeStyle.BRAKE,
            },
            {
                label: "离线/连接中断",
                fill: robotProperty.robotFill.OFFLINE,
                stroke: robotProperty.strokeStyle.OFFLINE,
            },
        ],
    },
    {
        key: "warning",
        items: [
            { label: "定位告警", fill: robotProperty.localizationWarning.fill },
            { label: "错误告警", fill: robotProperty.errorWarning.fill },
        ],
    },
    {
        key: "decoration",
        items: [
            { label: "有任务", glyph: "dot", color: robotProperty.order.fill },
            { label: "载货", glyph: "line", color: robotProperty.load.stroke },
            // 充电三角恒白（transformTrafficInfo 中 pathFill 恒取白色），取 CHARGE 键语义更贴切
            {
                label: "充电标识",
                glyph: "triangle",
                color: robotProperty.pathFill.CHARGE,
            },
            // 车头标记线的黄色未收录进 robotProperty（sceneFunc 中为字面量 #FFFF00），此处保持一致
            { label: "车头方向", glyph: "headline", color: "#FFFF00" },
        ],
    },
];
