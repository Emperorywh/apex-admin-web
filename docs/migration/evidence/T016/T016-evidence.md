# T016 证据 — 五语运行时与公共控件主题桥接

- **源版本**：目标仓库 HEAD `3445579` + 本卡未提交差异；旧词条来源 `docs/migration/reference/snapshot/dd/src/locales/`（源 `e570b8df` 快照）。
- **环境**：Chrome（ZCode IAB，1280×720）、Asia/Shanghai、Vite dev server `http://localhost:5173`；会话为隔离种子（root 短路身份 + detail 不可达保留快照分支），未连接任何真实后端，无业务写入。
- **检查**：`pnpm typecheck`（tsc -b --noEmit）exit 0，无输出。
- **词条核对**：8 命名空间（auth/common/dashboard/error/menu/orderRecord/profile/system）× 4 非默认语言 = 32 个资源文件、285 个独立 key 全部有译文；来源=旧 JSON 命中 + 人工补译（清单 manual-translations.json，共 250 key 补译，含旧 JSON「译文=简中原文」未译占位 51 个）。

## 场景与结果

| 场景 | 内容 | 结果 |
| --- | --- | --- |
| T016-V01 | 五语逐一切换（zh-CN→en-US→zh-TW→ja-JP→ko-KR）：外壳品牌/页签/导航/暂缓提示/查询区按钮、文档标题（`Tasks · Dispatch System`）、`<html lang>`、`apex-admin:lang` 持久化、antd 分页内置文案（items/page、Go to、全 N 件/총 N건/共 N 條）、dayjs 时钟（Sep 17 Thu / 週四 / 목） | 通过【隔离验证】 |
| T016-V02 | 异步加载竞态：en→ja→ko 快速连切（每步仅 150ms 间隔，不等待加载），2.5s 后界面全韩文，无 en/ja/zh 残留，document lang 与存储一致 ko-KR | 通过【隔离验证】 |
| T016-V03 | 刷新持久化：ko→en 切换后硬刷新，语言保持 en-US、文档标题与 html lang 一致 | 通过【隔离验证】 |
| T016-V04 | 公共弹窗主题：深色主题下打开「退出登录」App 确认弹窗，深色配色/英文文案/按钮样式正确（截图 V04-dark-shell-en.png、V04-dark-dialog-en.png）；主题三态菜单与语言切换互不干扰 | 通过【隔离验证】 |
| T016-V05 | 编辑不丢稿（机制级）：查询输入框打 DOM 哨兵 + 注入值，切语言后哨兵保留（同一 DOM 节点未重建），placeholder 同步切换为英文 | 通过【隔离验证】 |
| T016-V06 | Accept-Language 跟随：代码路径核对（legacyRequest 直读 `i18next.language`，五语自动覆盖）；**真实后端抓包未执行**（隔离环境无旧后端），归 T090 定向补验 | 机制核对通过；抓包待验 |

## 未执行 / 已知边界

- 登录页语言入口（G03）归 T017；本卡验证在登录后外壳进行。
- order-record 模板页枚举徽标与「状态」列头仍中文：模板页未接 `t()`，领域词条已备于 orderRecord 命名空间，T066 页面迁移时接入（详见合同 §8）。
- 真实五语视觉矩阵（Chrome/Edge × 两尺寸，A15）归 T098—T105 分域复核；本卡仅 1280×720 单浏览器。
