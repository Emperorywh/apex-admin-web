/**
 * 工艺模板共享选项 DTO（GET /dispatcher/orderTemplate/getOrderTemplates，
 * OpenAPI OrderTemplate schema）。contracts.md 第 5 节登记 owner=P03、消费者 P20/P21。
 * 模板的增改删/步骤编辑归 P20 页面任务，本服务仅提供只读选项查询。
 */

/** 工艺模板（OrderTemplate schema 全量字段；子任务结构模板与订单同形，此处按需透传） */
export interface OrderTemplateDto {
  /** 后端自增主键（int64，JSON number 承载；G10 精度联调核实项） */
  id?: number
  createTime?: string
  updateTime?: string
  createUser?: string
  updateUser?: string
  /** 模板名称（展示用） */
  orderTemplateName?: string
  /** 模板唯一 key（调度系统标识） */
  orderTemplateKey?: string
  /** 模板预约车辆 key/名称 */
  appointVehicleKey?: string
  appointVehicleName?: string
  /** 模板预约车辆分组 key/名称 */
  appointVehicleGroupKey?: string
  appointVehicleGroupName?: string
  /** 模板子任务集合（结构与订单子任务一致，消费方按需解析） */
  orderMissions?: unknown[]
}
