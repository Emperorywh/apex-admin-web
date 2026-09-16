# T010 隔离验证证据

- 目标仓库：HEAD `4e5f1a3` + 本卡未提交差异（新增 `src/hooks/page-query/`、5 个消费方迁移）。
- 环境：`node docs/migration/evidence/T010/mock-query-server.mjs`（9389）+ `APEX_DEV_LEGACY_TARGET=http://127.0.0.1:9389 APEX_DEV_PROXY_TARGET=http://127.0.0.1:9389 pnpm dev --port 5217`；Chrome 内嵌浏览器 1280×720；账号 root/root；系统时区 UTC+8（页面显示 20:26，日志为 UTC）。
- 临时探针页：`probe/QueryProbe.tsx`（验证时以 `/query-probe` 路由挂载，**已从 src 移除**；复现时按该文件与 `definitions.tsx` children 中注释样式的临时节点挂回）。原始请求日志：`mock-query-server-log.jsonl`。

## 场景结果（全部为【隔离验证】，非真实验收）

| 场景 | 结论 | 证据要点 |
| --- | --- | --- |
| V01 慢请求竞态 | ✅ 通过 | A 实例先发 `tag=AB&delay=3000`（12:27:28.739 起在途），150ms 后切条件 `tag=CD&delay=0`（12:27:29.818 落地）；AB 服务端 3 秒后返回，页面 `data.tag` 保持 CD、servedAt 为 CD 时刻——旧条件响应未覆盖新条件（代际守卫 + 条件切换中止双保险） |
| V02 连续失败 | ✅ 通过 | 注入 fail=1 后按轮询继续失败两次（12:30:39.550、12:30:40.815），`failureCount=2`、`error` 可见、`data` 保留旧值（降级展示）；恢复后一次成功（42.177）`failureCount` 清零、error 清空；`issued` 计数与轮询次数一一对应，无并发堆叠、无 toast（弹窗归错误事件层） |
| V03a 隐藏暂停 | ✅ 通过 | 经“调度监控”（暂缓 overlay，hideInTabs）切走后探针页签 Activity hidden——最后一条请求 12:30:43.804，此后 3.7 秒以上零请求（原 2 秒节奏），返回 /order-record 期间探针页签保持 hidden 也持续零请求 |
| V03b 恢复立即请求 | ⏳ 未取证 | overlay 返回落在 /order-record 而非探针页签；经页签栏切回探针页签的实操作场景未完成（页签栏点击在遮挡环境超时）。实现路径与 V03a 同一编排 effect（visible 变化即 issue），代码已覆盖，待下轮补操作证据 |
| V04 销毁中止 | ⏳ 未取证 | 慢请求在页签隐藏态设置（Effects 卸载，未发出——本身符合隐藏不请求语义），关闭页签时无在途可中止；需在可见态下发慢请求后关闭页签补验 `aborted=true` |
| V05 无重复链 | ✅ 通过 | 全程日志中每实例每周期恰好 1 条请求（A/B 两实例各自独立、单实例无并发堆叠）；StrictMode 双挂载仅首帧 2 次（ issued=2），其后恒定单链 |
| V06 轮询不重置条件 | ✅ 通过 | 轮询请求 URL 参数恒为发起时条件（tag=CD 连续多周期不变），轮询只替换 data，不触碰消费方 query 状态 |
| document 隐藏分支 | ⏳ 未取证 | useDocumentVisible（visibilitychange）与 V03a 走同一 visible 编排路径，未单独操纵浏览器窗口复验 |

## 已知环境因素（非代码缺陷，如实记录）

1. **轮询周期实测约 2.0 秒（配置 1 秒）**：内嵌浏览器面板被遮挡时 Chromium 将隐藏渲染进程的定时器钳制到整秒网格，`落定+1000ms` 的重排被对齐后呈 2.000s 周期；期间 `document.visibilityState` 仍为 visible（轮询未暂停，可证钳制而非暂停）。前台真实页面的预期周期为“落定+1s”，待 T090 真实环境复核。
2. V01 轮次中 `aborted` 标记曾失真（mock 在响应前判定 `req.destroyed`），已改为监听请求 `aborted` 事件并以当前 mock 代码为准；早期日志不作为中止证据。

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
