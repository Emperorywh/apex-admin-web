/**
 * 认证六接口（规格 §6.3）：login/refresh/logout/profile(GET/PUT)/password(PUT)。
 * 每个函数显式声明入参与 Promise<T> 返回类型，经封装的 request<T>() 完成类型解包；
 * login/refresh/logout 固定 skipAuthRefresh（规格 §6.2），不能触发 401 刷新流程。
 * 跨切片会话编排（epoch、清理、导航意图）见 auth.session.ts，不在本文件重复。
 */
import { AUTH_ENDPOINTS } from '@/constants/auth/auth.constants'
import { PROFILE_ENDPOINTS } from '@/constants/profile/profile.constants'
import { GLOBAL_REQUEST_SCOPE } from '@/constants/request.constants'
import { request } from '@/services/request/request'
import type { User } from '@/types/system/user/user.types'
import type {
  ChangePasswordRequestDto,
  GetProfileResponseDto,
  LoginRequestDto,
  LoginResponseDto,
  LogoutRequestDto,
  RefreshTokensRequestDto,
  RefreshTokensResponseDto,
  UpdateProfileRequestDto,
} from './auth.service.types'

/**
 * 登录：POST /auth/login。
 * silent 由登录表单自行呈现错误（如 AUTH_INVALID_CREDENTIALS 行内提示），避免全局提示重复；
 * skipAuthHeader 关闭旧 token 认证头（规格 §7.4-2）。
 */
export function login(dto: LoginRequestDto): Promise<LoginResponseDto> {
  return request<LoginResponseDto>({
    url: AUTH_ENDPOINTS.LOGIN,
    method: 'post',
    data: dto,
    skipAuthRefresh: true,
    skipAuthHeader: true,
    silent: true,
  })
}

/**
 * 刷新双 token：POST /auth/refresh。
 * 请求运行时内部的 401 刷新单飞使用专用实例（规格 §6.2）；本函数是 §6.3 接口契约的
 * 业务入口，供需要显式刷新的调用方与 demo adapter 复用。
 */
export function refreshTokens(dto: RefreshTokensRequestDto): Promise<RefreshTokensResponseDto> {
  return request<RefreshTokensResponseDto>({
    url: AUTH_ENDPOINTS.REFRESH,
    method: 'post',
    data: dto,
    skipAuthRefresh: true,
    skipAuthHeader: true,
    silent: true,
  })
}

/**
 * 登出：POST /auth/logout。固定 skipAuthRefresh（规格 §6.2）；
 * silent：登出结果的本地清理由会话编排的 finally 保证，失败不弹全局提示。
 */
export function logout(dto: LogoutRequestDto): Promise<null> {
  return request<null>({
    url: AUTH_ENDPOINTS.LOGOUT,
    method: 'post',
    data: dto,
    skipAuthRefresh: true,
    silent: true,
  })
}

/**
 * 获取当前会话 profile：GET /auth/profile。
 * guard/profile 初始化请求固定 silent（规格 §7.2），错误由路由错误页呈现；
 * 全局作用域使其不被页签生命周期取消（规格 §7.4-6）。
 */
export function getProfile(): Promise<GetProfileResponseDto> {
  return request<GetProfileResponseDto>({
    url: PROFILE_ENDPOINTS.GET_PROFILE,
    method: 'get',
    silent: true,
    scopeId: GLOBAL_REQUEST_SCOPE,
  })
}

/** 编辑个人资料：PUT /auth/profile（body 契约见规格 §14.3） */
export function updateProfile(dto: UpdateProfileRequestDto): Promise<User> {
  return request<User>({
    url: PROFILE_ENDPOINTS.UPDATE_PROFILE,
    method: 'put',
    data: dto,
  })
}

/** 修改密码：PUT /auth/password；新旧密码策略由表单校验（规格 §14.3） */
export function changePassword(dto: ChangePasswordRequestDto): Promise<null> {
  return request<null>({
    url: PROFILE_ENDPOINTS.CHANGE_PASSWORD,
    method: 'put',
    data: dto,
  })
}
