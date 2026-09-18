/**
 * 车辆共享选项 DTO（GET /dispatcher/vehicle/getSimpleVehicles，OpenAPI SimpleVehicle schema）。
 * 车辆下拉选项的唯一数据源（contracts.md 第 5 节：P03 代建、P04 车辆分组页后续消费）。
 */

/** 简单车辆信息：车辆唯一 key + 展示名（后端原文，不做猜测翻译） */
export interface SimpleVehicleDto {
  /** 车辆唯一 key（调度系统标识，原样提交/回显） */
  key?: string
  /** 车辆名称（展示用） */
  name?: string
}
