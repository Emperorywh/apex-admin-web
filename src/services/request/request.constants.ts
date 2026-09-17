/**
 * 请求基础设施常量：超时、调度协议业务码、前端本地错误码。
 */

/**
 * API 基础路径默认值（迁移规格 4.4 节 D31）：
 * - 调度系统后端统一前缀为 /fms/v1，所有业务 service 只拼相对 endpoint，
 *   最终请求路径形如 /fms/v1/dispatcher/...；
 * - dev 环境经 Vite 同源代理把 /fms 原样转发到联调服务器（不做 rewrite）；
 * - 生产环境由同源反向代理转发 /fms；
 * - 仅在部署拓扑变化时可经 VITE_API_BASE_URL 覆盖，业务代码不得硬编码主机/IP/协议。
 */
export const DEFAULT_API_BASE_URL = '/fms/v1'

/** 常规请求超时（毫秒） */
export const REQUEST_TIMEOUT_MS = 15_000

/**
 * 调度协议业务码（Result.code）。
 *
 * 证据来源（2026-09-17 真实联调环境实测 + 旧项目代码；联调地址见 vite.config.ts 代理配置）：
 * - code=200：正常（GET /fms/v1/systemLogos 返回 {code:200,...} 实证）；
 * - code=1000000：会话失效/未登录（旧项目 httpShared BIZ_CODE.TOKEN_EXPIRED；
 *   真实环境无凭据访问 GET /fms/v1/auth/user/pageUsers 返回该码，已复核）；
 * - code=1000010：用户名或密码错误（真实环境错误凭据登录实测）；
 * - code=1001000：未授权（旧项目 httpShared BIZ_CODE.UNAUTHORIZED 代码证据，
 *   真实环境尚未复现，最终映射登记缺口 G03，授权页跳转由 P02 接入）。
 */
export const RESULT_CODES = {
  /** 业务成功；不依赖 message === 'success' 字符串 */
  SUCCESS: 200,
  /** 会话失效（未登录/token 过期）：清会话并跳登录，单飞收敛 */
  SESSION_EXPIRED: 1_000_000,
  /** 未授权：跳软件授权页（旧代码证据，待真实复核；跳转逻辑归 P02） */
  UNAUTHORIZED: 1_001_000,
  /** 用户名或密码错误 */
  LOGIN_FAILED: 1_000_010,
} as const

/** 未显式指定 pageSize 时的默认页大小（前后端通用默认值） */
export const DEFAULT_PAGE_SIZE = 20

/** 前端本地生成的稳定错误码（后端不会返回），CLIENT.* 点分格式 */
export const CLIENT_ERROR_CODES = {
  /** 网络不可达 / 请求被拦截 */
  NETWORK_ERROR: 'CLIENT.NETWORK_ERROR',
  /** 主动取消（切换页签、刷新页签等） */
  CANCELLED: 'CLIENT.CANCELLED',
  /** 响应体不符合调度协议 Result 形状 */
  MALFORMED_RESPONSE: 'CLIENT.MALFORMED_RESPONSE',
  /** 未知后端错误（无法归类） */
  UNKNOWN: 'CLIENT.UNKNOWN',
} as const
