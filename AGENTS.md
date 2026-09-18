# AGENT.md — 会话工作约定与经验沉淀

供后续 AI 会话在本仓库工作时直接复用。分工：任务台账与验收规格见 `TASKS.md`；任务交接记录见 `docs/migration/tasks/<任务>.md`；本文只沉淀**跨任务可复用的教训与规则**，每条都来自真实缺陷，不是风格偏好。

---

## 1. 布局容器与滚动纪律（2026-09-18 P03 列表页视觉缺陷修复沉淀）

### 容器规则
- `.workspace`（`BasicLayout.module.css`）已显式锁定 `grid-template-columns/rows: minmax(0, 1fr)`：页面层尺寸恒等于工作区盒，页内超宽内容**不会再**把整层撑出视口。
- 新页面永远不要假设"页面可以比视口宽"：横向溢出一律由页面内部滚动消化（ApexTableReact 自带 viewport `overflow: auto`，宽表让它自己出横向滚动条）。
- ApexTableReact 的 `height` **禁止硬编码** `calc(100vh - Npx)`：视口高度一变就失准（P03 曾在 945px 高的窗口把分页器顶出工作区、末行被 Dock 裁半）。标准写法：外层容器 `flex: 1; min-height: 0`，表格 `height="100%"`。

### 排查手法（截图审查）
- 「最右侧字段/统计项被截断」不一定是字段自身的问题，可能是整层容器被撑爆。先做像素扫描（PowerShell `System.Drawing` 逐像素找边界色变的 x 坐标），把测得的输入框/列边界与代码推算值对照，区分"字段溢出"和"容器 blowout"。
- 布局算术可以**不登录就静态完成**：antd `Col span` 求和 vs 容器宽（1920 视口 − 16px 工作区 padding）；Apex 列宽求和 vs 容器宽。P03 的溢出和"统计条第 7 项不可见"都只要手算就能提前发现。
- 几个实测换算：秒级时间串 `yyyy-MM-dd HH:mm:ss`（19 字符）在默认字号下占 **~146px**，时间列宽 ≥160 起步；工具截图管线：PowerShell 裁剪 + NearestNeighbor 放大读小字。

## 2. Apex 表格（apex-table-react）使用规则

- 列对齐用官方扩展点 `meta: { apex: { align: 'start' | 'center' | 'end' } }`。直接写 `meta: { align }` **过不了 typecheck**（TanStack `ColumnMeta` 无此属性，报"no properties in common"）；运行时消费的是 `data-align` 属性。
- 列定义数组写 `useMemo<ApexColumnDef<D>[]>(() => ...)`：不提供泛型上下文时，`align: 'center'` 这类字面量会拓宽为 `string` 导致 typecheck 失败。
- **等价迁移必须逐列核对旧版列定义**（`C:\code\dd` 下旧页源码）：列序、列宽、对齐、格式化、空值占位。旧版的全局特征（如 RecordTable 15 列全部 `align: "center"`）最容易在重写时整体丢失，症状是"表头居中、单元格左对齐"的错位。
- 同一列"有的行完整、有的行省略号截断" = 截断行的原始字符串更长。先确认所有单元格是否都走了 `displayDateTime`（它恒定输出秒级 19 字符）；若代码已统一而症状仍在，是**常驻页签缓存了热更前的旧模块**——重开页签再判，不要急着改格式化代码。
- 枚举映射必须有既定语义才做：任务优先级在旧系统是 0-999 自由数值输入，就显示原值，**不臆造「低/中/高」**（规格 11.2/18.3 纪律）。拿不准就去旧源码找 InputNumber/Select 的取值域。
- 列偏好接线两条铁律（P03 联验实证）：① `onColumn*Change` 里 setState 与 `prefs.save` 都不可省——只 save 不更新受控切片，改动会被下一帧渲染回弹；② 适配器 `save` 是整体替换语义，必须传合并后的完整四切片（列设置面板一次确认连发四类回调，单片补丁互相覆盖）。表格开启 `columnSettingsEnabled` 时序号列默认放出（用户决策）：齿轮入口随序号列表头；显式关闭序号列会使齿轮退化为表头上方独立工具条行。
- 展示层格式化（如统计数字 `toLocaleString()` 千分位）不改协议值本身；空值展示规则见第 3 节。

## 3. 表单与空值展示标准（2026-09-18 第二批沉淀，全局强制）

### 表单：标签一律横排居左，禁止上下排列
- 所有 antd Form 统一 `layout="horizontal"`（label 左、录入控件右），**禁止 `layout="vertical"`**。
- 两种既定参数，按场景照抄：
  - 筛选栏（多列栅格内）：`colon={false}` + `labelCol={{ flex: '0 0 104px' }}` + `wrapperCol={{ flex: '1 1 0%', style: { minWidth: 0 } }}`。固定标签宽保证各行控件左缘对齐；104px 容纳当前最长标签「任务名称/编号」，出现更长标签时同步加大。
  - Modal/Drawer 内表单：`labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}`（登录页同参数）。
- **wrapper 弹性基准必须为 0 且禁用 min-width:auto**（上面筛选栏参数已含）：antd Form.Item 行容器默认可换行，`flex: '1 1 auto'` 时 RangePicker 这类宽 min-content 控件（~480px）会把 wrapper 挤到标签下一行，视觉上退回「标签在上」的竖排，且同行的按钮组浮到标签行高——P03 实测踩坑，typecheck/build 均发现不了。
- 已全量改造 8 处：OrderSearchForm/CreateOrderModal/OrderCancelModal/MockDispatchModal（order-record）、LoginForm（auth）、MenuForm/RoleForm/UserForm（system）。新表单直接照抄；筛选栏操作按钮组记得 `<Space wrap>`——1366 视口下标签占宽后按钮换行而非溢出。

### 单元格空值：一律留白，禁止「—」横线占位
- 表格/Descriptions 单元格无数据（null/undefined/空串/空数组）显示**空白**。
- 共享工具已在根上统一：`UNPARSEABLE_DATETIME = ''`（`src/utils/datetime/datetimeDisplay.ts`），`displayDateTime` 对缺失/不可解析输出空串；新增单元格直接消费，不要再写 `|| '—'`。
- 两个语义边界勿混淆：
  - **未知枚举 ≠ 缺失**：未知枚举显示协议原值（不猜语义）；缺失才留白。
  - **统计条缺失 ≠ 0**：统计条缺失字段仍显示「—」，必须与「真实 0」可区分——这是 DoD 14 的数据纪律而非视觉装饰，不在留白范围内。
- 派生值同纪律：如耗时仅起止齐备时计算，缺失留白（留白 ≠ "00:00:00"，不补零）。

## 4. 按钮纪律（2026-09-18 第三批沉淀，全局强制）

- **重试按钮只允许出现在表格内部**（ApexTableReact 内建错误态「重试」）。其余任何区域——统计条、下拉选项、弹窗、非表格数据块——失败时只呈现状态文本（common 命名空间「加载失败」，五语言已有），恢复依赖可见轮询自动重查；StateBlock 不传 `onRetry` 即无按钮。
- **不提供手动刷新按钮**（工具栏、统计条等处一律不得出现「刷新」）。数据新鲜度由 useVisiblePolling 可见轮询与写操作成功后的自动 reload 保证。
- 边界说明：路由错误边界（页面级崩溃）的「重新加载」是整页重载、无其他恢复路径，不在禁令内；无轮询的数据块（如只读地图）接入新页时须补自动重查机制，否则失败后无法自愈。
- 已清理：P03 统计条错误块重试按钮、统计条/工具栏「刷新」、车辆/地图/动作/站点等下拉的「重新加载」按钮（改为「加载失败」文本）。

## 5. 验证纪律

- **lint/typecheck/structure/build 全绿 ≠ 视觉正确**：四项门禁照不到像素层。P03 当时四项全绿，仍带着两个布局根因交付。
- 带令牌联验受阻（凭据失效）时的最低限度替代：静态布局算术 + 格式化代码路径审计 + 把「待视觉验收风险点」显式写进交接记录；不得以"门禁全绿"暗示视觉已验收。
- TASKS.md DoD 13 与 B2 样板门禁已把「真实登录 + 真实数据整页渲染验收（1920 与 1366 宽度、双主题）」列为样板页（P03/P05）勾选前的硬要求，环境受阻按缺口登记并保持不勾选。
- PageCacheHost 会缓存已挂载页签的 React 树：**判定运行时行为前先硬刷新/重开页签**，否则你在验证旧模块而不是 HEAD 代码；同理，交付说明里的运行时结论要注明当时加载的代码形态。
- **IAB 联验环境的渲染管线冻结（2026-09-18 P39 补验沉淀）**：rAF 不执行之外，**ResizeObserver 回调同样不派发**——Apex 虚拟表格收不到视口尺寸致 tbody 渲染 0 行（数据实况正常，P03/P05 未改动页同症状，勿误判为回归）。补验手法：`goto()` 后立即注入双垫片（rAF→setTimeout(16)；RO→observe 时回调一次真实尺寸）再等数据渲染。**垫片修正（2026-09-19 P07 沉淀）**：P39 的 RO 垫片依赖 RO 实例内部槽 `this.callback`，当前 Chrome 已不暴露（undefined，被 try/catch 吞掉即垫片失效）；修正版在 **constructor 里捕获回调**（`this.__cb = cb`），observe 后按 0/60/300ms 多次派发 `getBoundingClientRect`（保证布局完成后有非零尺寸回调），并以页面内探针（新建 RO observe 一个 div，400ms 内回调即命中）自测通过后再开始断言。截图出现历史悬浮元素属旧帧伪象，收起下拉/菜单后重截；真实登出后 `persist:apex-admin:auth` 可能延迟清除，验守卫回跳前先手动清该键；顶栏下拉一律按 lucide 图标类定位（svg.lucide-languages / lucide-moon 等），不按随语言变化的 title 文案。另两条 P07 沉淀：① **后端 root 单会话互踢**——联验期间 curl 登录会把浏览器会话踢失效（后续请求 1000000），多页签并存时幽灵页签的失效请求触发登出链路会波及新页签，同一时间只保持一个登录会话、API 验证与浏览器验证不混用登录；② **force-hide 残留 Modal 的内联 `style.display='none'` 会破坏 antd 后续显隐管理**（open=true 也显示不出来），清残留后不要再复用该 Modal 实例做断言，重开页签最稳。P09 轮沉淀三条：① **锁接管判据缺陷**——定时任务轮次同宿主进程内运行时，「进程核查」无法区分「会话空闲间隙」与「已结束」；P09 曾因此误接管仍存活的前序轮锁（前序轮发现后主动停写、以 `.run-lock/HANDOFF-*.md` 交接，未酿成冲突）。接管遗留锁前必须在 RUN_STATE 找到前序运行的「本轮结束」标记，或以 RUN_STATE 最近更新时间+锁文件 mtime+多点探活综合判断；单凭进程不存在不构成接管依据。② **curl 行内中文陷阱**——Git Bash 下 `curl -d '{"…中文…"}'` 会编码损坏致后端 500（P09 createMap 一度误判后端缺陷）；中文请求体一律 UTF-8 文件体 `--data-binary @file`，浏览器/axios 不受影响。③ **antd 主题按钮为三态下拉**（浅色/深色/跟随系统），system 态在 IAB（系统偏好 dark）下点一次看不出变化；联验切主题点菜单项后 reload 落位，截图改新页签整页载入规避黑帧。

## 6. i18n 接线纪律（2026-09-18 P38 实测沉淀）

- 本项目 i18next 配置 `keySeparator=false; nsSeparator=false`（中文 key 即文案）：**`t()` 一律不带「ns:」前缀**——带了不会被解析成命名空间，整串「orderInfo:独立窗口」会被当作 key 原样显示在页面上，typecheck/build 照不到。
- 一个组件要跨命名空间取文案（如详情组件主体文案走 orderRecord、新增按钮文案走 orderInfo）：`useTranslation(['orderRecord','orderInfo'], { nsMode: 'fallback' })` + 无前缀 key，i18next 按数组顺序回退查找；宿主路由 meta.i18nNamespaces 必须把用到的命名空间都声明齐（切换语言时才预载）。
- 顶栏/语言菜单按钮的 title/aria-label 也是翻译文案：DOM 定位（querySelector 按 title）在非简中语言下会失效，自动化验证要用位置或结构选择器。

## 7. 文档联动

- 改公共文件（BasicLayout/请求层/表格用法）→ 同步在对应任务交接记录登记"影响已核"；新教训按本文格式沉淀到对应章节，不另开碎片文档。
- 本页案例全记录（9 项缺陷 → 根因 → 修复对照表）：`docs/migration/tasks/P03.md`「视觉缺陷修复」节。


不要写任何的单元测试。更新文档/代码注释时，不要无脑追加，要适度精简，删除过时的内容，只保留最新的内容。
