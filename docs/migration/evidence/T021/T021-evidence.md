# T021 验收证据 — ApexTable 分页、跨页选择、主题与五语

- 日期：2026-09-17（本轮，隔离验证＋真实后端读写混合：列表为真实旧后端只读查询）
- 环境：ZCode IAB Chromium 1600×900；语言 zh-CN（切换验证覆盖五语）；主题浅/深切换；dev server :5221（`APEX_DEV_LEGACY_TARGET=http://10.11.2.67:8888` 真实旧后端，root/root 登录）；探针页 `/dev/apex-table-probe`（临时路由，收尾卡移除）
- 版本绑定：目标仓 HEAD `ebdd997` + 本卡未提交差异（适配层 + 探针 + 路由 + `apex-table-react@0.1.0` 依赖）；库仓 `ae34e0a` 未改动
- 类型检查：`pnpm typecheck` exit 0（适配层完成、探针加入、修复后各一次）；库仓 `tsc --noEmit` exit 0

## 场景结果

| ID | 场景 | 结果 | 证据要点 |
| --- | --- | --- | --- |
| V01 | request 模式服务端分页（真实数据） | ✅ | pageVehicles 真实返回：`共 198 条`、20 页、页大小 10/20/50；翻到第 2 页首行 `2095399299897602082` 变化；见 V01-light-real-data.png |
| V02 | 跨页选择保留 | ✅ | 第 1 页勾选 2 行（`25`、`renxing02`）→ 翻页不丢 → 第 2 页再勾 1 行 → `已选：25、renxing02、2095399299897602082`，计数徽标 2→3 |
| V03 | 表头复选 = 仅当前页全选（A08） | ✅ | 第 2 页表头勾选 → 恰为该页 10 个 rowId（2095…2082—2088、2093…9160—9161），无"全库全选" |
| V04 | 清空选择 | ✅ | `清空选择（3）`→ 已选：无、计数 0 |
| V05 | 五语包切换 | ✅ | en-US `198 items in total`/`10 per page`；ja-JP `全 198 件`/`10 件/ページ`；zh-TW `共 198 筆`/`10 筆/頁`；ko-KR `총 198건`/`10건/페이지`；回 zh-CN `共 198 条`/`10 条/页`；列设置入口读屏名随语言（`Column settings`/`列設定`） |
| V06 | 主题桥接（深/浅） | ✅ | 深色：表格计算样式 `--apex-table-bg=#1b253d`（=深色 --app-card-bg）、headerBg 为 color-mix 表达式，表格实际背景 rgb(27,37,61)；浅色回切渲染正确（V06-light-final.png）。过程中发现并修复：库默认变量挂 `.apex-table`，桥接层改 `.apex-table.apex-table` 特异性覆盖（详见合同 §5.1） |
| V07 | 列布局会话记忆（UI 级演示） | ⏳ 未执行 | 列设置弹窗可打开（字段名/列宽/显示状态/固定位置结构完整），但对弹窗内列宽输入框的三种驱动（Playwright fill、原生 setter+事件、CUA 键盘输入）在本 IAB 环境均未生效（输入通道限制，非业务缺陷）；适配器保存/恢复/清除路径为代码级交付（`useSessionColumnLayout` 自动防抖保存 + auth.epoch 清空），UI 级演示归 T028 业务页接入时补验 |

## 过程发现（已修复）

1. **主题桥接被库默认值压制**：首次实现桥接层用 `:root`，实测深色下 `--apex-table-bg` 仍为 `#fff`——库默认变量挂在组件根 `.apex-table` 且异步 chunk 注入次序不定；改 `.apex-table.apex-table` 后深浅色均正确。已写入合同消费约束。
2. **选择列默认不显示**：`showSelectionColumn` 需显式传入（默认不开），已加入消费样例与探针。
3. **环境事项（非本卡缺陷）**：5173 端口存在会话外遗留 dev 进程（无 /fms 代理，未触碰，按共享工作区约定保留）；`vite.config.ts` 的旧协议代理读取 shell 环境变量 `APEX_DEV_LEGACY_TARGET` 而非 `.env.local`，本轮以 `APEX_DEV_LEGACY_TARGET=… pnpm dev --port 5221` 启动（T001-V04 口径一致）。

## 检查口径说明

按 TASKS §2.5：仅运行目标仓 `pnpm typecheck` 与库仓 `tsc --noEmit`；未运行 lint/构建/自动化测试。演示为手动页面操作 + DOM 断言；真实后端写入零次（pageVehicles 为只读查询，未触发任何车辆控制）。
