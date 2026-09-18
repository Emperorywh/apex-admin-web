/**
 * 任务类型/状态下拉选项元数据（P03）。
 *
 * 枚举值是提交给后端的协议原值（OpenAPI OrderRecordPageParamOrderRecord 枚举），
 * label 为中文文案 key（i18next 运行时翻译，不落成固定字符串，DoD 11/18.2.8）。
 * 状态口径与旧实现一致：筛选选项七状态；列表标签映射见页面 ORDER_STATE_TAG_META。
 */

import type { OrderState, OrderType } from '@/services/order-record/order.service.types'

export const ORDER_TYPE_OPTIONS: { value: OrderType; label: string }[] = [
  { value: 'WORK', label: '工作任务' },
  { value: 'PARK', label: '停靠任务' },
  { value: 'CHARGE', label: '充电任务' },
  { value: 'BATTERY_MAINTAIN', label: '电池保养' },
]

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
 * 子任务/动作状态映射（详情弹窗展示用；枚举值为协议原值）。
 * 子任务状态文案与旧实现 MissionState 枚举一致（等待/进行/挂起/取消/完成）；
 * 动作状态与旧实现 ActionStatus 枚举一致（等待/初始化/执行中/完成/失败）。
 * 未知枚举不映射，由调用方显示原值（规格 18.3）。
 */

export const MISSION_STATE_OPTIONS: { value: string; label: string }[] = [
  { value: 'NA', label: '等待' },
  { value: 'PROCESSING', label: '进行' },
  { value: 'HANG', label: '挂起' },
  { value: 'CANCELLED', label: '取消' },
  { value: 'FINISHED', label: '完成' },
]

export const ACTION_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'WAITING', label: '等待' },
  { value: 'INITIALIZING', label: '初始化' },
  { value: 'RUNNING', label: '执行中' },
  { value: 'FINISHED', label: '完成' },
  { value: 'FAILED', label: '失败' },
]
