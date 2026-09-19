/**
 * i18next 初始化与语言治理。
 *
 * - key 即中文文案：keySeparator/nsSeparator 关闭，zh-CN 不维护资源文件
 * - 其余四语言资源按命名空间懒加载（路由通过 meta.i18nNamespaces 声明）
 * - 切换语言先预加载基础与已打开页签命名空间并集，再 changeLanguage；
 *   预加载失败时保留原语言（调用方回滚状态），不会出现半翻译页面
 */

import i18next, { type BackendModule, type CallbackError } from 'i18next'
import dayjs from 'dayjs'
import { initReactI18next } from 'react-i18next'
// 五个 locale 包静态注册（体积小）；展示层可输出对应语言的相对时间等文案，
// 解析与时区行为不受影响（DoD 14：日期数值展示不改协议）
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/zh-tw'
import 'dayjs/locale/en'
import 'dayjs/locale/ja'
import 'dayjs/locale/ko'
import { setRequestLanguage } from '@/services/request/request'

/**
 * 全站支持的五种语言。zh-TW 为独立语言而非 zh-CN 的变体：
 * normalizeLanguage 对繁中/日/韩精确保留，不误映射回简中。
 */
export const SUPPORTED_LANGUAGES = ['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'ko-KR'] as const
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: AppLanguage = 'zh-CN'

/** 语言偏好 localStorage key（目标项目单一持久语言来源） */
const STORAGE_KEY_LANGUAGE = 'apex-admin:lang'
/**
 * 旧系统（Umi）语言偏好 key：同源一次迁移。老用户此前保存的语言偏好
 * 读取后写入新 key 并删除旧 key，避免双来源残留（T00.8：umi_locale 一次迁移）。
 */
const LEGACY_STORAGE_KEY_LANGUAGE = 'umi_locale'

/**
 * 基础命名空间，所有页面共享。
 * error 为错误兜底（404/500/页面与路由错误边界）文案：这类呈现可随时出现在
 * 任意路由——包括未声明页面命名空间的公开页与类组件直读 i18next 的错误边界
 * （P42），故随基座常载，不依赖路由 meta 声明。
 */
export const BASE_NAMESPACES = ['common', 'menu', 'error'] as const

/** dayjs locale 映射：语言切换时同步（仅影响展示措辞，不改时间值/时区） */
const DAYJS_LOCALES: Record<AppLanguage, string> = {
  'zh-CN': 'zh-cn',
  'zh-TW': 'zh-tw',
  'en-US': 'en',
  'ja-JP': 'ja',
  'ko-KR': 'ko',
}

/** 单语言命名空间懒加载表 */
type NamespaceLoaders = Record<string, () => Promise<{ default: Record<string, string> }>>

/** en-US 命名空间懒加载表（含 T00 共享命名空间与已交付页面命名空间） */
const enUsLoaders: NamespaceLoaders = {
  common: () => import('@/i18n/locales/en-US/common'),
  menu: () => import('@/i18n/locales/en-US/menu'),
  auth: () => import('@/i18n/locales/en-US/auth'),
  profile: () => import('@/i18n/locales/en-US/profile'),
  system: () => import('@/i18n/locales/en-US/system'),
  // P03 任务管理交付：en-US 分片重写（旧真译沿用+补译）
  orderRecord: () => import('@/i18n/locales/en-US/orderRecord'),
  // P38 完整任务详情（order-info；页面私有命名空间，弹窗完整详情入口共用）
  orderInfo: () => import('@/i18n/locales/en-US/orderInfo'),
  // P05 车辆列表（vehicle-deploy/vehicle-diplay；页面私有命名空间）
  vehicleList: () => import('@/i18n/locales/en-US/vehicleList'),
  // P04 车辆分组（vehicle-deploy/vehicle-group；页面私有命名空间）
  vehicleGroup: () => import('@/i18n/locales/en-US/vehicleGroup'),
  // P06 载具类型（vehicle-deploy/vehicle-type；页面私有命名空间）
  carrierType: () => import('@/i18n/locales/en-US/carrierType'),
  // P07 节点映射（vehicle-deploy/node-mapping；页面私有命名空间，地图选点弹窗共用）
  nodeMapping: () => import('@/i18n/locales/en-US/nodeMapping'),
  // P08 告警码管理（system-involve/alarm-code-management；页面私有命名空间）
  vehicleAlarmCode: () => import('@/i18n/locales/en-US/vehicleAlarmCode'),
  // P09 地图列表（map-through/map-list；页面私有命名空间）
  mapList: () => import('@/i18n/locales/en-US/mapList'),
  // P10 跨地图关联（map-through/cross-maps；页面私有命名空间）
  crossMap: () => import('@/i18n/locales/en-US/crossMap'),
  // P11 多地图点边组合（map-through/point-edge-combination；页面私有命名空间）
  nodeEdgeGroup: () => import('@/i18n/locales/en-US/nodeEdgeGroup'),
  // P12 地图推送记录（map-through/map-push-records；页面私有命名空间）
  mapPushRecord: () => import('@/i18n/locales/en-US/mapPushRecord'),
  // P13 调度中心（dispatch-hub；页面私有命名空间）
  dispatchConfig: () => import('@/i18n/locales/en-US/dispatchConfig'),
  // P14 电梯（tri-resource/tri-device/elevator；页面私有命名空间）
  deviceElevator: () => import('@/i18n/locales/en-US/deviceElevator'),
  // P15 自动门（tri-resource/tri-device/auto-door；页面私有命名空间）
  deviceAutoDoor: () => import('@/i18n/locales/en-US/deviceAutoDoor'),
  // P16 充电桩（tri-resource/tri-device/charge-pie；页面私有命名空间）
  deviceChargePile: () => import('@/i18n/locales/en-US/deviceChargePile'),
  // P17 交通灯（tri-resource/tri-device/traffic-lights；页面私有命名空间）
  deviceTrafficLight: () => import('@/i18n/locales/en-US/deviceTrafficLight'),
  // P18 风淋门(tri-resource/tri-device/air-shower-door;页面私有命名空间)
  deviceAirShower: () => import('@/i18n/locales/en-US/deviceAirShower'),
  // P22 避障模板（mission-cluster/obstacle-avoidance；页面私有命名空间）
  obstacleTemplate: () => import('@/i18n/locales/en-US/obstacleTemplate'),
  // P23 车辆动作（mission-cluster/action-control/agv-action；页面私有命名空间）
  agvAction: () => import('@/i18n/locales/en-US/agvAction'),
  // P25 版本管理（system-involve/version-control；页面私有命名空间）
  systemVersion: () => import('@/i18n/locales/en-US/systemVersion'),
  // P26 系统日志（system-involve/system-log；页面私有命名空间）
  systemLog: () => import('@/i18n/locales/en-US/systemLog'),
  // P28 操作日志（system-involve/operation-log；页面私有命名空间）
  operationLog: () => import('@/i18n/locales/en-US/operationLog'),
  // P27 系统设置（system-involve/system-setting；页面私有命名空间）
  'system-branding': () => import('@/i18n/locales/en-US/system-branding'),
  // P39 完整车辆详情（vehicle-info；页面私有命名空间，抽屉完整详情入口共用）
  vehicleInfo: () => import('@/i18n/locales/en-US/vehicleInfo'),
  dashboard: () => import('@/i18n/locales/en-US/dashboard'),
  error: () => import('@/i18n/locales/en-US/error'),
  // 共享地图能力文案（T00.7 ReadOnlyMap；消费页面在 meta.i18nNamespaces 声明 'map'）
  map: () => import('@/i18n/locales/en-US/map'),
  // P02 软件授权（authorize-ingress；P29 复用激活组件时同声明此命名空间）
  'license-activation': () => import('@/i18n/locales/en-US/license-activation'),
  // P29 软件信息（system-involve/software-information；页面私有命名空间，激活弹窗复用 P02 组件同声明 license-activation）
  'software-license': () => import('@/i18n/locales/en-US/software-license'),
  // P30 数据库备份（system-involve/database-backup；页面私有命名空间）
  'database-backup': () => import('@/i18n/locales/en-US/database-backup'),
  // P41 无权限页（un-access；布局外独立页）
  'access-denied': () => import('@/i18n/locales/en-US/access-denied'),
}

/**
 * zh-TW/ja-JP/ko-KR 基座命名空间（T00.8：common/menu/auth/error/map 全量交付）。
 * 页面私有命名空间（profile/system/orderRecord/dashboard 等）由对应页面任务
 * 交付自己的四语言分片；此处查不到的命名空间返回空资源，i18next 自动回退简中
 * （key 即中文文案，回退语义天然成立），已登记 docs/migration/i18n-missing.md。
 * 三个语言目录结构一致，逐语言声明字面量导入（Vite 静态分析要求）。
 */
const zhTwLoaders: NamespaceLoaders = {
  common: () => import('@/i18n/locales/zh-TW/common'),
  menu: () => import('@/i18n/locales/zh-TW/menu'),
  auth: () => import('@/i18n/locales/zh-TW/auth'),
  error: () => import('@/i18n/locales/zh-TW/error'),
  map: () => import('@/i18n/locales/zh-TW/map'),
  // P03 任务管理（order-record；页面私有命名空间）
  orderRecord: () => import('@/i18n/locales/zh-TW/orderRecord'),
  // P38 完整任务详情（order-info；页面私有命名空间）
  orderInfo: () => import('@/i18n/locales/zh-TW/orderInfo'),
  // P39 完整车辆详情（vehicle-info；页面私有命名空间，抽屉完整详情入口共用）
  vehicleInfo: () => import('@/i18n/locales/zh-TW/vehicleInfo'),
  vehicleList: () => import('@/i18n/locales/zh-TW/vehicleList'),
  // P04 车辆分组（vehicle-deploy/vehicle-group；页面私有命名空间）
  vehicleGroup: () => import('@/i18n/locales/zh-TW/vehicleGroup'),
  // P06 载具类型（vehicle-deploy/vehicle-type；页面私有命名空间）
  carrierType: () => import('@/i18n/locales/zh-TW/carrierType'),
  // P07 节点映射（vehicle-deploy/node-mapping；页面私有命名空间，地图选点弹窗共用）
  nodeMapping: () => import('@/i18n/locales/zh-TW/nodeMapping'),
  // P08 告警码管理（system-involve/alarm-code-management；页面私有命名空间）
  vehicleAlarmCode: () => import('@/i18n/locales/zh-TW/vehicleAlarmCode'),
  // P09 地图列表（map-through/map-list；页面私有命名空间）
  mapList: () => import('@/i18n/locales/zh-TW/mapList'),
  // P10 跨地图关联（map-through/cross-maps；页面私有命名空间）
  crossMap: () => import('@/i18n/locales/zh-TW/crossMap'),
  // P11 多地图点边组合（map-through/point-edge-combination；页面私有命名空间）
  nodeEdgeGroup: () => import('@/i18n/locales/zh-TW/nodeEdgeGroup'),
  // P12 地图推送记录（map-through/map-push-records；页面私有命名空间）
  mapPushRecord: () => import('@/i18n/locales/zh-TW/mapPushRecord'),
  // P13 调度中心（dispatch-hub；页面私有命名空间）
  dispatchConfig: () => import('@/i18n/locales/zh-TW/dispatchConfig'),
  // P14 电梯（tri-resource/tri-device/elevator；页面私有命名空间）
  deviceElevator: () => import('@/i18n/locales/zh-TW/deviceElevator'),
  // P15 自动门（tri-resource/tri-device/auto-door；页面私有命名空间）
  deviceAutoDoor: () => import('@/i18n/locales/zh-TW/deviceAutoDoor'),
  // P16 充电桩（tri-resource/tri-device/charge-pie；页面私有命名空间）
  deviceChargePile: () => import('@/i18n/locales/zh-TW/deviceChargePile'),
  // P17 交通灯（tri-resource/tri-device/traffic-lights；页面私有命名空间）
  deviceTrafficLight: () => import('@/i18n/locales/zh-TW/deviceTrafficLight'),
  // P18 風淋門(tri-resource/tri-device/air-shower-door;頁面私有命名空間)
  deviceAirShower: () => import('@/i18n/locales/zh-TW/deviceAirShower'),
  // P22 避障範本（mission-cluster/obstacle-avoidance;頁面私有命名空間）
  obstacleTemplate: () => import('@/i18n/locales/zh-TW/obstacleTemplate'),
  // P23 车辆动作（mission-cluster/action-control/agv-action；页面私有命名空间）
  agvAction: () => import('@/i18n/locales/zh-TW/agvAction'),
  // P25 版本管理（system-involve/version-control；页面私有命名空间）
  systemVersion: () => import('@/i18n/locales/zh-TW/systemVersion'),
  // P26 系统日志（system-involve/system-log；页面私有命名空间）
  systemLog: () => import('@/i18n/locales/zh-TW/systemLog'),
  // P28 操作日志（system-involve/operation-log；页面私有命名空间）
  operationLog: () => import('@/i18n/locales/zh-TW/operationLog'),
  // P27 系统设置（system-involve/system-setting；页面私有命名空间）
  'system-branding': () => import('@/i18n/locales/zh-TW/system-branding'),
  'license-activation': () => import('@/i18n/locales/zh-TW/license-activation'),
  // P29 软件信息（system-involve/software-information；页面私有命名空间，激活弹窗复用 P02 组件同声明 license-activation）
  'software-license': () => import('@/i18n/locales/zh-TW/software-license'),
  // P30 数据库备份（system-involve/database-backup；页面私有命名空间）
  'database-backup': () => import('@/i18n/locales/zh-TW/database-backup'),
  'access-denied': () => import('@/i18n/locales/zh-TW/access-denied'),
}
const jaJpLoaders: NamespaceLoaders = {
  common: () => import('@/i18n/locales/ja-JP/common'),
  menu: () => import('@/i18n/locales/ja-JP/menu'),
  auth: () => import('@/i18n/locales/ja-JP/auth'),
  error: () => import('@/i18n/locales/ja-JP/error'),
  map: () => import('@/i18n/locales/ja-JP/map'),
  // P03 任务管理（order-record；页面私有命名空间）
  orderRecord: () => import('@/i18n/locales/ja-JP/orderRecord'),
  // P38 完整任务详情（order-info；页面私有命名空间）
  orderInfo: () => import('@/i18n/locales/ja-JP/orderInfo'),
  // P39 完整车辆详情（vehicle-info；页面私有命名空间，抽屉完整详情入口共用）
  vehicleInfo: () => import('@/i18n/locales/ja-JP/vehicleInfo'),
  vehicleList: () => import('@/i18n/locales/ja-JP/vehicleList'),
  // P04 车辆分组（vehicle-deploy/vehicle-group；页面私有命名空间）
  vehicleGroup: () => import('@/i18n/locales/ja-JP/vehicleGroup'),
  // P06 载具类型（vehicle-deploy/vehicle-type；页面私有命名空间）
  carrierType: () => import('@/i18n/locales/ja-JP/carrierType'),
  // P07 节点映射（vehicle-deploy/node-mapping；页面私有命名空间，地图选点弹窗共用）
  nodeMapping: () => import('@/i18n/locales/ja-JP/nodeMapping'),
  // P08 告警码管理（system-involve/alarm-code-management；页面私有命名空间）
  vehicleAlarmCode: () => import('@/i18n/locales/ja-JP/vehicleAlarmCode'),
  // P09 地图列表（map-through/map-list；页面私有命名空间）
  mapList: () => import('@/i18n/locales/ja-JP/mapList'),
  // P10 跨地图关联（map-through/cross-maps；页面私有命名空间）
  crossMap: () => import('@/i18n/locales/ja-JP/crossMap'),
  // P11 多地图点边组合（map-through/point-edge-combination；页面私有命名空间）
  nodeEdgeGroup: () => import('@/i18n/locales/ja-JP/nodeEdgeGroup'),
  // P12 地图推送记录（map-through/map-push-records；页面私有命名空间）
  mapPushRecord: () => import('@/i18n/locales/ja-JP/mapPushRecord'),
  // P13 调度中心（dispatch-hub；页面私有命名空间）
  dispatchConfig: () => import('@/i18n/locales/ja-JP/dispatchConfig'),
  // P14 电梯（tri-resource/tri-device/elevator；页面私有命名空间）
  deviceElevator: () => import('@/i18n/locales/ja-JP/deviceElevator'),
  // P15 自动门（tri-resource/tri-device/auto-door；页面私有命名空间）
  deviceAutoDoor: () => import('@/i18n/locales/ja-JP/deviceAutoDoor'),
  // P16 充电桩（tri-resource/tri-device/charge-pie；页面私有命名空间）
  deviceChargePile: () => import('@/i18n/locales/ja-JP/deviceChargePile'),
  // P17 交通灯（tri-resource/tri-device/traffic-lights；页面私有命名空间）
  deviceTrafficLight: () => import('@/i18n/locales/ja-JP/deviceTrafficLight'),
  // P18 エアシャワー(tri-resource/tri-device/air-shower-door;ページ専用名前空間)
  deviceAirShower: () => import('@/i18n/locales/ja-JP/deviceAirShower'),
  // P22 障害物回避テンプレート（mission-cluster/obstacle-avoidance;ページ専用名前空間）
  obstacleTemplate: () => import('@/i18n/locales/ja-JP/obstacleTemplate'),
  // P23 车辆动作（mission-cluster/action-control/agv-action；页面私有命名空间）
  agvAction: () => import('@/i18n/locales/ja-JP/agvAction'),
  // P25 版本管理（system-involve/version-control；页面私有命名空间）
  systemVersion: () => import('@/i18n/locales/ja-JP/systemVersion'),
  // P26 系统日志（system-involve/system-log；页面私有命名空间）
  systemLog: () => import('@/i18n/locales/ja-JP/systemLog'),
  // P28 操作日志（system-involve/operation-log；页面私有命名空间）
  operationLog: () => import('@/i18n/locales/ja-JP/operationLog'),
  // P27 系统设置（system-involve/system-setting；页面私有命名空间）
  'system-branding': () => import('@/i18n/locales/ja-JP/system-branding'),
  'license-activation': () => import('@/i18n/locales/ja-JP/license-activation'),
  // P29 软件信息（system-involve/software-information；页面私有命名空间，激活弹窗复用 P02 组件同声明 license-activation）
  'software-license': () => import('@/i18n/locales/ja-JP/software-license'),
  // P30 数据库备份（system-involve/database-backup；页面私有命名空间）
  'database-backup': () => import('@/i18n/locales/ja-JP/database-backup'),
  'access-denied': () => import('@/i18n/locales/ja-JP/access-denied'),
}
const koKrLoaders: NamespaceLoaders = {
  common: () => import('@/i18n/locales/ko-KR/common'),
  menu: () => import('@/i18n/locales/ko-KR/menu'),
  auth: () => import('@/i18n/locales/ko-KR/auth'),
  error: () => import('@/i18n/locales/ko-KR/error'),
  map: () => import('@/i18n/locales/ko-KR/map'),
  // P03 任务管理（order-record；页面私有命名空间）
  orderRecord: () => import('@/i18n/locales/ko-KR/orderRecord'),
  // P38 完整任务详情（order-info；页面私有命名空间）
  orderInfo: () => import('@/i18n/locales/ko-KR/orderInfo'),
  // P39 完整车辆详情（vehicle-info；页面私有命名空间，抽屉完整详情入口共用）
  vehicleInfo: () => import('@/i18n/locales/ko-KR/vehicleInfo'),
  vehicleList: () => import('@/i18n/locales/ko-KR/vehicleList'),
  // P04 车辆分组（vehicle-deploy/vehicle-group；页面私有命名空间）
  vehicleGroup: () => import('@/i18n/locales/ko-KR/vehicleGroup'),
  // P06 载具类型（vehicle-deploy/vehicle-type；页面私有命名空间）
  carrierType: () => import('@/i18n/locales/ko-KR/carrierType'),
  // P07 节点映射（vehicle-deploy/node-mapping；页面私有命名空间，地图选点弹窗共用）
  nodeMapping: () => import('@/i18n/locales/ko-KR/nodeMapping'),
  // P08 告警码管理（system-involve/alarm-code-management；页面私有命名空间）
  vehicleAlarmCode: () => import('@/i18n/locales/ko-KR/vehicleAlarmCode'),
  // P09 地图列表（map-through/map-list；页面私有命名空间）
  mapList: () => import('@/i18n/locales/ko-KR/mapList'),
  // P10 跨地图关联（map-through/cross-maps；页面私有命名空间）
  crossMap: () => import('@/i18n/locales/ko-KR/crossMap'),
  // P11 多地图点边组合（map-through/point-edge-combination；页面私有命名空间）
  nodeEdgeGroup: () => import('@/i18n/locales/ko-KR/nodeEdgeGroup'),
  // P12 地图推送记录（map-through/map-push-records；页面私有命名空间）
  mapPushRecord: () => import('@/i18n/locales/ko-KR/mapPushRecord'),
  // P13 调度中心（dispatch-hub；页面私有命名空间）
  dispatchConfig: () => import('@/i18n/locales/ko-KR/dispatchConfig'),
  // P14 电梯（tri-resource/tri-device/elevator；页面私有命名空间）
  deviceElevator: () => import('@/i18n/locales/ko-KR/deviceElevator'),
  // P15 自动门（tri-resource/tri-device/auto-door；页面私有命名空间）
  deviceAutoDoor: () => import('@/i18n/locales/ko-KR/deviceAutoDoor'),
  // P16 充电桩（tri-resource/tri-device/charge-pie；页面私有命名空间）
  deviceChargePile: () => import('@/i18n/locales/ko-KR/deviceChargePile'),
  // P17 交通灯（tri-resource/tri-device/traffic-lights；页面私有命名空间）
  deviceTrafficLight: () => import('@/i18n/locales/ko-KR/deviceTrafficLight'),
  // P18 에어샤워(tri-resource/tri-device/air-shower-door;페이지 전용 네임스페이스)
  deviceAirShower: () => import('@/i18n/locales/ko-KR/deviceAirShower'),
  // P22 장애물 회피 템플릿(mission-cluster/obstacle-avoidance;페이지 전용 네임스페이스)
  obstacleTemplate: () => import('@/i18n/locales/ko-KR/obstacleTemplate'),
  // P23 车辆动作（mission-cluster/action-control/agv-action；页面私有命名空间）
  agvAction: () => import('@/i18n/locales/ko-KR/agvAction'),
  // P25 版本管理（system-involve/version-control；页面私有命名空间）
  systemVersion: () => import('@/i18n/locales/ko-KR/systemVersion'),
  // P26 系统日志（system-involve/system-log；页面私有命名空间）
  systemLog: () => import('@/i18n/locales/ko-KR/systemLog'),
  // P28 操作日志（system-involve/operation-log；页面私有命名空间）
  operationLog: () => import('@/i18n/locales/ko-KR/operationLog'),
  // P27 系统设置（system-involve/system-setting；页面私有命名空间）
  'system-branding': () => import('@/i18n/locales/ko-KR/system-branding'),
  'license-activation': () => import('@/i18n/locales/ko-KR/license-activation'),
  // P29 软件信息（system-involve/software-information；页面私有命名空间，激活弹窗复用 P02 组件同声明 license-activation）
  'software-license': () => import('@/i18n/locales/ko-KR/software-license'),
  // P30 数据库备份（system-involve/database-backup；页面私有命名空间）
  'database-backup': () => import('@/i18n/locales/ko-KR/database-backup'),
  'access-denied': () => import('@/i18n/locales/ko-KR/access-denied'),
}

/** 各语言懒加载表：zh-CN 无资源（key 即文案）；其余语言按表加载 */
const languageLoaders: Partial<Record<AppLanguage, NamespaceLoaders>> = {
  'en-US': enUsLoaders,
  'zh-TW': zhTwLoaders,
  'ja-JP': jaJpLoaders,
  'ko-KR': koKrLoaders,
}

/**
 * 任意输入归一化为受支持语言：
 * - en* → en-US；ja* → ja-JP；ko* → ko-KR
 * - 繁中变体（zh-tw/zh-hk/zh-mo/zh-hant*）精确保留为 zh-TW，不再并入简中
 * - zh-cn/zh/zh-hans 及一切未知值回退简中
 * 持久化恢复（settings rehydrate）与切换入口统一经此收敛，
 * 避免残留的旧值/非法值直接 changeLanguage 导致 useSuspense 挂起。
 */
export function normalizeLanguage(raw: string | null | undefined): AppLanguage {
  if (!raw) return DEFAULT_LANGUAGE
  const lower = raw.toLowerCase()
  if (lower.startsWith('en')) return 'en-US'
  if (lower === 'zh-tw' || lower === 'zh-hk' || lower === 'zh-mo' || lower.startsWith('zh-hant')) {
    return 'zh-TW'
  }
  if (lower.startsWith('ja')) return 'ja-JP'
  if (lower.startsWith('ko')) return 'ko-KR'
  return 'zh-CN'
}

/**
 * 读取持久化语言偏好（无偏好或不可读时回退默认语言）；
 * 旧 umi_locale key 存在时执行一次迁移（写入新 key、删除旧 key）。
 * 供 i18n 初始化与 settings 切片共用，是持久语言偏好唯一读取入口。
 */
export function readStoredLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_LANGUAGE)
    if (stored) return normalizeLanguage(stored)
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY_LANGUAGE)
    if (legacy) {
      const migrated = normalizeLanguage(legacy)
      localStorage.setItem(STORAGE_KEY_LANGUAGE, migrated)
      localStorage.removeItem(LEGACY_STORAGE_KEY_LANGUAGE)
      return migrated
    }
    return DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

function persistLanguage(language: AppLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY_LANGUAGE, language)
  } catch {
    // 隐私模式等场景下静默失败
  }
}

/**
 * 命名空间懒加载后端：
 * - zh-CN 直接返回空资源（key 即文案）
 * - 其余语言按表加载；表中无此命名空间（页面私有分片未交付）同样返回空资源，
 *   让 i18next 走 fallbackLng 回退简中，而不是报错中断资源装载
 */
const lazyBackend: BackendModule = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    if (language === 'zh-CN') {
      callback(null, {})
      return
    }
    const loader = languageLoaders[language as AppLanguage]?.[namespace]
    if (!loader) {
      callback(null, {})
      return
    }
    loader()
      .then((mod) => callback(null, mod.default))
      .catch((err: unknown) => callback(err as CallbackError, null))
  },
}

const initialLanguage = readStoredLanguage()

if (!i18next.isInitialized) {
  void i18next.use(lazyBackend).use(initReactI18next).init({
    lng: initialLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    ns: [...BASE_NAMESPACES],
    defaultNS: 'common',
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: true },
    partialBundledLanguages: true,
  })
  dayjs.locale(DAYJS_LOCALES[initialLanguage])
  document.documentElement.lang = initialLanguage
  // 请求层 Accept-Language 与初始语言对齐（旧代码已证实行为；I07 真实复核登记）
  setRequestLanguage(initialLanguage)
}

/** 预加载指定语言的命名空间集合（zh-CN 无需加载；backendConnector.load 自带缓存与去重） */
export async function preloadNamespaces(language: AppLanguage, namespaces: readonly string[]): Promise<void> {
  if (language === 'zh-CN') return
  const unique = [...new Set(namespaces)]
  if (!unique.length) return
  await new Promise<void>((resolve, reject) => {
    i18next.services.backendConnector.load([language], unique, (err: unknown) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

/**
 * 切换语言：先加载基础与额外命名空间并集，再统一 changeLanguage，
 * 同时切换 dayjs locale 与 document lang，避免缓存页签出现半翻译状态。
 * 预加载失败时抛错且不改变任何语言状态——调用方据此保留原语言。
 */
export async function changeAppLanguage(
  language: AppLanguage,
  extraNamespaces: readonly string[] = [],
): Promise<void> {
  await preloadNamespaces(language, [...BASE_NAMESPACES, ...extraNamespaces])
  await i18next.changeLanguage(language)
  persistLanguage(language)
  dayjs.locale(DAYJS_LOCALES[language])
  document.documentElement.lang = language
  // 后续请求（含上传）携带切换后的语言
  setRequestLanguage(language)
}

export default i18next
