/**
 * 软件授权服务（P02；P29 软件信息页复用同一服务）。
 *
 * 契约（OpenAPI「软件授权控制」tag，2026-09-18 逐一核对 + 真实环境实证）：
 * - GET /fms/v1/auth/license/getHardwareInfo（ResultString）：
 *   返回服务器硬件码字符串；真实环境 GET code=200 实证可用，且不要求认证
 *   （未激活/未登录均可读取，授权页作为登录落点时必须可用）。
 * - POST /fms/v1/auth/license/softwareActivation（请求 SoftwareActivationCode，
 *   响应 ResultVoid）：提交激活码；写操作不做自动重试（规格 4.2 重试行），
 *   结果以业务 code=200 判定，失败由请求层抛 ApiError。
 *
 * 两个 operation 在 OpenAPI 中 security 均为 None：认证头由请求层按会话
 * 统一携带（有令牌则带），本服务不手工拼装认证信息。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type { SoftwareActivationCodeDto } from '@/services/license-activation/license.service.types'

/**
 * 读取服务器硬件码（P02 授权页展示 + 一键复制；P29 授权信息页可复用）。
 * 失败由请求层抛出 ApiError，调用方按失败呈现（不清空成空串冒充成功）。
 */
export async function fetchHardwareInfo(options?: RequestOptions): Promise<string> {
  return api.get<string>('/auth/license/getHardwareInfo', { signal: options?.signal })
}

/**
 * 提交软件激活（副作用写操作）：成功即后端已确认激活（code=200）。
 * 激活码参数不做格式校验改写——后端是唯一校验方，前端仅做非空拦截。
 */
export async function activateSoftware(activationCode: string, options?: RequestOptions): Promise<void> {
  const payload: SoftwareActivationCodeDto = { activationCode }
  await api.post<void>('/auth/license/softwareActivation', payload, { signal: options?.signal })
}
