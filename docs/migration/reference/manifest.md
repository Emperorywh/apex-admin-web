# 参考资料 Manifest（T001 交付）

> 只读快照的相对路径索引。所有路径相对本仓库根（`C:\code\apex-admin-web` 内任意工作副本），
> **不依赖原机器绝对路径**。快照为只读（文件已去写权限），后续任务只读引用，不在快照内修改。
> 生成时间：2026-09-16（T001 认领轮次）。

## 1. 快照位置与源版本

| 快照（相对仓库根） | 源仓库 | 源 HEAD | 文件数 | 体积 | 排除项 |
| --- | --- | --- | --- | --- | --- |
| `docs/migration/reference/snapshot/dd/` | C:\code\dd | `e570b8df24ed7493bb2369b052e19759eafed211`（工作区干净） | 658 | 7.2MB | `.git`、`node_modules`、`dist`、`.claude`、`.vscode`、`.husky`、`.umi*`、`.cache`、`.npmrc`（防凭据）、`*.local`、`*.log` |
| `docs/migration/reference/snapshot/apex-table-react/` | C:\yangwenhua\ApexTableReact | `ae34e0a28493db57f5593f00b4c9abe4a9f3c94e`（工作区干净） | 93 | 3.4MB | `.git`、`node_modules`、`dist`、`docs-dist`、`.artifacts`、`.dumi`、`.cache`、`*.local`、`*.log` |

两仓快照时工作区均干净，快照内容 = 提交内容，无未提交差异混入。

## 2. 旧项目（snapshot/dd）关键定位

| 资料 | 快照内路径 | 说明 |
| --- | --- | --- |
| Umi 配置（路由、代理） | `snapshot/dd/.umirc.ts` | `/fms`、`/rcsFlow` 代理（大小写以它为准）；内网 target 仅作参考，禁止作为默认连接地址 |
| 页面源根 | `snapshot/dd/src/pages/<域>/<页面>/` | 域：AccessManagement、ActionControl、AnalyzeVisual、AuthorizeIngress、DispatchHub、Login、MapThrough、MissionCluster、ObstacleAvoidance、OrderInfo、OrderRecord、Overlook、RecordPlayback、StrategyManage、SystemInvolve、TriDevice、TriResource、TriTraffic、UnAccess、VehicleDeploy、VehicleInfo |
| API 集中定义 | `snapshot/dd/src/api/api.ts` | 旧接口路径常量（含 `/fms/v1/...` 全量前缀）；配套 `request.ts`、`httpShared.ts`、`uploadWithProgress.ts` |
| 权限码 | `snapshot/dd/permission.json` | 菜单/按钮权限码参考 |
| 五语词条 | `snapshot/dd/src/locales/` | 领域词条迁移来源 |
| mock | `snapshot/dd/mock/` | 旧本地 mock 定义 |
| 契约/规范 | `snapshot/dd/SPEC_i18n.md`、`snapshot/dd/CLAUDE.md` | 旧仓自己的规范，参考用 |
| 依赖锁定 | `snapshot/dd/package-lock.json` | 旧仓冻结安装参考（npm） |

## 3. 表格库（snapshot/apex-table-react）关键定位

| 资料 | 快照内路径 | 说明 |
| --- | --- | --- |
| 组件源码 | `snapshot/apex-table-react/src/ApexTable/index.tsx`、`src/internal/` | 主组件与内部实现；`internal/expansion.ts` 为行展开（基线后 `972604f` 新增） |
| 公开类型 | `snapshot/apex-table-react/src/types.ts` | 消费端 props 合同 |
| 无样式入口 | `snapshot/apex-table-react/src/unstyled.ts`（导出位置见 package.json exports） | `./unstyled` 子路径 |
| 样式 | `snapshot/apex-table-react/src/styles/structure.css`、`theme.css` | 结构/主题两层 |
| 列偏好适配器 | `snapshot/apex-table-react/src/adapters/` | `./adapters/local-column-preferences` 子路径 |
| 使用文档 | `snapshot/apex-table-react/docs/` | dumi 演示与能力说明 |
| 编辑测试 | `snapshot/apex-table-react/tests/editing.test.mjs` | 受控编辑行为参考（T024） |
| 构建脚本 | `snapshot/apex-table-react/scripts/`、`.fatherrc.ts` | 本地构建参考；**库改动须在原仓库可写副本进行，不在快照内改** |
| 依赖锁定 | `snapshot/apex-table-react/pnpm-lock.yaml` | 库仓冻结安装参考 |

## 4. 发布物与版本依据

- **apex-table-react npm 已发布版本：`0.1.0`、`0.1.0-rc.0`**（2026-09-16 registry 核实）。`0.1.0` 对应源 HEAD `ae34e0a`（版本更新提交）。本轮联调按 SPEC §5.2 可用明确 npm 版本；本地构建包仅临时，T107 切正式。
- 旧项目不发布 npm，以快照 HEAD 为冻结依据。
- antd：实施锁定 `6.6.4`（精确版本入 package.json + pnpm-lock）。

## 5. 快照使用规则

1. 快照只读：一切修改回到原仓库（C:\code\dd、C:\yangwenhua\ApexTableReact）进行；表格库改动后需用户重新发布（TASKS T021/T107）。
2. 页面任务冻结动作时，源文件引用写**快照相对路径 + 源 HEAD**，例：`docs/migration/reference/snapshot/dd/src/pages/OrderRecord/... @ e570b8df`。
3. 原仓库后续若再变动，以 handoff 记录新 HEAD 并按需刷新快照，不静默覆盖。
