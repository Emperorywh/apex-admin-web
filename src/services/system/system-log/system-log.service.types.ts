/**
 * 系统日志服务类型（P26 系统日志页；OpenAPI「系统控制类」systemLog 三 operation）。
 *
 * SystemLog 对应 OpenAPI schema SystemLog（pageSystemLogs 的 records 元素）：
 * 仅 name（日志文件名称）与 time（最后修改时间）两个字段；time 协议声明为
 * date-time，响应实测为 yyyy-MM-dd HH:mm:ss 秒级字符串（联验核实），展示层经
 * 共享 displayDateTime 转换、不改协议值。logType 选项由 getSystemLogTypes
 * 动态下发（旧版同源），前端不硬编码枚举清单、不臆造语义。
 */

/** 系统日志列表项（pageSystemLogs 返回 records 元素；字段与 OpenAPI SystemLog 一致） */
export interface SystemLogDto {
  /** 日志文件名称（后端文件名原值；行 ID 与下载定位键，协议原样） */
  name?: string | null
  /** 最后修改时间（秒级字符串，展示层转换；缺失留白） */
  time?: string | null
}

/** 系统日志分页查询参数（GET pageSystemLogs query 平铺，G04 口径） */
export interface SystemLogPageParam {
  /** 当前页码（从 1 计数） */
  pageNo: number
  /** 每页数量 */
  pageSize: number
  /** 日志类型（getSystemLogTypes 下发的类型值，如 NORMAL；不指定则不过滤） */
  logType?: string
  /** 日志名称（模糊匹配） */
  logName?: string
  /** 日志开始时间（yyyy-MM-dd HH:mm:ss） */
  startTime?: string
  /** 日志结束时间（yyyy-MM-dd HH:mm:ss） */
  endTime?: string
}

/** 分页结果载体（与后端 ResultPage 泛型一致；仅消费业务字段） */
export interface SystemLogPageResult {
  records?: SystemLogDto[] | null
  total?: number | null
  size?: number | null
  current?: number | null
}

/** 下载系统日志参数（POST downloadSystemLog 请求体，OpenAPI DownloadSystemLogParam） */
export interface DownloadSystemLogParam {
  /** 日志类型（取当前筛选的 logType 原值，随下载请求整体提交） */
  logType: string
  /** 待下载的日志文件名称集合（列表行 name 原值，可多选） */
  logNames: string[]
}
