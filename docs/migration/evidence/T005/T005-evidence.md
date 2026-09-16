# T005 验证证据 — 接通旧身份恢复与唯一权限模型

- **性质**：全部为【隔离验证】。本地 mock 旧后端（临时目录 `%TEMP%\t005-mock\mock.mjs`，端口 9388，不入仓库）+ dev 代理（`APEX_DEV_LEGACY_TARGET=http://127.0.0.1:9388`，端口 5211）+ 真实浏览器（Chrome 内核，1280×720，zh-CN）加载目标应用后执行。
- **服务端视角**：mock 逐请求日志已存档脱敏为同目录 `mock-server-log.jsonl`（16 条，含 Authorization 头与请求体）。
- **方法**：页面内原生 module script 动态 import 真实模块（`/src/services/auth/auth.service.ts` 等）驱动服务层场景；登录/导航/头像菜单走真实 UI 操作。
- **版本**：目标仓库基线 `cb9f127` + 本卡未提交差异（提交后以该提交为准）；`pnpm typecheck` 通过（exit 0）。

## 场景结果（`<TaskID>-Vxx`）

| 场景 | 内容 | 结果 | 关键证据 |
| --- | --- | --- | --- |
| T005-V01 | 登录成功：MD5 密码协议、token 存储、快照与纪元 | 通过 | mock 日志：`password=5d7845ac…`（=mock 端 `md5("secret123")`，证明 spark-md5 输出与后端协议逐字节兼容）；响应 data → 快照 `{username:'normal', activated:true, tree 2 顶级, flat 4 码}`；存储 token=`Bearer token-normal`；epoch 推进 |
| T005-V02 | 登录业务失败（错误密码 → code 500） | 通过 | mock 日志 password=`2bda2998…` → 响应 code 500；服务层抛错，**不写存储、不置身份**（storage=null、identity 不变） |
| T005-V03 | 未激活账号（activated===false） | 通过 | 快照 `activated:false`、token=`Bearer token-inactive`；LoginForm 已接分流（navigate `/authorize-ingress`），真实授权页内容归 T018 |
| T005-V04 | 刷新恢复：detail 重新核对并替换缓存快照 | 通过 | 预置陈旧缓存（空树 + `stale-code`）→ restoreSession 以存储 token 调 GET detail（mock 日志含 Authorization）→ 快照被服务器真值替换（新增 `vehicle-type:view` 等 6 码）；核查结果回写存储 |
| T005-V05 | 损坏存储解析兜底 | 通过 | `accessInfo='{broken json'` → restoreSession 结论=无会话，坏存储自愈清除（accessInfo=null） |
| T005-V06 | 恢复遇 1000000（认证失效） | 通过 | token=`token-expired` → mock 返回 code 1000000 → 存储与身份立即清空、epoch+1（D26），事件由 T003 通道发出 |
| T005-V07 | 恢复遇 1001000（软件未授权） | 通过 | 身份保留（inactive-user），`authorizationRequired=true`；路由编排归 T007/T018 |
| T005-V08 | 切账号迟到响应隔离（会话纪元） | 通过 | 旧纪元 `identityVerified` 不覆盖新会话（identity 保持 userB）；`isIdentityEpochCurrent(旧)=false`、`(当前)=true` |
| T005-V09 | 源特权分支与双源判定 | 通过 | `isRootUser(root/administrator)=true`、`user1=false`；root 空权限树菜单判定短路放行；普通账号有叶子码通过、无关联码拒绝；按钮码仅认 flatPermissions（按钮码出现在 MENU 树中不获得按钮权，两源不互相兜底） |
| T005-V10 | 登出失败/成功 | 通过 | 失败样本（mock code 500）：抛错且**保留存储与会话**（源行为）；成功：存储清除、后续请求 Authorization 头消失（mock 日志 auth=""） |
| T005-V11 | 祖先填充注入点 | 通过 | 注入点为空=恒等；`setPermissionMenuTree(全量树)` 后 `vehicle-group:view` 补出祖先 `vehicle:manage`（T007 绑定后生效） |
| T005-V12 | 真实 UI 端到端登录 | 通过 | 登录表单填 normal/secret123 → 登录成功 → 跳转 `/over-look`（FALLBACK_PATH）→ 头像 title/菜单显示 `normal · 普通账号` |

## 与退出条件的对应与保留说明

- 刷新恢复 / 损坏存储 / 切账号迟到响应 / 源特权分支：V04/V05/V08/V09 已隔离验证。
- 完整授权与可见投影往返：本卡验证到"快照含原样 permissionsTree + flatPermissions"；角色编辑页的读写往返属 T079。
- **发现并移交 T007**：当前模板接线下，守卫 loader 的未登录重定向分支不生效（客户端导航与硬刷新均未被拦截，identity 状态本身正确）。直通登录时代 user 恒持久化，该分支从未被真实行使；路由鉴权接线本就是 T007（"沿现有路由单源补鉴权"）的交付，此处记录供其修复并验证。
- 真实环境待验（归 T090 条件）：detail 响应真实字段形状（见合同"待核验"）、真实 token 形态、1000000/1001000 文案与码。
