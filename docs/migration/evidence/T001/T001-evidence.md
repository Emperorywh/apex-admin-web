# T001 证据记录

- 证据版本绑定：
  - 目标仓库：起点 HEAD `ebe6f0a5da4ca1a5f342cf6b6aab60859cff836c`（干净）；本卡未提交差异 = `package.json`（antd 锁 6.6.4）、`pnpm-lock.yaml`、`vite.config.ts`（旧前缀代理）、新增 `.env.example`、新增 `docs/migration/**`。
  - 旧项目快照：`e570b8df`（干净）；表格库快照：`ae34e0a`（干净）；npm `apex-table-react@0.1.0`。
  - 环境：Windows 10.0.26200 · Node v22.23.1 · pnpm 11.21.0 · Chrome/Git-Bash curl（代理探测）。

| 场景 | 内容 | 结果 | 备注 |
| --- | --- | --- | --- |
| T001-V01 | 目标仓库 `pnpm typecheck`：锁定前（antd ^6.6.1→6.6.1）与锁定后（6.6.4）各一次 | 两次均 exit 0、无输出 | 隔离验证（静态）；执行口径按 TASKS §2 第 5 条，未跑 lint/构建 |
| T001-V02 | 快照可定位性抽查：`snapshot/dd/src/pages/`（21 个业务域目录，含 OrderRecord、MapThrough、MissionCluster、VehicleDeploy 等复杂页）、`snapshot/dd/.umirc.ts`、`snapshot/apex-table-react/src/ApexTable/index.tsx`、`src/internal/expansion.ts` 均存在且可读；快照目录树已置只读权限 | 通过 | 相对路径见 reference/manifest.md §2/§3 |
| T001-V02b | 快照排除项核查：find 全树无 node_modules/dist/.git/.umi/.artifacts/docs-dist、无 .npmrc/.env*/\*.local | 通过 | 排除清单见 manifest §1 |
| T001-V03 | 冻结安装复现条件：Node v22.23.1（满足 >=22.22.0）、pnpm 11.21.0（= packageManager）、`pnpm install` 实际执行成功并更新 lock（antd 6.6.1→6.6.4，Done in 18.7s） | 通过 | 严格复现用 `pnpm install --frozen-lockfile`；未做全新目录冷装演练（登记为可选补验） |
| T001-V04 | dev 代理行为实测（见 environment.md §2 表） | V04a 未配置旧目标：/fms、/rcsFlow → 200 text/html（SPA 回退）；V04b 配置不可达目标：两前缀 → 502 text/plain；V04c /api（目标无服务）→ 502 | 隔离验证；探测经本会话临时 dev 实例（已清理），未触碰会话外 5173 端口的既有进程 |

未执行项：浏览器端手动功能验收（本卡无业务页面）、真实旧后端连通（地址未提供，SPEC §14）。
