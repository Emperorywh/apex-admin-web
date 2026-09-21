/** 站点及其可关联点位；点位仅能在所属站点内选择。 */
export interface StorageStation {
  id: string
  name: string
  points: { id: string; name: string }[]
}

/** 库位参数：层号为正整数，深度和高度单位为毫米，承重单位为千克。 */
export interface StorageLocationValues {
  name: string
  stationId: string
  pointId: string
  layer: number
  depth: number
  height: number
  maxLoad: number
  remark: string
}

/** 稳定 ID 用于目录定位和增删改，名称修改不改变记录身份。 */
export interface StorageLocation extends StorageLocationValues {
  id: string
}

/** 本地 JSON 同时提供站点字典、关联点与预制库位，不依赖后端接口。 */
export interface StorageLocationData {
  stations: StorageStation[]
  locations: StorageLocation[]
}
