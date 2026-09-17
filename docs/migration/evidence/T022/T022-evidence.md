# T022 证据 — 展开子表与动态行高能力验证（2026-09-17）

## 环境与版本

- 目标仓：apple-admin 分支，基线 `b2bfe25`（T021 提交）+ 本卡未提交差异；库 `apex-table-react@0.1.0`（npm，源 HEAD `ae34e0a`），本轮**未改库**。
- 浏览器：桌面 Chrome 152（专用调试实例，独立 profile），1600×900；语言 zh-CN（V05a 切换 en-US 验证）。
- 后端：真实旧后端 `http://10.11.2.67:8888`（root/root），dev 代理 `APEX_DEV_LEGACY_TARGET` 内联注入（:5222 实例）；全部场景只读查询，零 mock。
- 驱动方式：IAB guest 本轮渲染帧停摆（rAF=0、ResizeObserver 不投递、截图失败，环境问题非代码缺陷），改由 CDP 驱动真实桌面 Chrome 执行 UI 操作并读取 DOM 度量；数值断言为主要证据，截图为辅助。
- 数据实况：分组成员表 2 组（成员 6/3）；模板 8 条（完整模板 14 任务；定制场景 mission 75=19 动作、76=18 动作）；工艺实例 79 条（每条 1 子流程，10/页 → 8 页）。

## 场景结果（<TaskID>-Vxx）

| 场景 | 断言（DOM 实测） | 结果 |
| --- | --- | --- |
| V01 成员表 | 库位看板（6 成员）展开 → 详情 1 行、成员子表 6 行、详情高 359px；再点收起 → 详情 0；空成员组不可展开（真实数据两组均有成员，`rowExpandable` 逻辑为代码审查+样例覆盖） | ✅ |
| V02 三级展开 | “完整模板”展开 → 任务子表 10 行（14 条、子表分页控件存在）；子表点“下一页”→ 子表 4 行、主表仍 8 行（分页独立）；子表任务再展开 → 动作子表出现（第三级嵌套） | ✅ |
| V03 长子表动态行高 | “定制场景”展开 → 任务子表 3 行；mission 75 展开 → 详情内 22 行（3 任务+19 动作）、详情实高 1254px > 视口 362px；外层滚动 scrollHeight 2120、滚到底 scrollTop=1758、表格底部 ≤ 视口底部（可达，无错位/空洞） | ✅ |
| V04 分页×展开 | flows 第 1 页展开两行（det=2、aria-expanded=true）→ 切第 2 页（首行 a5ffa423，det=0，第 2 页行未展开）→ 回第 1 页：首行恢复 bf32a0f3、det=2、aria-expanded=true（展开状态按行身份跨页保留）；翻页后端顺序稳定（curl 两次比对一致） | ✅ |
| V05 语言与尺寸 | 切 en-US → 展开按钮 aria-label `展开行`→`Collapse row`（表格文案随应用语言）；视口 1600×900→1366×768 → 表格视口重排（1514×362），行渲染与展开详情（1254px）保持 | ✅ |
| V06 父子交互 | 成员子表内点表头排序、点子表行 → 父行保持展开（det=1）、成员 6 行不丢（库 expand 按钮 stopPropagation + 行点击 isInteractive 过滤） | ✅ |
| 200 行分页 | 真实后端可展开父表最大 79 行×8 页（V04）；198 行×20 页分页在 T021-V01 已验证（车辆表无子内容）；200+ 行展开规模由库演示（240 行本地数据，库仓 docs/demos/Expandable.tsx ControlledExpandable）覆盖 | ✅（口径见左） |
| 连续展开 | 同表连续展开两行（V04a det=2）；跨样例多表同时保持展开（复测期间 3+ 详情并存无错位） | ✅ |
| 密度切换 | 未在本轮执行（列设置弹窗内密度入口未驱动）；密度→重测为库级 `useLayoutEffect[safeHeight]→measure()` 路径，代码审查+库演示覆盖；容器尺寸变化路径已由 V05b 验证 | ⏳ 归 T028 随页补验 |

## 截图（docs/migration/evidence/T022/）

- `T022-V01-member-subtable.png` 样例一：分组展开 → 成员子表（真实 6 成员）
- `T022-V02-three-level.png` 样例二：完整模板展开（任务 14）；样例三两行展开 + 嵌套子流程子表（引用模板/指定车辆/子流程状态真实值）
- `T022-V03-long-detail.png` 样例二：定制场景 mission 75 长动作子表（19 行）
- `T022-V04-cross-page.png` 样例三：第 1 页两行展开状态
- `T022-V05-small-viewport.png` 1366×768 视口下的重排

## 类型检查

- 目标仓 `pnpm typecheck`（tsc -b --noEmit）exit 0（含本卡 ExpansionProbe/ApexTableProbe 改动）。
- 库仓 `tsc --noEmit` exit 0（本轮未改库，复跑确认）。

## 本轮发现（交付合同更新）

1. **动作行身份不能用裸 actionType**：真实数据同一任务内 actionType 重复（humanoidBend 连续两次）、actionId 全为 null；库 duplicateRowId 诊断按设计拒绝渲染（源 antd rowKey 同用 actionType，重复仅告警）。探针样例改用 `actionType#序号` 组合；正式页面（T059 等）需同样组合。已写入 table-capabilities.md §5。
2. **固定高度滚动容器里的表格会被 flex 收缩压扁**：flex-shrink 默认 1，表格根元素被压缩后视口测量为 0、行不渲染且无任何错误提示。消费页在滚动容器中放置 ApexTable 时须对表格（或其父块）设置 `flexShrink: 0`。已写入 §5。
3. 展开详情内嵌套 ApexTable：非虚拟内容高模式工作正常（库对嵌套表的测量查询用 `:scope` 限定，不误注册到外层虚拟器）；嵌套表自带分页独立于主表。
