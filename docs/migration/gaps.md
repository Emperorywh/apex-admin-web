# 接口缺口与契约待核实台账

> 状态取值：`待确认 / 已确认缺失 / 已确认替代 / 已验证可用 / 本期暂缓`。
> 本表由 T00 按规格第 13 章初始化（2026-09-17，运行 run-20260917-121624-7468），全部为「待确认」——规格中的发现是勘察事实，不代表已完成后端验证。
> 关闭任何缺口必须附请求证据与验证日期；页面任务在自己的 `tasks/<ID>.md` 登记本页涉及的具体缺口证据，统筹者汇总到这里。

| 编号 | 发现 / 证据 | 影响页面 | 状态 | 本期处理 | 决定 / 验证日期 |
| --- | --- | --- | --- | --- | --- |
| G01 | 旧 `GET /fms/v1/auth/authorize/detail` 未出现在 OpenAPI | 会话恢复与权限更新（T00、P01；P31/P32/P43 不得调用） | 已确认缺失 | 登录返回数据持久化；权限拒绝后提示重新登录；不调用未文档化接口。T00.3 已移除模板 `/users/me` 会话恢复路径（profile.service 已删除） | 2026-09-17（OpenAPI 复核 + 模板调用点清理） |
| G02 | 文档没有模板 `/auth/refresh`、`/users/me` 协议（模板 auth.service 现存调用） | 模板认证基础设施（T00、P43） | 已确认缺失 | T00.3 已删除：请求层刷新重放/`_retriedAfterRefresh` 全部移除，`loadSession`/`getMyProfile`/`updateMyProfile` 删除；会话过期（业务码 1000000）直接清会话重新登录 | 2026-09-17 |
| G03 | 文档无 securitySchemes；`LoginParam.password` 未说明 MD5，旧登录使用 MD5 + Bearer | 登录及全局认证头（T00、P01/P02/P29） | 已验证可用 | 2026-09-18 真实凭据联验关闭：① MD5 确认为必需形态——MD5(root) 登录 `code=200` 返回完整 UserAuth，明文密码同账号返回 `1000010`；② Bearer 确认被识别——带令牌业务接口返回 `1001000`（进入激活检查），无令牌返回 `1000000`（未登录），令牌前缀形态正确；③ `1001000` 真实语义=`系统没有被激活`（软件授权状态，与登录态/权限无关），跳软件授权入口方向确认（UI 跳转归 P02）；④ 登录返回 UserAuth 六字段与前端 DTO 完全一致（token/activated/user/roles/permissions/permissionsTree，permissionsTree 树形带 childPermissions）；⑤ root 真实身份：id=2、level=2、state=ENABLED、roles=[test,user,test001]、155 个权限码。`request.constants.ts` 注释已同步实证结论 | 2026-09-18（真实登录成功/MD5-明文对照/Bearer-无令牌对照） |
| G04 | 多个 GET 参数以对象 DTO 声明（如 `OrderRecordPageParamOrderRecord`） | 全部列表筛选分页 | 待确认 | 逐 endpoint 验证 query 序列化，记录差异，不统一猜扁平/对象。T00.3 已定义 `BackendPageQuery`（pageNo/pageSize）与 `BackendPageResult`（records/current/size/total/pages）为常见形状基准；分页响应真实形状尚未抽样核实 | — |
| G05 | `uploadSystemVersion` 等上传在文档表现为 `application/json` 内 binary 字段 | P08/P09/P25/P27（P23 若有可达上传同样核实） | 待确认 | 核实 multipart/字段名/媒体类型后适配；不假定所有上传同一种方式 | — |
| G06 | 旧电梯内呼 `/fms/v1/device/elevator/innerCall` 未出现在 OpenAPI，且控制弹窗可达 | P14 | 待确认 | 保留有权限入口并标记接口暂不可用；不用外呼接口猜测替代 | — |
| G07 | 旧地图拉取 `downloadMapInfo` 未出现在 OpenAPI，MapList/PullModal 引用它 | P09 | 待确认 | 可达入口保留禁用说明；`downloadMap`/`vehicleDownloadMap` 不自动认定语义相同 | — |
| G08 | 旧 API 清单含 `upLoadMap/updateMapResource`、旧版本分页/更新重启等未声明路径 | P09、P25 | 待确认 | 先核对当前可达性，再逐条确认新版接口替代，逐项登记而非整批照搬 | — |
| G09 | 多数分页 DTO 未声明排序参数 | 全部表格页 | 待确认 | 不支持的列禁用排序或仅在完整本地集合明确实现；不发虚构 sort | — |
| G10 | int64 ID 与计数字段，实际规模未验证 | 行标识、关联选择、精确计数（全部相关页） | 待确认 | 联调核实精度；禁止损失精度后转字符串掩盖问题。T00.3：登录返回的 `UserSummary.id`（int64）在 DTO 层保持 JSON number、实体层以字符串无损承载，联调时需抽样核对真实 id 规模 | — |
| G11 | 普通文件接口未必有进度、取消、断点续传契约 | P03/P08/P09/P23/P25/P26/P27/P30 | 待确认 | 仅真实或不确定进度；取消不等于服务端回滚 | — |
| G12 | 模板个人资料、菜单、角色/用户 REST DTO 与调度 DTO 不同 | P31/P32/P43（P27 不虚构设置 CRUD） | 待确认 | 以调度 API 为准；无对应能力的入口注明缺口，不留假数据 | — |
| G13 | 缺少已核实的事务、版本号和幂等键支持 | 全部写操作页 | 待确认 | 预读冲突检查、结果未知态、禁止自动重放；不承诺强一致事务 | — |
| G14 | 旧全局 WebSocket 地址属于调度监控，OpenAPI 不含对应消息契约 | H01 及需实时能力的页面 | 待确认 | 优先已声明 HTTP 查询；确有依赖再登记独立契约，不复制硬编码 ws 地址 | — |
| G15 | 时区、某些统计公式/空值语义和状态集合待与真实数据核对 | P21/P28/P29/P33–P37/P40 | 待确认 | 部署配置时区（缺省 Asia/Shanghai）；缺失显示不可计算；公式验证后才能验收 | — |
| G16 | 目标 `check:structure` 脚本缺失（2026-09-17 实测 `pnpm check` 失败）；README 视觉指南 `docs/macos_ui_ux_design_guide_v3.md` 全仓库确认不存在（T00.1 曾误记「文件现存」，已勘误） | 质量门禁与设计依据（T00、V01） | 已验证可用 | T00.2 已落地 `scripts/check-structure.mjs`（禁 index.tsx、别名/相对导入、导入方向、硬编码主机门禁，违规注入自测可抓）；README/CLAUDE.md 失效引用改为「以现有布局/token 为视觉基线」 | 2026-09-17 |

## 新增缺口登记

（新缺口从 G17 起编号，由统筹者汇总；页面任务先在自己的记录中登记，避免并行改本表冲突。）

| 编号 | 发现 / 证据 | 影响页面 | 状态 | 处理 | 决定 / 验证日期 |
| --- | --- | --- | --- | --- | --- |
| G17 | 联调服务器（10.11.2.67:8888）软件未激活：2026-09-18 真实登录返回 `activated:false`，root 带有效令牌访问业务接口（pageUsers 实测）返回 `1001000 系统没有被激活`，公开接口（systemLogos、getHardwareInfo 无令牌）不受影响 | T00 放行证据残留项（带令牌业务只读）、B2 样板门禁真实只读联验、P02 激活流程、全部 B2+ 页面的真实接口联验 | 待确认（外部条件） | 软件激活（softwareActivation）属副作用操作，按规格不自动执行，须用户在专用环境或现场完成；激活后前端无需改动（1001000 语义与跳转方向已确认）。解除条件：用户激活联调环境或提供已激活后端。T00 因此保持不勾选（放行证据「授权只读可用」未取得），队列停在 T00 | 2026-09-18（登记） |
