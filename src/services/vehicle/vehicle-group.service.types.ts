/**
 * 车辆分组共享选项 DTO（GET /dispatcher/vehicleGroup/getVehicleGroups，OpenAPI AGVGroup schema）。
 * 分组下拉选项唯一数据源（contracts.md 第 5 节：P03 代建、P04/P20 后续消费）。
 */

/** 车辆分组信息：分组 key/名称 + 组内车辆 key 集合（选项场景主要消费 key 与名称） */
export interface VehicleGroupDto {
  /** 后端自增主键（int64，JSON number 承载；G10 精度联调核实项） */
  id?: number
  /** 分组唯一 key（调度系统标识） */
  agvGroupKey?: string
  /** 分组名称（展示用） */
  agvGroupName?: string
  /** 组内车辆 key 集合（创建任务选分组提交时由后端解析，不在前端展开） */
  agvKeys?: string[]
}
