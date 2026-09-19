/**
 * 三方交管服务类型（P19 三方交管页；owner 归 P19，contracts.md 第 5 节）。
 *
 * 类型逐字段对应 OpenAPI schema：
 * - TripartiteTraffic             交管配置实体（增/改/删请求体与分页行同构）
 * - TripartiteTrafficPageParam    分页查询参数（GET query 平铺）
 * - PageTripartiteTraffic         分页响应 data（records/total/size/current）
 * - SimpleMapNodeEdgeGroup        点边组合选项（getSimpleTripartiteTrafficEdgeGroups）
 * - TripartiteTrafficApplyRequest 通信模拟测试请求体
 *
 * 契约要点：
 * - id 为 int64 主键（G10：行 ID 字符串化守卫精度；删除/编辑请求体为完整实体，
 *   id 随实体原样提交，协议原样不二次转换）；
 * - nodeEdgeGroupId 为字符串（三方交管引用的「已确认组合」id；列表渲染经选项
 *   集合映射名称，找不到映射时显示原值=已删除组合不可静默替换）；
 * - extendParam 为开放对象（additionalProperties：扩展参数，实践中至少含 url）；
 * - applyType 为受控枚举 APPLY/RELEASE（通信模拟测试的申请/释放两态）。
 */

/** 交管配置实体（OpenAPI TripartiteTraffic；增/改/删请求体与分页行同构） */
export interface TripartiteTrafficRecord {
  /** 主键（int64；行 ID 来源；写请求体随完整实体原样提交） */
  id?: number | string | null
  /** 创建时间（协议原样；列表不展示，保留契约完整） */
  createTime?: string | null
  /** 更新时间（协议原样；列表不展示，保留契约完整） */
  updateTime?: string | null
  /** 创建人（契约字段；旧版页面未展示，保留类型完整） */
  createUser?: string | null
  /** 更新人（契约字段；旧版页面未展示，保留类型完整） */
  updateUser?: string | null
  /** 区域编号（三方交管的隔离单元标识） */
  areaCode?: string | null
  /** 点边组合 id（字符串；选项集合映射名称，无映射显示原值） */
  nodeEdgeGroupId?: string | null
  /** 当前占用系统标识（仲裁方写入的占用状态） */
  lockedSys?: string | null
  /** 是否外部系统作为仲裁方 */
  isExternalArbitrator?: boolean | null
  /** 扩展参数（开放对象；实践中至少含 url 键，弹窗按 key/value 行编辑） */
  extendParam?: Record<string, unknown> | null
}

/** 分页查询参数（GET query 平铺；pageNo 从 1 计数） */
export interface TripartiteTrafficPageParam {
  pageNo: number
  pageSize: number
  /** 区域编号或占用系统（模糊匹配；空条件不传） */
  areaCode?: string
}

/** 分页响应 data（OpenAPI PageTripartiteTraffic；orders 等写Only字段不消费） */
export interface TripartiteTrafficPageResult {
  records?: TripartiteTrafficRecord[] | null
  total?: number | null
  size?: number | null
  current?: number | null
}

/** 点边组合选项（OpenAPI SimpleMapNodeEdgeGroup；全部地图扁平集合） */
export interface SimpleMapNodeEdgeGroup {
  /** 组合唯一 id（字符串；与交管配置的 nodeEdgeGroupId 对应） */
  id?: string | null
  /** 组合名称（下拉展示与列表映射来源） */
  name?: string | null
  /** 地图 id（契约字段；旧版页面未消费，保留类型完整） */
  mapId?: string | null
  /** 地图名称（契约字段；旧版页面未消费，保留类型完整） */
  mapName?: string | null
}

/** 通信模拟测试的请求类型（OpenAPI applyType 受控枚举） */
export type TripartiteApplyType = 'APPLY' | 'RELEASE'

/** 通信模拟测试请求体（OpenAPI TripartiteTrafficApplyRequest，三字段均必填） */
export interface TripartiteTrafficApplyRequest {
  /** 请求类型：APPLY=申请占用 / RELEASE=释放占用 */
  applyType: TripartiteApplyType
  /** 区域编号（目标交管区域） */
  areaCode: string
  /** 系统编号（本系统在仲裁方的标识；旧实现同款固定 rxx） */
  systemCode: string
}
