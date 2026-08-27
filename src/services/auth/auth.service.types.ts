/**
 * 认证域请求/响应 DTO。
 */

export interface LoginRequestDto {
  username: string
  password: string
}

export interface LoginResponseDto {
  accessToken: string
  tokenType: string
}

export interface RefreshResponseDto {
  accessToken: string
  tokenType: string
}

/** GET /users/me 响应 */
export interface MeResponseDto {
  id: string
  username: string
  displayName: string
  email: string | null
  roles: Array<{ code: string; name: string }>
}
