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
