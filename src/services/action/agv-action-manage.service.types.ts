/**
 * 车辆动作管理页（P23）协议 DTO（owner=P23，contracts.md 第 5 节）。
 *
 * 逐字段核对 default_OpenAPI.json（AGVActionParam / ActionParameter / AGVAction /
 * PageAGVAction）。与共享选项类型 AGVActionDto（P03 代建，同一 OpenAPI
 * AGVAction schema）的差异：blockingType 放宽为 string——专项验收要求「已有动作
 * 参数不因未知枚举丢失」，后端历史数据可能携带枚举集（NONE/SOFT/HARD）之外的
 * 原值，本页按协议原值回显与提交，不收窄类型。文档未标 required 一律可选，
 * 消费侧按留白处理；精度纪律（G10）：行主键 id（int64）以 JSON number 承载。
 */

/** 动作参数（OpenAPI ActionParameter；value 声明为 object——历史数据实际形态
 * 可能为字符串/数字/数组/对象任意 JSON，原样透传不解释） */
export interface AgvActionParameterDto {
  /** 参数名（旧 UI「动作名」） */
  key?: string
  /** 参数值（协议原样；编辑回显非字符串值只做显示转换，不丢原值） */
  value?: unknown
}

/** 车辆动作行记录（GET pageAGVActions 行记录；OpenAPI AGVAction 全量字段） */
export interface AgvActionRowDto {
  /** 技术主键（int64；编辑/删除按它定位，JSON number 承载 G10 同 P22） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 动作类型（协议原值） */
  actionType?: string
  /** 动作描述 */
  actionDescription?: string
  /** 阻塞类型（OpenAPI 枚举 NONE/SOFT/HARD；放宽为 string 承载未知枚举原值） */
  blockingType?: string
  /** 动作参数集合 */
  actionParameters?: AgvActionParameterDto[]
}

/** 车辆动作分页数据（PageAGVAction，My-Plus 形态） */
export interface AgvActionPageDto {
  records?: AgvActionRowDto[]
  total?: number
  size?: number
  current?: number
}

/** 分页查询参数（GET query 平铺；pageNo 从 1 计数。OpenAPI 文档把参数声明为
 * actionPageParam 对象引用，序列化差异沿用 G04 登记口径：后端接受平铺 query，
 * P03/P11/P22 等已逐 endpoint 实证，本页联验继续核实） */
export interface AgvActionPageParam {
  pageNo: number
  pageSize: number
  /** 按动作类型/描述模糊查询（旧实现 searchParams.query 原样透传） */
  query?: string
}

/** 新增/编辑/删除共用请求体（OpenAPI addAGVAction / updateAGVAction /
 * deleteAGVAction 的 body 均为 AGVActionParam；旧实现删除仅提交 {id}，
 * 新增/编辑提交表单四字段） */
export interface AgvActionParamDto {
  /** 技术主键（编辑/删除定位；新增不携带） */
  id?: number
  actionType?: string
  actionDescription?: string
  blockingType?: string
  actionParameters?: AgvActionParameterDto[]
}
