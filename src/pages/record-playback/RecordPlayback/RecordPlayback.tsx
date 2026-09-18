/**
 * 录制回放暂缓说明页（H03 / 规格 3.2 D07）。
 *
 * 旧来源 C:\code\dd\src\pages\RecordPlayback（Konva 回放画布 KonvaRender +
 * ControlPanel 控制面板 + TopBar + 录制文件导入/导出（ImportModal/ExportModal）
 * + 历史录制 HistoryModal + 车辆信息面板（VehicleInformation/VehicleInfoModal），
 * 依赖 getPlaybackFrames 回放帧轮询 / getSimpleMaps / getSystemStatusRanges）
 * 本期整体不迁移：本页不加载任何旧回放代码，不发业务请求、不建立轮询/连接，
 * 不引入录制文件导入导出、时间轴、回放轮询、全局进度和完整回放模块。
 *
 * 约束（与 H01/H02 同模式）：
 * - 本页带 migrationDeferred 元标记，不作为登录落点/回跳候选
 *   （routeAccess.isLeafAvailable 排除 deferred 页）。
 * - 直访携带的查询参数（旧入口的地图/录制上下文）原样保留在地址栏，
 *   本页不消费、不清洗、不据其跳转——既不死链也不自动跳旧系统，
 *   为后续真实迁移保留上下文入口。
 * - 权限与旧系统一致：record-playback:view（PERM.RECORD_PLAYBACK_VIEW，
 *   菜单与直访一致守卫）。
 * - 标题文案走 menu 常载命名空间（五语言沿用旧菜单真译），
 *   说明文案走 common 常载命名空间，本页不新增私有分片（i18n-map H03 登记）。
 */

import { MigrationPending } from '@/components/MigrationPending/MigrationPending'

export default function RecordPlayback() {
  // 统一暂缓说明：标题与路由菜单同源（menu.录制回放），说明文案为 common 既有五语言
  return <MigrationPending title="录制回放" />
}
