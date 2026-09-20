/**
 * 车辆状态统计：聚合纯函数（owner=P37；旧 model/selectors.ts 等价迁移，
 * 为本页与 P35 任务统计报表的共享计算源——P35 接入车辆统计维度时消费本模块，
 * 不得另写第二份同义聚合，与 P33 statistics.ts 的 owner 约定同构）。
 *
 * 接口返回「每车 × 每状态」的扁平记录（totalDurationSeconds 单位秒），
 * KPI / 图表 / 明细表所需的聚合视角统一在这里计算：
 * - aggregateByState：跨车辆按状态聚合（状态排行/占比类视图的输入）；
 * - groupByVehicle：按车辆分组（堆叠柱、明细占比分母的输入）；
 * - secondsOfStates / totalSeconds：指定状态集合或全量总时长；
 * - secondsOfStatesInGroup：单车分组内的指定状态合计（P35 利用率排行
 *   「每车有效状态时长」的直接输入，避免消费方重复展开 stateSeconds）。
 *
 * 纯函数、无 React 依赖；展示名统一约定：vehicleName 为空回退 vehicleKey。
 * 缺失时长（null/undefined）按 0 参与求和——「该状态无记录」与「时长为 0」
 * 在聚合结果中等价（协议不区分，旧实现同口径）；是否展示由视图层决定。
 */

import type { VehicleExecutingDurationDto, VehicleStatisticState } from '@/services/report-vehicle-state/report-vehicle-state.service.types'

/** 按状态聚合后的时长项（跨所有车辆；seconds 单位秒） */
export interface StateDurationItem {
  /** 车辆统计状态 */
  state: VehicleStatisticState
  /** 该状态总时长（秒） */
  seconds: number
}

/** 按车辆分组后的时长聚合 */
export interface VehicleDurationGroup {
  /** 车辆唯一标识 */
  vehicleKey: string
  /** 展示名（vehicleName 为空时回退 vehicleKey） */
  vehicleName: string
  /** 该车全部状态总时长（秒） */
  totalSeconds: number
  /** 该车各状态时长（秒），按状态码索引（仅出现过的状态有键） */
  stateSeconds: Partial<Record<VehicleStatisticState, number>>
}

/** 跨车辆按状态聚合总时长；只返回出现过的状态（0 时长记录同样保留，展示层决定过滤） */
export function aggregateByState(rows: VehicleExecutingDurationDto[]): StateDurationItem[] {
  const byState = new Map<VehicleStatisticState, number>()
  for (const row of rows) {
    byState.set(row.state as VehicleStatisticState, (byState.get(row.state as VehicleStatisticState) ?? 0) + (row.totalDurationSeconds ?? 0))
  }
  return Array.from(byState.entries()).map(([state, seconds]) => ({ state, seconds }))
}

/** 按车辆分组聚合各状态时长，保持接口返回中的车辆首次出现顺序 */
export function groupByVehicle(rows: VehicleExecutingDurationDto[]): VehicleDurationGroup[] {
  const byVehicle = new Map<string, VehicleDurationGroup>()
  for (const row of rows) {
    const key = row.vehicleKey ?? ''
    let group = byVehicle.get(key)
    if (!group) {
      group = {
        vehicleKey: key,
        vehicleName: row.vehicleName || key,
        totalSeconds: 0,
        stateSeconds: {},
      }
      byVehicle.set(key, group)
    }
    const seconds = row.totalDurationSeconds ?? 0
    const state = row.state as VehicleStatisticState
    group.stateSeconds[state] = (group.stateSeconds[state] ?? 0) + seconds
    group.totalSeconds += seconds
  }
  return Array.from(byVehicle.values())
}

/** 全部记录的总时长（秒） */
export function totalSeconds(rows: VehicleExecutingDurationDto[]): number {
  return rows.reduce((sum, row) => sum + (row.totalDurationSeconds ?? 0), 0)
}

/** 指定状态集合的总时长（秒）——如 EXECUTING_WORK 用于利用率、ERROR 用于故障时长 */
export function secondsOfStates(
  rows: VehicleExecutingDurationDto[],
  states: VehicleStatisticState[],
): number {
  const wanted = new Set<VehicleStatisticState>(states)
  return rows.reduce(
    (sum, row) => (wanted.has(row.state as VehicleStatisticState) ? sum + (row.totalDurationSeconds ?? 0) : sum),
    0,
  )
}

/**
 * 单车分组内的指定状态合计（秒）。
 * P35 利用率排行的「每车有效状态时长」（有效状态常量见 statistics.ts）直接消费，
 * 本页单车维度的派生计算同样复用，避免各处重复展开 stateSeconds。
 */
export function secondsOfStatesInGroup(
  group: VehicleDurationGroup,
  states: VehicleStatisticState[],
): number {
  const wanted = new Set<VehicleStatisticState>(states)
  return (Object.entries(group.stateSeconds) as [VehicleStatisticState, number][]).reduce(
    (sum, [state, seconds]) => (wanted.has(state) ? sum + seconds : sum),
    0,
  )
}
