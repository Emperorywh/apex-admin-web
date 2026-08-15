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
 * 登录传输扩展（规格 §13.2）：由演示模式运行时在启动时注册，off 构建不注册。
 * 本模块保持 demo 无关：只定义扩展点契约，不感知 demo adapter 的存在。
 */
export interface LoginTransportExtension {
  /**
   * 真实通道登录成功后调用：把 store 的 sessionSource 归一为实际承载通道。
   * force 模式下该请求实际由 demo adapter 承载，来源归一为 demo；
   * fallback 模式下若登录请求发起时来源已是 demo（重登/残留的 demo 会话，
   * 请求由 demo adapter 承载）则保持 demo，否则归一 real（清除失败尝试残留的 demo 标记）。
   */
  normalizeSourceAfterRealLogin(): void
  /**
   * 真实通道登录失败后调用：仅网络级失败且演示模式允许时切换 demo 来源并重放一次登录。
   * 返回重放结果；返回 null 表示不接管（业务错误/取消/未启用），由调用方上抛原错误；
   * 重放自身失败时实现方须恢复切换前来源并上抛重放错误，未登录状态不得残留 demo 标记。
   */
  replayViaDemoAfterNetworkFailure(dto: LoginRequestDto, error: unknown): Promise<LoginResponseDto | null>
}

let loginTransportExtension: LoginTransportExtension | null = null

/** 注册/清空登录传输扩展；演示模式运行时（src/demo/demoRuntime.ts）唯一调用方 */
export function registerLoginTransportExtension(extension: LoginTransportExtension | null): void {
  loginTransportExtension = extension
}

/**
 * 真实传输通道的原始登录请求：POST /auth/login。
 * 登录编排（login）与 demo fallback 重放共用；本身不感知演示模式，不含 fallback 逻辑。
 */
export function loginViaTransport(dto: LoginRequestDto): Promise<LoginResponseDto> {
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
 * 登录：POST /auth/login（规格 §6.3/§13.2）。
 * silent 由登录表单自行呈现错误（如 AUTH_INVALID_CREDENTIALS 行内提示），避免全局提示重复；
 * skipAuthHeader 关闭旧 token 认证头（规格 §7.4-2）。
 * 登录 API 服务负责 fallback：真实 adapter 网络级失败后经注册的扩展切换 demo 来源并重放一次；
 * 业务错误不切换。未注册扩展（off 构建/测试）时保持纯真实通道。
 */
export async function login(dto: LoginRequestDto): Promise<LoginResponseDto> {
  try {
    const result = await loginViaTransport(dto)
    loginTransportExtension?.normalizeSourceAfterRealLogin()
    return result
  } catch (error) {
    const extension = loginTransportExtension
    if (extension === null) {
      throw error
    }
    const replayed = await extension.replayViaDemoAfterNetworkFailure(dto, error)
    if (replayed === null) {
      throw error
    }
    return replayed
  }
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

/**
 * 个人中心写操作可调选项（规格 §7.4-3）：
 * 资料与密码表单自行呈现错误（字段映射或页面级）的调用方传 silent: true 关闭全局提示，
 * 避免同一错误既弹全局提示又在表单内重复出现；默认走全局统一提示。
 */
export interface ProfileWriteOptions {
  silent?: boolean
}

/** 编辑个人资料：PUT /auth/profile（body 契约见规格 §14.3） */
export function updateProfile(dto: UpdateProfileRequestDto, options: ProfileWriteOptions = {}): Promise<User> {
  return request<User>({
    url: PROFILE_ENDPOINTS.UPDATE_PROFILE,
    method: 'put',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}

/** 修改密码：PUT /auth/password；新旧密码策略由表单校验（规格 §14.3） */
export function changePassword(dto: ChangePasswordRequestDto, options: ProfileWriteOptions = {}): Promise<null> {
  return request<null>({
    url: PROFILE_ENDPOINTS.CHANGE_PASSWORD,
    method: 'put',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}
