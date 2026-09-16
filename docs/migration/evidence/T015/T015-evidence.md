# T015 隔离验证证据（2026-09-17）

- **版本绑定**：目标仓库 HEAD `aef370c` + 本卡未提交差异（提交后以 T015 提交为准）；`pnpm typecheck` 通过（探针移除后复跑 exit 0）。
- **环境**：Chrome（IAB 内核），视口 1280×720，语言 zh-CN；真实旧后端 `http://10.11.2.67:8888`（root/root 登录，登录/detail 均走真实协议）；`APEX_DEV_LEGACY_TARGET=APEX_DEV_PROXY_TARGET=http://10.11.2.67:8888 pnpm dev --port 5219`。
- **验证手段**：临时探针页 `/dev/invalidation-probe`（已随本卡收口移除）。探针提供：草稿置脏/解除、可控回执写入（真实 `submitWriteTask` 状态机，回执由验证者手动放行以构造迟到回执）、1001000 注入（与事件桥同一 reducer 路径）、403/session-expired 事件注入（经 `reportLegacyRequestError` 走真实事件总线，与信封错误同路径）、收缩快照注入 + 真实 `reconcileRevokedPagesNow` 清理链、恢复接口直调（真实 detail 协议）。注入仅用于隔离验证，不属于生产兜底。

## 场景结果（全部为【隔离验证】，非真实验收）

| 场景 | 内容 | 结果 | 关键证据 |
| --- | --- | --- | --- |
| V01 | 认证失效单次收敛 | ✅ | 挂起前 epoch=0、探针写入 `running`；并发注入 3 个 session-expired 事件后：`persist:apex-admin:auth` identity=`null`、URL 弹回 `/login`（桥 `identity===null` 守卫保证只处理一次，epoch 仅 +1；坏 token 直测后端各端点均返回信封 500 而非 1000000，故走事件层注入） |
| V02 | 迟到回执隔离 | ✅ | 重登后任务列表空（纪元复位清记录）；手动放行旧会话回执：探针 `onSuccess` 断言未触发（无「断言失败」提示）、记录未复活（`isIdentityEpochCurrent` 丢弃） |
| V03 | 1001000 暂停 | ✅ | 注入后 URL 立即转 `/authorize-ingress`、业务视图隐藏（探针按钮不可见）；暂停期间点回业务页签/直访 `/order-record` 均被弹回授权页（SessionHost 效应 + 守卫双层强制）；epoch 保持 0（未复位草稿/任务/页签会话） |
| V04 | 激活恢复接口 | ✅（部分） | 挂起中直调 `resumeAfterSoftwareAuthorizationActivated()`：真实 detail 重查执行，后端返回信封 500 → 结论 `unreachable`，挂起标记保持 true（不伪造恢复）。`verified→resumed` 分支（清挂起 + 撤权收敛 + 返回 resumed）无法在本后端构造——detail 对任意 token 恒返回 `{"code":500}`，归 T090 环境核验 |
| V05a | 页面撤权 | ✅ | 注入无码收缩快照后调真实清理链：通知「权限已变更：T015 失效编排探针 已关闭。进行中的指令结果可能未知，系统不会自动重发。」（五语 key 生效，en-US 已配）；页签原子关闭（1 个）；重登复查被撤页草稿=干净、任务列表空（停等后记录已清）；直访被撤路由落 `/no-permission`；其他有权页不受影响 |
| V05b | 仅按钮撤权 | ✅ | 注入保留 `dev:probe` 菜单码、清空按钮码的快照：页面撤权 0（页面/草稿/任务全部保留），按钮码集清空（消费方经 `useAuth().hasButtonCode` 隐藏/禁用动作），epoch 不变 |
| V06 | 403→权限重查 | ◐ | 事件接线同 V01 机制（`subscribeLegacyEvents` 过滤 `request-error` status=403 → 单飞行重查），`isPermissionReconcileInProgress` 暴露给动作层；detail 成功→撤权收敛的完整链因后端 detail 恒 500 无法端到端采集，归 T090 |

## 已知限制与本轮发现

1. **真实后端 `/fms/v1/auth/authorize/detail` 对任意 token（含有效 root token）恒返回信封 `{"code":500,"message":"失败"}`**（直测证据见上）：旧前端从未消费该接口（T005 合同 §5 已有假设标注），真实形状/方法必须 T090 核验后回填。本次恢复路径实际走向「网络失败→保留缓存快照」分支。
2. **传输任务暂停/撤权行为未单独构造**：96MB 探针传输依赖上传时序，本轮未采集；暂停/撤权对传输调用与写入相同的 `cancelTransferTask` 原语（引擎语义已由 T011 隔离验证 V 系列覆盖），真实大文件复核归 T090/T096。
3. 探针在 overlay 下的草稿/任务显示读「当前 location」tabKey（显示为 null），为探针自身展示限制；期间 store 状态经 epoch 与 V05a 重登复查间接确认未丢失。
4. 事件注入（session-expired/403）与真实信封错误的差异仅在「信封来源」，事件总线、桥、编排器、清理点全部为生产路径。
