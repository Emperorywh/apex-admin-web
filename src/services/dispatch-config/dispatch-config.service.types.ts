/**
 * 调度配置（P13）协议 DTO（owner=P13，contracts.md 第 5 节）。
 *
 * 逐字段核对 default_OpenAPI.json 的 TaskConfig / TaskConfigEditParam /
 * ResultListTaskConfig；文档未标 required 一律可选，消费侧按留白处理。
 * 值域纪律：configValue / defaultConfigValue 协议层即 string（布尔也是
 * "true"/"false" 字符串），编辑控件在展示层转换、提交前转回字符串。
 */

/**
 * 配置值类型（OpenAPI configValueType 为无枚举 string；旧实现消费六种：
 * int 整数 / bool 布尔 / enum 单选 / select 多选 / double 小数 / string 文本）。
 * 未知类型不开放编辑（只读展示原值），不猜测语义。
 */
export type TaskConfigValueType = 'int' | 'bool' | 'enum' | 'select' | 'double' | 'string'

/** 子配置项（TaskConfig；表格一行 = 一个调度参数） */
export interface TaskConfigDto {
  /** 技术主键（int64；页面行 ID 用 configKey，此字段保持协议不丢） */
  id?: number
  /** 配置类型：traffic/system…（顶层分组的 Tab 定位键） */
  configType?: string
  /** 配置类型名称：交管/系统配置…（后端下发文案，协议原值展示不翻译） */
  configTypeName?: string
  /** 配置唯一 key（页面表格稳定行 ID；批量保存按它定位） */
  configKey?: string
  /** 配置名称（展示列） */
  configKeyName?: string
  /** 配置值类型（见 TaskConfigValueType；未知原值只读） */
  configValueType?: string
  /** 当前配置值（协议 string；bool 为 "true"/"false"，select 多选为 ";" 分隔） */
  configValue?: string
  /** 默认配置值（展示列；旧版「重置为默认」语义废弃后仅作参考列保留） */
  defaultConfigValue?: string
  /** 配置值单位（展示列） */
  configValueUnit?: string
  /** 配置值范围（int/double 解析 min/max，enum/select 解析选项的来源） */
  configValueRange?: string
  /** 嵌套的子配置集合（顶层分组节点的明细行；叶子节点为空） */
  childTaskConfigs?: TaskConfigDto[]
}

/** 批量编辑单条参数（OpenAPI TaskConfigEditParam：仅 key + 字符串值） */
export interface TaskConfigEditParam {
  configKey: string
  configValue: string
}
