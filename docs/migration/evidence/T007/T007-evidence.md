# T007 证据记录 — 统一路由、对象页签与稳定会话缓存宿主

- **日期**：2026-09-16
- **环境**：隔离验证。Vite dev `http://localhost:5217`（`APEX_DEV_LEGACY_TARGET=http://127.0.0.1:9388` 指向本目录 `mock-server.mjs`，仅提供 `/fms/v1/auth/authorize/{login,detail,logout}`）；Chrome（ZCode 内嵌浏览器）1280×720；时区 Asia/Shanghai；语言 zh-CN（界面 key 即中文）；浅色主题。
- **目标版本**：基线 `e17b710` + 本卡未提交差异（提交后以该提交为准）；`pnpm typecheck` 通过（exit 0）。
- **账号**（mock，仅隔离验证用）：`root/root`（特权分支）、`op/op`（仅 `vehicle-group:view` + `overview:view` + `auth:user:view`；树形 permissionsTree + 平铺 permissions 双源）。
- **请求留痕**：`mock-server-log.jsonl`（23 条，全部为 auth 协议请求；全程无任何暂缓模块/详情业务/被拒页面的业务请求发出）。

## 场景与结果（全部为【隔离验证】，`<TaskID>-Vxx`）

| 场景 | 操作 | 结果 |
| --- | --- | --- |
| T007-V01 | 清空存储后未登录硬刷新 `/order-record` | ✅ 重定向 `/login?redirect=%2Forder-record`。**顺带修复 T005 移交缺陷**，根因有二：① `store.ts` migrate 将 identity 置 `undefined`，绕过全应用 `=== null` 登录判定；② 守卫 loader 只等 rehydrate、不等 restoreSession 结论，硬刷新在核查完成前被误判。修复后复测通过 |
| T007-V02 | root 登录携带 redirect 回跳 | ✅ 落 `/order-record`（回跳参数生效） |
| T007-V02b | root 无参登录（默认入口） | ✅ 落 `/order-record`＝首个有权已实现业务页；跳过暂缓 over-look；模板仪表盘已移除 |
| T007-V03/V08 | root/op 退出：头像菜单 → 确认弹窗 → 确认 | ✅ 弹"确认退出登录？"；确认后回登录页（携带 redirect）；页签与缓存由 sessionExpired 整体清空（重登后从零开始） |
| T007-V04 | 对象页签：硬载 `?orderTaskKey=TASK-A`、客户端导航 `?orderTaskKey=TASK-B` | ✅ 规范化 key `/order-info?orderTaskKey=TASK-A|B`，两页签并存、标题带对象后缀（"任务详情 · TASK-A/B"）；重复进入同对象聚焦已有页签 |
| T007-V04b | 裸 query 兼容 | ✅ `resolveObjectKey('?TASK-B')='TASK-B'`（页面内模块级验证），规范页签即由裸形式首次载入创建；注：测试用 IAB 会对裸 query 追加 `=`（`?TASK-B=`），该退化形式按设计落稳定错误页签，真实浏览器无此重写 |
| T007-V05a | op 无参登录（默认入口） | ✅ 落 `/vehicle-deploy/vehicle-group`（op 唯一已实现有权页；auth:user:view 不构成入口——rootOnly） |
| T007-V05b | op 菜单过滤 | ✅ Dock 仅剩：调度监控（含"下一轮实现"徽标）+ 车辆管理；任务管理/地图/三方/工艺/系统/数据统计整组隐藏；权限管理组因 rootOnly+无 role 码整体隐藏 |
| T007-V05c | op 直访 `/order-record`（无 order-record:view） | ✅ 重定向 `/no-permission`；mock 日志无业务请求 |
| T007-V05d | op 直访 `/access-management/user-management`（持 auth:user:view 非 root） | ✅ 拦截至 `/no-permission`（rootOnly 源特权规则） |
| T007-V05e | op 直访 `/over-look`（持 overview:view） | ✅ 统一暂缓提示（标题"调度监控"+"该模块将在下一轮实现"+返回/退出按钮）；全屏无外壳；原 Overlook 业务模块不加载 |
| T007-V05f | 暂缓提示"返回本轮可用页面" | ✅ 回 `/vehicle-deploy/vehicle-group` |
| T007-V06 | 跨布局实例保留：车辆分组 DOM 打标记 → 进暂缓视图 → history.back | ✅ 标记保留＝React 实例未重建、缓存宿主未销毁 |
| T007-V06b | 暂缓视图期间外壳与页签状态 | ✅ `shellBare` 类生效；header `display:none`（Dock 经父级插槽隐藏）；车辆分组页 Activity 层 `display:none`＝挂起（DOM/状态保留、Effects 卸载查询暂停，V09 机制证据） |
| T007-V07 | op 访问未匹配路径 `/definitely-not-a-route` | ✅ 会话内 404（非暂缓路由不落入暂缓提示）；"返回工作台"→ 车辆分组 |
| T007-P41 | P41 双文案分流 | ✅ 仅暂缓权限 → `/no-permission?scope=deferred-only` 显示"暂无本轮可用业务页面，相关模块将在下一轮实现"；完全无权 → 显示无权限文案；两分支均提供"退出并重新登录"（页面内 resolveAccessibleEntry 双分支验证 + UI 渲染验证） |

## 已知边界与遗留

- **未在本轮操作验证**：全屏监控页 `/analyze-visual/server-resource-monitor` 的实际进入与菜单别名 replace 语义（其 overlay/guard 机制与暂缓视图同源并已被 V05c—V06 覆盖；P40 真实内容与 A16 全屏返回矩阵归 T089/T093/T106 复验）。
- 编辑中曾出现"rootOnly 过滤未生效"与"对象页签双页签"伪象，均为浏览器缓存 Vite 旧转换模块 / IAB URL 重写所致（重启 dev server 后复测通过），非应用缺陷。
- 权限树注入（`setPermissionMenuTree`）按模块初始化执行；祖先填充对 op 的菜单码集合已验证（`auth:manage/auth:user:view/overview:view/vehicle-group:view/vehicle:manage`）。
- en-US 新词条已加（common/menu 命名空间），五语补齐归 T016（沿用 T005 先例）。
