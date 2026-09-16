# T018 验证证据 — 软件授权入口与许可证信息（2026-09-17）

- **性质**：真实旧后端读写验证 + 浏览器手动场景（非隔离注入；除 V08/V09 未执行项外，全部对真实后端 `http://10.11.2.67:8888` 发起）。
- **环境**：Chrome（IAB 受控实例，1440×900），Vite dev `http://localhost:5173`，代理 `APEX_DEV_LEGACY_TARGET=http://10.11.2.67:8888` 内联注入（发现与补正见下）；账号 root/root（登录协议 MD5）；语言环境 en-US→zh-CN→ja-JP；主题 light/dark 均覆盖。
- **版本绑定**：目标仓库工作区差异（HEAD `ea2b3e1` + T018 未提交改动，提交后以 T018 提交为准）；`pnpm typecheck` 通过（exit 0）。
- **请求脱敏说明**：登录 token、激活码密文、硬件指纹均为后端真实返回，此处只记录行为与码值（1001020），不落全文。

## 场景与结果

| 场景 | 操作与请求 | 预期（源行为/合同） | 结果 |
| --- | --- | --- | --- |
| V01 P29 真实许可证读取 | 登录后进入 `/system-involve/software-information`，`getLicense`（真实 POST） | 信封成功 → 横幅/统计/明细完整渲染 | ✅ 状态「Activated/已激活/有効」、AGV 200 台、剩余 470 天（与过期日 2027-12-31 一致）、激活/过期日期、激活码密文、硬件信息全部为真实数据；en→zh-CN→ja-JP 切换即时生效（懒加载命名空间） |
| V02 P29 激活真实写入失败 | 激活弹窗提交无效激活码，`softwareActivation`（真实 POST，经 T011 写入任务） | 信封明确拒绝 → `failed` → 保留后端原文提示，不刷新不导航 | ✅ 后端返回信封 `1001020 激活失败` → 写入任务记 `failed`（BIZ_FAILURE 可判读）→ toast 展示后端原文（ja 环境显示对应词条）、弹窗保留、许可证未假刷新 |
| V03 P02 直访与硬件码读取 | 会话内直访 `/authorize-ingress`（未挂起），`getHardwareInfo`（真实 GET） | 覆盖层视图正常渲染，硬件码展示，空码时激活禁用 | ✅ 覆盖层无外壳；硬件码与 getLicense.hardwareInfo 一致；textarea 空时「激活授权」disabled |
| V04 P02 复制接线 | 点击「复制」硬件码 | 成功提示（源行为） | ✅ toast「コピーしました」；剪贴板实际写入经 navigator.clipboard（安全上下文），execCommand 降级路径为源实现原样迁移、内网 http 场景归实际部署验证 |
| V05 P02 激活真实写入失败 | 授权页提交无效激活码（真实 POST，写入任务 tabKey=null） | 明确拒绝 → 提示后端原文，留在本页 | ✅ toast「Activation failed」（后端原文），URL 保持 `/authorize-ingress`，提交态复位，无假成功 |
| V06 P02 返回登录（G01 统一出口） | 「返回登录」→ 二次确认弹窗 → 取消 / 确认 | 取消留在本页；确认走真实 logout → 登录页 | ✅ 取消：URL 不变；确认：真实 logout 请求成功 → 收敛回 `/login`；重登录后按回跳地址回到 `/authorize-ingress` |
| V07 主题表现 | P29 切 dark（data-theme=dark）；P02 于 dark 下检查 | P29 跟随双主题（--app-* 变量）；P02 自包含暗色不随主题 | ✅ P29 横幅渐变取 `--app-blue/--app-blue-2`，暗色下正常；P02 基底恒为 `#040a18`、面板描边 `rgba(64,140,255,.22)` 与源一致 |
| V08 激活成功 → 恢复全链 | 需有效激活码使后端真实激活，再 `resumeAfterSoftwareAuthorizationActivated()` → `resumed` → 导航首权页 | 未执行 | ◌ 无有效激活码且真实 detail 恒 500（重查只能落 `unreachable`），双条件缺失；`resumed` 分支逻辑走查 + T015 已验证恢复接口本体；**定向补验归 T090** |
| V09 自然 1001000 挂起进入 P02 | 需真实未激活系统产生 1001000 | 未执行 | ◌ 真实后端已激活且对无效 token 恒 500（T015 已记录）；挂起路由强制 T015 已在事件层验证，本页渲染已由 V03 直访佐证；自然挂起分流**归 T090** |

## 环境发现（移交 environment.md 补正）

`vite.config.ts` 以 `process.env.APEX_DEV_LEGACY_TARGET` 注册旧协议代理；实测 `.env.local` 在配置求值期**不生效**（配置了 .env.local 后启动，`/fms` 仍 404），须以内联环境变量方式启动（`APEX_DEV_LEGACY_TARGET=http://10.11.2.67:8888 pnpm dev`）。T090 及后续真实联调按此执行。

## 证据边界

- 截图：IAB 截图能力在本环境不可用（capture 失败），视觉验证以 DOM 快照 + 计算样式（背景/描边/渐变、data-theme）替代；五语×双主题全矩阵归 T098/T105 分域复核。
- 复制场景未断言系统剪贴板实际内容（IAB 权限限制），以成功提示 + 与源一致的工具实现为证。
