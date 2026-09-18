/**
 * 任务域枚举展示元数据（共享常量，P38 提升自 features/order-record/orderRecordOptions）。
 *
 * 为什么放在 constants：任务管理（P03）与任务详情（P38）分属两个 feature 业务域，
 * 结构检查禁止 features 之间互相导入；枚举映射是协议原值 → 展示文案的单一真相源，
 * 提升到共享常量层供两个业务域共同消费，避免两份定义漂移。
 *
 * 纪律：
 * - value 一律是后端协议原值（OpenAPI 枚举），提交/筛选时保持原值不翻译；
 * - label 是简体中文文案 key，i18next 运行时翻译（中文 key 即文案），
 *   不在模块加载期翻译成固定字符串（语言切换后动态重建，规格 18.2.8）；
 * - 未知枚举不映射，由调用方显示原值（规格 18.3：不臆造语义）。
 */

import type { OrderState, OrderType } from '@/services/order-record/order.service.types'

/** 任务类型（旧实现 OrderTypes 枚举同口径） */
export const ORDER_TYPE_OPTIONS: { value: OrderType; label: string }[] = [
  { value: 'WORK', label: '工作任务' },
  { value: 'PARK', label: '停靠任务' },
  { value: 'CHARGE', label: '充电任务' },
  { value: 'BATTERY_MAINTAIN', label: '电池保养' },
]

/** 任务状态（旧实现 OrderStatus 枚举同口径；筛选选项七状态） */
export const ORDER_STATE_OPTIONS: { value: OrderState; label: string }[] = [
  { value: 'OUT_QUEUE', label: '队列外' },
  { value: 'IN_QUEUE', label: '队列中' },
  { value: 'PROCESSING', label: '执行中' },
  { value: 'HANG', label: '挂起' },
  { value: 'SUCCEEDED', label: '成功' },
  { value: 'CANCELLED', label: '取消' },
  { value: 'FAILED', label: '失败' },
]

/**
 * 子任务状态（详情展示用；旧实现 MissionState 枚举同口径：等待/进行/挂起/取消/完成）。
 * value 为 string：missionPage 记录中的状态为后端原值字符串，未知值不映射。
 */
export const MISSION_STATE_OPTIONS: { value: string; label: string }[] = [
  { value: 'NA', label: '等待' },
  { value: 'PROCESSING', label: '进行' },
  { value: 'HANG', label: '挂起' },
  { value: 'CANCELLED', label: '取消' },
  { value: 'FINISHED', label: '完成' },
]

/** 动作状态（详情展示用；旧实现 ActionStatus 枚举同口径：等待/初始化/执行中/完成/失败） */
export const ACTION_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'WAITING', label: '等待' },
  { value: 'INITIALIZING', label: '初始化' },
  { value: 'RUNNING', label: '执行中' },
  { value: 'FINISHED', label: '完成' },
  { value: 'FAILED', label: '失败' },
]
