/**
 * @description 车辆状态统计：聚合纯函数（selectors）
 *
 * 接口返回的是「每车 × 每状态」的扁平记录（totalDurationSeconds 单位秒），
 * 各图表 / KPI / 明细表需要的聚合视角统一在这里计算：
 *   - aggregateByState：跨车辆按状态聚合（占比饼图、状态排行）
 *   - groupByVehicle：按车辆分组（堆叠柱、单车饼图、车辆排行、明细表占比分母）
 *
 * 纯函数、无 React 依赖；展示名统一约定：vehicleName 为空时回退 vehicleKey。
 */
import type { VehicleExecutingDuration, VehicleStatisticState } from "@/types/AnalyzeVisual/VehicleStateStatistics";

/**
 * 按状态聚合后的时长项（跨所有车辆）。
 */
export interface StateDurationItem {
    /** 车辆统计状态 */
    state: VehicleStatisticState;
    /** 该状态总时长（秒） */
    seconds: number;
}

/**
 * 按车辆分组后的时长聚合。
 */
export interface VehicleDurationGroup {
    /** 车辆标识 */
    vehicleKey: string;
    /** 展示名（vehicleName 为空时回退 vehicleKey） */
    vehicleName: string;
    /** 该车全部状态总时长（秒） */
    totalSeconds: number;
    /** 该车各状态时长（秒），按状态码索引 */
    stateSeconds: Partial<Record<VehicleStatisticState, number>>;
}

/**
 * 跨车辆按状态聚合总时长。
 * 只返回出现过的状态（时长可为 0 的记录同样保留，由展示层决定是否过滤）。
 */
export function aggregateByState(rows: VehicleExecutingDuration[]): StateDurationItem[] {
    const byState = new Map<VehicleStatisticState, number>();
    for (const row of rows) {
        byState.set(row.state, (byState.get(row.state) ?? 0) + (row.totalDurationSeconds ?? 0));
    }
    return Array.from(byState.entries()).map(([state, seconds]) => ({ state, seconds }));
}

/**
 * 按车辆分组聚合各状态时长，保持接口返回中的车辆首次出现顺序。
 */
export function groupByVehicle(rows: VehicleExecutingDuration[]): VehicleDurationGroup[] {
    const byVehicle = new Map<string, VehicleDurationGroup>();
    for (const row of rows) {
        let group = byVehicle.get(row.vehicleKey);
        if (!group) {
            group = {
                vehicleKey: row.vehicleKey,
                vehicleName: row.vehicleName || row.vehicleKey,
                totalSeconds: 0,
                stateSeconds: {},
            };
            byVehicle.set(row.vehicleKey, group);
        }
        const seconds = row.totalDurationSeconds ?? 0;
        group.stateSeconds[row.state] = (group.stateSeconds[row.state] ?? 0) + seconds;
        group.totalSeconds += seconds;
    }
    return Array.from(byVehicle.values());
}

/**
 * 全部记录的总时长（秒）。
 */
export function totalSeconds(rows: VehicleExecutingDuration[]): number {
    return rows.reduce((sum, row) => sum + (row.totalDurationSeconds ?? 0), 0);
}

/**
 * 指定状态集合的总时长（秒）（如 EXECUTING_WORK 用于利用率、ERROR 用于故障时长）。
 */
export function secondsOfStates(rows: VehicleExecutingDuration[], states: VehicleStatisticState[]): number {
    const wanted = new Set<VehicleStatisticState>(states);
    return rows.reduce((sum, row) => (wanted.has(row.state) ? sum + (row.totalDurationSeconds ?? 0) : sum), 0);
}
