# 合同：旧身份恢复与唯一权限模型（T005 交付）

> 消费方：T007（路由鉴权/宿主）、T010（查询纪元隔离）、T011（写入任务纪元）、T015（统一失效编排）、T017（用户菜单/改密）、T079（角色授权编辑）。
> 规格依据：SPEC §6.2、§8.2、D06/D08/D24/D26。隔离验证见 `evidence/T005/`；服务实现见 `src/services/auth/auth.service.ts`。

## 1. 模块与职责

| 文件 | 职责 |
| --- | --- |
| `src/services/auth/auth.service.ts` | 唯一身份协议接入：`login/logout/restoreSession/initIdentityEventBridge` + 纪元 API（`getIdentityEpoch/isIdentityEpochCurrent`） |
| `src/services/auth/identity.storage.ts` | 本地存储唯一出入口（键 `accessInfo`，形状=源系统；坏 JSON 自愈清除）；`persistIdentity` 同步 storage+请求头 |
| `src/services/auth/permission.model.ts` | 纯函数：`isRootUser/flattenPermissionCodes/expandWithAncestors/deriveMenuCodes/deriveButtonCodes/hasMenuCode/hasButtonCode`；`setPermissionMenuTree` 注入点 |
| `src/services/auth/crypto/md5.ts` | 登录密码摘要（spark-md5，32 位小写，与旧后端协议兼容已验证） |
| `src/store/slices/authSlice.ts` | 唯一身份状态：`{ identity, epoch, restored, authorizationRequired }`；actions=`identityReady/identityVerified/restoreFinishedWithoutSession/sessionExpired/softwareAuthorizationRequired` |

**唯一性**：不并存第二套身份状态。新协议通道（`request.ts`）已移除 accessToken/refresh/401 重放，不再承载身份；`sessionExpired` 的派发方只有 `auth.service`（登出、1000000 事件桥、恢复核查失败）与 UI 主动退出（Header）。

## 2. 登录 / 登出 / 恢复

- `login({username, password})`：密码 MD5 后 POST `/fms/v1/auth/authorize/login`。成功即完成：快照落库（`identityReady`，epoch+1）+ 存储写入 + `setLegacyToken`。返回快照；调用方按 `snapshot.activated === false`（严格判定）分流授权页。**不存储密码**。
- `logout()`：POST `/fms/v1/auth/authorize/logout`；业务/网络失败**原样抛出**，调用方保留会话并提示（源行为）；成功清除存储与请求头，调用方需 `dispatch(sessionExpired())` 收敛页签/缓存并跳登录。
- `restoreSession()`：启动引导（main.tsx）在渲染前调用，顺序=持久化恢复→读存储→`setLegacyToken`→GET `/fms/v1/auth/authorize/detail` 重新核对。结论三种：
  1. 核对成功 → `identityVerified`（仅纪元匹配时生效）并回写存储；
  2. 1000000 → 立即清会话（D26）；1001000 → 身份保留 + `authorizationRequired=true`；
  3. 网络失败 → 保留缓存快照继续（对齐源行为：恢复不因后端暂时不可达强制登出），后续业务请求的失效事件再收敛。
- `initIdentityEventBridge()`：启动期注册一次。1000000 → 存在会话时清存储/请求头/身份（每次失效只处理一次）；1001000 → 置挂起标记；request-error 不进身份层。**不做路由跳转与业务清理编排**（T015 接线点：本桥 + T003 `subscribeLegacyEvents`）。

## 3. 会话纪元（迟到响应隔离）

```ts
const epoch = getIdentityEpoch()      // 请求发起前捕获
// 响应返回后：
if (!isIdentityEpochCurrent(epoch)) discard()   // 已切账号/重登/失效，必须丢弃
```

- epoch 在 `identityReady`（登录/恢复完成）与 `sessionExpired` 时递增；**不持久化**（每次启动重建，仅隔离页面生命周期内的迟到响应）。
- 消费约定：T010 查询控制器、T011 写入任务在提交结果入 store 前比对；登录/登出 UI 动作不需要手动比对（reducer 内已收敛）。

## 4. 权限模型（SPEC §8.2）

- 双源分算：菜单=permissionsTree 扁平化（仅 MENU 码）+祖先填充；按钮=flatPermissions 平铺集合。**两源不互相兜底**（已验证：MENU 树中的按钮码不产生按钮权）。
- `isRootUser`：username 为 `root` 或 `administrator` 走特权分支（源实际判定，非"仅 root"）；特权账号在 `hasMenuCode/hasButtonCode` 短路放行。ROOT_ONLY 码的路由级拦截归 T007。
- **祖先填充注入点（T007 必做）**：`setPermissionMenuTree(tree)` 需在路由定义就绪后调用（从 definitions 派生父级分组）。未注入时祖先填充为恒等（只保留用户自有码），菜单分组可见性将不完整。
- 组件入口：`useAuth()` → `{ identity, isAuthenticated, isRoot, hasMenu(code), hasButton(code) }`。

## 5. 已知限制与待核验

- **detail 响应字段为对称假设**（`username/activated/permissionsTree/permissions`）：旧前端从未消费该接口，真实形状待 T090 环境核验后回填本合同与 DTO；信封成功但字段不足以核对身份时按核对失败清会话（安全方向）。**2026-09-17 实测补充（T015）**：真实后端 detail 对任意 token 恒返回信封 `{"code":500}`，恢复/重查实际走「不可达→保留快照」分支，真实形状核验更为紧迫。
- **T015 增补**：本服务新增 `reverifyIdentity()`（会话中 detail 重查唯一入口，激活恢复与 403 权限重查共用，见 `contracts/invalidation-orchestration.md`）；同轮修复 restoreSession catch 误读 `error.api`（legacyGet 抛出的就是 ApiError 本体，此前 1000000/1001000 在恢复路径不可识别）与 store.ts migrate 每次刷新清空 identity（见 T015 handoff「正常修复」）。
- 网络失败时缓存快照放行（见第 2 节结论 3）：若 T015 需要更严格的"未核验降级"展示，可消费 `restored` + 事件自行扩展，不改变本层默认行为。
- 模板遗留：新协议业务接口（dashboard/profile/system 模板页）现无任何令牌，调用即失败；各页迁移卡接入旧协议前保持该状态，不属于身份层缺陷。
- 守卫 loader 未登录重定向分支在当前模板接线下不生效（见 evidence T005 发现项）：**T007 补鉴权时修复并验证**。
