/**
 * 个人中心域请求/响应 DTO。
 */

export interface UpdateMyProfileRequestDto {
  displayName: string
  email: string | null
}
