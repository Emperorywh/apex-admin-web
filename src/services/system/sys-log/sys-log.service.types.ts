/**
 * 操作日志服务类型（P28 操作日志页；OpenAPI「系统日志控制类」pageSysLogs）。
 *
 * SysLogDto 对应 OpenAPI schema SysLog（pageSysLogs 返回 records 元素）。
 * 契约要点：
 * - id 为 int64 主键（G10：调度后端 int64 主键应以字符串承载；实际序列化形态
 *   以带令牌联验实证为准，展示层不做二次加工）；
 * - requestTime 协议声明 date-time，展示层经共享 displayDateTime 转换（缺失
 *   留白），不改协议原值——时间语义遵循部署时区（G15，联验实证记录形态）；
 * - requestParam/responseParam 是「字符串承载的 JSON/原文」：展示层解析失败时
 *   保留原文呈现，不伪装成结构化数据；
 * - requestUri/requestMethod 为契约完整字段（旧版页面未展示，保持等价不新增列）。
 */

/** 操作日志记录（pageSysLogs 返回 records 元素；字段与 OpenAPI SysLog 一致） */
export interface SysLogDto {
  /** 日志主键（int64；行 ID 来源，协议原样） */
  id?: number | string | null
  /** 日志标题（如「车辆类型列表」；缺失留白） */
  title?: string | null
  /** 日志类型（NORMAL 正常 / ERROR 异常；未知枚举原值呈现） */
  logType?: string | null
  /** 请求 IP（缺失留白） */
  requestIp?: string | null
  /** 请求地址（契约字段；旧版页面未展示，保留类型完整） */
  requestUri?: string | null
  /** 请求方法（契约字段；旧版页面未展示，保留类型完整） */
  requestMethod?: string | null
  /** 请求参数（字符串承载的 JSON 或原文；缺失留白、空值区分呈现） */
  requestParam?: string | null
  /** 请求耗时（毫秒；缺失留白） */
  requestDuration?: number | null
  /** 操作用户（缺失留白） */
  username?: string | null
  /** 异常详情（仅 ERROR 记录可能有值；缺失留白） */
  exceptionDetail?: string | null
  /** 响应参数（字符串承载的 JSON 或原文；缺失留白、空值区分呈现） */
  responseParam?: string | null
  /** 操作目标名称（筛选条件 targetName 的模糊匹配对象；缺失留白） */
  targetName?: string | null
  /** 操作所属模块（枚举原值如 VEHICLE；未知枚举原值呈现） */
  module?: string | null
  /** 请求时间（date-time 字符串；展示层 displayDateTime 转换、缺失留白） */
  requestTime?: string | null
}

/** 操作日志分页查询参数（POST pageSysLogs JSON body，OpenAPI SysLogPageParamSysLog） */
export interface SysLogPageParam {
  /** 当前页码（从 1 计数；页面用 toBackendPage 从零基 pageIndex 换算） */
  pageNo: number
  /** 每页数量 */
  pageSize: number
  /** 日志标题（模糊匹配；空条件裁剪不提交） */
  title?: string
  /** 日志类型（NORMAL/ERROR；不指定则不过滤） */
  logType?: string
  /** 操作所属模块（精确匹配；不指定则不过滤） */
  module?: string
  /** 操作目标名称（模糊匹配；空条件裁剪不提交） */
  targetName?: string
  /** 请求开始时间（yyyy-MM-dd HH:mm:ss；部署时区语义，G15） */
  startRequestTime?: string
  /** 请求结束时间（yyyy-MM-dd HH:mm:ss；部署时区语义，G15） */
  endRequestTime?: string
}

/** 分页结果载体（与后端 ResultPageSysLog.data 一致；仅消费业务字段） */
export interface SysLogPageResult {
  records?: SysLogDto[] | null
  total?: number | null
  size?: number | null
  current?: number | null
}
