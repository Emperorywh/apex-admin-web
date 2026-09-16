# 路由外公共动作记录（G01—G04，T017 建立）

> 源依据：快照 `snapshot/dd/src/components/ActionsRender/index.tsx`、`components/PasswordModal/index.tsx`、`app.tsx`（getInitialState 读图）@ e570b8df。

| # | 动作 | 源行为 | 目标实现 | 验证 |
| --- | --- | --- | --- | --- |
| G01 | 主动退出 | logout API → 清 accessInfo → 回登录页；失败提示且保留会话 | Header 头像菜单 → `useProtectedLogout`：confirmSessionExit（T013）→ 声明式二次确认 → logout → sessionExpired 收敛（T015 编排接管清理） | V05：取消留原页 ✅；确认发 logout 请求并回登录页 ✅ |
| G02 | 本人改密 | 用户菜单「修改密码」→ PasswordModal：新密码须含字母+数字（4-16），两次一致；MD5 上送 updateUserPassword；成功即退出回登录页 | `PasswordModal`（features/auth）→ `updateUserPassword`（system/user 服务域，本卡唯一旧协议方法）；成功 → message + 复用 G01 受保护退出 | V04：校验拒绝（不一致/纯字母）✅；真实写入 Root1234 → 新密码登录 ✅ → 已恢复 root/root（同协议 code 200）✅ |
| G03 | 语言切换（外壳） | 顶栏 Dropdown（源仅 zh/en） | `LanguageMenu` 共享组件（Header + 登录页），五语，`localeChanged` 统一时序 | T016 V02 ✅ + 本卡登录页 V06 ✅ |
| G04 | 外壳图片读取 | getInitialState 并行读 headerLogo/favicon → Object URL/favicon link；失败回退默认 | `system-setting.service.fetchSystemImage` + `useSystemImage`（Header 品牌图 / SystemFavicon / 登录页背景）；按位置失效通知 `notifySystemImagesReplaced`（T074 消费） | V01/G04：headerLogo 855KB 应用 ✅、favicon 404 回退 ✅；合同见 `contracts/system-image.md` |

## 主题切换（源 ActionsRender 第三项）

源顶栏含明/暗主题切换（localStorage + setAntdConfig + 整页刷新）。目标为 settingsSlice 三态主题（light/dark/system，无刷新切换，T016 合同 §5），能力等价且强于源，本卡未改动，记录为有意差异。

## 已验证限制

- 真实过期会话（detail/事件层 1000000）不可构造：过期提示以隔离标记方式验证登录页半场，auth.service 标记点为静态代码核对（5 处失效收敛统一经过 `dispatchSessionExpired`）；真实链路归 T090。
- 验证环境 rAF 节流（IAB 后台标签）导致弹窗进出场动画冻结：退出确认的「取消/确认」逻辑以网络请求与路由结果佐证；动画完成度归 T098 真实浏览器复核。
