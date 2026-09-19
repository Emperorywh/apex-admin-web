/**
 * 任务工艺模板管理 DTO（P20；owner 归 P20，contracts.md 第 5 节登记）。
 *
 * 与共享选项类型 OrderTemplateDto（order-template.service.types.ts，P03 代建）
 * 的差异：分页行/编辑回显直接消费 OpenAPI OrderTemplate schema 全量字段，
 * 子任务（orderMissions）按 OrderMissionTemplate 结构展开——展开行子表需要
 * mapName/stationName 等后端回填的展示字段，提交参数按 OpenAPI
 * OrderTemplateParam/OrderTemplateUpdateParam 只含提交所需字段。
 */

/** 模板动作参数条目（OpenAPI ActionParameter；value 后端为宽松 object，字符串/数字/数组混提保形） */
export interface TemplateActionParameterDto {
  /** 参数名 */
  key?: string
  /** 参数值（协议原值透传，本页表单输入产出字符串；编辑回显未改动行提交原始值——P23 同款守恒） */
  value?: unknown
}

/** 模板动作条目（OpenAPI ActionParam；blockingType 为后端受控枚举 NONE/SOFT/HARD，未知值后端 500——P23 已实证契约） */
export interface TemplateActionDto {
  /** 动作类型（协议原值） */
  actionType?: string
  /** 动作描述 */
  actionDescription?: string
  /** 阻塞类型：NONE/SOFT/HARD */
  blockingType?: string
  /** 生效条件（空=无条件生效；旧页面表单不含此字段，回显原样保留提交） */
  conditionStr?: string
  /** 动作参数集合 */
  actionParameters?: TemplateActionParameterDto[]
}

/** 模板子任务行（OpenAPI OrderMissionTemplate 展开形态；列表展开行子表数据源） */
export interface TemplateMissionRowDto {
  /** 子任务数据库 id（int64；展开行子表稳定行 ID） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 子任务唯一 key（后端生成） */
  orderMissionTemplateKey?: string
  /** 所属模板 key */
  orderTemplateKey?: string
  /** 地图唯一 id */
  mapId?: string
  /** 地图名称（后端回填展示字段） */
  mapName?: string
  /** 站点唯一 id */
  stationId?: string
  /** 站点名称（后端回填展示字段） */
  stationName?: string
  /** 子任务动作集合（展开行二级子表数据源） */
  actions?: TemplateActionDto[]
}

/** 模板行（OpenAPI OrderTemplate 全量字段） */
export interface TemplateRowDto {
  /** 后端自增主键（int64；行 ID 与编辑定位标识） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 模板名称（列表列 + 弹窗回显） */
  orderTemplateName?: string
  /** 模板唯一 key（调度系统标识；删除按此定位） */
  orderTemplateKey?: string
  /** 预约车辆 key/名称（与车辆分组互斥，二选一） */
  appointVehicleKey?: string
  appointVehicleName?: string
  /** 预约车辆分组 key/名称（与指定车辆互斥，二选一） */
  appointVehicleGroupKey?: string
  appointVehicleGroupName?: string
  /** 子任务集合（展开行子表 + 编辑/复制回显） */
  orderMissions?: TemplateMissionRowDto[]
}

/** 分页响应（OpenAPI PageOrderTemplate；total int64 经 JSON number 接收） */
export interface TemplatePageDto {
  records?: TemplateRowDto[] | null
  total?: number
  size?: number
  current?: number
  pages?: number
}

/** 分页查询参数（OpenAPI OrderTemplatePageParamOrderTemplate；G04 平铺口径：
 *  GET query 对象属性直接平铺为 query 参数，query=模板名称或编号模糊匹配） */
export interface TemplatePageParam {
  /** 当前页码（从 1 计数） */
  pageNo: number
  /** 每页数量 */
  pageSize: number
  /** 模板名称或编号模糊查询（可选） */
  query?: string
}

/** 创建模板参数（OpenAPI OrderTemplateParam；appointVehicleKey 与
 *  appointVehicleGroupKey 互斥二选一，可同时为空=不指定车辆） */
export interface TemplateCreateParamDto {
  /** 模板名称（必填） */
  orderTemplateName: string
  /** 预约车辆 key（未指定车辆分组时提交） */
  appointVehicleKey?: string
  /** 预约车辆分组 key（未指定车辆时提交） */
  appointVehicleGroupKey?: string
  /** 子任务列表（至少 1 条，页面整组校验「子任务不能为空」） */
  orderMissions: TemplateMissionParamDto[]
}

/** 编辑模板参数（OpenAPI OrderTemplateUpdateParam；int64 id 定位，其余同创建——
 *  与创建共用子任务结构，编辑为整模板替换语义） */
export interface TemplateUpdateParamDto extends TemplateCreateParamDto {
  /** 模板数据库 id（int64，从回显行显式携带） */
  id: number
}

/** 删除模板参数（OpenAPI OrderTemplateDeleteParam；body 仅 {orderTemplateKey}——
 *  按调度 key 定位，与 P23/P24 按 int64 id 定位的形态不同，勿混淆） */
export interface TemplateDeleteParamDto {
  orderTemplateKey: string
}

/** 子任务提交条目（OpenAPI OrderMissionTemplateParam；mapId/stationId 为字符串唯一 id） */
export interface TemplateMissionParamDto {
  /** 地图唯一 id */
  mapId: string
  /** 站点唯一 id */
  stationId: string
  /** 动作集合（至少包含页面表单产出的 actionType/actionDescription/blockingType/actionParameters） */
  actions: TemplateActionDto[]
}
