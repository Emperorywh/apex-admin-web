/**
 * 软件授权/许可证信息服务（T018，P02 授权页与 P29 软件信息页共用，
 * TASKS §5：`system-involve/software-information` 域唯一实现责任卡）。
 *
 * - getHardwareInfo：GET /fms/v1/auth/license/getHardwareInfo（信封 data 为
 *   硬件码字符串；P02 展示与复制，供用户向管理员换取激活码）；
 * - getLicense：POST /fms/v1/auth/license/getLicense（无请求体；返回完整
 *   许可证信息，P29 查询与激活成功后刷新共用）；
 * - softwareActivation：POST /fms/v1/auth/license/softwareActivation；
 *   属真实写入——两处调用都必须经 T011 写入任务控制器（submitWriteTask），
 *   由页面传入任务 signal 实现停等/待确认语义，本服务不自行重试不重发。
 *
 * 错误语义（T003 合同）：信封失败（如无效激活码返回 1001020「激活失败」）
 * 抛 ApiError，bizMessage 保留后端原文供页面提示；1001000/1000000 由请求层
 * 事件桥收敛为授权挂起/会话失效（invalidation-orchestration 合同）。
 */

import { legacyGet, legacyPost } from '@/services/request/legacy/legacyRequest'
import type { LegacyRequestOptions } from '@/services/request/legacy/legacy.types'
import type {
  LicenseInfoRecord,
  SoftwareActivationParams,
} from '@/services/system-involve/software-information/software-information.service.types'

/** 硬件码查询地址（SPEC 附录B：getHardwareInfo） */
const GET_HARDWARE_INFO_URL = '/fms/v1/auth/license/getHardwareInfo'
/** 许可证信息查询地址（SPEC 附录B：getLicense，源即 POST 无请求体） */
const GET_LICENSE_URL = '/fms/v1/auth/license/getLicense'
/** 软件激活地址（SPEC 附录B：softwareActivation） */
const SOFTWARE_ACTIVATION_URL = '/fms/v1/auth/license/softwareActivation'

/**
 * 查询本机硬件码（信封 data 为字符串；空串按源行为展示为「—」）。
 * 失败原样抛 ApiError，由调用方提示。
 */
export function getHardwareInfo(options?: LegacyRequestOptions): Promise<string> {
  return legacyGet<string>(GET_HARDWARE_INFO_URL, undefined, options)
}

/**
 * 查询许可证信息（P29 页面查询 + 激活成功后刷新共用同一入口）。
 * 失败原样抛 ApiError；信封成功但 data 为空时按无许可处理由页面回退空态。
 */
export function getLicense(options?: LegacyRequestOptions): Promise<LicenseInfoRecord> {
  return legacyPost<LicenseInfoRecord>(GET_LICENSE_URL, undefined, options)
}

/**
 * 提交软件激活（真实写入）。必须由写入任务执行器调用并透传 ctx.signal；
 * 明确成功时信封 data 通常为 null，调用方以「信封成功」为准推进后处理。
 */
export function softwareActivation(
  params: SoftwareActivationParams,
  options?: LegacyRequestOptions,
): Promise<unknown> {
  return legacyPost<unknown>(SOFTWARE_ACTIVATION_URL, { activationCode: params.activationCode }, options)
}
