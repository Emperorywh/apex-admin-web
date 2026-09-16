# 运行环境与代理（T001 交付）

> 记录目标项目运行条件、dev 代理行为与外部依赖解除条件。真实测试环境/账号由用户另行提供（SPEC §14、T090 登记）。

## 1. 运行条件（冻结安装可复现）

| 项 | 值 | 依据 |
| --- | --- | --- |
| Node | >= 22.22.0（本机实际版本以 `node -v` 为准） | package.json engines |
| pnpm | 11.21.0（`packageManager` 字段约束；corepack 可直接启用） | package.json |
| 安装 | `pnpm install --frozen-lockfile`（CI/复现）；日常 `pnpm install` | pnpm-lock.yaml 已随 antd 6.6.4 锁定更新 |
| 类型检查 | `pnpm typecheck`（`tsc -b --noEmit`） | TASKS §2 既定口径；当前通过 |
| dev 服务器 | `pnpm dev`（默认 5173，占用时 vite 自动顺延端口，以启动日志为准） | vite 默认行为 |
| 预览 | `pnpm preview`（构建产物） | package.json scripts |

## 2. dev 代理（vite.config.ts）

| 前缀 | 目标 | 环境变量 | 未配置时行为 |
| --- | --- | --- | --- |
| `/api` | `APEX_DEV_PROXY_TARGET`，默认 `http://localhost:8000`（本地 FastAPI 后端） | `APEX_DEV_PROXY_TARGET` | 固定注册，指向默认本地后端 |
| `/fms` | 旧调度后端 | `APEX_DEV_LEGACY_TARGET` | **不注册**，请求落入 SPA 回退返回 index.html（200 text/html） |
| `/rcsFlow` | 同上（旧 .umirc.ts 中两前缀同目标；F 为大写） | `APEX_DEV_LEGACY_TARGET` | 同上 |

- 示例文件 `.env.example`；本地实际值放 `.env.local`（`*.local` 已被 .gitignore 忽略）。
- 设计约束：旧 `.umirc.ts` 遗留内网生产地址**不得**作为默认值写进任何提交；测试地址到位前旧前缀保持未注册，避免误连生产。

### 已实测行为（2026-09-16，T001 本轮）

| 场景 | 请求 | 实测结果 | 结论 |
| --- | --- | --- | --- |
| V04a 未配置旧目标 | `GET /fms/v1/test`、`GET /rcsFlow/v1/test`（默认配置 dev 实例） | 200 text/html（SPA 回退，未走代理） | 未配置不注册 ✓；注意此阶段旧前缀会被 SPA 回退吞掉，属已知过渡态，旧协议页面接入后由接口错误正常暴露 |
| V04b 配置不可达旧目标 | `APEX_DEV_LEGACY_TARGET=http://127.0.0.1:9` 后同请求 | 502 text/plain（两前缀一致） | 代理按需注册并转发 ✓ |
| V04c /api | `GET /api/v1/test`（默认目标，本机 8000 无服务） | 502 text/plain（转发尝试） | /api 固定代理 ✓（连接被拒说明请求已交给目标） |

## 3. WebSocket

旧项目存在 WS 消费：`ws://<IP>:8888/websocket/getDispatcherMonitor?accept-language=<语言>`（源 `src/socket/WebSocketProvider.tsx` @ 快照 `snapshot/dd/src/socket/WebSocketProvider.tsx`），属**调度监控（本轮暂缓模块）**。本轮 dev 代理不配 WS 升级；网关侧 WS 转发由 T106 按"有消费者才核验"处理。

## 4. 外部条件与解除方式

| 条件 | 当前状态 | 解除方式 | 影响任务 |
| --- | --- | --- | --- |
| 旧后端测试地址 + 账号 | 未提供 | 用户按 SPEC §14 提供后填 `.env.local` 的 `APEX_DEV_LEGACY_TARGET`，使用方式由 T090 登记 | T090 及所有真实写入/旧协议联调卡 |
| 表格库正式 npm 发布 | `0.1.0` 已可用；后续修复需再发布 | 用户执行 `npm publish`（本轮不授权自动发布） | T021/T022/T024 联调、T107 正式切换 |
| 网关（SPA 回退 + /fms、/rcsFlow 代理） | 未提供 | 测试网关信息由用户提供 | T106 |
| 本地 FastAPI 后端（/api） | 本机未运行（实测 502 连接拒绝） | `C:\code\apex-admin` 本地启动 | 模板既有 /api 功能联调（本轮迁移主要走旧前缀） |
