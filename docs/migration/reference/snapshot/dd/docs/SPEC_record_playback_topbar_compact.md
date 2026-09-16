# SPEC：录制回放顶部工具栏空间优化（TopBar 紧凑化 + 低频功能收纳）

> 状态：已实施（本文档为实施后补写的规格说明，与代码当前状态一致）
> 日期：2026-08-27
> 关联代码：`src/pages/RecordPlayback/components/TopBar/index.tsx`、`src/pages/RecordPlayback/components/TopBar/index.less`

---

## 1. 背景与目标

录制回放页顶部工具栏按原始布局总宽约 1400px（左侧查询区约 900px + 右侧工具区约 480px），在 1366px 宽的常见笔记本/工控屏上超出可视宽度，核心查询路径无法首屏完整呈现。

### 1.1 优化目标

| 优先级 | 要求 |
| --- | --- |
| 必须 | 地图选择、时间范围选择器、查询按钮、锁定车辆在首屏完整可见 |
| 必须 | 交管筛选入口在首屏可达（见 §3 需求澄清） |
| 允许 | 其他功能性按钮做收纳/图标化处理，为上述区域腾出空间 |
| 约束 | 不改变任何功能的业务逻辑；收纳后的功能仍需 1–2 次点击内可达 |

### 1.2 需求澄清：交管筛选

需求方表述的"交管筛选"在工程中**不存在同名独立控件**，经核对对应的是"展示"（图层显示）下拉菜单中的**"隐藏所有交管信息"**复选开关，即 `overlayVisible.traffic` 状态（`RecordPlayback/index.tsx` 持有，经 props 下发 TopBar）。

实施过程中曾按"将交管开关从二级菜单提升为左侧一级快捷按钮"处理（含 `StopOutlined` 图标、开启态主题色高亮、title 动态提示"隐藏交管信息/显示交管信息"），**需求方复核后要求复原**。最终状态：

- 交管显示控制**回归"图层显示"菜单**（`displayMenuItems` 第 3 项复选框，从未删除）；
- 入口为右侧首屏可见的眼睛图标按钮（一次点击展开菜单，一次点击切换开关）；
- 该快捷按钮的全部痕迹（JSX、图标导入、`.traffic_toggle` 样式）已移除。

---

## 2. 改造前现状（实现基线，已核实）

1. **布局结构**：`top_bar_container` 高 60px、padding 0 24px，flex 两端对齐；左区 `left_section`（gap 16px）放查询路径，右区 `right_section`（gap 8px）放工具按钮。
2. **左侧控件**：地图 Select（宽 150）、RangePicker（showTime，自适应宽约 370px）、查询 Button（primary，带图标文字）、竖分隔线、锁定车辆 Select（宽 250，弹层 375）。
3. **右侧控件**（全部带文字）：导入、导出（内联校验：时间范围必选、跨度 ≤1 小时）、历史回放三个 Button；分隔线；"展示"Dropdown（Button 带 EyeOutlined + 文字"展示"，菜单 9 个图层复选项）；分隔线；放大、缩小（icon-only Button + title）、RotateMap（20px Icon 触发 Popover）、全屏（icon-only Button + title）。
4. **弹出层容器**：所有 Select/RangePicker/Dropdown 均传 `getPopupContainer`（页面容器，全屏兼容），本次改造全部沿用。
5. **既有瑕疵**：`@ant-design/icons` 导入了未使用的 `SettingOutlined`（仓库默认存在的未用导入状态）。

---

## 3. 设计决策

### D1. 按使用频率三层分区 ✅

工具栏控件重新分层，高频路径保首屏、低频操作收纳、常驻工具图标化：

| 分区 | 内容 | 处理方式 |
| --- | --- | --- |
| 高频查询区（左） | 地图选择、时间范围、查询按钮、锁定车辆 | 全保留首屏，锁定车辆收窄为 200px |
| 低频数据区（右） | 导入、导出、历史回放 | 收进 `⋯`"更多"Dropdown，菜单项带图标文字 |
| 视图工具区（右） | 图层显示、放大、缩小、旋转、全屏 | 图标化紧凑排列（图层按钮去掉"展示"文字，以 title 补偿） |

设计依据：回放页的主路径是"选地图 → 定时间 → 查询 → 盯车"，查询路径任何收纳都会增加操作成本；导入/导出/历史回放是会话级低频动作，一次点击展开菜单的代价可接受；视图工具是图标语义自明的常驻工具，天然适合 icon-only。

### D2. 交管快捷开关：实施后复原 ✅

见 §1.2。结论：交管显示控制保留在"图层显示"菜单内，不设一级快捷按钮。图层显示入口（眼睛图标）位于首屏右侧工具组，满足"交管筛选首屏可达"的目标。

### D3. 更多下拉：逻辑原样迁移，不做入口降级 ✅

- 菜单项：`import`（导入，ImportOutlined）/ `export`（导出，ExportOutlined）/ `history`（历史回放，HistoryOutlined），文案与原按钮一致。
- 导出前校验（时间范围必选、跨度 ≤1 小时）从原按钮 onClick **原样抽出**为 `openExportModal`，由菜单 `onClick` 按 key 分发调用——行为、提示文案、提示时机与改造前完全一致，仅入口变化。
- Dropdown 传 `getPopupContainer`，全屏场景弹层仍挂页面容器内。

### D4. 视图工具图标化 + title 补偿 ✅

- "展示"按钮去掉文字"展示"，保留 EyeOutlined icon 与 Dropdown，补 `title="图层显示"`；放大/缩小/全屏原本已有 title，不动。
- "更多"按钮 `title="更多操作"`。
- 原右侧两处内部分隔线合并为一处（更多下拉与视图工具组之间），视图工具组内 gap 4px 聚为单族群。

### D5. 锁定车辆收窄 + 极窄屏收缩兜底 ✅

- 宽度 250 → 200（内联 style 改为 less 类 `vehicle_select`），弹层 `popupMatchSelectWidth={375}` 不变。
- `width: 200; min-width: 120; flex: 0 1 auto`：容器空间不足时该下拉是左侧唯一收缩项，避免把右侧工具组挤出屏幕；地图/时间范围/查询不参与收缩（压缩会破坏控件形态）。

### D6. 容器紧凑化 ✅

| 项 | 改造前 | 改造后 | 说明 |
| --- | --- | --- | --- |
| 工具栏高度 | 60px | 48px | 默认 32px 控件上下各留 8px；为地图多争取 12px 纵向空间 |
| 横向 padding | 0 24px | 0 16px | 配合收纳后的密度收紧 |
| 左区 gap | 16px | 12px | 保持分组可辨识 |
| 右区 gap | 8px | 4px | 图标族群内部间距 |
| 分隔线高度/margin | 24px / 0 8px | 20px / 0 4px | 与 48px 容器比例协调 |
| 左区 flex | — | `min-width: 0` | 允许左区收缩（配合 D5） |
| 右区 flex | — | `flex-shrink: 0` | 工具组永不收缩 |

### D7. 顺带清理 ✅

删除 `index.tsx` 中未使用的 `SettingOutlined` 导入（因本次修改 import 块而一并清理，零风险）。

---

## 4. 空间预算（估算值）

| 区域 | 改造前 | 改造后 |
| --- | --- | --- |
| 左区 | 150 + 16 + ~370 + 16 + ~72 + 17 + 16 + 250 ≈ **907px** | 150 + 12 + ~370 + 12 + ~72 + 9 + 12 + 200 ≈ **837px** |
| 右区 | 导入/导出/历史回放 ~240 + 分隔线 + "展示" ~62 + 分隔线 + 4 个视图工具 ≈ **480px** | 更多 32 + 分隔线 + 5 个图标工具 ≈ **220px** |
| padding | 48px | 32px |
| 合计 | ~1435px | **~1089px** |

结论：1366px 屏完整放下且有余量；1280px 极窄屏由锁定车辆收缩（200→120）兜底，仍不换行、不遮挡。

---

## 5. 边界与异常

| 场景 | 行为 |
| --- | --- |
| 1366px 及以上宽度 | 全部控件首屏完整呈现 |
| 1280px 极窄宽度 | 锁定车辆下拉收缩（最低 120px），其余不变；右侧工具组不收缩不被遮挡 |
| 窗口宽度不足以容纳收缩后的左区 | 不做换行处理（flex nowrap 默认），接受压缩溢出（回放页最小实用宽度约 1100px） |
| 全屏模式（containerRef requestFullscreen） | 弹层仍挂页面容器（`getPopupContainer` 沿用），48px 高度在全屏下同样生效 |
| 未选时间范围点"更多 → 导出" | `请先选择时间范围` 警告，不开弹窗（与原行为一致） |
| 时间跨度 >1 小时点"更多 → 导出" | `导出时间范围不能超过1小时...` 警告（与原行为一致） |
| 图层显示菜单 | 9 个复选项（含交管）全部保留，行为与改造前一致 |
| 悬浮无文字图标 | 均有 title 提示（图层显示/放大/缩小/全屏/更多操作；RotateMap 自带 Popover 标题） |
| 键盘/读屏可达性 | 图标按钮依赖 antd 默认 button 语义；本次未做额外 aria 增强（与项目现状一致） |

---

## 6. 技术实现

### 6.1 涉及文件

| 文件 | 改动 |
| --- | --- |
| `TopBar/index.tsx` | import 调整（+MoreOutlined，−SettingOutlined，复原时−StopOutlined）；新增 `moreMenuItems` / `openExportModal` / `handleMoreMenuClick`；左侧锁定车辆改用 `vehicle_select` 类；右侧重排（更多 Dropdown + 图标化视图工具组） |
| `TopBar/index.less` | 容器紧凑化（48px / 16px padding）；左右区 gap 与 flex 策略；分隔线尺寸；新增 `vehicle_select` 类 |

### 6.2 新增逻辑（TopBar/index.tsx）

```tsx
// "更多"下拉菜单项：低频数据操作（导入/导出/历史回放）收纳于此，
// 为主查询路径（地图/时间/查询/锁定车辆/交管）腾出首屏空间
const moreMenuItems: MenuProps['items'] = [
    { key: 'import', icon: <ImportOutlined />, label: '导入' },
    { key: 'export', icon: <ExportOutlined />, label: '导出' },
    { key: 'history', icon: <HistoryOutlined />, label: '历史回放' },
];

/**
 * 打开导出弹窗前的校验：
 * 1. 时间范围必选，未选择时拦截提示
 * 2. 导出跨度不能超过1小时，超限时拦截提示
 */
const openExportModal = () => {
    if (!timeRange || !timeRange[0] || !timeRange[1]) {
        message.warning('请先选择时间范围');
        return;
    }
    const duration = timeRange[1].valueOf() - timeRange[0].valueOf();
    const oneHourInMs = 60 * 60 * 1000;
    if (duration > oneHourInMs) {
        message.warning('导出时间范围不能超过1小时，请缩小时间范围后重试');
        return;
    }
    setIsExportModalOpen(true);
};

// "更多"菜单点击分发，行为与原独立按钮完全一致
const handleMoreMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'import') {
        setIsImportModalOpen(true);
    } else if (key === 'export') {
        openExportModal();
    } else if (key === 'history') {
        setIsHistoryModalOpen(true);
    }
};
```

### 6.3 JSX 结构（最终状态）

```
top_bar_container
├── left_section                          // gap 12，min-width 0
│   ├── Select 地图（width 150，弹层 225）
│   ├── RangePicker（showTime，不变）
│   ├── Button 查询（primary，loading=isLoading）
│   ├── divider
│   └── Select 锁定车辆（vehicle_select：200→120 可收缩，弹层 375）
└── right_section                         // gap 4，flex-shrink 0
    ├── Dropdown 更多（MoreOutlined icon-only，title"更多操作"）
    ├── divider
    ├── Dropdown 图层显示（EyeOutlined icon-only，title"图层显示"，9 项复选菜单）
    ├── Button 放大 / Button 缩小（title）
    ├── RotateMap（20px Icon + Popover，不变）
    └── Button 全屏（title）
```

弹窗（ImportModal / ExportModal / HistoryModal）渲染与 props 不变。

### 6.4 样式（TopBar/index.less 关键段）

```less
.vehicle_select {
    // 常规200px，空间不足时收缩至120px下限，不与右侧工具争抢空间
    width: 200px;
    min-width: 120px;
    flex: 0 1 auto;
}
```

其余见 §D6 表格（高度 48、padding 16、gap 12/4、divider 20px、右区 flex-shrink 0、左区 min-width 0）。

---

## 7. 验收用例

| # | 场景 | 预期 |
| --- | --- | --- |
| 1 | 1366×768 打开录制回放页 | 地图、时间范围、查询、锁定车辆首屏完整可见，无换行/遮挡 |
| 2 | 右侧工具组 | 更多、图层显示、放大、缩小、旋转、全屏六个图标全部可见 |
| 3 | 悬浮各图标按钮 | 分别出现 title：更多操作 / 图层显示 / 放大 / 缩小 / 全屏 |
| 4 | 点"更多" | 菜单出现导入/导出/历史回放三项，带图标 |
| 5 | 未选时间范围 → 更多 → 导出 | 提示"请先选择时间范围"，弹窗不打开 |
| 6 | 时间跨度 2 小时 → 更多 → 导出 | 提示"导出时间范围不能超过1小时..."，弹窗不打开 |
| 7 | 合法时间范围 → 更多 → 导出 | 导出弹窗正常打开，参数（mapId/startTs/endTs）正确 |
| 8 | 更多 → 导入 / 历史回放 | 对应弹窗正常打开；历史回放选中记录后查询链路与改造前一致 |
| 9 | 点眼睛图标 | 图层显示菜单 9 项（含"隐藏所有交管信息"）与改造前一致 |
| 10 | 切换"隐藏所有交管信息" | 地图交管层即时隐藏/显示（行为与改造前一致，且不再有其他交管入口） |
| 11 | 锁定车辆下拉 | 宽 200，搜索/清除/选中后地图跟随行为不变 |
| 12 | 窗口缩到 ~1280px | 锁定车辆收缩（最低 120），右侧工具组完整不被挤出 |
| 13 | 全屏（工具栏全屏按钮） | 弹层（下拉/弹窗）仍渲染在页面内，不残留浏览器滚动条问题 |
| 14 | 放大/缩小/旋转/全屏 | 功能与改造前一致 |
| 15 | 工具栏纵向 | 高度 48px，地图区域相应增高 |

---

## 8. 未决 / 后续

- **键盘/读屏可达性**：icon-only 按钮目前以 title 补偿，未做 aria-label 增强；如后续有无障碍要求可统一补。
- **交管快捷开关**：本次按需求方要求复原。若日后回放排查交管的频率显著升高，可再评估是否提供一级开关（此前实现含 `.traffic_toggle` 激活态样式，可从 git 历史找回）。
- **1280px 以下**：不做响应式换行设计，接受压缩（见 §5）；若实际部署环境出现更窄屏幕，再行评估。
