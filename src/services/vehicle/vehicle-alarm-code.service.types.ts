/**
 * 车辆告警码服务 DTO（dispatcher/vehicleAlarmCode，OpenAPI 与旧实现逐字段核对）。
 *
 * 告警码是车辆上报告警的字典配置：每条记录含告警码字符串与一组多语言
 * 描述（locale/desc/hint），供告警展示与处理建议使用。字段名与结构保留
 * 协议原样，不擅自改语义。P08 起本文件 owner 归 P08（contracts.md 第 5 节）。
 */

/** 多语言告警描述行（OpenAPI AlarmCodeRecord 同形；列表展示与弹窗编辑共用） */
export interface AlarmCodeRecordDto {
  /** 语言类型（与后端约定枚举一致，如 zh_CN/en_US/ja_JP/ko_KR/zh_TW；未知原样展示） */
  locale?: string
  /** 告警描述（说明"是什么告警"） */
  desc?: string
  /** 处理建议（说明"怎么处理这个告警"；选填） */
  hint?: string
}

/** 车辆告警码行记录（OpenAPI AGVAlarmCode 同形；分页查询行数据源） */
export interface AlarmCodeRecord {
  /** 记录 ID（后端自增主键；int64 经 JSON number 承载，行 ID 层转字符串） */
  id?: number
  /** 创建时间（yyyy-MM-dd HH:mm:ss 字符串，展示层经 displayDateTime 统一） */
  createTime?: string
  /** 更新时间（同上） */
  updateTime?: string
  /** 创建人（原始值，缺失留白） */
  createUser?: string
  /** 更新人（原始值，缺失留白） */
  updateUser?: string
  /** 告警码 */
  alarmCode?: string
  /** 多语言告警描述集合 */
  alarmCodeRecords?: AlarmCodeRecordDto[]
}

/** 分页查询参数（OpenAPI AGVAlarmCodePageParamAGVAlarmCode 同形；GET 平铺 query，G04 同形态） */
export interface AlarmCodePageParam {
  /** 当前的页码（后端 1 计数，页面用 toBackendPage 从零基 pageIndex 换算） */
  pageNo: number
  /** 每页的数量 */
  pageSize: number
  /** 告警码（模糊查询；可选） */
  alarmCode?: string
}

/** 分页响应（OpenAPI PageAGVAlarmCode 同形；MyBatis-Plus 分页结构） */
export interface AlarmCodePage {
  records?: AlarmCodeRecord[]
  total?: number
  size?: number
  current?: number
  pages?: number
}

/** 新增告警码参数（OpenAPI AGVAlarmCodeAddParam 同形；多语言记录整体选填） */
export interface AlarmCodeAddParam {
  /** 告警码 */
  alarmCode: string
  /** 多语言告警描述 */
  alarmCodeRecords?: AlarmCodeRecordDto[]
}

/** 编辑告警码参数：新增字段全量 + id 定位（OpenAPI AGVAlarmCodeUpdateParam 同形） */
export interface AlarmCodeUpdateParam extends AlarmCodeAddParam {
  /** 记录 ID */
  id: number
}

/** 删除告警码参数（OpenAPI AGVAlarmCodeParam 同形；按告警码字符串定位，非 id） */
export interface AlarmCodeDeleteParam {
  /** 告警码 */
  alarmCode: string
}
