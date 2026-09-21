/**
 * P02 audit 第三次复核 acceptance.json 生成脚本（run run-c7d53b59）。
 * 基于第二轮记录逐项更新：复核口径、本轮证据路径、24 文件哈希重绑 @ 59b5434。
 */
const fs = require('fs')
const dir = 'docs/migration/evidence/P02/run-c7d53b59-d130-42e0-81df-7766f8c5b242'
const prevDir = 'docs/migration/evidence/P02/run-9fc8d28e-f5a1-4c48-8d7f-cbb16250663e'
const prev = JSON.parse(fs.readFileSync(prevDir + '/acceptance.json', 'utf8'))
const codeFiles = JSON.parse(fs.readFileSync(dir + '/code-files.json', 'utf8')).files
const R = dir + '/'
const RO = R + 'p02-audit3-readonly-result.json'
const B = R + 'browser-ui-result.json'
const SHOT = R + 'screenshots/p02-audit3-en-authorize.png'
const P41EV = 'docs/migration/evidence/P41/run-311a079a-4480-4296-86fe-7508d21a26cb/acceptance.json'

const rec = structuredClone(prev)
rec.auditRound = '第三次复核（基线 26c94cc→59b5434，期间唯一代码变更为 57ce7ba P41-audit-1 修复 routeAccess.ts +5 行）'
rec.codeCommit = '59b5434dbc8e46369b5677a9ea1144ec576f80fe'
rec.releaseChecks = { scope: 'passed', static: 'passed', readOnly: 'passed', ui: 'passed', sharedConsumers: 'passed' }
rec.releaseReasons = {
  static: '本轮未重复全量检查——P41 audit 因 57ce7ba 变更 routeAccess.ts 已重跑 pnpm check+build 全量复绿（lint 547 文件 0/0+structure 529+build 1.39s），其后 daeb4be/a0a1071/59b5434 三个 docs 提交（git diff 57ce7ba..59b5434 证实 src/、package.json、pnpm-lock.yaml、vite.config.ts 零变化），结果直接适用当前基线',
  ui: '本轮针对性复测 8 项（routeAccess 修复后授权页回跳敏感项+登出清理+落点回归），经本机 dev server 同源代理（5173 用户既有运行未接管）→ 192.168.0.158:8888 已激活后端；license-activation 受检 13 文件哈希与上轮一致（零变更），第二轮 1366/1920 双视口整页、五语言全页、激活失败注入证据继续有效；IAB 输入管线冻结经合成 pointer 序列完成提交类操作（边界登记于 browser-ui-result.json），真实指针复核归 V01',
  sharedConsumers: 'license-activation 服务与 ActivationForm 的消费者 P29 已于 P29 轮带令牌联验复用契约；request.ts/request.constants.ts/authSlice/App.tsx/common×4/definitions.tsx/i18n.ts 本轮哈希与上轮一致（零变更）；唯一变更 routeAccess.ts 逐 hunk 从 P02 视角审查：新增拒绝仅精确匹配 /no-permission（ROUTE_PATHS 常量），授权页 perm 未声明经 hasMenuAccess 登录即可达、resolveSafeRedirectPath 回跳链路（findLeafByPath→isLeafAvailable）零改动、resolveLandingPath activated=false→授权页落点分支（规格 5.6/D29）未触及，且浏览器实测 redirect=%2Fauthorize-ingress 登录回跳授权页复现（B2）'
}
rec.releaseNotes = 'audit 第三次复核：24 受检文件 23 个哈希与上轮一致、唯一变更 routeAccess.ts（57ce7ba P41-audit-1 修复）逐 hunk 从 P02 视角审查成立且浏览器实测授权页回跳未破坏；静态门禁复用 P41 audit @ 57ce7ba 复绿结果（57ce7ba..59b5434 仅 docs）；真实只读复测 5/5（getHardwareInfo 代理+直连一致 e5c6aacc、10.11.2.67 认证交换 activated=true/155 权限码、登出清理）；浏览器针对性复测 8/8（守卫/授权页回跳/硬件码一致性/复制环境限制/reload 恢复+返回登录/en-US 全元素/登出清理 persist 二次解析核验/落点回归 /dashboard）；verification=partial（A14 激活副作用、A04/I06 同 T00/P01 口径 deferred），gate=ready 维持 B1/P29 放行，不勾选 TASKS'

const byId = Object.fromEntries(rec.items.map((it) => [it.id, it]))
const setReason = (id, reason) => { byId[id].reason = reason }
const addEvidence = (id, paths) => { byId[id].evidence = [...new Set([...byId[id].evidence, ...paths])] }

setReason('TASK', 'P02 专项逐项复核三轮成立：未登录（本轮守卫实测 /login?redirect=%2Fauthorize-ingress）、会话过期（请求层 1000000 单飞，T00 实证）、软件未激活（页面定位呈现+1001000 收敛接线；10.11.2.67 连续两轮可达实测 activated=true——该目标为已激活联调后端，真实未激活环境依旧不可得）、授权失效（到期码随 P29 getLicense 复核登记）。独立授权入口≠免鉴权三轮再实测（守卫拦截+登录后合法回跳授权页——本轮在 routeAccess P41-audit-1 修复后复测复现）；激活副作用按 D32 专用环境 deferred（A14）；激活成功导航消费 resolveLandingPath（本轮无参数登录实测落点 /dashboard 主路径）。')
addEvidence('TASK', [RO, B])

setReason('DoD2', '页面零 axios/零拼 URL：license.service 单点 GET /auth/license/getHardwareInfo（ResultString，本轮两通道实测 HTTP 200+code=200 且页面渲染值与脚本值 SHA-256 一致）、POST /auth/license/softwareActivation（ResultVoid，写不自动重试）；成功判定仅业务 code=200；license.service 哈希与上轮一致（零变更）。')
addEvidence('DoD2', [RO])

setReason('DoD3', '四态分离复核成立（守卫实测本轮重放；未激活引导呈现本轮 en 语言复现 System not activated…）；10.11.2.67 连续两轮认证交换实测 activated=true——该 OpenAPI 默认联调目标为已激活环境，真实未激活环境依旧不可得，activated=false 登录落点与 1001000 真实业务触发维持 deferred 归 V01（机制两端各自实证：落点分支 T00.4、事件引导生产构建接线；本轮落点规则经 resolveLandingPath 无参数登录真实复现 /dashboard）。')
addEvidence('DoD3', [RO, B])

addEvidence('DoD6', [B])
setReason('DoD7', '失败留稿（上轮注入实测）+页面刷新恢复（本轮 reload 后硬件码重新渲染实测）；「返回登录」语义核验维持（replace 落 /login 保留会话，persist token 在位，源码注释证实非登出）；非实时页无轮询；会话数据登出即清（本轮 persist 二次解析核验 token/user=null、permissions/permissionsTree=[]）。')
addEvidence('DoD7', [B])

setReason('DoD8', '激活写入机制级实证维持（上轮 loading 防连点/失败留稿/不自动重放/code=200 唯一判定/空输入禁用——本轮空输入 disabled 态复现）；真实激活成功链路按 D32 专用环境 deferred（本轮 10.11.2.67 认证交换实测 activated=true，无法演练激活态变更，不对共享环境提交写尝试）。')
addEvidence('DoD8', [RO, B])

setReason('DoD13', '1366/1920 双视口整页验收由上轮完成且布局代码（AuthorizeIngress.module.css 等 13 个受检文件）零变更，结果继续适用；本轮 1280×720 en 授权页截图：深蓝科技风完整（网格/扫描线/四角边框/水印/辉光标题），卡片居中按钮可达无溢出；独立页固定深色为与旧系统一致的设计行为。IAB Chromium/Windows 边界如实保留，macOS/实体浏览器归 V01。')
addEvidence('DoD13', [SHOT])

setReason('DoD15', '静态门禁复用 P41 audit @ 57ce7ba 全量复绿结果（lint 547 文件 0/0+structure 529+build 1.39s；git diff 57ce7ba..59b5434 证实其后仅 docs 提交，src/package.json/pnpm-lock.yaml/vite.config.ts 零变化）；本轮补真实只读复测 5/5（getHardwareInfo 代理+直连一致、10.11.2.67 认证交换）与浏览器针对性复测 8 项；激活写副作用按规格仅专用环境（deferred 登记于 A14）；未新增单元测试。')
byId.DoD15.evidence = [P41EV, RO, B]

setReason('DoD16', 'P02 范围零 mock/console/debugger 残留（上轮 grep 实证+本轮受检文件哈希一致）；交接记录按第三次复核口径更新；缺口/限制/deferred 如实登记于本记录与 RUN_STATE pendingItems。')

setReason('A03', '真登录为 P01 owner（P01 第三次复核 passed，同基线）；P02 消费同一会话：本轮 en 登录成功反馈实测（登录成功 toast/Sign in 按钮真实提交→回跳授权页），无伪管理员。')
addEvidence('A03', [B])

setReason('A04', '机制级实证维持：持久化恢复（本轮授权页 reload 硬件码重渲染）、登出清理（本轮 persist 二次解析核验 token/user=null、permissions/permissionsTree=[]、activated=false+语言偏好 en-US 保留）；真实 token 过期收敛与双窗口退出同步需长会话/双窗口环境，与 T00/P01 audit 同口径登记。')
addEvidence('A04', [B])

setReason('A05', 'P02 适用面复核成立：独立授权页受认证守卫实测（本轮重放：未登录拦截保留回跳参数）；登录后站内合法回跳放行——本轮为 routeAccess P41-audit-1 修复后复测：redirect=%2Fauthorize-ingress 登录回跳授权页复现（修复仅精确拒绝 /no-permission，授权页 perm 未声明经 hasMenuAccess 登录即可达，行为不变）；无 redirect 落点规则为 /dashboard（本轮无参数 en 登录实测）；routeAccess.ts 唯一变更已逐 hunk 从 P02 视角审查。')
addEvidence('A05', ['src/router/routeAccess.ts', B])

setReason('A06', '协议：GET /fms/v1/auth/license/getHardwareInfo 本轮双通道复测（dev 代理+直连，HTTP 200+code=200，72 字符一致，SHA-256 前 8 位 e5c6aacc 与页面渲染值一致）；POST softwareActivation 按 OpenAPI（SoftwareActivationCode→ResultVoid）；另经 10.11.2.67 带令牌实测同一接口（72 字符）；Bearer/MD5 认证契约 G03 已关闭。')
byId.A06.evidence = [RO, 'src/services/license-activation/license.service.ts']

addEvidence('A10', [B])
addEvidence('A11', [B])
addEvidence('A13', [B])

setReason('A14', '激活写入机制级实证维持（防连点/失败留稿/不自动重放/code=200 唯一判定/成功后 activationConfirmed+resolveLandingPath 落点导航接线——落点函数本轮无参数登录实测 /dashboard 主路径）；失败分支零后端接触实测（上轮）。真实激活成功链路需专用未激活环境：10.11.2.67 连续两轮可达且认证交换实测 activated=true（已激活联调后端），未激活环境依旧不可得，不对共享环境提交写尝试（含无效激活码）。')
addEvidence('A14', [RO, B])

addEvidence('A20', [B])

setReason('A22', '授权页为合法站内回跳落点——本轮在 routeAccess P41-audit-1 修复后实测复现（redirect=%2Fauthorize-ingress 登录回跳授权页）；/authorize-ingress 地址无历史拼写变体；1001000 引导 SPA 导航不经整页重载（ActivationRedirectListener 哈希与上轮一致）；登录落点规则本轮按当前基线复测——/dashboard（P34 交付兑现 D29）；登出后守卫落 /login?redirect=%2Fdashboard 为既有行为（P41 瞬态观察项同款，归 V01）。')
addEvidence('A22', [B, 'src/features/license-activation/components/ActivationRedirectListener/ActivationRedirectListener.tsx'])

setReason('A23', '依赖与门禁：P41 audit @ 57ce7ba（routeAccess.ts 变更后）pnpm check+build 全量复绿；57ce7ba..59b5434 仅 docs（git diff 证实零代码变化）；官方 npm 依赖与锁文件未动；本轮零代码修改（纯复核+证据）。')
byId.A23.evidence = [P41EV]

addEvidence('I01', [B])
addEvidence('I04', [B])
addEvidence('I05', [B])
addEvidence('I08', [B])

setReason('I06', 'P02 范围内资源完整性实证维持：license-activation 四语言 12 键全齐无缺失回退（分片哈希与上轮一致）；本轮 en 正常加载路径复现。真实网络级语言资源加载失败不白屏场景与 T00/P01 同口径受 IAB 环境限制。')
byId.I06.evidence = [B]

rec.verification = 'partial'
rec.verificationNote = '3 项 deferred：A14 激活成功副作用（D32 专用环境；10.11.2.67 连续两轮可达实测已激活）、A04 长会话 token 过期/多窗口退出、I06 真实资源加载失败（后两项与 T00/P01 audit 同口径归 V01）；P02 任务范围内全部适用项 passed，零新缺陷；本轮为 routeAccess P41-audit-1 修复后 P02 视角复核（授权页回跳未破坏实测复现）'
rec.environment = {
  codeCommit: '59b5434dbc8e46369b5677a9ea1144ec576f80fe（24 受检文件 23 个哈希与上轮 26c94cc 完全一致；唯一变更 routeAccess.ts 57ce7ba P41-audit-1 修复 +5 行）',
  channel: 'Vite dev server 同源代理 http://localhost:5173（用户既有运行，未接管）→ APEX_DEV_LEGACY_TARGET',
  backend: '192.168.0.158:8888（已激活联调后端，浏览器 UI+只读对照）；10.11.2.67:8888（连续两轮可达，认证交换实测 activated=true/155 权限码，登出清理完成）',
  credentials: '本机 .env.local（APEX_TEST_USERNAME/APEX_TEST_PASSWORD，来源名称记录、值不入档）；硬件码 72 字符真实值不入档（仅长度+SHA-256 前 8 位 e5c6aacc）',
  browser: 'ZCode IAB（Chromium 内核，Windows 11），视口 1280×720（针对性抽验；1366/1920 双视口由上轮覆盖）',
  roles: 'root（已激活后端）；普通用户/未激活分支受环境限制同 T00 登记',
  languages: '本轮 en-US 切换全链路+授权页 en 渲染实测（截图本地留存）；zh-TW/ja-JP/ko-KR 全页由上轮维持（分片零变更）',
  themes: '独立页固定深色为与旧系统一致的设计行为；外壳双主题归 P01/全局验收',
  sideEffects: '零业务写接触：登录/登出为认证交换（两个后端各自完成，测试会话均已清理）；10.11.2.67 探测仅登录→getHardwareInfo→登出；未对任何环境提交激活码写尝试',
  syntheticPathNotes: 'IAB 输入管线冻结（与 P01/P02 第二轮同现象）：提交类点击经 evaluate 派发 pointer 序列垫片完成，不能证明真实指针交互，真实指针自然浏览器复核归 V01；剪贴板管线在合成事件下双路失败（Clipboard API NotAllowedError+execCommand false，诊断垫片实测）——复制成功提示按组件设计不出现（成功才提示），组件零变更且上轮已实测读回一致；persist 字段双层 JSON 序列化，token 清空判定须二次 parse（Boolean("null") 假阳性已修正并登记）'
}
rec.codeFiles = codeFiles

fs.writeFileSync(dir + '/acceptance.json', JSON.stringify(rec, null, 2))
console.log('acceptance.json written:', rec.items.length, 'items,', rec.codeFiles.length, 'files')
