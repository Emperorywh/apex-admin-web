# T011 隔离验证证据（2026-09-16）

- 环境：mock 旧后端 `mock-task-server.mjs`（:9389，root/root）+ `pnpm dev --port 5217`（`APEX_DEV_LEGACY_TARGET/APEX_DEV_PROXY_TARGET` 指向 mock）；Chrome 内嵌浏览器 1280×720，Asia/Shanghai，zh-CN。驱动方式：页面脚本（自动化点击管线在遮挡面板超时，与 T010 一致）。
- 版本绑定：HEAD `2ed3c66` + 本卡未提交差异（含验证期间两处缺陷修复，见"发现与修复"）；探针页/临时路由为验证用临时代码，提交前移除（副本 `probe/TaskProbe.tsx`）。
- 服务端请求时间线为唯一权威依据：`mock-task-server-log-segment1.json`（第一段）+ 结束前 `/dev/log` 全量（见交接 handoff 引用的 segment2）。

## 场景与结果（全部为【隔离验证】）

| 场景 | 操作 | 预期 | 结果 |
| --- | --- | --- | --- |
| V01 切页/全屏回执不断 + 原页恢复订阅 | 提交 W1(3s)/T2(5s) 后经 Dock 进入暂缓 overlay（/over-look，外壳隐藏、页签挂起）；返回后切回探针页签 | 回执在隐藏期继续落 store；onSuccess 正常触发；回页显示最新状态 | ✅ 服务端 `t2 ms=5026 aborted=false`（14:27:12 提交，回执于 overlay 期间 22:27:17 落定并触发 onSuccess）；页面 UI 在 overlay 期间冻结（Activity 效果卸载，符合"隐藏页暂停展示"）；返回后缓存 DOM 显示 success（原页恢复订阅） |
| V02 丢回执 | W2 delay=20s（>15s JSON 超时） | 15s 超时 → unknown/receipt-lost，不重发 | ✅ 记录 `unknown, receipt-lost, 15.1s`；服务端 `dev-write tag=w2 ms=20014 aborted=true`（客户端 15s 中止），单次请求 |
| V03 停止等待 | W4(8s) 提交 1.5s 后停止等待 | → unknown/stopped-waiting；服务端观察到中止 | ✅ 记录 `unknown, stopped-waiting, 1.65s`；服务端 `tag=w4 ms=8015 aborted=true` |
| V03b 业务失败 | W3 fail=1 | → failed，保留 bizMessage | ✅ `failed`，biz="模拟业务失败" |
| V04 旧会话迟到 | W5(6s) 提交后立即切换会话（登录→epoch+1） | 记录立即清空；迟到回执被丢弃；onSuccess 不触发；无重发 | ✅ 切换后快照空；22:34:01 迟到落定→"记录已清除"（settled=null）；无 onSuccess 日志；服务端 `tag=w5 ms=6006 aborted=false` 单次送达 |
| V05 上传后处理与阶段反馈 | T1/T2（6MB，服务端延迟 0/5s，停滞阈值 1.5s） | 字节 100% 后等信封；服务端处理阶段不误判停滞；成功触发 onSuccess | ✅ T2 于 5s 成功（处理期 5s ≫ 1.5s 停滞阈值，未误判）；阶段采样捕获 `active/server-processing/percent=100`（字节 100% 时仍非 success）；onSuccess 日志在册 |
| V06a 上传取消 | T3 30MB，800ms 后取消（服务端 delay=8s） | cancelled + resultUnknown=true | ✅ `cancelled, resultUnknown=true`；服务端已收全量 31457465 字节并照常处理（`ms=8134 aborted=false`）——实证"取消≠后端未执行" |
| V06b 上传业务失败 | T5 mode=fail | failed，结果已知 | ✅ `failed`，biz="模拟上传业务失败"，resultUnknown=false |
| V06c 响应不可判读 | T6 mode=html（200 + 网关 HTML） | unknown/待确认 | ✅ `unknown, resultUnknown=true, "上传响应不可判读"` |
| V07 服务端处理超时 | T4（服务端读 1MB 后 pause，浏览器侧被视为 server-processing 且永不响应） | 60s 保护超时 → unknown（不自动重发） | ✅ 提交 22:36:10 后 60 秒落定 `unknown`（结果见 segment2 日志 `dev-upload-stallmid`，客户端中止） |
| 无自动重发/无重复链 | 以上全部场景 | 每个动作服务端恰一次请求 | ✅ segment1 日志逐条核对：w1/w2/w3/w4/w5/t2/t3/t5/t6 各 1 条 |

## 环境因素与限制

- **uploading 阶段真实停滞无法在环回构造**：Chromium 网络缓冲整体吞下 30MB 请求体（浏览器侧 onload 完成、进入 server-processing），TCP 回压停滞不可复现；停滞检测代码沿旧 `uploadWithProgress` 原样迁移（进展重置定时器/阈值中止/分阶段），真实大文件停滞归 T090/T096 复核。
- 内嵌面板遮挡环境下自动化点击管线超时，全程改页面脚本驱动（与 T010 第六轮一致）。
- V01 中 overlay 期间页面 UI 冻结属 PageCacheHost 既有语义（隐藏页效果卸载），非本层缺陷；任务数据层与 XHR 不受影响。

## 发现与修复（实现期内修复并复验）

1. **在途写入状态停留 `queued`**：执行器调用后未置 `running`，UI 与停止等待的 queued/running 区分失效 → `writeTasks.ts` 在调用执行器后置 `running`（复验 V03 通过）。
2. **`toApiError` 降级裸 ApiError 对象**：legacyCall 抛出的规范化 ApiError（非 ApiRequestError 实例）被映射为 CLIENT.UNKNOWN，导致取消误判为 receipt-lost、业务失败无法判 failed → `request.ts` 增加 isApiError 形状识别原样透传（复验 V03/V03b 通过；该修复对 T003 JSON 通道无行为变化，其内部本就先做同形检查）。

## 服务端日志关键行（segment1，节选）

```
14:25:29.968 dev-write  tag=w1  ms=3017  aborted=false          # V01 成功回执
14:27:12.755 dev-upload tag=t2  ms=5026  aborted=false bytes=6291641   # V01/V05 overlay 期间落定
14:27:12.851 dev-write  tag=w2  ms=20014 aborted=true          # V02 客户端 15s 超时中止
14:33:19.837 dev-write  tag=w4  ms=8015  aborted=true          # V03 停止等待中止
14:33:22.724 dev-write  tag=w3  ms=503   aborted=false         # V03b 业务失败
14:33:55.640 dev-write  tag=w5  ms=6006  aborted=false         # V04 迟到回执单次送达
14:34:27.544 dev-upload tag=t3  ms=8134  aborted=false bytes=31457465  # V06a 取消时服务端已收全量并处理
14:34:30.280 dev-upload tag=t5  ms=328   aborted=false         # V06b 业务拒绝
14:34:30.294 dev-upload tag=t6  ms=320   aborted=false         # V06c HTML 不可判读
```
