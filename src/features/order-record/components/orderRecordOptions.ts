/**
 * 任务类型/状态下拉选项元数据（P03）。
 *
 * P38 起枚举映射常量提升到共享常量层 `@/constants/order/orderDisplayOptions`
 * （任务详情业务域与列表域分属两个 feature，结构检查禁止跨 feature 导入；
 * 常量单点定义、两域共同消费）。本文件保留 re-export，既有消费者导入路径不变。
 *
 * 纪律不变：枚举值是提交给后端的协议原值（OpenAPI OrderRecordPageParamOrderRecord
 * 枚举），label 为中文文案 key（i18next 运行时翻译，不落成固定字符串）。
 * 状态口径与旧实现一致：筛选选项七状态；列表标签映射见页面 ORDER_STATE_TAG_META。
 */

export {
  ACTION_STATUS_OPTIONS,
  MISSION_STATE_OPTIONS,
  ORDER_STATE_OPTIONS,
  ORDER_TYPE_OPTIONS,
} from '@/constants/order/orderDisplayOptions'
