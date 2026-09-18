/**
 * 调度监控暂缓说明页（H01 / 规格 3.2 D07）。
 *
 * 旧来源 C:\code\dd\src\pages\Overlook（ForceGraph 力导图监控 + PanelTabs
 * 面板，含全局 WebSocket、地图操作、模拟停靠/充电等现场业务）本期整体不迁移：
 * 本页不加载任何旧监控代码，不发业务请求、不建立 WebSocket 连接，
 * 仅对拥有 overview:view 权限的用户（菜单与直访一致，T00.4 守卫拦截）呈现
 * T00 统一「本期暂未迁移」说明（MigrationPending）。
 *
 * 约束：
 * - 不复刻旧系统「登录后固定跳 /over-look」的落点（resolveLandingPath 按权限落点）；
 *   本页带 migrationDeferred 元标记，同样不作为登录落点/回跳候选。
 * - 直访携带的查询参数（旧入口的目标标识等上下文）原样保留在地址栏，
 *   本页不消费、不清洗、不据其跳转——既不死链也不自动跳旧系统，
 *   为后续真实迁移保留上下文入口。
 * - 标题文案走 menu 常载命名空间（五语言沿用旧菜单真译），
 *   说明文案走 common 常载命名空间，本页不新增私有分片（i18n-map H01 登记）。
 */

import { MigrationPending } from '@/components/MigrationPending/MigrationPending'

export default function Overlook() {
  // 统一暂缓说明：标题与路由菜单同源（menu.调度监控），说明文案为 common 既有五语言
  return <MigrationPending title="调度监控" />
}
