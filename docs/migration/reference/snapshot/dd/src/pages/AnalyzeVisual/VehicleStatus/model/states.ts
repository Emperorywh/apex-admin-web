/**
 * @description 车辆状态统计：状态枚举的展示元数据（label i18n key / 颜色 / 顺序）
 *
 * 状态枚举 VehicleStatisticState 与后端报表口径一一对应（见类型定义文件），
 * 此处集中维护其展示层元数据：
 *   - label 使用中文原文作为 i18n key，由组件层 t() 转换（项目 i18n 规范）
 *   - 颜色采用「状态语义色」固定映射：颜色跟随状态实体，不随数据排名变化
 *   - 顺序与后端枚举声明一致（按语义分组），堆叠柱 / 图例 / 表格保持一致
 *
 * 配色说明（已经过 CVD 校验工具核对，残余告警为有意保留的状态语义）：
 *   - 离线使用灰色（chroma 校验必然 FAIL，离线=灰是行业通用语义，有意保留）
 *   - 告警/暂停等使用亮黄、琥珀色（lightness 略出校验带宽，
 *     状态色规范允许警告色系偏亮，以图例文字 + Tooltip + 表格 Tag 作二级编码补偿）
 *   - 制动 / 告警 / 异常三个相邻暖色通过明暗阶梯区分（深红 / 橙 / 亮红），
 *     避免色盲下相邻色对不可分
 */
import type { VehicleStatisticState } from "@/types/AnalyzeVisual/VehicleStateStatistics";

/**
 * 状态展示顺序：与后端枚举声明顺序一致（语义分组），
 * 堆叠柱系列、图例、表格筛选项共用该顺序，保证跨图表认知一致。
 */
export const VEHICLE_STATISTIC_STATE_ORDER: VehicleStatisticState[] = [
    "ONLINE",
    "OFFLINE",
    "IDLE",
    "EXECUTING_WORK",
    "EXECUTING_CHARGE",
    "EXECUTING_PARK",
    "TRAFFIC",
    "PAUSED",
    "AVOID",
    "BRAKE",
    "WARNING",
    "ERROR",
    "CHARGING",
];

/**
 * 状态 → 展示文案 i18n key（中文原文）。
 * 与类型定义中各枚举值的语义注释一一对应。
 */
export const STATE_LABEL_KEY: Record<VehicleStatisticState, string> = {
    ONLINE: "在线",
    OFFLINE: "离线",
    IDLE: "空闲",
    EXECUTING_WORK: "执行作业",
    EXECUTING_CHARGE: "执行充电",
    EXECUTING_PARK: "执行停靠",
    TRAFFIC: "交管等待",
    PAUSED: "暂停",
    AVOID: "避让",
    BRAKE: "制动",
    WARNING: "告警",
    ERROR: "异常",
    CHARGING: "充电中",
};

/**
 * 状态 → 固定颜色（语义色映射，颜色永远跟随状态实体本身）。
 * 未知状态（后端新增枚举前端未跟进时）回退灰色，避免渲染崩溃。
 */
export const STATE_COLOR: Record<VehicleStatisticState, string> = {
    ONLINE: "#52c41a",
    OFFLINE: "#8c8c8c",
    IDLE: "#73d13d",
    EXECUTING_WORK: "#1890ff",
    EXECUTING_CHARGE: "#faad14",
    EXECUTING_PARK: "#13c2c2",
    TRAFFIC: "#722ed1",
    PAUSED: "#ffc53d",
    AVOID: "#eb2f96",
    BRAKE: "#cf1322",
    WARNING: "#fa8c16",
    ERROR: "#f5222d",
    CHARGING: "#d48806",
};

/** 未知状态回退色（后端返回未登记的状态码时使用） */
export const UNKNOWN_STATE_COLOR = "#595959";

/**
 * 取状态颜色：未登记的状态码回退到 UNKNOWN_STATE_COLOR。
 */
export function stateColor(state: string): string {
    return STATE_COLOR[state as VehicleStatisticState] ?? UNKNOWN_STATE_COLOR;
}

/**
 * 取状态展示文案 key：未登记的状态码原样返回（展示后端原文，便于排查）。
 */
export function stateLabelKey(state: string): string {
    return STATE_LABEL_KEY[state as VehicleStatisticState] ?? state;
}
