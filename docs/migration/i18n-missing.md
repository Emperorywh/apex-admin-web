# 缺失翻译登记（i18n-missing）

> 允许缺失翻译回退简体中文，但不能故意忽略已有译文（规格 18.1）。每条缺失登记后跟踪补齐或确认回退。

## 登记格式

| 语言 | 命名空间 | 中文 key | 所属页面/组件 | 状态（回退简中 / 已补齐 / 待定） | 登记任务 | 日期 |
| --- | --- | --- | --- | --- | --- | --- |
| （示例行，登记时替换）en-US | orderRecord | 任务管理 | order-record | 待定 | P03 | — |

## 当前登记

（zh-TW/ja-JP/ko-KR 命名空间体系自 T00.8 起建立；此前新增的公共文案按「回退简中」登记，T00.8 建基座时逐条补齐。）

| 语言 | 命名空间 | 中文 key | 所属页面/组件 | 状态（回退简中 / 已补齐 / 待定） | 登记任务 | 日期 |
| --- | --- | --- | --- | --- | --- | --- |
| zh-TW | common | 暂无访问权限 | StateBlock（公共状态块） | 回退简中 | T00.5 | 2026-09-17 |
| zh-TW | common | 当前账号没有查看此内容的权限，请联系管理员开通 | StateBlock（公共状态块） | 回退简中 | T00.5 | 2026-09-17 |
| zh-TW | common | 该功能暂不可用 | StateBlock（公共状态块） | 回退简中 | T00.5 | 2026-09-17 |
| zh-TW | common | 所需接口能力尚未就绪，相关操作已禁用 | StateBlock（公共状态块） | 回退简中 | T00.5 | 2026-09-17 |
| zh-TW | common | 加载失败 | StateBlock（公共状态块） | 回退简中 | T00.5 | 2026-09-17 |
| zh-TW | common | 无法获取数据，请检查网络或服务状态后重试 | StateBlock（公共状态块） | 回退简中 | T00.5 | 2026-09-17 |
| zh-TW | common | 重新加载 | StateBlock（公共状态块） | 回退简中 | T00.5 | 2026-09-17 |
| zh-TW | common | （T00.6 页签动作确认/传输状态 11 键：关闭当前页签、确认继续{{action}}？、继续、确认刷新当前页签？、刷新页签、以下页签存在未保存的修改…、这些页签仍有正在进行的传输…、进行中的传输将被本机终止…、登录已结束…、"{{name}}" 传输完成/失败/已终止） | TabsBar/Header/TransferWatcher（公共页签与传输） | 回退简中 | T00.6 | 2026-09-17 |
| ja-JP | common | （同上：StateBlock 7 条 + T00.6 页签/传输 11 键） | StateBlock、TabsBar/Header/TransferWatcher | 回退简中 | T00.8 | 2026-09-17 |
| ko-KR | common | （同上：StateBlock 7 条 + T00.6 页签/传输 11 键） | StateBlock、TabsBar/Header/TransferWatcher | 回退简中 | T00.8 | 2026-09-17 |
| zh-TW/ja-JP/ko-KR | common | T00.7 命令确认与批量反馈 8 键（确定、本次操作影响以下对象：、等 {{count}} 个对象、命令提交后不代表操作已完成…、成功 {{count}} 项、成功 {{succeeded}} 项…、（原值缺失）、{{id}}（已不在当前选项中）） | confirmCommand/metricFormat 同族公共文案 | 回退简中 | T00.7 | 2026-09-17 |
| zh-TW/ja-JP/ko-KR | map | 请传入地图ID、地图加载中...、地图数据为空、搜索节点或路径...、节点、路径（共 6 键） | ReadOnlyMap（共享只读地图组件） | 回退简中 | T00.7 | 2026-09-17 |

> 说明：ApexTableReact 表格控件文案（locale 包）不属于本登记——五语言已随 T00.5 完整交付（`src/i18n/locales/apexTable/`），无缺失。
