# 合同：ApexTable 能力与消费约定（T021 交付）

> 消费方：T022（展开子表）、T024（受控编辑）、T026（共享查询的分页消费）及所有带表格的业务页（T028/T030/T032/T035/T037 起）。
> 规格依据：SPEC §7、A08/A15。演示验证见 `evidence/T021/`；消费样例为 `src/pages/dev/ApexTableProbe/ApexTableProbe.tsx`（临时探针，收尾卡移除）与 `src/components/ApexTable/legacyTableRequest.ts`。

## 1. 包来源与版本锚点

| 项 | 值 |
| --- | --- |
| 依赖 | `apex-table-react@0.1.0`（npm 正式版，package.json 精确 `0.1.0`） |
| lockfile integrity | `sha512-mXq9blpaI88FL/zGkY4IUoRNN93j091q6ESWJhWM33vPU6LYCs3V6zu2QoSaxrDgFlXS73U5ki8mdsocZErFkQ==` |
| dist 入口 hash | `dist/index.js` sha256 `4c36f36abcef9f8094e82bc33a0b8f8803bac4885cdb889005422cef6b14c4be` |
| 源 HEAD | 库仓 `ae34e0a`（= T001 快照版本，行展开已含）；本轮**未改库** |
| 双端类型检查 | 目标仓 `pnpm typecheck` exit 0；库仓 `tsc --noEmit` exit 0（2026-09-17） |

唯一消费入口：`@/components/ApexTable`（re-export 库公开面 + 本目录适配）。页面**不得**直接 `import 'apex-table-react'`，避免绕过 locale/主题桥。

## 2. 目标仓薄适配（本轮交付）

| 文件 | 职责 |
| --- | --- |
| `src/components/ApexTable/index.ts` | 统一出口；先加载库自带样式再加载主题桥 |
| `apexTableLocales.ts` | 五语 `ApexLocale` 包（zh-CN 直接复用库 `zhCN`，en-US/zh-TW/ja-JP/ko-KR 为本仓翻译）；`resolveApexTableLocale` |
| `useApexTableLocale.ts` | `i18next.language` → `normalizeLanguage` → 语言包；切语言自动重渲 |
| `apexTableTheme.css` | `--apex-table-*` → `--app-*` 令牌映射，`.apex-table.apex-table` 特异性压过库默认（见 §5） |
| `tableColumnPreferences.ts` | 会话内存列偏好：`createSessionTablePreferences`、`useSessionColumnLayout`（自动防抖保存/恢复/`resetToDefault`） |
| `legacyTableRequest.ts` | `createLegacyTableRequest`（0 基页码→旧协议 1 基、取消信号下传、rowCount=后端 total）、`useCrossPageSelection` |

## 3. 消费样例（request 模式 + 跨页选择 + 受控布局）

```tsx
import { ApexTableReact, useApexTableLocale, useCrossPageSelection,
         useSessionColumnLayout, createLegacyTableRequest, toRowId } from '@/components/ApexTable'

const request = useMemo(() => createLegacyTableRequest<Row>(async ({ pageNo, pageSize, signal }) => {
  const raw = await legacyGet<LegacyRawPage<Row>>(url, { pageNo, pageSize }, { signal })
  const page = convertLegacyPage(raw)
  return { items: page.items, total: page.total }   // total 必须是后端准确总数
}), [])
const locale = useApexTableLocale()
const selection = useCrossPageSelection()
const layout = useSessionColumnLayout<Row>('业务表ID')

<ApexTableReact columns={columns} request={request}
  getRowId={(row) => toRowId(row.key)}
  pagination={{ pageSizeOptions: [10, 20, 50] }}
  locale={locale} columnSettingsEnabled showRowNumber showSelectionColumn
  tableRef={layout.tableRef} {...layout.columnProps}
  state={{ rowSelection: selection.rowSelection }}
  onRowSelectionChange={selection.onRowSelectionChange} />
```

- 行身份一律 `getRowId` + `toRowId`（T003 合同 §5），禁止数组下标。
- 末页删除后页码回正：调用方 `clampToValidPage`（T003 §4），request 模式另有条件变化自动回第 1 页（`autoResetPageIndex` 默认开）。
- 筛选变化清空选择是页面职责：按业务时机调 `selection.clearSelection`（A08 空选不得提交由页面保证）。

## 4. 能力核对（0.1.0 实测）

| 能力 | 结论 |
| --- | --- |
| 服务端分页 | ✅ request 模式内置：0 基 pageIndex、受控/非受控分页、条件变化自动回第 1 页、AbortController 取消、过期响应按查询身份丢弃、rowCount 必须为非负整数 |
| 选择 | ✅ 受控 `state.rowSelection`；**表头复选=仅当前页全选**（分页启用时 `scope='page'`），无"全库全选"入口——A08 口径成立；跨页保留由消费方持有状态实现（已演示） |
| 列设置/偏好 | ✅ 库内置列设置弹窗（宽度/显隐/固定/排序/密度/恢复默认）；持久化走 `apex-table-react/adapters/local-column-preferences` + 本仓会话内存存储（SPEC §7.2"仅会话内记忆"，认证纪元推进即清空） |
| 主题 | ✅ `.apex-table` 根变量桥接 `--app-*`；深色随 `data-theme` 生效（实测深色卡片底 #1b253d）；单表品牌覆盖用组件 `style` 属性（`ApexTableStyle`） |
| 语言 | ✅ 五语包全量；库内文案（分页/列设置/空态/错误/读屏名）随应用语言切换 |
| 展开行 | ✅ 库已含且经 T022 真实后端验证（V01—V06）：受控/非受控展开键按行 ID 保存（翻页/筛选不丢）、`rowExpandable` 控制可展开行、详情行动态测量参与滚动计算、密度/容器尺寸变化后重测；嵌套子表（成员表、任务多层展开）以独立表格实例渲染，行身份/分页/滚动各层独立，嵌套表测量查询 `:scope` 限定不误注册外层虚拟器。见 `evidence/T022/`；万行虚拟编辑归 T024 |
| 受控编辑 | 库已含（`editable`/`onDataChange`）；合同与万行验证归 T024 |

## 5. 已验证限制（消费方必读）

1. **主题覆盖顺序**：库默认变量挂在 `.apex-table`（特异性 0,1,0），异步 chunk 下样式注入次序不定；桥接层用 `.apex-table.apex-table`（0,2,0）稳定覆盖。同页单表品牌定制继续用 `style` 属性，不要再写第三套 CSS。
2. **request 模式 rowCount 无未知态**：分页控件要求准确 total；后端未返回 total 的接口先按 T003 兜底语义处理，不得伪造。
3. **"选择全部筛选结果"仅在非分页模式出现**：request+分页下表头只有当前页全选；独立全量操作走 §6.4 业务流程（T032），不得由勾选推导。
4. **列偏好的存储是进程内存**：整页刷新/浏览器页签关闭即回默认（与 T013 内存草稿同口径）；跨账号不泄露（auth.epoch 监听清空）。
5. **JSDOM/无高度容器**：表体需显式高度或可测量 flex 容器（库诊断 `unmeasurable`）；探针用 `height={520}`。
6. **重复业务键必须组合行身份（T022）**：真实数据同一任务内 `actionType` 会重复、`actionId` 可为 null，裸业务键触发 `duplicateRowId` 诊断并拒绝渲染（源 antd 仅告警仍渲染）。只读子表用 `actionType#序号` 组合（T022 探针样例）；可编辑表由 T024 合同给出稳定行身份方案。
7. **滚动容器中放置表格须禁 flex 收缩（T022）**：固定高度滚动容器的 flex 子项默认 `flex-shrink: 1`，会把表格根元素压扁 → 视口测量 0 → 行不渲染且无错误提示。表格或其父块设置 `flexShrink: 0`（探针页已按此修正）。
8. **展开详情内嵌套子表（T022）**：非虚拟内容高模式（`virtualization={false}`、不传 `height`）由外层详情行承载滚动；嵌套表分页/排序/行身份与主表独立。虚拟化嵌套表需自给显式高度，未经真实页面验证前不采用。

## 6. 验证与剩余项

演示：真实旧后端（root）+ 探针页，V01—V06 见 `evidence/T021/T021-evidence.md`。剩余：列设置弹窗内改动布局的 UI 级演示因 IAB 输入通道限制未执行（适配器保存/恢复路径为代码审查 + 库自身演示覆盖），归 T028 业务页接入时随页补验；五语×两主题的全组合视觉归 T099—T105 分域复核。

T022 补充（展开子表，见 `evidence/T022/T022-evidence.md`）：成员表、任务三级展开、长子表动态行高、分页×展开跨页保留、语言/尺寸变化、父子交互均以真实后端 + 真实 Chrome（CDP 驱动）验证通过；剩余：列设置弹窗内密度切换 UI 级演示未执行，归 T028 随页补验；200+ 行可展开父表的真实数据规模当前后端不具备（最大 79 行×8 页），更大规模展开由库演示覆盖、归 T095A 规模联验复核。
