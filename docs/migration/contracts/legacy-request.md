# 合同：旧协议请求与二进制下载（T003 交付）

> 消费方：T005（身份接通）、T010（查询/轮询）、T011（写入/传输任务）、T026（共享查询）、T082（统计服务）及所有页面 service。
> 规格依据：SPEC §6.1—6.3、§10.2、附录B.1。隔离验证证据见 `evidence/T003/`；真实环境核验项在文末。

## 1. 模块与入口

| 文件 | 职责 |
| --- | --- |
| `src/services/request/legacy/legacyRequest.ts` | 唯一旧协议 axios 实例；`legacyGet/legacyPost/legacyPut`、`downloadBinary`、`nativeDownload`、`setLegacyToken`、`subscribeLegacyEvents`、`createLegacyErrorDeduper` |
| `src/services/request/legacy/legacyProtocol.ts` | 纯函数（无 axios/store 依赖）：`isLegacyEnvelope`、`isLegacySuccess`、`convertLegacyPage`、`toLegacyPageNo`、`clampToValidPage`、`toRowId`、`buildAuthorizationHeader`、`parseDispositionFilename`、`describeLegacyFailure`、`sniffLegacyErrorBlob` |
| `src/services/request/legacy/legacy.types.ts` | `LegacyEnvelope/LegacyRawPage/LegacyPage/LegacyDownloadResult/LegacyRequestEvent/LEGACY_BIZ_CODES/LEGACY_ERROR_CODES` |
| `src/services/request/request.types.ts` | `ApiError` 新增可选 `bizCode`/`bizMessage`（旧协议原文），新协议消费方不受影响 |

与 `/api/v1` 新协议通道（`src/services/request/request.ts`）并存、互不混用；本卡未改动新协议行为。新协议通道的 refresh 重放移除归 T005。

## 2. 调用方式

```ts
import { legacyGet, legacyPost, legacyPut, downloadBinary, nativeDownload } from '@/services/request/legacy/legacyRequest'
import { convertLegacyPage, toLegacyPageNo, clampToValidPage, toRowId } from '@/services/request/legacy/legacyProtocol'

// JSON：params 进 query；信封解包后直接返回 data
const raw = await legacyGet<LegacyRawPage<Vehicle>>('/fms/v1/dispatcher/vehicle/pageVehicles', { pageNo: 1, pageSize: 20, query: 'AGV' })
const page = convertLegacyPage(raw) // { items, page(1起), pageSize, total, pages }

// 表格 0 基页码 → 旧 pageNo；删除末页最后一条后拉回有效页
const pageNo = toLegacyPageNo(tablePageIndex)          // 0→1
const safePage = clampToValidPage(requestedPage, total, pageSize)

// 写操作：POST/PUT 与旧契约一致（旧删除也是 POST，不改方法）
await legacyPost('/fms/v1/dispatcher/vehicle/deleteVehicle', { vehicleKey: 'AGV-01' })
```

- **路径**：以 `/fms`、`/rcsFlow` 开头原样请求（实例 baseURL 为空，绝不前置 `/api/v1`；dev 由 vite 代理、生产由网关路由）。地址拼写保留源样（如 `getSites`、`pageAGVNodeMapping`，见 SPEC 附录B.1）。
- **超时**：JSON 默认 15 秒（`LEGACY_JSON_TIMEOUT_MS`），下载默认 60 秒（`LEGACY_DOWNLOAD_TIMEOUT_MS`）；均可在 options 覆盖。旧系统实际为 1 小时不超时，若真实环境导出/大文件超时，按合同记录后在调用处放宽，不改全局默认。
- **头部**：`Authorization` 由 `setLegacyToken` 供给（T005 登录/恢复/失效时调用；null 则不带该头），`buildAuthorizationHeader` 保证最终只含一份 Bearer；`Accept-Language` 自动取 i18next 当前语言（T016 五语切换后自动生效），无需调用方设置。
- **凭据**：`withCredentials: true`，与旧 `withCredentials` 行为一致。

## 3. 成功与失败语义

- 成功判据集中处理：`code===200 && message==='success'`（SPEC §6.1 保留源判据）。个别实际契约不同的接口，在 service 层用 `isLegacySuccess(env, false)` 等显式偏离并记录，不在页面散落 `res.code` 判断。
- 失败统一抛 `ApiRequestError` 兼容形状的 `ApiError`：
  - 业务失败：`code='LEGACY.BIZ_FAILURE'`，`bizCode`/`bizMessage` 保留后端原文（message 已按请求语言本地化）。
  - 1000000：`code='LEGACY.SESSION_EXPIRED'`；1001000：`code='LEGACY.SOFTWARE_UNAUTHORIZED'`。两者**先发事件再抛错**。
  - 信封形状不合法（代理回退 HTML、网关错误页）：`code='LEGACY.MALFORMED_RESPONSE'`。
  - 网络不可达/HTTP 错误：复用新协议 `toApiError` 映射（`CLIENT.NETWORK_ERROR` 等）。
  - 主动取消：`code='CLIENT.CANCELLED'`；查询取消不弹错（`apiErrorMessage` 对其返回空串），写入取消的可见状态归 T011 任务控制器。
- **无重试/无重放**：本通道不存在任何自动重试、刷新重放或失败重发（SPEC §6.3）。写请求中止后：发送前中止服务端未收到（可判定未提交）；传输中中止服务端已收到（结果待确认，须核查，不得伪装成功或已撤销）。
- 错误事件：`subscribeLegacyEvents(listener)`，事件类型 `session-expired | authorization-required | request-error`（附 error/url/method）。**本层不做路由跳转、不清会话**——会话与授权编排由 T005（身份）与 T015（统一失效）消费此接口实现。页面提示层可用 `createLegacyErrorDeduper(windowMs)` 对同错误去重（默认 1.5 秒窗口）。

## 4. 分页

- 唯一映射：`records→items`、`current→page`（1 起）、`size→pageSize`、`total→total`、`pages→pages`；字段缺省有兜底（空数组/0/第1页）。
- ApexTable 0 基页码用 `toLegacyPageNo` 换算；表格 request 模式的 `data/rowCount` 再映射归 T021 表格适配，不在本合同。
- **例外**：任务详情 `missionPage` 与订单主记录分页形状不同，由 T070/T066 分别映射，不得复用 `convertLegacyPage`（SPEC §6.1/附录B.1）。
- 页码回正是**调用方职责**：删除末页最后一条、total 变化后用 `clampToValidPage` 修正；筛选变化回第一页（T010 查询控制器负责编排）。

## 5. ID 与行身份

- 行身份一律 `toRowId` 规范化为字符串；**禁止 `Number(id)`/`parseInt` 往返**。字符串 ID 原样保留（已验证 9007199254740993）。
- 已证实的限制：若后端以裸数字下发超过 2^53 的 ID，浏览器 `JSON.parse` 阶段即丢精度（9007199254740993→…992），前端无法挽回。真实后端 ID 下发类型须在 T090 环境核对；发现裸数字大整数 ID 属合同阻塞，登记后处理（如要求后端改字符串），不得静默截断。

## 6. 二进制下载

- `downloadBinary(url, { method?, params?, data?, signal?, timeoutMs? })` → `{ blob, filename, contentType, status }`。与 JSON 同一 Authorization 头；**需要鉴权头的接口不得改裸 a 链接，不得把 token 放 URL**（SPEC §10.2）。
- 文件名：`filename` 已按 RFC 5987 `filename*=` 优先、普通 `filename=` 兜底解析；空串时调用方回退默认名。移交浏览器后只提示“已开始下载”，不提示“已完成”。
- JSON 业务错误伪装成二进制（含 content-type 误标 octet-stream）会被嗅探并抛业务错误，**调用方拿不到 blob，不会保存损坏文件**。
- 内存限制：blob 全量读入内存，无流式；大文件优先走可原生移交的 GET。
- `nativeDownload(url, params)`：仅限**不需要 Authorization 头**的 GET（同源 Cookie 自动携带，已验证请求无该头）；触发即返回，前端无法感知完成/失败，也不能取消。数据库备份下载（T077）等 GET 原生接口按此评估。
- 已知旧实现差异：旧 `api/index.ts` 残留同 URL 的 POST 备份下载封装，按 SPEC §10.2 以有效页面的 GET 契约为准，不复制 POST 封装。

## 7. 隔离验证已覆盖 / 待真实环境核验

已覆盖（`evidence/T003/`，mock 旧后端 + 页面加载真实模块）：成功/业务失败/认证/授权/形状守卫事件、分页映射、大整数 ID、下载成功（RFC5987 中文文件名）、两类文件型错误、写请求发送前/传输中止不重放（服务端计数）、头部注入与原生移交。

待真实环境核验（不阻塞开发，归属见括号）：真实鉴权头形态与 token 是否已含 Bearer（T005 登录合同确认后回填）、CORS/同源 Cookie 行为、真实 Content-Disposition 形态与编码、最大文件与内存边界（T090/T096）、网关下路径与状态码（T106）、ID 下发类型（T090）。
