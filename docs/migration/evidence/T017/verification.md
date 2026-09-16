# T017 隔离验证证据（2026-09-17）

- **目标版本**：apple-admin 工作区（基于 47adfa5 + 本卡未提交差异）
- **环境**：vite dev @ localhost:5199，`APEX_DEV_LEGACY_TARGET=http://10.11.2.67:8888`（default_OpenAPI.json server）；Chrome（IAB），1280×720，时区 Asia/Shanghai，语言 zh-CN 起始
- **账号**：root/root（用户提供的测试账号；改密验证后已恢复原密码，恢复请求 code 200）
- **检查口径**：`pnpm typecheck` 通过（两次：实现后、修复后）；无自动化测试；执行口径与 SPEC §13.1 差异按 TASKS §2 如实标注

## 场景结果

| 场景 | 操作与观察 | 结果 |
| --- | --- | --- |
| V01 登录前后读图 | 打开 /login：loginBackground 请求返回 401,348B 真实图片并作为背景应用（截图 login-bg.png）；favicon 请求 404 → 保持 /favicon.ico 默认；页面无异常 | ✅ |
| V02 登录分流/首权跳转 | root/root 登录 → POST authorize/login 200 → navigate /order-record（首个有权页，跳过暂缓模块）；brand 图请求 headerLogo 855,956B 应用 | ✅ |
| V03 过期提示（隔离） | sessionStorage `apex-admin:session-expired=1` → 刷新登录页 → notification「登录过期/登录已过期，请重新登录」出现且标记即读即清；真实 1000000 后端不可构造（T015 已记录），auth.service 5 处失效收敛统一标记为代码核对 | ✅（隔离）/ 真实链路归 T090 |
| V04 本人改密闭环 | 弹窗标题「修改密码 - root」；两次不一致→「两次输入的密码不一致」✅；纯字母 root→「密码必须包含字母和数字，长度4-16位」✅（源规则）；Root1234 提交→updateUserPassword 写入成功→受保护退出→Root1234 登录成功→同协议恢复 root（code 200）→root 登录成功 | ✅ |
| V05 受保护退出 | 头像菜单：root/特权账号/修改密码/退出登录；退出登录→（无草稿时 confirmSessionExit 直接放行）→二次确认；取消→留在 /order-record ✅；确认→POST authorize/logout→sessionExpired→回 /login?redirect=%2Forder-record ✅ | ✅ |
| V06 五语 | 登录页语言菜单五语（简体中文/繁體中文/English/日本語/한국어）；切 en-US：Dispatch System/Username/Password/Sign in 全翻译，html lang=en-US；切回 zh-CN 恢复 | ✅ |
| V07 主题弹窗 | 未单独截图：PasswordModal/确认弹窗与既有页面同受 ConfigProvider 主题算法管束，机制证据复用 T016 V04（深色弹窗）；T098 分域复核时补真实浏览器截图 | ◐ 复用 T016 |

## 本轮发现并修复

1. **命令式 modal.confirm 僵尸弹窗**（正常修复，随本卡）：Header 原退出确认使用 `App.useApp().modal.confirm`，验证中出现多个确认弹窗无法销毁——与 SessionHost 注释记录的 T013 教训一致（容量确认已因此改声明式）。修复：新增 `logoutConfirmBus` + `LogoutConfirmHost`（声明式、常驻挂载切换 open），`useProtectedLogout` 统一走该宿主；修复后取消/确认逻辑均正确（以网络请求+路由佐证）。
2. 修复过程中第一版 `useSyncExternalStore` getSnapshot 返回新对象导致 "Maximum update depth exceeded"，已修复（快照对象身份稳定）。

## 环境限制

- IAB 标签 rAF 节流（后台标签 requestAnimationFrame 不触发）：弹窗进出场动画停留在相位上不消失；逻辑行为不受影响。动画完成度与 V07 截图归 T098 真实浏览器复核。
- 真实未激活账号（activated=false 分流 A3）、真实过期会话（A8 全链）：后端不可构造，归 T090 定向补验。
