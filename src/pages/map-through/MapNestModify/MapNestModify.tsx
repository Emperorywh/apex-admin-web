/**
 * 地图编辑暂缓说明页（H02 / 规格 3.2 D07）。
 *
 * 旧来源 C:\code\dd\src\pages\MapThrough\MapNestModify（Konva 完整地图编辑器：
 * NestGraph 画布（GraphStage/GraphBar/GraphMenu/ContextMenu）+ NestPanel 属性
 * 面板 + 启用编辑/地图描述等）本期整体不迁移：本页不加载任何旧编辑器代码，
 * 不发业务请求、不产生任何地图编辑副作用（新增/改删节点边、保存、发布等）。
 * 地图列表的增改删、版本、导入导出、发布推送归 P09，选点/只读渲染归 P07，
 * 均不受本页影响。
 *
 * 约束（与 H01 同模式）：
 * - 本页带 migrationDeferred 元标记，不作为登录落点/回跳候选
 *   （routeAccess.isLeafAvailable 排除 deferred 页）。
 * - 直访携带的查询参数（旧入口的地图 ID 等上下文）原样保留在地址栏，
 *   本页不消费、不清洗、不据其跳转——既不死链也不自动跳旧系统，
 *   为后续真实迁移保留上下文入口。
 * - 权限与旧系统一致：map-edit:view（PERM.MAP_EDIT_VIEW，菜单与直访一致守卫）。
 * - 标题文案走 menu 常载命名空间（五语言沿用旧菜单真译），
 *   说明文案走 common 常载命名空间，本页不新增私有分片（i18n-map H02 登记）。
 */

import { MigrationPending } from '@/components/MigrationPending/MigrationPending'

export default function MapNestModify() {
  // 统一暂缓说明：标题与路由菜单同源（menu.地图编辑），说明文案为 common 既有五语言
  return <MigrationPending title="地图编辑" />
}
