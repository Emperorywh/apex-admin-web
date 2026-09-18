/**
 * 地图管理（P09 地图列表页）协议 DTO（owner=P09，contracts.md 第 5 节）。
 *
 * 逐字段核对 default_OpenAPI.json（MapInfo / MapInfoVersion / 各 Param schema），
 * 可空性与后端一致（文档未标 required，一律可选，消费侧留白处理）。
 */

/** 地图记录（GET pageMapInfos 行记录；OpenAPI MapInfo schema） */
export interface MapInfoDto {
  /** 技术主键（int64，DTO 层保持 JSON number，G10） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 地图唯一 id（业务标识，字符串；删除/编辑均以它定位） */
  mapId?: string
  /** 地图名称 */
  mapName?: string
  /** 楼层 */
  floor?: number
  /** 地图状态（ENABLED/DISABLED，未知原值展示） */
  mapState?: string
  /** 当前版本 id */
  mapVersionId?: number
  /** 当前版本号（列表「当前版本」列） */
  mapVersion?: string
}

/** 地图分页数据（PageMapInfo，My-Plus 形态：records/total/size/current） */
export interface MapPageDto {
  records?: MapInfoDto[]
  total?: number
  size?: number
  current?: number
}

/** 地图分页查询参数（GET query 平铺，G04 同款；pageNo 从 1 计数） */
export interface MapPageParam {
  pageNo: number
  pageSize: number
  /** 按（名称/标识）模糊查询 */
  query?: string
}

/** 创建地图参数（POST createMap；OpenAPI MapInfoAddParam） */
export interface MapCreateParam {
  mapName: string
  mapState: string
  floor: number
}

/** 编辑地图参数（POST updateMap；OpenAPI MapInfoUpdateParam，按 mapKey 定位；
 * 旧实现编辑时不提交 mapName（表单中名称禁用），本层保持同形态 */
export interface MapUpdateParam {
  mapKey: string
  mapState: string
  floor: number
}

/** 删除地图参数（POST deleteMap；OpenAPI MapInfoDeleteParam） */
export interface MapDeleteParam {
  mapId: string
}

/** 地图版本记录（GET pageMapInfoVersions 行记录；OpenAPI MapInfoVersion schema，
 *  mapJson/mapImage/originalMapData 等大字段本页不消费不声明） */
export interface MapVersionDto {
  /** 版本 id（int64，DTO 层保持 JSON number，G10；发布/推送/下载按它定位） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  mapId?: string
  mapName?: string
  /** 版本备注 */
  mapRemark?: string
  /** 版本号 */
  mapVersion?: string
  /** 来源（父）版本号 */
  parentMapVersion?: string
  /** 当前已发布版本标识（OpenAPI boolean；truthy=当前线上版本，「是否发布」列与发布按钮禁用依据，
   *  联验实证真实下发 true/false） */
  currentMapInfoVersion?: boolean
  /** 旧后端「已发布」字段（联验实证新后端不下发；保留可选兼容，发布禁用与
   *  currentMapInfoVersion 并用） */
  published?: boolean
}

/** 地图版本分页数据（PageMapInfoVersion 形态） */
export interface MapVersionPageDto {
  records?: MapVersionDto[]
  total?: number
  size?: number
  current?: number
}

/** 地图版本分页查询参数（GET query 平铺；按地图隔离） */
export interface MapVersionPageParam {
  mapId: string
  pageNo: number
  pageSize: number
  /** 按版本号/备注模糊查询 */
  query?: string
}

/** 发布地图版本参数（POST publishMapInfoVersion） */
export interface MapVersionPublishParam {
  mapVersionId: number
}

/** 推送地图版本参数（POST pushMapInfoVersion；OpenAPI MapInfoVersionPushParam） */
export interface MapVersionPushParam {
  mapVersionId: number
  /** 推送目标车辆 key 集合（getSimpleVehicles 契约的 key 原样） */
  vehicleKeys: string[]
  /** 是否随版本推送 SLAM 底图 */
  enabledPushSlamMap: boolean
}
