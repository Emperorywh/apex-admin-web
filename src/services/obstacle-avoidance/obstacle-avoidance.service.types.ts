/**
 * 避障模板（P22）协议 DTO（owner=P22，contracts.md 第 5 节）。
 *
 * 逐字段核对 default_OpenAPI.json（ObstacleAvoidance / ObstacleAvoidanceParameter /
 * ObstacleAvoidanceAddParam / ObstacleAvoidanceUpdateParam /
 * ObstacleAvoidancePageParamObstacleAvoidance），文档未标 required 一律可选，
 * 消费侧按留白处理。精度纪律（G10）：行主键 id（int64）以 JSON number 承载。
 */

/** 避障参数明细（OpenAPI ObstacleAvoidanceParameter；avoid 为避障参数类型标识
 * `${模板key}_index_N` 形态，enable 为是否启用该避障参数，均协议原样） */
export interface ObstacleAvoidanceParameterDto {
  /** 避障参数名称（保存时为模板名，协议原值展示不猜语义） */
  name?: string
  /** 避障参数类型标识（协议原值；未知值展示原值不臆造中文） */
  avoid?: string
  /** 是否启用避障参数（boolean 协议原值） */
  enable?: boolean
}

/** 避障模板记录（GET pageObstacleAvoidance 行记录；OpenAPI ObstacleAvoidance） */
export interface ObstacleAvoidanceDto {
  /** 技术主键（int64；编辑/删除按它定位，JSON number 承载 G10 同 P09/P10/P11） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 避障名称 */
  obstacleAvoidanceName?: string
  /** 避障参数集合（展开行子表数据源） */
  parameters?: ObstacleAvoidanceParameterDto[]
}

/** 避障模板分页数据（PageObstacleAvoidance，My-Plus 形态） */
export interface ObstacleAvoidancePageDto {
  records?: ObstacleAvoidanceDto[]
  total?: number
  size?: number
  current?: number
}

/** 分页查询参数（GET query 平铺；pageNo 从 1 计数。OpenAPI 文档把参数声明为
 * pageParam 对象引用，序列化差异沿用 G04 登记口径：后端接受平铺 query，
 * P03/P11 等已逐 endpoint 实证，本页联验继续核实） */
export interface ObstacleAvoidancePageParam {
  pageNo: number
  pageSize: number
  /** 按避障策略名称模糊查询 */
  query?: string
}

/** 创建参数（POST createObstacleAvoidance；OpenAPI ObstacleAvoidanceAddParam） */
export interface ObstacleAvoidanceAddParam {
  /** 避障名称 */
  obstacleAvoidanceName: string
  /** 避障参数集合（按已选模板顺序整体提交） */
  parameters: ObstacleAvoidanceParameterDto[]
}

/** 编辑参数（POST updateObstacleAvoidance；OpenAPI ObstacleAvoidanceUpdateParam，
 * 按 int64 主键 id 定位，parameters 集合整体替换——协议语义页面照实提交） */
export interface ObstacleAvoidanceUpdateParam {
  /** 避障模板唯一 id（int64） */
  id: number
  /** 避障名称 */
  obstacleAvoidanceName: string
  /** 避障参数集合（整体替换） */
  parameters: ObstacleAvoidanceParameterDto[]
}

/** 删除参数（POST deleteObstacleAvoidance；OpenAPI 将 id 声明为 required query 参数，
 * 服务层按文档以 query string 提交，联验实证） */
export interface ObstacleAvoidanceDeleteParam {
  /** 避障模板唯一 id（int64） */
  id: number
}
