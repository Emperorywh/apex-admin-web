/**
 * 操作日志所属模块选项（P28；旧实现 operationLogModuleOptions 等价迁移）。
 *
 * value 与后端 SysLog.module 字段保持一致（旧仓库 constants 同源 14 项，不臆造
 * 不增删）；label 是简中文案 key：筛选下拉与表格 Tag 经 t() 走 operationLog
 * 命名空间翻译，四语言分片同构（en 沿用旧真译，繁日韩 B1 基线补译）。
 * 后端返回未知枚举时表格显示协议原值（不猜语义，AGENTS 第 3 节纪律）。
 */

export interface OperationLogModuleOption {
  /** 简中文案 key（i18n 翻译；keySeparator=false 中文 key 即文案） */
  label: string
  /** 模块枚举原值（与后端 SysLog.module 一致，精确匹配筛选值） */
  value: string
}

/** 操作日志模块枚举（旧仓库 constants/index.ts 同源等价迁移） */
export const operationLogModuleOptions: OperationLogModuleOption[] = [
  { label: '车辆管理', value: 'VEHICLE' },
  { label: '车辆组管理', value: 'VEHICLE_GROUP' },
  { label: '载具管理', value: 'CARRIER' },
  { label: '订单管理', value: 'ORDER' },
  { label: '订单模板', value: 'ORDER_TEMPLATE' },
  { label: '订单工艺', value: 'ORDER_FLOW' },
  { label: '回放管理', value: 'PLAYBACK' },
  { label: '交通管理', value: 'TRAFFIC' },
  { label: '设备管理', value: 'DEVICE' },
  { label: '地图管理', value: 'MAP' },
  { label: '用户管理', value: 'USER' },
  { label: '角色管理', value: 'ROLE' },
  { label: '动作管理', value: 'ACTION' },
  { label: '系统管理', value: 'SYSTEM' },
]

/** 枚举原值 → 简中文案 key 的映射（表格 Tag 渲染消费；未知枚举回退原值） */
export const operationLogModuleLabelMap: Record<string, string> =
  operationLogModuleOptions.reduce<Record<string, string>>((acc, cur) => {
    acc[cur.value] = cur.label
    return acc
  }, {})
