/**
 * 软件授权服务的 DTO 定义（OpenAPI「软件授权控制」tag，operation 已逐一核对）。
 */

/**
 * 软件激活请求体（OpenAPI schema: SoftwareActivationCode）。
 * POST /fms/v1/auth/license/softwareActivation 的 application/json 请求体；
 * 激活码由用户从管理员处获取后原样提交，前端不做格式改写。
 */
export interface SoftwareActivationCodeDto {
  /** 激活码 */
  activationCode: string
}

/**
 * 授权证明记录（OpenAPI getLicense 响应 data；旧 LicenseProofRecord 等价迁移）。
 * POST /fms/v1/auth/license/getLicense：当前系统授权信息。展示层按可缺失防御
 * （缺失留白/未知，不冒充有效值）；时间字段为后端墙钟字符串（部署时区语义，
 * 经 datetimeDisplay 单点解析），真实形态以 P29 联验为准。
 */
export interface LicenseProofDto {
  /** 硬件信息原文（多行文本） */
  hardwareInfo: string
  /** 授权最大 AGV 数量 */
  agvNumber: number
  /** 激活日期 */
  issueDate: string
  /** 过期日期 */
  expirationDate: string
  /** 激活码原文 */
  activationCode: string
}
