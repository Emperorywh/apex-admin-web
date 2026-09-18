# 调度系统迁移 TASKS

> 制定日期：2026-09-17。当前仅完成任务拆解，所有实施任务均未开始。
> 唯一规格基线：[调度系统迁移规格说明](docs/SPEC_dispatch_migration_20260917.md)（完整第 1–18 章，含 D01–D34、A01–A24、I01–I08）。
> 本文件位于目标仓库根目录。用户描述的带反斜杠分段路径实际对应上面的文件名；不创建另一份规格。
> 本轮不实施迁移，不修改应用、依赖或后端，不自动部署，不验证现场控制命令。

## 1. 任务模型与执行边界

共 **48 项任务**：1 项基础设施 T00、42 项旧页面迁移 P01–P42、1 项模板公共能力收口 P43、3 项暂缓页说明 H01–H03、1 项统一验收 V01。每个页面任务包含该页的服务、DTO、组件、子表、弹窗、文件操作、权限、五语言和验证，不再把同一页面拆给多个 Agent 分别接接口、写 UI 和翻译。

45 个旧叶子入口 = P01–P42 的 42 个迁移/合并入口 + H01–H03 的 3 个暂缓入口。P34 同时承接目标模板首页；P31/P32 合并目标模板用户/角色实现；P43 覆盖额外的目标模板公共能力。目录、重定向、菜单别名与跨页流程由 T00 建立机制、页面任务接入、V01 核验。

- 目标仓库：`C:\code\apex-admin-web`。旧仓库：`C:\code\dd`，旧路由依据 `.umirc.ts`；逐页必须继续递归阅读实际可达组件，不能止于本任务卡。
- 新路由唯一真相源：`src/router/definitions.tsx`。保留 React 19、TypeScript 6、Vite 8、React Router、Redux Toolkit、axios、react-i18next、CSS Modules 和 MacOS 外壳。
- API 契约：`C:\yangwenhua\ApexTableReact\default_OpenAPI.json`。本轮只核对文件哈希，与规格一致：`A82E9B5F6EF5E564DEEE16E4E74713B28FCCB35CD0A651E3631CFD9D63D49C7C`；没有据此宣称真实接口可用。
- 开工重核 API 文件与哈希；规格基线为 238 个 HTTP operation、408 个 schema。文件更新时逐 operation 评估影响，不能只看 `1.0` 版本字段。
- 本清单的接口族不是可直接拼接的 endpoint，也不是逐条请求协议；每个 Agent 必须在 OpenAPI 中确认 method、完整 path、字段、权限和响应。
- 优先级：规格用户决策 > 最新 OpenAPI 和可核实真实契约 > 当前旧可达实现及相关业务规格 > 目标模板。不能迁回假登录、假数据或已明确变更的失败策略。
- 代码新增/修改须有解释行为及必要约束的**多行简体中文注释**；沿用附近风格，不主动格式化无关文件。
- 不迁入 Umi 运行时、第二套模板后端、中间适配服务器、本地表格源码依赖；不修改/发布表格库。不因 API 存在就增加旧不可达业务。
- 三个暂缓页面不加载完整业务；地图管理、只读地图和选点仍在范围内。无入口的输送线、旧设备实现、系统动作、重复权限页及历史文件/动作策略只登记，不自动迁移或删除。

## 2. 多 Agent 认领、共享文件与交接

### 2.1 独立执行流程

1. 阅读本文件的通用要求、任务卡、完整规格、当前工作区约束和前置任务交接记录；复核本任务实际来源。
2. 由统筹执行者分配任务 ID、基线提交、工作分支/工作目录和文件归属；同一任务同一时间只有一个负责人。有 Git 时优先每任务独立 worktree，分支如 `codex/migration-p07`。
3. 在自己的任务记录中登记状态、计划修改文件、消费的共享契约与接口缺口；依赖不满足时先补证据/盘点，不用 mock 继续伪装接入。
4. 在所属页面范围内完成纵向迁移和通用完成定义；跨任务调整交给对应负责人，先合并兼容契约，再继续消费者。
5. 提交交接记录及可审阅差异；统筹者串行合并，执行批次门禁后分派下一批。合并后的实际接口/路由联验完成，才更新最终验收状态。

不依赖聊天历史交接。以下文档由后续实施任务创建，本轮不声称它们已存在：

| 交付物 | 维护方式 / 必含内容 |
| --- | --- |
| `docs/migration/baseline.md` | T00：源路由、API 哈希/规模、依赖版本、现有检查故障、排除历史实现 |
| `docs/migration/contracts.md` | T00：共享 API、DTO/ID、分页、权限、实体导航、表格、草稿、轮询、传输、地图、i18n、时区契约及 owner |
| `docs/migration/tasks/<ID>.md` | 每个 Agent 独占：来源/目标、完整操作映射、权限、改动文件、契约版本、状态、缺口、五语言记录、证据、后续事项 |
| `docs/migration/operations.md` | 统筹者汇总：旧路由/组件/操作 → 新实现 → method/path/operationId（若有）→ 权限 → 状态/证据 |
| `docs/migration/gaps.md` | 统筹者汇总 G01–G16 与新增缺口，保留影响页面、证据、决定、验证日期、后续负责人 |
| `docs/migration/i18n-map.md`、`i18n-missing.md`、`terminology.md` | T00 建格式与公共内容；Agent 在自己的记录提供分片；统筹者合并旧 key 映射、缺失翻译与术语 |
| `docs/migration/acceptance.md` | V01 汇总 A/I 矩阵、跨页验证、自动检查、真实接口证据、主题/语言/终端检查及未验收事项 |

状态分开记录，避免“写完代码”等同于“真实验收通过”：

- 实施状态：`未开始 / 进行中 / 前端完成 / 受阻 / 已合并`。
- 验证状态：`未验证 / 部分通过 / 已通过 / 不适用（注明理由）`。
- 缺口状态沿用规格：`待确认 / 已确认缺失 / 已确认替代 / 已验证可用 / 本期暂缓`。
- 只有所有适用验收通过才勾选任务。允许单独交付“前端可用部分完成、指定操作待后端补齐”，但任务记录必须列出未完成项，不能把禁用操作写为已接入。
- 没有账号、后端不可用或缺少专用写操作环境时记录受影响验证；其他不依赖该条件的工作继续。下游只可在所需契约和门禁确实满足时启动。

### 2.2 修改归属与并行防冲突

| 文件/能力 | 初始 owner | 并行期规则 |
| --- | --- | --- |
| 依赖与锁文件、Vite/环境配置、全局 token、检查脚本 | T00 | 页面 Agent 不自行升级依赖或改公共构建设置；提出需求，由统筹串行集成 |
| 请求层、会话/权限、store、路由守卫/投影、页签缓存、表格公共资源（五语言 locale 包/主题映射/分页与行 ID 纯函数/统一状态块，不含表格包装组件）、传输/地图 | T00 | 契约冻结后复用；修复由原 owner 或指定接任者处理，记录影响消费者 |
| `src/router/definitions.tsx`、语言加载器/公共命名空间 | T00；之后统筹者 | T00 预留元数据和命名空间；页面 Agent 提交必要差异，统筹串行应用，保持路由单一真相源 |
| 页面入口、页面私有 features/services/types、样式及语言分片 | 对应 P/H 任务 | 任务卡目标路径为已存在入口；共用父目录不等于可以改其他页面 |
| 现有 `services/order-record` / `features/order-record` | P03 | P38 可消费；详情新增独立文件，修改列表公共导出时先交接 |
| 现有 `services/dashboard` / `features/dashboard` | P34 | 承接首页与旧实时页合并，不允许其他页面复制 mock |
| 现有 `services/system/user`、`features/system/user`、`pages/system/user` | P31 | 统一调度用户 DTO；P43 只做引用/入口收口 |
| 现有 `services/system/role`、`features/system/role`、`pages/system/role` | P32 | 与用户/权限树使用同一已确认契约 |
| `services/profile`、模板菜单服务/features/pages | P43 | 不新增无依据 CRUD；避免与 P31/P32 同时修改 |
| `TASKS.md` 与汇总台账 | 统筹者 | 页面 Agent 只更新自己的任务记录，防止多个分支改同一汇总表 |

新页面私有模块默认放在 `src/features/<任务模块名>/`、`src/services/<任务模块名>/`、`src/types/<任务模块名>/`；遵循现有结构检查，T00 可以统一确定业务域/子域结构并记录**精确文件归属**。P03/P31/P32/P34 优先沿用现有目录，不制造平行重复实现。服务沿用 `*.service.ts`、`*.service.types.ts`，使用具名函数、明确 DTO、可选 RequestOptions 和 AbortSignal。

所有跨页只读选项由 T00 登记唯一 owner 和 operation：例如地图/节点、车辆、分组、载具、动作、工艺模板、驱动、电梯、角色、品牌。查选项不必等管理页面完成；不能由每页复制一套请求。页面详细查询/写操作仍归页面任务。同一个 operation 同时用于选项与完整业务时，复用底层服务，只在上层选择/转换字段。

页面私有语言按模块分片保存于 `src/i18n/locales/<语言>/<命名空间>.ts` 或 T00 确定的等价结构；五语言目录均有明确归属。共享 `common/menu/auth/error` 由统筹者维护，不为并行方便复制相互竞争的公共译文。

### 2.3 可直接分派的任务指令

> 执行 TASKS.md 的 `<任务ID>`。先阅读通用完成定义、完整迁移规格及前置任务记录，核对旧路由可达实现和最新 OpenAPI。仅修改任务归属文件，复用公共契约；公共文件变更先登记交由统筹集成。完成该页面全部业务操作、权限、Apex 表格、五语言、错误/草稿/传输生命周期和验证证据。禁止前端 mock，不自动试发现场写命令。将结果、未验收项和下一位 Agent 所需信息写入 `docs/migration/tasks/<任务ID>.md`。新增/修改代码写多行简体中文注释，不格式化无关代码。

## 3. 分批执行与放行门禁

批次表示可调度顺序，同一批内依赖满足且文件归属不冲突的任务可以交给不同 Agent；不是要求一次启动整批。编号不是严格串行顺序。每批合并后进行受影响页面的检查和必要联验，不将日常质量问题全部留给 V01。

| 批次 | 任务 | 前置条件与退出要求 |
| --- | --- | --- |
| B0 | T00 | 单一基础设施任务；内部按里程碑顺序推进，完成公共契约、真实登录最小路径、真实只读 Apex 列表、五语言和生命周期基座 |
| B1 | P01、P41、P42、H01–H03；P01 后 P02 | T00 放行；完成登录/授权/恢复/错误落点和暂缓入口，后续页不再依赖假登录 |
| B2a | P03、P05 | P01 放行，冻结任务/车辆实体参数与导航契约；分别作为表格与控制样板 |
| B2b | P38、P39 | 分别依赖 P03、P05，完成详情、独立窗口、实体缓存隔离及列表往返 |
| B3 | P04、P06–P18、P22、P23、P25–P32 | 通过下述 B2 样板门禁；P29 另依赖 P02；共享选项不依赖相关管理页先完成 |
| B4a | P19、P24 | B2 门禁及 P11 / P23 分别完成，验证点边组合→交管、动作→分组 |
| B4b | P20 | B2 门禁及 P23、P24 完成，验证动作/分组→工艺模板 |
| B5 | P21、P43 | 分别依赖 P20，以及 P31/P32；完成主子工艺与模板公共入口收口 |
| B6 | P33、P34、P36、P37、P40 | B2 门禁通过后可与无冲突的 B3–B5 页面并行；共享公式明确文件 owner |
| B6b | P35 | P33/P37 计算与统计契约就绪，完成报表与相同口径明细 |
| B7 | V01 | 所有前端实现/已知缺口说明已合并；逐项验收，不能因排期结束判整体通过 |

**B2 样板门禁**：T00 + P01 + P03/P05/P38/P39 的必要契约与实现已合并；真实登录和真实只读列表/详情通过，Apex 分页/取消/错误、草稿、实体页签、独立窗口和五语言达到可复用标准；副作用代码完成并列明专用环境/现场待验收项。门禁只放行后续实现，不替代写操作验收、不自动勾选任务。真实只读未验证时不得宣称门禁已通过。样板页 P03/P05 勾选前须完成至少一次带真实数据的整页渲染视觉验收（1920 与 1366 宽度、双主题）；环境受阻时按缺口登记并保持不勾选，不得以 lint/typecheck/build 全绿替代。

依赖任务的“完成”用于调度时，指所消费的代码/契约已合并且适用只读与公共机制验证通过，不要求无关现场副作用先验收；依赖中的后端缺口若影响消费者，则消费者相应部分仍受阻。P03/P05 的“完整详情链路”在 B2b 补验，因此 P38/P39 依赖列表已交接的契约，不依赖列表任务先勾选，避免循环等待。

## 4. 每个页面必须满足的通用完成定义（DoD）

每张任务卡的专项验收在下列要求之上增加，不能替代它们。不适用项需写原因。

1. **可达业务完整**：递归清点旧页面、弹窗、抽屉、嵌套表、表单、控制、批量、导入导出和跨页流程。记录来源→目标→实际 operation→权限→验证状态；缺口有禁用入口和原因，不以列表能加载替代闭环。
2. **真实服务与协议**：页面不导入 axios、不拼业务 URL、不解原始包装；严格 `/fms/v1/...` 和真实 DTO。以 HTTP 和业务 `code=200` 判定，正确处理 void/分页/文件、GET 对象序列化、时间、int64 精度与未知枚举；禁止先丢精度后转字符串。不能调用虚构 REST/刷新/会话接口。
3. **权限与状态区分**：菜单、直访、按钮、独立窗口一致；普通用户与真实 root/administrator 规则一致。无权限动作通常隐藏，只读值可读；缺口对有权限用户禁用说明。无权限、暂缓、缺口、离线、真实空结果分开，后端拒绝不能当成功。
4. **所有表格统一**：主表、编辑表、弹窗表、子表、报表明细和文件列表均用官方 npm ApexTableReact；无 antd Table/ProTable/EditableProTable 或自绘 HTML table 替代。页面直接消费包公开 API，**禁止二次封装表格组件**（无包装/转发/统一入口组件）；公共设施仅限五语言 locale 包、主题变量映射、分页换算/行 ID 纯函数与不包裹表格的独立状态块，不再造引擎，能力不足用表格加抽屉保留业务。
5. **表格语义**：零基 pageIndex→后端 pageNo、data/rowCount 明确；真实完整小集合/草稿可用 data 模式。稳定行 ID，当前页选择，翻页/筛选/失权清无效选择；筛选回首页，删末页末行回有效页，未知总数不填 0。排序仅支持真实能力。列偏好按服务实例/用户/tableId/版本隔离且可重置；筛选分页/展开仅当前页签保存，不默认跨重启持久化。
6. **取消与失败**：条件切换、翻页、语言变化和关闭防乱序；主动取消不报错/判离线。真正失败立即清空该请求对应远端区域，显示错误重试并禁用依赖操作；保留筛选和草稿。不同请求区域独立展示，禁止空数组/零对象或旧数据冒充成功。
7. **草稿与生命周期**：切页保留内存草稿，LRU 不淘汰脏页；关闭、刷新、关闭其他/全部统一检查；浏览器离开提示依平台能力，非正常终止不承诺恢复。退出/过期清会话数据。实时页只在页签激活且文档可见时约 5 秒串行刷新、恢复即查、失败有限退避；普通 CRUD 不默认轮询。
8. **写入与批量**：普通保存直接提交；控制/删除/覆盖/发布/重启等分级确认对象和影响、防重复，写操作不自动重试。命令接受≠完成；超时/断连显示未知，核实状态后再由用户决定重试，无查询能力说明无法确认。整批响应不编造逐项成功；多步优先真实批量接口，检查保存基线，保留冲突/部分提交，不承诺后端没有的事务。
9. **文件**：独立于 Activity 页 effect；切页继续，关页提示，可真实取消才提供取消，Abort 不代表服务器回滚。已知总字节才显示百分比，否则不确定进度；传输 100% 后可仍在处理。识别 Blob 内 JSON/文本错误，安全文件名、释放 URL；核实媒体类型/字段/限制，不假装续传。导出范围真实，不冒充全量或擅拉全部分页；大文件规模/性能无环境注明。
10. **关联与地图**：地图/节点/动作/车辆/驱动失效时保留可识别原值，不静默选第一项；父条件变化重新校验依赖并防乱序。只读地图按需加载、平移缩放/选点/高亮/回填准确，取消不改草稿，不带入完整编辑器或监控。
11. **五语言随页交付**：同步迁移 zh-CN/en-US/zh-TW/ja-JP/ko-KR 已有译文，覆盖菜单/状态/校验/通知/图表/表格/辅助标签/缺口原因；旧 key→新命名空间/key 映射完整，中文 key/value 不同须显式保留。已缺翻译允许简中回退，登记语言/命名空间/key/页面/状态，不故意丢已有译文。处理插值、ICU 和上下文，不盲替 JSON/Cron 花括号；动态重算列/枚举/图表，不刷新整页、不丢草稿、不重发写请求、不修改业务值。
12. **语言边界**：不猜译用户名称、日志、原始标识和后端原文；提交原始枚举/权限码。统一已证实 Accept-Language（含上传），服务端语言相关只读可重查且防旧语言覆盖；传输继续。后端错误/导出内部语言支持单独登记，不伪称前端已全部翻译。
13. **外观与终端**：保留 Dock/顶栏/页签/玻璃效果/token/深浅主题和减少动画支持；紧凑工具栏。简单表单 Modal，长表单/快览 Drawer，复杂工艺工作区页签。Windows/macOS 常用稳定 Chrome/Edge、1366×768 及更大桌面检查；长译文可读、按钮可达，隐藏恢复/固定列/虚拟展开不异常；不扩大为完整移动端/Safari 验收。渲染验收以真实登录、真实数据的整页形态为准：布局容器（工作区/页签宿主）不得被页内超宽内容撑破，横向溢出收敛为页面内部滚动，统计、筛选、表格与分页器在同一视口完整可达；表格列对照旧页逐列核对列序、列宽、对齐、时间/数值格式与空值占位，枚举无既定语义时显示原值，不臆造映射文案。工程门禁与局部截图不能替代整页渲染验收。
14. **统计与时间**：真实数据和已确认公式/单位/分母/区间，图表明细共用计算；0≠null/缺失/未知，除零不可计算，异常/重复记录不猜修复。部署时区优先、缺省 Asia/Shanghai，不随浏览器语言/时区漂移；保留偏移语义、确认无时区字符串和起止边界。图表按需注册/释放，不能引入旧 mock repository。
15. **验证与证据**：有效 lint/typecheck/结构检查/build；真实只读联调（查询性质 POST 按业务分类）。必要映射/计算可测试，不能用 mock server/合成记录证明接入。创建/删除/激活/控制/推送/重启/回滚仅在专用测试环境或现场人员执行，留证据；规格不授权默认现场自动试发。无环境注明“接口未验证”。证据不存密码/完整 token。
16. **交接收尾**：清除本页运行 mock、Umi、假进度、随机统计、错误 fallback；保留合法真实 mockDispatch。列剩余缺口、未验证项、共享契约改动、依赖消费者和适用 A/I 编号。

## 5. T00：基础设施（单独任务）

- [x] **T00 基线、请求/会话/权限、表格、页签与五语言公共基础设施**
- **批次/依赖**：B0；无实施前置。一个负责人持有公共文件，可跨多轮执行；以下是同一任务内部里程碑，不拆成抢改公共文件的并行任务。
- **必读**：完整规格；旧路由、权限/访问控制、登录/授权、请求和五语言资源；目标 request/auth/router/store/i18n/layouts；安装包公开声明。
- **范围**：第 2.2 节公共文件与机制。完成最小真实纵向接入，P01/P02 补齐页面闭环，P03/P05 建立完整业务样板。

| 里程碑 | 必须交付 | 放行证据 |
| --- | --- | --- |
| T00.1 基线及分工 | 45 个旧叶子、目录/重定向、目标入口与权限映射；历史可达性；API 哈希/operation 清单；共享资源 owner；检查故障；初始化台账和 G01–G16 | 入口数/路径可复核；载具/备份不默认公开；设备 `_back` 来源准确 |
| T00.2 依赖与环境 | 开工重核 npm 正式 latest antd/Apex 兼容性，记录版本、提交 pnpm 锁文件；同源代理默认 10.11.2.67:8888，明确前缀处理和上游 `/fms/v1/...`；部署时区；修复有效结构检查和 README 失效依据 | 可复现安装及类型/构建兼容，check:structure 确实执行；无本地表格 src/npm link、业务硬编码 IP/HTTP/WS |
| T00.3 请求与认证 | Result/ApiError、分页/查询/时间/精度、取消、并发失效收敛、健康反馈；文件通道；核实 MD5/Bearer/业务码后集中适配；去掉直通登录和虚构 refresh/me/detail；真实会话持久化、不存密码、多窗口退出 | 最小真实登录和授权只读可用；HTTP/业务错误/取消区分，未知协议登记；写请求无自动重放 |
| T00.4 权限与路由 | 后端菜单树/按钮码、祖先语义及真实 root/administrator 规则；所有入口守卫；合法回跳和可用落点；目录索引不能指向无权限/未实现页；历史拼写/别名/详情参数/实体缓存键 | 独立页不因 layout:false 公开；首页同一实例；过渡未迁移页无 mock 请求，且不算可用落点 |
| T00.5 Apex 与状态 | 不做组件二次封装：交付五语言 locale 包、主题变量映射、分页换算/行 ID 纯函数、列偏好官方适配器接入约定与统一状态块（均为资源/纯函数/独立组件，页面直接组装到 ApexTableReact）；统一无权限/暂缓/缺口/离线/空态；核验公开虚拟化/编辑/展开；图表依赖若需要统一决策 | 真实只读列表验证 Apex request，落在 P03/P05 既有入口（页面直接使用 ApexTableReact），不新增演示页/假业务数据 |
| T00.6 页签与传输 | 脏状态/关闭刷新/LRU 保护；约 5 秒可见串行轮询和上限退避；普通查询与传输分离；传输关闭提示/状态追踪；实体页签和独立窗口 | Activity 隐藏不误杀传输，退出清用户数据；不新增用户可见全局任务中心；机制测试不冒充现场验收 |
| T00.7 共享业务能力 | 地图只读/缩放平移/选点高亮回填；真实选项及失效处理；控制确认/未知/批量反馈契约；时间展示、统计空值/单位基础工具 | 按需加载且兼容 React 19；不引入地图编辑/监控/回放；具体统计公式归页面 owner |
| T00.8 五语言基座 | 五语言类型/normalizeLanguage/懒加载；中文 key 与资源 owner；解析旧嵌套资源盘点，先迁公共/菜单/认证/错误；保留暂缓/历史归属；antd/Apex/dayjs/Intl/html lang 同步；单一持久语言来源、同源 umi_locale 一次迁移 | 繁中/日/韩不误映射；基础及已开页面资源加载后切换；失败保留原语言；日期/数值展示不改协议；语言头含上传 |
| T00.9 冻结交接 | contracts.md、真实纵向样板、公共导出、各页 namespace/文件归属、证据和未验项；过渡期未完成 mock 页面退出运行路径 | 无假登录/可达 mock fallback；B1/B2 所需机制可用，不以空接口壳放行 |

T00 处理 G01–G05、G09–G16 的公共部分；G06/G07 的具体禁用入口归 P14/P09。认证或真实只读受外部阻塞时明确列出，不以“前端写完”宣布放行。所有旧有效译文最终去向由各页补全，T00 盘点不代表 I02 已通过。

**退出检查**：A03–A13、A16/A17/A20/A22/A23 的公共部分和 I01/I04–I07 基础能力有证据；有效项目检查、真实登录/只读验证完成。页面或副作用剩余项交给对应 owner；完整 A/I 由 V01 收口。

## 6. 页面任务卡

每张卡的模块名确定默认私有文件/语言分片归属，详见第 2.2 节；全部继承第 4 节 DoD。旧来源相对 `C:\code\dd\src\pages`（特别注明除外），目标入口相对 `src/pages` 并带 `.tsx`。来源为目录时继续定位入口与可达子组件。API 须逐 operation 核对。


### P01 登录

- [x] **P01 登录**
- **批次 / 前置**：B1 / T00。
- **入口**：`/login`；**旧来源**：`Login`；**目标**：`src/pages/auth/Login/Login.tsx`。
- **私有模块 / 语言分片**：`auth-login`；**接口依据**：auth/authorize/login、systemLogos。
- **业务交付**：完成真实登录表单、品牌资源、五语言切换、授权状态与合法站内回跳；复用 T00 会话和认证适配，不再另造认证状态。登录优先进入有权限且已实现的首页，否则进入首个有权限、已实现且可用业务页；无可用业务页明确反馈。
- **专项验收**：核对正确/错误凭据、刷新恢复、并发过期、多窗口退出、外站回跳拒绝和权限拒绝；登录成功不得出现本地伪造管理员。品牌请求失败不阻止真实登录。
- **追踪**：A03–A06、A20、A22；I01、I04、I07；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P01.md`。

### P02 软件授权

- [x] **P02 软件授权**
- **批次 / 前置**：B1 / P01。
- **入口**：`/authorize-ingress`；**旧来源**：`AuthorizeIngress`；**目标**：`src/pages/authorize-ingress/AuthorizeIngress/AuthorizeIngress.tsx`。
- **私有模块 / 语言分片**：`license-activation`；**接口依据**：auth/license/getHardwareInfo、softwareActivation。
- **业务交付**：迁移硬件信息展示、激活输入与提交、失败保留输入、成功后依据真实会话和权限导航；只开放后端允许的授权入口。提供可复用的激活业务组件供 P29 使用。
- **专项验收**：区分未登录、会话过期、软件未激活和授权失效；不得把独立授权入口等同于所有独立页面免鉴权；激活副作用在专用环境或现场验证。
- **追踪**：A03–A06、A13–A14、A20；G03；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P02.md`。

### P03 任务管理（表格样板）

- [ ] **P03 任务管理（表格样板）**
- **批次 / 前置**：B2a / P01。
- **入口**：`/order-record`；**旧来源**：`OrderRecord`；**目标**：`src/pages/order-record/OrderRecord/OrderRecord.tsx`。
- **私有模块 / 语言分片**：`order-record`；**接口依据**：dispatcher/orderRecord、orderTask、orderTemplate。
- **业务交付**：完整迁移状态统计、筛选分页、详情入口、创建与快捷创建、旧页面可达控制、取消原因、真实 orderTask/mockDispatch 模拟分配及导出；移除 order.mock.ts 和运行引用。共享工艺等选项调用 T00 的查询契约，不等待 P20 编辑页面完成。
- **专项验收**：以真实列表验收 Apex request 分页、末页删除、当前页选择、列偏好与失败清空；创建表单切页保留草稿。明确标注真实仿真；导出遵守后端筛选和数据范围。整页渲染验收另含：工作区不被超宽表格撑破，统计条、筛选区与分页器在视口内完整可达，时间列统一秒级格式，表头与单元格对齐一致。P38 未完成时记录详情链路待联验，不能报整页闭环通过。
- **追踪**：A06–A11、A13–A16、A21；G04、G09–G11、G13；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P03.md`。

### P04 车辆分组

- [ ] **P04 车辆分组**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/vehicle-deploy/vehicle-group`；**旧来源**：`VehicleDeploy/VehicleGroup`；**目标**：`src/pages/vehicle-deploy/VehicleGroup/VehicleGroup.tsx`。
- **私有模块 / 语言分片**：`vehicle-group`；**接口依据**：dispatcher/vehicleGroup、vehicle/getSimpleVehicles。
- **业务交付**：迁移分组分页、新增、编辑、删除、组内车辆选择和校验；真实选项展示名称及标识，组内表格一并替换。
- **专项验收**：删除或无权限车辆保留原标识与不可用说明；不得静默替换关联。保存失败保留组内编辑，切换父条件不被旧响应覆盖。
- **追踪**：A05–A11、A13、A15、A17；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P04.md`。

### P05 车辆列表（控制样板）

- [ ] **P05 车辆列表（控制样板）**
- **批次 / 前置**：B2a / P01。
- **入口**：`/vehicle-deploy/vehicle-diplay`；**旧来源**：`VehicleDeploy/VehicleDisplay`；**目标**：`src/pages/vehicle-deploy/VehicleDisplay/VehicleDisplay.tsx`。
- **私有模块 / 语言分片**：`vehicle-list`；**接口依据**：dispatcher/vehicle。
- **业务交付**：迁移分页、接入车辆、编辑、删除、状态与详情入口，以及旧页面实际可达的单车/批量指令；建立其他设备页复用的控制交互样板。历史 vehicle-diplay 地址保留。
- **专项验收**：状态查询只在可见时按需轮询；重新激活先核验状态再开放控制。批量反馈依据真实返回显示成功/失败/未知，不把整批接受当逐车完成。P39 完成后联验完整详情。参考旧 SPEC_VehicleList_Sort.md，但仅开放真实支持的排序。
- **追踪**：A05–A15、A22；G04、G09、G10、G13；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P05.md`。

### P06 载具类型

- [ ] **P06 载具类型**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/vehicle-deploy/vehicle-type`；**旧来源**：`VehicleDeploy/VehicleType`；**目标**：`src/pages/vehicle-deploy/VehicleType/VehicleType.tsx`。
- **私有模块 / 语言分片**：`carrier-type`；**接口依据**：dispatcher/carrier。
- **业务交付**：迁移类型分页、增改删、尺寸及参数校验；保留真实协议单位与精度，不把载具误改成车辆型号业务。
- **专项验收**：核对旧路由缺少 access 的实际权限来源；不得公开访问或创造权限码。尺寸边界、数值提交、未知参数和失败留稿有明确行为。
- **追踪**：A05–A11、A13；G10；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P06.md`。

### P07 节点映射

- [ ] **P07 节点映射**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/vehicle-deploy/node-mapping`；**旧来源**：`VehicleDeploy/NodeMapping`；**目标**：`src/pages/vehicle-deploy/NodeMapping/NodeMapping.tsx`。
- **私有模块 / 语言分片**：`node-mapping`；**接口依据**：dispatcher/agvNodeMapping、map/getMapInfo。
- **业务交付**：迁移查询、增改删、映射行编辑、建议节点、只读地图选点和失效节点处理；复用 T00 地图能力。开工读取旧 SPEC_node_mapping.md 与 SPEC_node_mapping_map_picker.md。
- **专项验收**：确认只回填当前目标行，取消不改原草稿；多行编辑标识稳定；地图/节点失效明确阻止错误保存；不导入完整地图编辑器。
- **追踪**：A08–A11、A13、A15、A17；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P07.md`。

### P08 告警码管理

- [ ] **P08 告警码管理**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/vehicle-deploy/alarm-code-management`；**旧来源**：`SystemInvolve/AlarmCodeManagement`；**目标**：`src/pages/system-involve/AlarmCodeManagement/AlarmCodeManagement.tsx`。
- **私有模块 / 语言分片**：`vehicle-alarm-code`；**接口依据**：dispatcher/vehicleAlarmCode。
- **业务交付**：迁移分页、增改删、告警码文件下载及全量覆盖上传，明确覆盖范围和影响。
- **专项验收**：上传媒体类型与字段经核实；切页继续传输、关闭提示、进度真实；错误 JSON 不下载为文件，失败不清除尚未提交的输入。
- **追踪**：A05–A11、A14–A16；G05、G11；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P08.md`。

### P09 地图列表

- [ ] **P09 地图列表**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/map-through/map-list`；**旧来源**：`MapThrough/MapList`；**目标**：`src/pages/map-through/MapList/MapList.tsx`。
- **私有模块 / 语言分片**：`map-list`；**接口依据**：dispatcher/map、mapVersion。
- **业务交付**：迁移元数据增改删、调度地图/车载地图导入、文件下载、版本列表、发布、推送及原可达导出；旧 PullModal 拉取入口按 G07 保留禁用原因。地图编辑导航进入 H02。
- **专项验收**：版本/目标车辆核验后才允许发布推送，区分传输完成、服务端处理、命令接受和最终结果；版本/文件/选择弹窗表格全部使用 Apex。不能用 downloadMap 或 vehicleDownloadMap 猜替拉取语义。
- **追踪**：A02、A07–A11、A14–A17、A22；G05、G07、G08、G11、G13；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P09.md`。

### P10 地图关联

- [ ] **P10 地图关联**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/map-through/cross-maps`；**旧来源**：`MapThrough/CrossMaps`；**目标**：`src/pages/map-through/CrossMaps/CrossMaps.tsx`。
- **私有模块 / 语言分片**：`cross-map`；**接口依据**：dispatcher/crossMap、地图/电梯真实选项 operation。
- **业务交付**：迁移跨地图关系查询与增改删、站点和电梯关联选择及校验；选项接口来自 T00，不依赖 P14 页面完成。
- **专项验收**：切换地图重新校验站点，失效地图/站点/电梯保留原标识；必要关联缺失不允许提交；联动请求防乱序。
- **追踪**：A05–A11、A13、A15、A17；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P10.md`。

### P11 多地图点边组合

- [ ] **P11 多地图点边组合**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/map-through/point-edge-combination`；**旧来源**：`MapThrough/PointEdgeCombination`；**目标**：`src/pages/map-through/PointEdgeCombination/PointEdgeCombination.tsx`。
- **私有模块 / 语言分片**：`node-edge-group`；**接口依据**：dispatcher/systemNodeEdgeGroup。
- **业务交付**：迁移分页、增改删及地图点边组合选择；按需使用只读地图，不扩展为地图编辑。
- **专项验收**：点/边/地图组合标识与顺序按真实契约提交；选择取消不污染草稿，失效关联可识别并阻止错误保存；向 P19 提供已确认组合实体契约。
- **追踪**：A07–A11、A13、A17；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P11.md`。

### P12 地图推送记录

- [ ] **P12 地图推送记录**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/map-through/map-push-records`；**旧来源**：`MapThrough/MapPushNotificationRecords`；**目标**：`src/pages/map-through/MapPushNotificationRecords/MapPushNotificationRecords.tsx`。
- **私有模块 / 语言分片**：`map-push-record`；**接口依据**：dispatcher/mapPushRecord。
- **业务交付**：迁移查询、筛选分页、状态、重新推送及取消推送；与 P09 对齐真实推送对象、状态和返回入口。
- **专项验收**：重推/取消前确认对象与状态；超时查询实际状态，不能自动补发；没有可核实状态时显示无法确认。P09→P12 联验可排在两者合并后。
- **追踪**：A08–A11、A14–A16；G13；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P12.md`。

### P13 调度中心

- [ ] **P13 调度中心**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/dispatch-hub`；**旧来源**：`DispatchHub`；**目标**：`src/pages/dispatch-hub/DispatchHub/DispatchHub.tsx`。
- **私有模块 / 语言分片**：`dispatch-config`；**接口依据**：dispatcher/taskConfig/getTaskConfigs、batchEditConfigs。
- **业务交付**：迁移分类配置、可编辑值、参数校验、重置草稿、批量保存；只读权限保留可读值。
- **专项验收**：重置回到最近一次确认保存的基线；失败保留输入；保存前检查关键状态冲突，优先真实批量接口，不承诺未提供的原子事务。
- **追踪**：A05–A06、A11、A13、A15；G13；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P13.md`。

### P14 电梯

- [ ] **P14 电梯**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/tri-resource/tri-device/elevator`；**旧来源**：`TriDevice/Elevator_back`；**目标**：`src/pages/tri-device/Elevator/Elevator.tsx`。
- **私有模块 / 语言分片**：`device-elevator`；**接口依据**：device/elevator。
- **业务交付**：迁移驱动参数、增改删、详情状态、外呼、开关门及清占用；内呼按 G06 对有权限用户显示禁用说明。来源必须是当前路由的 Elevator_back。
- **专项验收**：驱动切换校验参数与楼层等真实取值；控制确认对象和影响，结果未知可追踪；不能以外呼代替内呼或从历史 Elevator 复制额外能力。
- **追踪**：A05–A14、A17；G06、G13；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P14.md`。

### P15 自动门

- [ ] **P15 自动门**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/tri-resource/tri-device/auto-door`；**旧来源**：`TriDevice/AutoDoor_back`；**目标**：`src/pages/tri-device/AutoDoor/AutoDoor.tsx`。
- **私有模块 / 语言分片**：`device-auto-door`；**接口依据**：device/autoDoor。
- **业务交付**：迁移驱动参数、增改删、状态、开关门和清占用；复用控制样板，核对 AutoDoor_back 的所有可达弹窗。
- **专项验收**：状态失败清空对应区域并暂停依赖操作；不自动重放开关门命令；只读用户无控制入口。
- **追踪**：A05–A14；G13；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P15.md`。

### P16 充电桩

- [ ] **P16 充电桩**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/tri-resource/tri-device/charge-pie`；**旧来源**：`TriDevice/ChargePile/ModbusChargePile`；**目标**：`src/pages/tri-device/ModbusChargePile/ModbusChargePile.tsx`。
- **私有模块 / 语言分片**：`device-charge-pile`；**接口依据**：device/chargePile。
- **业务交付**：迁移驱动参数、增改删、状态、开始和停止充电；保留 charge-pie 地址。
- **专项验收**：驱动、对象和充电状态按契约核验；命令接受不显示成充电完成；不因其他旧 Modbus 文件存在而扩张来源范围。
- **追踪**：A05–A14、A22；G13；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P16.md`。

### P17 交通灯

- [ ] **P17 交通灯**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/tri-resource/tri-device/traffic-lights`；**旧来源**：`TriResource/TrafficLights`；**目标**：`src/pages/tri-device/TrafficLights/TrafficLights.tsx`。
- **私有模块 / 语言分片**：`device-traffic-light`；**接口依据**：device/trafficLight。
- **业务交付**：迁移驱动参数、增改删、测试操作与结果；注意旧来源在 TriResource/TrafficLights。
- **专项验收**：测试也按实际副作用分类，不能默认作为只读自动执行；未知结果保留诊断信息，不用动画假装测试通过。
- **追踪**：A05–A11、A13–A14、A21；G13；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P17.md`。

### P18 风淋门

- [ ] **P18 风淋门**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/tri-resource/tri-device/air-shower-door`；**旧来源**：`TriDevice/AirShowerDoor_back`；**目标**：`src/pages/tri-device/AirShowerDoor/AirShowerDoor.tsx`。
- **私有模块 / 语言分片**：`device-air-shower`；**接口依据**：device/airShowerDoor。
- **业务交付**：迁移驱动参数、增改删、状态、开关门、风淋和清占用；只迁当前来源的可达控制。
- **专项验收**：操作按实际设备状态和权限开放；防重复提交、超时未知与状态核验可用；驱动参数错误保留输入。
- **追踪**：A05–A14；G13；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P18.md`。

### P19 三方交管

- [ ] **P19 三方交管**
- **批次 / 前置**：B4a / B2 样板门禁、P11。
- **入口**：`/tri-resource/tri-traffic`；**旧来源**：`TriTraffic`；**目标**：`src/pages/tri-traffic/TriTraffic/TriTraffic.tsx`。
- **私有模块 / 语言分片**：`tripartite-traffic`；**接口依据**：dispatcher/tripartiteTraffic。
- **业务交付**：迁移配置增改删、边组合选择、通信模拟测试；边组合接口与 P11 保持一致。
- **专项验收**：已删除组合不可静默替换；模拟测试调用真实后端并标识目标/仿真，依据真实结果反馈；测试是否影响现场先按契约分类。
- **追踪**：A05–A11、A13–A14、A17、A21；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P19.md`。

### P20 任务工艺

- [ ] **P20 任务工艺**
- **批次 / 前置**：B4b / B2 样板门禁、P23、P24。
- **入口**：`/mission-cluster/mission-create`；**旧来源**：`MissionCluster/MissionCreate`；**目标**：`src/pages/mission-cluster/MissionCreate/MissionCreate.tsx`。
- **私有模块 / 语言分片**：`order-template`；**接口依据**：dispatcher/orderTemplate、动作/地图/站点/车辆/分组选项。
- **业务交付**：迁移模板增改删、步骤与动作嵌套详情、顺序和参数编辑，复杂编辑使用工作区页签；所有选项查询真实接口。复用 P23/P24 的动作契约与 T00 地图/选项能力。
- **专项验收**：展开和编辑子表均使用 Apex；能力不足用表格加抽屉保留效果。切页/LRU/语言切换不丢草稿；关联失效和部分保存有明确反馈。旧 permission 名称与页面称谓可能交叉，严格核对真实 PERM，不能凭名称猜码。
- **追踪**：A07–A11、A13、A15、A17–A18；G13；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P20.md`。

### P21 工艺管理

- [ ] **P21 工艺管理**
- **批次 / 前置**：B5 / B2 样板门禁、P20。
- **入口**：`/mission-cluster/mission-flow`；**旧来源**：`MissionCluster/MissionFlow`；**目标**：`src/pages/mission-cluster/MissionFlow/MissionFlow.tsx`。
- **私有模块 / 语言分片**：`order-flow`；**接口依据**：dispatcher/orderFlow。
- **业务交付**：迁移创建工艺、Cron 编辑、主工艺和子工艺控制、查询、展开及关联模板选择。
- **专项验收**：保留旧有秒位与 ? 等 Cron 语义，使用部署时区；未确认调度器语义不展示猜测的下一次执行时间。主/子控制分别校验对象、权限与结果；嵌套顺序和草稿可靠。
- **追踪**：A12–A15、A17–A19；G13、G15；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P21.md`。

### P22 避障模板

- [ ] **P22 避障模板**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/mission-cluster/obstacle-avoidance`；**旧来源**：`ObstacleAvoidance`；**目标**：`src/pages/obstacle-avoidance/ObstacleAvoidance/ObstacleAvoidance.tsx`。
- **私有模块 / 语言分片**：`obstacle-template`；**接口依据**：dispatcher/obstacleAvoidance。
- **业务交付**：迁移模板增改删、参数编辑、子表格与详情；保留旧可达嵌套业务能力。
- **专项验收**：参数的单位、边界、必填和未知值按契约处理；主子表行标识稳定，失败留稿，切页恢复后编辑位置正确。
- **追踪**：A07–A11、A13、A15、A18；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P22.md`。

### P23 车辆动作

- [ ] **P23 车辆动作**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/mission-cluster/action-control/agv-action`；**旧来源**：`ActionControl/AGVAction`；**目标**：`src/pages/action-control/AGVAction/AGVAction.tsx`。
- **私有模块 / 语言分片**：`agv-action`；**接口依据**：action/agvAction。
- **业务交付**：迁移动作增改删、参数和详情；递归检查原可达文件操作，按真实接口接入或登记缺口，不能只迁列表。
- **专项验收**：已有动作参数不因未知枚举丢失；若有文件操作，遵循 T00 传输约定。向 P24/P20 提供动作实体及参数契约；不迁未挂路由系统动作页。
- **追踪**：A07–A11、A13、A16、A18；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P23.md`。

### P24 动作分组

- [ ] **P24 动作分组**
- **批次 / 前置**：B4a / B2 样板门禁、P23。
- **入口**：`/mission-cluster/action-control/agv-action-group`；**旧来源**：`ActionControl/AGVActionGroup`；**目标**：`src/pages/action-control/AGVActionGroup/AGVActionGroup.tsx`。
- **私有模块 / 语言分片**：`agv-action-group`；**接口依据**：action/agvActionGroup、agvAction/getAGVActions。
- **业务交付**：迁移分组增改删、组内动作配置和顺序编辑；复用已确认动作契约。
- **专项验收**：增删/重排后使用稳定动作标识与父组作用域；失效动作保留原标识并阻止错误保存；失败后顺序与输入不丢失。
- **追踪**：A07–A11、A13、A15、A17–A18；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P24.md`。

### P25 版本管理

- [ ] **P25 版本管理**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/system-involve/version-control`；**旧来源**：`SystemInvolve/VersionControl`；**目标**：`src/pages/system-involve/VersionControl/VersionControl.tsx`。
- **私有模块 / 语言分片**：`system-version`；**接口依据**：systemVersion。
- **业务交付**：迁移版本查询、包上传下载、删除待升级包、重启、回滚和恢复状态；开工读取旧 SPEC_update_version_real_upload_progress.md。
- **专项验收**：逐 operation 核实上传类型和旧版本接口替代；移除 FakeProgressModal。100% 后仍可显示服务端处理；重启断连不宣布成功，恢复查询不重放命令。大文件无环境时列待验收。
- **追踪**：A11、A14–A16、A21、A24；G05、G08、G11、G13；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P25.md`。

### P26 系统日志

- [ ] **P26 系统日志**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/system-involve/system-log`；**旧来源**：`SystemInvolve/SystemLog`；**目标**：`src/pages/system-involve/SystemLog/SystemLog.tsx`。
- **私有模块 / 语言分片**：`system-log`；**接口依据**：systemLog。
- **业务交付**：迁移类型查询、筛选分页和文件下载；文件列表使用 Apex，保留服务器日志原文。
- **专项验收**：下载鉴权、错误文件识别、Content-Disposition 文件名、Blob 释放和真实大小表现可追踪；仅提供接口支持的筛选。
- **追踪**：A06–A11、A16、A20；G11；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P26.md`。

### P27 系统设置

- [ ] **P27 系统设置**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/system-involve/system-setting`；**旧来源**：`SystemInvolve/SystemSetting`；**目标**：`src/pages/system-involve/SystemSetting/SystemSetting.tsx`。
- **私有模块 / 语言分片**：`system-branding`；**接口依据**：systemLogos。
- **业务交付**：迁移原可达品牌图片预览、上传及真实配置展示；复用 T00 品牌查询服务并按约定使登录/外壳刷新真实资源。
- **专项验收**：不新增通用设置 CRUD；无对应接口的配置标明缺口。上传失败保留原已确认资源，预览 URL 及时释放；品牌图片不伪装成后端业务记录。
- **追踪**：A06、A11、A13、A16、A20；G05、G12；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P27.md`。

### P28 操作日志

- [ ] **P28 操作日志**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/system-involve/operation-log`；**旧来源**：`SystemInvolve/OperationLog`；**目标**：`src/pages/system-involve/OperationLog/OperationLog.tsx`。
- **私有模块 / 语言分片**：`operation-log`；**接口依据**：common/sysLog/pageSysLogs。
- **业务交付**：迁移条件查询、分页与日志详情；字段展示遵守部署时区，保留服务器业务原文。
- **专项验收**：时间筛选边界和序列化有证据，敏感筛选不自动写 URL；日志详情区分缺失、空值和查询失败。
- **追踪**：A06–A11、A20；G04、G15；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P28.md`。

### P29 软件信息

- [ ] **P29 软件信息**
- **批次 / 前置**：B3 / B2 样板门禁、P02。
- **入口**：`/system-involve/software-information`；**旧来源**：`SystemInvolve/SoftwareInformation`；**目标**：`src/pages/system-involve/SoftwareInformation/SoftwareInformation.tsx`。
- **私有模块 / 语言分片**：`software-license`；**接口依据**：auth/license/getLicense、softwareActivation。
- **业务交付**：迁移授权信息、到期与激活状态及原可达激活入口，复用 P02 激活组件和同一权限/会话规则。
- **专项验收**：到期按真实后端时间语义显示；登录过期与授权失效区分；读取失败不显示已授权，激活成功依据业务结果更新。
- **追踪**：A03–A06、A11、A14、A20；G03、G15；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P29.md`。

### P30 数据库备份

- [ ] **P30 数据库备份**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/system-involve/database-backup`；**旧来源**：`SystemInvolve/DatabaseBackupManagement`；**目标**：`src/pages/system-involve/DatabaseBackupManagement/DatabaseBackupManagement.tsx`。
- **私有模块 / 语言分片**：`database-backup`；**接口依据**：dataBase。
- **业务交付**：迁移库列表、备份文件列表与下载；不擅自增加创建备份、恢复数据库操作。
- **专项验收**：核对原权限清单，不把缺少路由 access 当公开页；真实文件、文件名、失败及大文件待验收明确；两级列表均使用 Apex。
- **追踪**：A05–A11、A16；G10、G11；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P30.md`。

### P31 用户管理（合并模板实现）

- [ ] **P31 用户管理（合并模板实现）**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/access-management/user-management`；**旧来源**：`AccessManagement/UserManagement`；**目标**：`src/pages/access-management/UserManagement/UserManagement.tsx`。
- **私有模块 / 语言分片**：`access-user`；**接口依据**：auth/user、auth/role/getRoles。
- **业务交付**：迁移分页、新增、状态切换、删除、角色分配和重置密码；整合或替换 src/pages/system/user 及现有服务，只留一套真实调度实现。角色选项复用 T00 契约，不等待 P32 页面。
- **专项验收**：root/administrator 专属限制取真实身份；操作自己、目标账号限制以真实规则为准。密码不持久化；权限拒绝立即阻止并提示重新登录；旧 REST DTO 和 antd Table 不残留运行路径。
- **追踪**：A03–A11、A14–A15、A21；G12、G13；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P31.md`。

### P32 角色管理（合并模板实现）

- [ ] **P32 角色管理（合并模板实现）**
- **批次 / 前置**：B3 / B2 样板门禁。
- **入口**：`/access-management/role-management`；**旧来源**：`AccessManagement/RoleManagement`；**目标**：`src/pages/access-management/RoleManagement/RoleManagement.tsx`。
- **私有模块 / 语言分片**：`access-role`；**接口依据**：auth/role、auth/permission/getPermissions。
- **业务交付**：迁移分页、增改删、权限树分配、父子/祖先及半选语义；整合 src/pages/system/role。开工读取旧 SPEC_permission_modal_tri_state.md、SPEC_menu_permission.md、SPEC_button_permission.md。
- **专项验收**：保存后重新读取与原语义一致；勾选显示与提交值分离，不提交翻译标签，不凭空补权限。角色更新不伪造即时权限刷新接口；保留超级管理员专属限制。
- **追踪**：A05–A11、A13–A15；G12、G13；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P32.md`。

### P33 任务统计

- [ ] **P33 任务统计**
- **批次 / 前置**：B6 / B2 样板门禁。
- **入口**：`/analyze-visual/order-statistics`；**旧来源**：`AnalyzeVisual/OrderStatistics`；**目标**：`src/pages/analyze-visual/OrderStatistics/OrderStatistics.tsx`。
- **私有模块 / 语言分片**：`report-order`；**接口依据**：report/orderStatisticsReport。
- **业务交付**：迁移数量/效率统计、受支持筛选、图表及口径说明；经文档核对的公式归入专属纯计算模块，供图表与明细共用。参考旧 SPEC_metric_calculation_hint.md。
- **专项验收**：0、缺失、null、除零、未知状态、空结果和失败区分；不制造同比环比；图表实例正确重建/销毁。将确认后的共享口径交给 P35。
- **追踪**：A10–A12、A19–A20、A24；G15；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P33.md`。

### P34 合并业务首页 / 实时看板

- [ ] **P34 合并业务首页 / 实时看板**
- **批次 / 前置**：B6 / B2 样板门禁。
- **入口**：`/analyze-visual/dashboard-realtime`；**旧来源**：`AnalyzeVisual/RealtimeDashboard`；**目标**：`src/pages/dashboard/Dashboard/Dashboard.tsx`。
- **私有模块 / 语言分片**：`dashboard`；**接口依据**：dispatcher/dashboard/board。
- **业务交付**：将模板仪表盘与实时看板合并到 /dashboard，旧路由兼容重定向到同一实例；迁移真实 KPI、趋势和可达明细。移除 dashboard.mock.ts 及其引用，参考旧 SPEC_dashboard_stats.md。
- **专项验收**：同一首页只有一份数据和可见轮询；约 5 秒串行，隐藏暂停，恢复即查，失败退避并清空受影响区域；无首页权限遵守 P01 落点规则。跳转 P03/P38/P39/P36 的实际链路分别核验。
- **追踪**：A11–A12、A19–A22、A24；G15；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P34.md`。

### P35 任务统计报表

- [ ] **P35 任务统计报表**
- **批次 / 前置**：B6b / B2 样板门禁、P33、P37。
- **入口**：`/analyze-visual/dashboard-task`；**旧来源**：`AnalyzeVisual/TaskStatisticsReport`；**目标**：`src/pages/analyze-visual/TaskStatisticsReport/TaskStatisticsReport.tsx`。
- **私有模块 / 语言分片**：`report-task`；**接口依据**：report/orderStatisticsReport/taskStatistics、vehicleStatisticsReport。
- **业务交付**：迁移接口支持的统计窗口、车辆时长/利用率、趋势与明细；复用 P33/P37 已确认计算和单位，页面独有指标单独登记。
- **专项验收**：只接受统计天数的接口不显示任意日期范围能力；利用率分母、车辆集合和日边界可解释；图表与 Apex 明细一致，未知分母不可计算。
- **追踪**：A07–A11、A19–A20、A24；G15；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P35.md`。

### P36 故障告警

- [ ] **P36 故障告警**
- **批次 / 前置**：B6 / B2 样板门禁。
- **入口**：`/analyze-visual/dashboard-fault`；**旧来源**：`AnalyzeVisual/FaultAlert`；**目标**：`src/pages/analyze-visual/FaultAlert/FaultAlert.tsx`。
- **私有模块 / 语言分片**：`report-fault`；**接口依据**：report/systemAlarmRecord。
- **业务交付**：迁移聚合统计、告警分页、筛选、详情及关联任务/车辆导航；共享实体导航契约。
- **专项验收**：聚合与列表独立失败时分别显示真实状态；查询失败不能显示无告警；未知等级有文字和原值；关联目标无权限/不存在/参数缺失分别反馈。
- **追踪**：A07–A12、A19–A20、A22；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P36.md`。

### P37 车辆状态统计

- [ ] **P37 车辆状态统计**
- **批次 / 前置**：B6 / B2 样板门禁。
- **入口**：`/analyze-visual/vehicle-status`；**旧来源**：`AnalyzeVisual/VehicleStatus`；**目标**：`src/pages/analyze-visual/VehicleStatus/VehicleStatus.tsx`。
- **私有模块 / 语言分片**：`report-vehicle-state`；**接口依据**：report/vehicleStatisticsReport。
- **业务交付**：迁移状态时长、单车/跨车聚合、图表与明细；集中实现本页及 P35 共用的车辆统计计算，核实每车×每状态记录与 totalDurationSeconds 秒单位。
- **专项验收**：逐项验证状态集合、当天车辆数、分母、时间区间与日边界；不猜测去重或补零。参考旧 SPEC_vehicle_status_legend.md、SPEC_metric_calculation_hint.md，未知状态不算正常状态。
- **追踪**：A07–A11、A19–A20、A24；G15；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P37.md`。

### P38 完整任务详情

- [ ] **P38 完整任务详情**
- **批次 / 前置**：B2b / P03。
- **入口**：`/order-info`；**旧来源**：`OrderInfo`；**目标**：`src/pages/order-info/OrderInfo/OrderInfo.tsx`。
- **私有模块 / 语言分片**：`order-detail`；**接口依据**：orderRecord/getOrderRecordDetail 等已声明查询。
- **业务交付**：迁移按任务上下文查询、mission 分页、动作展开及返回来源；核对旧调用点参数。默认工作区页签并提供独立窗口/全屏，快速预览复用详情业务组件。
- **专项验收**：不同任务 ID 的页签、草稿和请求隔离；完整详情不被列表抽屉替代。缺参数、任务不存在、无权限、会话过期分别处理；嵌套表格使用 Apex；与 P03 完成往返联验。
- **追踪**：A05、A07–A13、A18、A22；G10；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P38.md`。

### P39 完整车辆详情

- [ ] **P39 完整车辆详情**
- **批次 / 前置**：B2b / P05。
- **入口**：`/vehicle-info`；**旧来源**：`VehicleInfo`；**目标**：`src/pages/vehicle-info/VehicleInfo/VehicleInfo.tsx`。
- **私有模块 / 语言分片**：`vehicle-detail`；**接口依据**：vehicle/getVehicleState 等已声明查询。
- **业务交付**：迁移按车辆标识读取实际状态及旧页面可达信息；默认工作区页签，提供独立窗口/全屏，复用实体导航和可见轮询机制。
- **专项验收**：不同车辆实体缓存隔离；独立窗口鉴权与工作区一致；状态失败清空对应远端区域，恢复立即查询；与 P05 列表和快速预览联验。
- **追踪**：A05、A07–A12、A22、A24；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P39.md`。

### P40 服务器资源

- [ ] **P40 服务器资源**
- **批次 / 前置**：B6 / B2 样板门禁。
- **入口**：`/analyze-visual/server-resource-monitor`；**旧来源**：`AnalyzeVisual/ServerRealtimeResources`；**目标**：`src/pages/analyze-visual/ServerRealtimeResources/ServerRealtimeResources.tsx`。
- **私有模块 / 语言分片**：`server-resource`；**接口依据**：serverResource/current。
- **业务交付**：迁移 CPU、内存、磁盘真实状态、可见轮询和全屏；默认工作区页签，保留 /analyze-visual/server-resource 菜单别名并共享鉴权与实现。
- **专项验收**：资源单位和比例按契约；未知容量不显示虚假 0%；全屏/独立窗口生命周期正确；无硬编码全局监控 WebSocket，无重复轮询。
- **追踪**：A05、A11–A12、A19–A20、A22、A24；G14；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P40.md`。

### P41 无权限页

- [x] **P41 无权限页**
- **批次 / 前置**：B1 / T00。
- **入口**：`/no-permission`；**旧来源**：`UnAccess`；**目标**：`src/pages/un-access/UnAccess/UnAccess.tsx`。
- **私有模块 / 语言分片**：`access-denied`；**接口依据**：无业务接口。
- **业务交付**：迁移已登录无权限反馈和可达返回路径，覆盖无业务页可用的场景，复用 T00 的导航判断与错误展示。
- **专项验收**：返回不进入无权限重定向循环；无权限、服务离线、接口缺口与本期暂缓明确区分；五语言完整，不能提供绕过路由权限的入口。
- **追踪**：A05、A20、A22；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P41.md`。

### P42 兜底错误页

- [x] **P42 兜底错误页**
- **批次 / 前置**：B1 / T00。
- **入口**：`/*`；**旧来源**：`@/pages/NotFound`；**目标**：`src/pages/error/NotFound/NotFound.tsx`。
- **私有模块 / 语言分片**：`error-pages`；**接口依据**：无业务接口。
- **业务交付**：迁移不存在页面提示、有效导航和恢复路径；同时核对目标项目 /404、/500、页面与路由错误边界，复用正确的五语言反馈。
- **专项验收**：未知 URL、加载失败、无权限分别呈现；已登录/未登录都有合法恢复路径，不泄漏会话信息，不把业务查询失败伪装为不存在页面。
- **追踪**：A10–A11、A20、A22；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P42.md`。

### P43 模板个人中心与公共入口清理

- [ ] **P43 模板个人中心与公共入口清理**
- **批次 / 前置**：B5 / B2 样板门禁、P31、P32。
- **入口**：`/profile（目标项目保留入口）`；**旧来源**：`目标项目 src/pages/profile 及相关公共入口`；**目标**：`src/pages/profile/Profile/Profile.tsx`。
- **私有模块 / 语言分片**：`profile`；**接口依据**：仅使用已证实调度契约；无菜单 CRUD 接口。
- **业务交付**：逐项核对个人资料与公共能力，只保留可接真实接口的部分；无接口的资料编辑/配置对有权限用户明确不可用。清理模板菜单管理、重复用户/角色入口及废弃 REST 服务的运行引用，配合 P31/P32 保证单一实现。
- **专项验收**：不调用虚构 /users/me，不伪造资料；不能把登录返回没有的字段补成示例数据。所有保留表格用 Apex；移除菜单 CRUD 虚假能力。删除历史代码前核对可达引用，不误删共享模块。
- **追踪**：A01、A07、A20–A23；G01、G02、G12；通用 DoD 和适用的 I01–I08 必须同时满足。交接记录：`docs/migration/tasks/P43.md`。

## 7. 三个暂缓页面：仅交付说明与入口兼容

三个任务只替换对应入口的呈现，复用 T00 的统一暂缓组件；不迁业务、不执行请求。仍需核对原权限和五语言资源归属，不能当作公开页面。H 任务勾选只代表说明入口验收通过，不代表完整页面已迁移。

### H01 调度监控暂缓说明

- [x] **H01 调度监控入口**
- **批次/依赖**：B1 / T00。
- **路径**：`/over-look`；旧来源 `Overlook`；目标 `src/pages/overlook/Overlook/Overlook.tsx`。
- **交付**：对有权限用户保留菜单/直访，显示统一“本期暂未迁移”；保留合法目标标识/查询上下文，既不死链也不自动跳旧系统。
- **验收**：不加载旧监控、全局 WebSocket、地图操作和该页模拟停靠/充电等业务；原相关五语言资源有映射去向。A01/A02/A05/A20/A22，I02/I06。

### H02 地图编辑暂缓说明

- [x] **H02 地图编辑入口**
- **批次/依赖**：B1 / T00。
- **路径**：`/map-through/map-nest-modify`；旧来源 `MapThrough/MapNestModify`；目标 `src/pages/map-through/MapNestModify/MapNestModify.tsx`。
- **交付**：菜单、地图列表等关联入口进入统一说明，保留合法地图上下文，按原权限控制。
- **验收**：不加载完整编辑器/编辑副作用；不得影响 P07 选点和 P09 地图 CRUD/版本/导入导出/发布推送，相关资源明确归属。A01/A02/A05/A17/A20/A22，I02/I06。

### H03 录制回放暂缓说明

- [x] **H03 录制回放入口**
- **批次/依赖**：B1 / T00。
- **路径**：`/analyze-visual/record-playback`；旧来源 `RecordPlayback`；目标 `src/pages/record-playback/RecordPlayback/RecordPlayback.tsx`。
- **交付**：原权限下保留菜单/直访与合法上下文，使用统一五语言说明。
- **验收**：不引入录制文件导入导出、时间轴、回放轮询/连接、全局进度和完整回放模块；相关语言资源保留归属。A01/A02/A05/A20/A22，I02/I06。

## 8. 接口缺口责任分配

状态和处理策略以规格第 13 章为准。本表分配落实责任，不表示已经验证或关闭缺口；未列出的新缺口继续编号登记。公共 owner 完成基础处理后，页面 owner 仍需记录本页具体 operation 的证据。

| 缺口 | 主责 | 页面落实 / 处理要点 |
| --- | --- | --- |
| G01 未文档化会话 detail | T00、P01 | P31/P32/P43 不调用；持久化真实登录返回，拒绝后重新登录 |
| G02 模板 refresh/me 假定 | T00、P43 | 删除假定，不建立伪刷新；所有页复用真实会话 |
| G03 MD5/Bearer/授权码待核实 | T00、P01/P02 | 真实证据后单点适配，不猜协议试口令；P29 复用 |
| G04 GET 对象序列化 | T00、全部相关页 | 逐 endpoint 验证 query，记录差异，不统一猜扁平/对象 |
| G05 上传媒体类型 | T00、P08/P09/P25/P27 | P23 若有可达上传同样核实；字段/类型按 operation |
| G06 电梯内呼缺口 | P14 | 有权限禁用入口，禁用原因；不能用外呼替代 |
| G07 地图拉取缺口 | P09 | 保留 PullModal 对应入口说明，不猜 downloadMap 等语义 |
| G08 旧地图/版本路径替代 | P09、P25 | 先确认可达性，再逐条确认新版接口替代 |
| G09 全量排序缺口 | T00、全部表格页 | 不发虚构 sort，不把当前分页排序暗示为全量 |
| G10 int64/计数精度 | T00、全部相关页 | 无损解析/字符串契约经证实后使用；不先损失再转换 |
| G11 进度/取消/续传 | T00、P03/P08/P09/P23/P25/P26/P27/P30 | 只承诺真实能力，长传输结果未知与大文件环境另记 |
| G12 模板 DTO/个人资料/菜单 | P31/P32/P43 | P27 不虚构设置 CRUD；保留单一调度后端实现 |
| G13 事务/版本/幂等 | T00、全部写操作页 | 冲突预读、部分提交/未知结果、不自动重放、不假事务 |
| G14 WebSocket 契约 | T00、H01、需要实时能力的页面 | 优先已声明 HTTP；确需 WS 独立核实，不迁回监控全局连接 |
| G15 时区/公式/空值 | T00、P21/P28/P29/P33–P37/P40 | Cron 与统计逐项核对；缺失/未知不可计算 |
| G16 检查脚本/视觉指南缺失 | T00、V01 | 修复有效检查，以现有布局/token 为视觉基线 |

对于已确认缺失的接口，可完成其前端可用部分与禁用原因，但不得把该操作标记为“已验证可用”。确需改变已确认产品范围、权限语义、后端方案或扩大现场副作用验证时，提出具体变更及依据，不自行改写规格。

## 9. V01：统一验收与迁移交付

- [ ] **V01 全项目回归、证据审查与交付收口**
- **批次/依赖**：B7；T00、P01–P43、H01–H03 的实现或已知缺口说明已合并。由统筹执行者处理跨文件收口；发现页面问题回交对应 owner 修复，不另造第二套实现。
- **交付**：最终入口/操作映射、缺口台账、环境/契约/依赖说明、五语言映射/术语/缺失清单、A/I 验收报告及真实证据。保留页面的“未验证/部分完成”状态。
- **通过含义**：所有适用 A01–A24、I01–I08 均有结论和证据；存在未完成接口能力或未完成真实验收时可以交付阶段报告，但不能声称“整个迁移已完成”或勾选为全部通过。

### 9.1 路由与跨页流程逐项复核

| 链路 | 责任任务 | 必须复核 |
| --- | --- | --- |
| 登录 → 授权/业务首页/首个可用页/无权限 | T00、P01/P02/P34/P41 | 合法回跳、授权与过期区分、无循环、退出/换账号/多窗口 |
| 任务列表 → 快捷创建/工艺选择 → 完整任务详情 | P03/P20/P38 | 真实选项、详情上下文、mission/动作展开、返回来源、独立窗口鉴权 |
| 车辆列表 → 分组关联 → 完整车辆详情 | P04/P05/P39 | 单车/批量指令目标、状态重新核验、实体缓存隔离 |
| 地图列表 → 版本/发布推送 → 推送记录 | P09/P12 | 真实版本/对象、传输/命令/结果阶段、不确定状态 |
| 地图/车辆 → 节点映射 → 选点回填 | T00、P07/P09 | 失效关联、取消不改草稿、回填正确行、无完整编辑器 |
| 地图关联 → 电梯/站点；点边组合 → 交管 | P10/P11/P14/P19 | 真实可识别关联、失效校验，不因管理页完成才允许查选项 |
| 车辆动作 → 动作分组 → 任务工艺 → 主子工艺 | P23/P24/P20/P21 | 顺序/参数/嵌套、Cron 秒位与 ?、草稿保护、冲突/部分保存 |
| 角色权限分配 → 用户角色 → 新会话与旧会话拒绝 | P31/P32、T00 | 父子/半选、真实特殊身份、普通用户无越权，不能伪造权限刷新 |
| 软件信息 → 激活；品牌上传 → 登录/外壳 | P29/P02/P27/P01 | 共用业务实现、真实状态更新、语言一致 |
| 首页/告警/统计 → 任务或车辆明细 | P34/P36/P33/P35/P37/P38/P39 | 口径/单位一致、合法实体参数、无权限目标正确反馈 |
| 服务器资源菜单别名 → 工作区/全屏/独立窗口 | P40、T00 | 同实现同权限，暂停/恢复无重复请求 |
| 任意关联入口 → 三个暂缓页 | H01–H03、P09 等 | 保留合法上下文、原权限、统一说明，不调用未迁移业务 |

### 9.2 工程与行为验收索引

| 规格验收 | 主责 / 证据要求 |
| --- | --- |
| A01/A02 范围与暂缓 | T00、全部 P/H、V01：45 个旧叶子逐项对应；目标额外公共入口不漏；历史实现可达性可审查 |
| A03/A04 认证会话 | T00、P01/P02：真实登录、恢复、过期、退出/多窗口，无伪管理员/刷新 |
| A05 权限 | T00、P31/P32、全部页：普通用户/特殊身份/无权限/撤权，菜单按钮直访独立窗口一致 |
| A06 协议 | T00、全部服务 owner：真实 method/path/DTO/业务码、认证和分页/文件证据 |
| A07–A09 表格 | T00、全部表格页、P43：业务渲染无替代表格，稳定 ID、分页选择/偏好隔离，模板公共页纳入 |
| A10/A11 请求及失败 | T00、全部页：真实请求取消/竞争/失败清区，筛选和草稿保留 |
| A12 实时生命周期 | T00、P05/P34/P39/P40 等实际实时页：可见串行、恢复即查、失败退避、无重复连接 |
| A13 草稿 | T00、全部编辑页，重点 P03/P07/P13/P20/P21：切换、LRU、批量关页/刷新、退出 |
| A14/A15 写入和一致性 | 全部写操作页：确认、防连点、未知/部分结果、冲突；专用环境/现场证据，无自动重放 |
| A16 文件 | T00、P03/P08/P09/P23/P25/P26/P27/P30：类型/错误/真进度/切页继续/取消边界/命名/释放/规模 |
| A17 关联与地图 | T00、P04/P07/P09–P11/P19/P20/P24：真实选点、失效可识别、不误回填 |
| A18 工艺 | P20/P21/P22/P23/P24/P38：步骤/动作/参数/主子控制/Cron/嵌套完整 |
| A19 统计 | P33–P37/P40：真实数据、经证实口径、缺失不补零、图表明细一致 |
| A20 语言/主题/终端 | 全部页、V01：五语言和深浅色、Windows/macOS Chrome/Edge、1366×768 及更大视口 |
| A21 零 mock | T00、P03/P34/P43、V01：运行引用审计，无样例/随机/伪进度/fallback，真实 mockDispatch 保留 |
| A22 首页与链接 | T00、P01/P34/P38/P39/P40/P41/P42、H01–H03：单首页、历史拼写、别名/详情参数、合法落点 |
| A23 依赖与检查 | T00、各批统筹、V01：官方包与锁文件、兼容性、有效检查、不格式化无关文件 |
| A24 稳定性 | T00、全部页、V01：真实规模多页签、展开虚拟表、图表重建、传输内存；记录环境/规模/持续时间与结果 |

### 9.3 国际化专项验收索引

| 规格验收 | 主责 / 必须交付的证据 |
| --- | --- |
| I01 语言入口/规范化 | T00、P01：五语言切换、刷新/独立窗口恢复、旧语言码兼容 |
| I02 旧资源迁移 | T00、全部页/H：解析嵌套旧资源、中文 key/value 差异和菜单映射，暂缓/历史归属；不能以 key 数相同证明完整 |
| I03 插值/动态文案 | 各页：变量/数量、ICU/富文本单独验证，无裸占位符或错误语序，不改业务 JSON/Cron |
| I04 切换与草稿 | T00、各编辑/图表/缓存页：资源先加载、无整页刷新/草稿丢失/写请求重发 |
| I05 第三方/辅助文案 | T00、各页：antd/Apex/dayjs、分页/列设置/编辑器/Tooltip/图表/可访问标签同步 |
| I06 回退/资源故障 | T00、全部页：简中回退登记，已有译文无故意遗漏，加载失败可恢复不白屏 |
| I07 后端协同 | T00、请求/传输及页面 owner：语言来源统一，错误消息与导出内部语言能力单独登记 |
| I08 日期数值/布局 | 全部页：切语言不改时区/业务值/枚举；五语言×深浅色×最低视口及桌面浏览器记录 |

### 9.4 最终检查与交付门禁

1. 在集成基线上运行 `pnpm lint`、`pnpm typecheck`、`pnpm check:structure`、`pnpm build`，记录命令、时间、提交和结果；结构脚本缺失不能当通过。`pnpm check` 已包含前三项时不必无理由重复执行。
2. 静态审查 Umi/旧巨型 API、替代表格渲染、mock 引用、随机/示例业务记录、伪进度和 fallback；按可达运行路径人工复核，不能仅凭 `mock` 字符串删除合法仿真接口，也不能忽略改名后的假数据。
3. 核对真实只读接口证据；写操作只收集专用环境或现场验收记录。环境、权限、接口、样本规模不足时明列待验收，不用合成数据替代。
4. 核对全部五语言资源映射与缺失登记、动态切换、深浅主题、独立窗口及最低分辨率。未覆盖平台/浏览器明确列出，不能代为推断通过。
5. 检查长时多页签/图表/表格/传输资源表现，记录实际持续时间、业务规模、浏览器/环境和观测；不承诺未经测量的首屏、百万行或文件上限。
6. 完成全部台账与环境配置说明；汇总每页“已完成 / 前端完成但有接口缺口 / 真实接口未验证 / 副作用待验收 / 本期暂缓”，精确定位不可用入口。
7. 检查 Git 差异仅包含授权迁移内容，代码有多行简体中文注释，无无关格式化；本清单不包含自动部署、修改后端、发布表格库或现场自动控制。

## 10. 单任务交接记录模板

复制到 `docs/migration/tasks/<任务ID>.md`；每项操作单列，不能只写“CRUD 已完成”。

| 字段 | 应填写内容 |
| --- | --- |
| 任务 / 负责人 / 基线 | ID、Agent/执行者、分支/提交、开始与更新日期 |
| 状态 | 实施状态、验证状态、阻塞原因；不能只用一个 done |
| 依据 | 规格章节、旧路由和实际组件/子组件、API 哈希及参考业务规格 |
| 操作映射 | 每个查询/表单/子表/按钮/导入导出/导航 → 新实现 → method/path/operationId → 权限 → 状态与证据 |
| 文件归属 | 实际修改清单；跨任务文件 owner 的交接结果；公共文件待集成差异 |
| 共享契约 | 消费/新增/变更的服务、DTO、namespace、tableId、导航/草稿/传输契约与消费者 |
| 接口缺口 | G 编号、具体证据、状态、受影响能力、入口呈现、决定和验证日期 |
| 国际化 | 五语言旧 key 映射分片、术语、已有/缺失译文、插值/动态切换/后端语言边界 |
| 验证 | 自动命令结果、真实只读证据、专用环境/现场写操作证据、A/I 对应项、视觉及规模记录 |
| 未完成 / 后续 | 具体操作、原因、是否阻塞消费者、后续负责人、复验条件 |

本文件是执行计划，不是迁移完成报告。开始下一项任务前，以已合并实现、交接记录和真实证据判断依赖，不以聊天中的“完成了”代替检查。
