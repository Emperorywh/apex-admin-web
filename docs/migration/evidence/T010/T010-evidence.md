# T010 隔离验证证据

- 目标仓库：HEAD `4e5f1a3` + 第五轮未提交差异（V01/V02/V03a/V05/V06）；第六轮补验时实现未改动，基线为 HEAD `dd75254`（含第五轮提交）。
- 环境：`node docs/migration/evidence/T010/mock-query-server.mjs`（9389）+ `APEX_DEV_LEGACY_TARGET=http://127.0.0.1:9389 APEX_DEV_PROXY_TARGET=http://127.0.0.1:9389 pnpm dev --port 5217`；Chrome 内嵌浏览器 1280×720；账号 root/root；系统时区 UTC+8（日志为 UTC）。
- 临时探针页：`probe/QueryProbe.tsx`（验证时以 `/query-probe` 路由挂载，**已从 src 移除**；第六轮版本：实例 A 轮询、实例 B 不轮询，使恢复/中止证据无歧义）。原始请求日志：`mock-query-server-log.jsonl`（第六轮全程 97 条，含下述场景时间线）。

## 场景结果（全部为【隔离验证】，非真实验收）

| 场景 | 结论 | 证据要点 |
| --- | --- | --- |
| V01 慢请求竞态 | ✅ 通过 | A 实例先发 `tag=AB&delay=3000`（12:27:28.739 起在途），150ms 后切条件 `tag=CD&delay=0`（12:27:29.818 落地）；AB 服务端 3 秒后返回，页面 `data.tag` 保持 CD、servedAt 为 CD 时刻——旧条件响应未覆盖新条件（代际守卫 + 条件切换中止双保险） |
| V02 连续失败 | ✅ 通过 | 注入 fail=1 后按轮询继续失败两次（12:30:39.550、12:30:40.815），`failureCount=2`、`error` 可见、`data` 保留旧值（降级展示）；恢复后一次成功（42.177）`failureCount` 清零、error 清空；`issued` 计数与轮询次数一一对应，无并发堆叠、无 toast（弹窗归错误事件层） |
| V03a 隐藏暂停 | ✅ 通过 | 经“调度监控”（暂缓 overlay，hideInTabs）切走后探针页签 Activity hidden——最后一条请求 12:30:43.804，此后 3.7 秒以上零请求（原 2 秒节奏），返回 /order-record 期间探针页签保持 hidden 也持续零请求 |
| V03b 恢复立即请求 | ✅ 通过（第六轮） | 页面脚本点击主导航“任务管理”切走（13:14:25.061Z），隐藏 84.6 秒期间 `/dev/log` 零 dev-query（最后一条 13:14:24.811）；点击页签栏“查询探针”页签切回（13:15:49.701Z），服务端 348/349ms 内同时收到 A0（13:15:50.049）与 B0（13:15:50.050）恢复请求；不轮询实例 B 计数恰 +1（2→3），A 轮询此后按单链接续（50.049→51.801→53.815，遮挡钳制 2.0s 节奏） |
| V04 销毁中止 | ✅ 通过（第六轮） | 可见态把实例 A delay 改 5000（13:16:55.676Z，计数 102→103 在途），535ms 后点击页签栏关闭按钮（13:16:56.211Z）；服务端该请求条目 `13:16:55.679 delay=5000 ms=5014 aborted=True`——客户端断开被服务端确认。关闭后页签从页签栏移除、探针 DOM 卸载 |
| document 隐藏分支 | ✅ 通过（第六轮） | 经宿主窗口最小化产生真实 visibilitychange：①隐藏生效——页面 `document.hidden=true`（13:21:30 读数）；②在途中止——9 秒慢请求 13:24:52.500 在途、最小化发生于 13:24:54.591（在途 2.1s），服务端 `13:24:52.500 delay=9000 ms=9011 aborted=True`；③隐藏期间零请求（13:24:52.5 后无任何新条目，轮询撤销）；④恢复——窗口还原于 13:25:57.870，服务端 13:25:57.879/57.880 即收到 B0 与 A0（条件保留重发）请求，9—10ms 内，两实例计数各 +1 |
| V01 附加：条件切换中止的服务端确认 | ✅ 顺带证实（第六轮） | 13:24:52.49 条件由 delay=8000 改 9000 时，上一代在途轮询请求（13:24:51.812 起）被代际中止，服务端 `13:24:51.812 delay=8000 ms=8007 aborted=True`——V01 的“条件切换中止在途”首次有服务端中止标记 |
| V05 无重复链 | ✅ 通过 | 全程日志中每实例每周期恰好 1 条请求（A/B 两实例各自独立、单实例无并发堆叠）；StrictMode 双挂载仅首帧 2 次（ issued=2），其后恒定单链 |
| V06 轮询不重置条件 | ✅ 通过 | 轮询请求 URL 参数恒为发起时条件（tag=CD 连续多周期不变），轮询只替换 data，不触碰消费方 query 状态 |

## 已知环境因素（非代码缺陷，如实记录）

1. **轮询周期实测约 2.0 秒（配置 1 秒）**：内嵌浏览器面板被遮挡时 Chromium 将隐藏渲染进程的定时器钳制到整秒网格，`落定+1000ms` 的重排被对齐后呈 2.000s 周期；期间 `document.visibilityState` 仍为 visible（轮询未暂停，可证钳制而非暂停）。前台真实页面的预期周期为“落定+1s”，待 T090 真实环境复核。
2. V01 轮次中 `aborted` 标记曾失真（mock 在响应前判定 `req.destroyed`），已改为监听请求 `aborted` 事件并以当前 mock 代码为准；早期日志不作为中止证据。第六轮再以 `res.destroyed` 兜底（socket 断开但事件时序差异时不漏记），第六轮日志为最终口径。
3. **document 隐藏分支的触发方式**：内嵌浏览器面板隐藏/遮挡均不触发 `visibilitychange`（`visibilityState` 恒为 visible），故第六轮经宿主窗口真实最小化（Win32 `ShowWindow(SW_MINIMIZE)`）取证——渲染进程收到真实 visibilitychange，非合成事件；页面内 `document.hidden=true` 已核实。Playwright 定位器点击在遮挡面板超时，页签切换/关闭均以页面脚本驱动（`.click()` 触发真实 React 事件与路由跳转），请求时间线一律以 mock 服务端日志为准。

## 复现方式

```bash
node docs/migration/evidence/T010/mock-query-server.mjs            # 9389
APEX_DEV_LEGACY_TARGET=http://127.0.0.1:9389 APEX_DEV_PROXY_TARGET=http://127.0.0.1:9389 \
  pnpm dev --port 5217
# 登录 root/root → /query-probe（挂回探针路由后）；控制桩：
# curl -X POST http://127.0.0.1:9389/dev/control -d '{"usersDelayMs":3000,"usersFail":false}'
# curl http://127.0.0.1:9389/dev/log?n=40
```

用户列表页（真实消费方抽查）：`/api/v1/users` 桩把查询串回显进 username，翻页/筛选后列表显示最新条件回显，慢响应（`usersDelayMs`）下切条件同样不回退旧条件。
