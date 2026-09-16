# T003 验证证据 — 统一旧JSON协议、分页与二进制下载

- **执行时间**：2026-09-16 17:10—17:25（本地 UTC+8）
- **环境**：Windows 10.0.26200 / Node v22.23.1 / pnpm 11.21.0；ZCode 内置浏览器（IAB，Chromium），视口默认；应用 dev 服务器 `http://localhost:5199/`（vite 8.2.1），代理 `APEX_DEV_LEGACY_TARGET=http://127.0.0.1:9377` 指向临时 mock 旧后端；语言 zh-CN（i18next 默认）。
- **隔离性质**：旧后端为临时 mock（不入仓库，位于 `%TEMP%\t003-mock\mock.mjs`），全部响应为构造信封；未触达真实旧后端。**所有场景均为隔离验证，不含真实验收。**
- **验证方式**：页面上下文动态 `import('/src/services/request/legacy/legacyRequest.ts')` 加载真实模块执行；服务端视角以 mock 逐请求 JSON 日志为准（已脱敏存档：`mock-server-log.jsonl`，仅含 dummy token `raw-token-123` / `Bearer already-prefixed-token`）。
- **代码版本**：目标仓库工作区（未提交差异，见 handoff 改动文件清单）；typecheck 在实现修复后最终通过（exit 0）。

## 场景结果

| 场景 | 内容 | 结果 | 关键证据 |
| --- | --- | --- | --- |
| T003-V01a 信封成功 | `legacyGet('/fms/v1/t003/echo')` 解包 data | 通过 | 返回 `receivedPath/receivedAuth/receivedLang`（V01 服务端日志 09:19:53） |
| T003-V01b 业务失败 | code=500 → 抛 `LEGACY.BIZ_FAILURE`，bizCode/bizMessage 保留原文 | 通过 | 抛错 `bizMessage:"车辆不存在"` + request-error 事件 |
| T003-V01c 大整数 ID | 字符串大整数 ID 原样保留；**裸数字超 2^53 的 ID 在 JSON.parse 即丢精度**（9007199254740993 → 9007199254740992），与预期一致的合同限制 | 通过（限制已证实） | `rawRecordsIds`：字符串型 `"9007199254740993"`（type string），数值型丢失精度 |
| T003-V01d 分页映射 | records/current/size/total/pages → items/page/pageSize/total/pages | 通过 | `pageMeta: {page:3, pageSize:20, total:105, pages:6, itemsLen:3}` |
| T003-V02a 认证失效 | code=1000000 → `session-expired` 事件 + 抛 `LEGACY.SESSION_EXPIRED` | 通过 | 事件记录 09:20:19 |
| T003-V02b 授权缺失 | code=1001000 → `authorization-required` 事件 + 抛 `LEGACY.SOFTWARE_UNAUTHORIZED` | 通过 | 事件记录 09:20:19 |
| T003-V02c 形状守卫 | HTML 响应（代理回退形态）→ `LEGACY.MALFORMED_RESPONSE`，不产生 undefined 访问 | 通过 | 抛错含 detail=url |
| T003-V03a 下载成功 | RFC5987 中文文件名解码、字节数、content-type、状态 | 通过 | `filename:"订单记录.xlsx"`、8 字节、PK 头 |
| T003-V03b 文件型错误（误标二进制） | JSON 信封误标 octet-stream → 抛业务错误，不返回 blob | 通过 | `bizMessage:"导出失败：无数据"`，无 LEAKED |
| T003-V03c 文件型错误（标注 json） | 同上 | 通过 | 抛 `LEGACY.BIZ_FAILURE` |
| T003-V04a 发送前中止 | abort 后再发 → `CLIENT.CANCELLED`，**服务端计数 0（可判定未提交）** | 通过 | 日志无 `never-sent` 请求 |
| T003-V04b 传输中中止 | 300ms 后 abort（服务端延迟 1500ms）→ 服务端**恰收到 1 次**，无自动重试 | 通过 | `writeHitsTotal:1` 唯一一条 delay=1500 POST |
| T003-V04c 正常写对照 | 单次发送成功 | 通过 | `writeHitsTotal:2` |
| T003-V05 头部注入 | 已带 Bearer 不重复前缀；裸 token 补一份；Accept-Language=zh-CN；路径不加 /api/v1 | 通过 | 服务端回显 `Bearer already-prefixed-token` / `Bearer raw-token-123`、路径 `/fms/v1/...` |
| T003-V06 原生移交 | `nativeDownload` 锚点触发 GET，**不带 Authorization 头**，query 正确编码 | 通过 | 日志 `authorization:null`、`query:{fileId:"7",name:"备份"}` |
| T003-V07 纯函数 | toLegacyPageNo/clampToValidPage/toRowId/parseDispositionFilename/去重器 | 通过 | 首次去重 true、窗口内第二次 false；中文文件名解析正确 |

## 未执行（不记为通过）

- 真实旧后端联调（地址/账号未提供，SPEC §14；归 T090）：真实鉴权、CORS/同源 Cookie、真实 Content-Disposition、最大文件与业务错误形态。
- 生产网关下的路径与状态码行为（归 T106）。
- 五语切换后的 Accept-Language 变化（当前语言运行时仅 zh-CN/en-US，五语归 T016；验证时确认 zh-CN 生效）。
- missionPage 等特殊分页映射（归 T070，不复用本转换函数）。
