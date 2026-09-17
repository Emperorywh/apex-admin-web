/**
 * 请求基础设施类型：调度协议 Result 包装、后端分页形状、错误模型。
 * 与业务域无关，供所有 service 共用。
 */

/**
 * 调度协议统一 Result 包装（OpenAPI 各 Result* 泛型的公共形状，真实环境已实证）：
 * `{code, message, timestamp, data}`；HTTP 成功且业务 code=200 才视为成功。
 */
export interface ResultDto<T> {
  /** 返回码，200 正常 */
  code: number
  /** 返回信息（不作为成功判定依据） */
  message: string
  /** 服务器毫秒时间戳（int64） */
  timestamp: number
  /** 业务数据；void/空时可能为 null */
  data: T
}

/**
 * 后端分页查询参数常见形状（pageNo 从 1 开始）。
 * 注意（G04）：逐 endpoint 核实后才可消费，不得假定所有接口一致；
 * service 层负责把前端零基 pageIndex 换算成这里的 pageNo。
 */
export interface BackendPageQuery {
  pageNo: number
  pageSize: number
}

/**
 * 后端分页响应常见形状（响应侧记录数/当前页/页大小/总数/总页数）。
 * 注意（G04）：与 BackendPageQuery 一样需逐 endpoint 核实；
 * service 层可把它规范化为 items/total/page/pageSize 暴露给页面，
 * 但不得把这里的内部名称错误发给调度后端。
 */
export interface BackendPageResult<T> {
  records: T[]
  current: number
  size: number
  total: number
  pages: number
}

/** 422 类校验错误条目（后端返回字段级错误时的通用形状） */
export interface ApiFieldError {
  field: string
  reason: string
  message: string
}

/**
 * 规范化后的 API 错误：HTTP 错误、业务码非 200 与前端本地错误统一收敛到此形状。
 * 调用方用 toApiError 还原、apiErrorMessage 取展示文案、isCancelledError 判主动取消。
 */
export interface ApiError {
  readonly isApiError: true
  /** 稳定错误码：CLIENT.* 或后端 message 摘要；业务码见 businessCode */
  readonly code: string
  /** HTTP 状态码；网络不可达为 0，业务码错误（HTTP 200）为 200 */
  readonly status: number
  /** 可展示标题 */
  readonly title: string
  /** 可展示详情（后端 message / 网关文本摘要） */
  readonly detail?: string
  /** 调度协议业务码（Result.code）；HTTP 协议级错误无此字段 */
  readonly businessCode?: number
  readonly errors?: ApiFieldError[]
}

/** 请求可选项 */
export interface RequestOptions {
  signal?: AbortSignal
}

/* -------------------------------------------------------------------------- */
/* 模板遗留类型（尚未迁移的模板 service 暂用；由 P03/P31/P32/P34 等页面任务     */
/* 替换为调度协议类型后删除。不得在新代码中引用。                                */
/* -------------------------------------------------------------------------- */

/** 模板遗留：实体状态编码（调度协议为 ENABLED/DISABLED，见各域 DTO） */
export type EntityStatus = 'active' | 'disabled'

/** 模板遗留：模板 REST 分页查询（调度协议见 BackendPageQuery） */
export interface PageQuery {
  page: number
  pageSize: number
  sort?: string
  status?: EntityStatus
}

/** 模板遗留：模板 REST 分页响应（调度协议见 BackendPageResult） */
export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  pages: number
}
