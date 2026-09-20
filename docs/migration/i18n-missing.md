# 缺失翻译登记（i18n-missing）

> 允许缺失翻译回退简体中文，但不能故意忽略已有译文（规格 18.1）。每条缺失登记后跟踪补齐或确认回退。

## 登记格式

| 语言 | 命名空间 | 中文 key | 所属页面/组件 | 状态（回退简中 / 已补齐 / 待定） | 登记任务 | 日期 |
| --- | --- | --- | --- | --- | --- | --- |
| （示例行，登记时替换）en-US | orderRecord | 任务管理 | order-record | 待定 | P03 | — |

## 当前登记

| 语言 | 命名空间 | 中文 key | 所属页面/组件 | 状态（回退简中 / 已补齐 / 待定） | 登记任务 | 日期 |
| --- | --- | --- | --- | --- | --- | --- |
| zh-TW/ja-JP/ko-KR | orderRecord | orderRecord 命名空间全部键 | order-record 模板遗留分片 | 回退简中 | P03 | 2026-09-17 |
| zh-TW/ja-JP/ko-KR | dashboard | dashboard 命名空间全部键 | dashboard 模板遗留分片 | 回退简中 | P34 | 2026-09-17 |

> T00.8 已补齐并从本表移除：common/menu/auth/error/map 五个基座命名空间的 zh-TW/ja-JP/ko-KR 全量译文（含 StateBlock 7 键、T00.6 页签/传输 11 键、T00.7 命令/批量/选项失效 8 键、ReadOnlyMap 6 键——此前按回退简中登记，T00.8 逐条补齐）。i18next 懒加载表查不到的命名空间返回空资源自然回退简中，页面任务交付自己的四语言分片后从本表移除。
>
> P43 已补齐并从本表移除：profile 命名空间 zh-TW/ja-JP/ko-KR 分片（10 键，术语与 menu/access-user 对齐）。同轮删除模板遗留菜单管理链（含 en-US/system.ts 与 system 命名空间注册），原「system 命名空间」登记条目随死代码清除，不再存在。

> 说明：ApexTableReact 表格控件文案（locale 包）不属于本登记——五语言已随 T00.5 完整交付（`src/i18n/locales/apexTable/`），无缺失。
