/**
 * 认证六接口（规格 §6.3 v1.15，真实后端 apex-admin 契约，baseURL /api/v1）：
 * login/refresh/logout/profile 聚合/资料/改密。
 * 每个函数显式声明入参与 Promise<T> 返回类型，经封装的 request<T>() 完成类型解包；
 * login/refresh 固定 skipAuthRefresh + skipAuthHeader，logout 固定 skipAuthRefresh（规格 §6.2），
 * 均不能触发 401 刷新流程。refreshToken 由 __Host-apex_refresh HttpOnly Cookie 承载，
 * 刷新/登出请求由浏览器自动携带，任何 DTO 不含该字段。
 * 跨切片会话编排（epoch、清理、导航意图）见 auth.session.ts，不在本文件重复。
 */
import { SUPER_ADMIN_USERNAME } from '@/constants/auth/auth.constants'
import { GLOBAL_REQUEST_SCOPE } from '@/constants/request.constants'
import { ADMIN_ROLE_CODE } from '@/constants/system/role/role.constants'
import { request } from '@/services/request/request'
import type { User } from '@/types/system/user/user.types'
import type {
  ChangePasswordRequestDto,
  GetProfileResponseDto,
  GetUserMeResponseDto,
  GetMeMenusResponseDto,
  GetPermissionsResponseDto,
  LoginRequestDto,
  LoginResponseDto,
  LogoutResponseDto,
  MeMenuNodeDto,
  RefreshTokensResponseDto,
  UpdateProfileRequestDto,
} from './auth.service.types'

/**
 * 登录：POST /auth/login（规格 §6.3 v1.14）。
 * silent 由登录表单自行呈现错误（如 AUTH.INVALID_CREDENTIALS 行内提示），避免全局提示重复；
 * skipAuthHeader 关闭旧 token 认证头（规格 §7.4-2）。
 * 成功后 refreshToken 经 Set-Cookie 落地，响应体不包含该字段。
 */
export function login(dto: LoginRequestDto): Promise<LoginResponseDto> {
  return request<LoginResponseDto>({
    url: '/auth/login',
    method: 'post',
    data: dto,
    skipAuthRefresh: true,
    skipAuthHeader: true,
    silent: true,
  })
}

/**
 * 刷新 accessToken：POST /auth/refresh。
 * 无请求体（refreshToken Cookie 由浏览器携带）；请求运行时内部的 401 刷新单飞
 * 使用专用实例（规格 §6.2）；本函数是 §6.3 接口契约的业务入口，供需要显式刷新的调用方使用。
 */
export function refreshTokens(): Promise<RefreshTokensResponseDto> {
  return request<RefreshTokensResponseDto>({
    url: '/auth/refresh',
    method: 'post',
    skipAuthRefresh: true,
    skipAuthHeader: true,
    silent: true,
  })
}

/**
 * 登出：POST /auth/logout。认证请求（携带 Authorization），无请求体；Cookie 由浏览器携带、
 * 后端吊销当前会话并删除 Cookie。固定 skipAuthRefresh（规格 §6.2）；
 * silent：登出结果的本地清理由会话编排的 finally 保证，失败不弹全局提示。
 */
export function logout(): Promise<LogoutResponseDto> {
  return request<LogoutResponseDto>({
    url: '/auth/logout',
    method: 'post',
    skipAuthRefresh: true,
    silent: true,
  })
}

/**
 * 把后端 UserResponse 适配为前端 User 实体（v1.16 起两形状同构，直接透传；
 * department/posts 为后端可选键，缺失时收敛为 null/[]）。
 */
function toUser(dto: GetUserMeResponseDto): User {
  return {
    id: dto.id,
    username: dto.username,
    displayName: dto.displayName,
    status: dto.status,
    phone: dto.phone,
    email: dto.email,
    lastLoginAt: dto.lastLoginAt,
    passwordUpdatedAt: dto.passwordUpdatedAt,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    department: dto.department ?? null,
    posts: dto.posts ?? [],
  }
}

/**
 * 扁平化菜单树 path 白名单（规格 §6.3 v1.15）：递归收集 GET /me/menus 树的非空 path
 * 原始值；与静态路由全路径的规范化比对统一在菜单过滤处进行，此处不做格式加工。
 */
function collectMenuPaths(nodes: readonly MeMenuNodeDto[]): string[] {
  const paths: string[] = []
  const visit = (node: MeMenuNodeDto): void => {
    if (node.path !== null && node.path !== '') {
      paths.push(node.path)
    }
    for (const child of node.children ?? []) {
      visit(child)
    }
  }
  for (const node of nodes) {
    visit(node)
  }
  return paths
}

/**
 * 拉取当前会话 profile 聚合：GET /users/me + GET /me/menus + GET /me/permissions（规格 §6.3 v1.15）。
 * guard/profile 初始化请求固定 silent（规格 §7.2），错误由路由错误页呈现；
 * 全局作用域使其不被页签生命周期取消（规格 §7.4-6）。
 * username 为 admin 的超管用户由前端补齐超管体验（规格 §5.1 v1.15）：roleCodes 注入
 * admin（通配语义）、menuPaths 固定 null 不受菜单树限制——后端 /me 端点按启用角色聚合，
 * admin 无角色时返回空集合；后端仍逐接口鉴权。
 */
export async function getProfile(): Promise<GetProfileResponseDto> {
  const [me, menus, permissions] = await Promise.all([
    request<GetUserMeResponseDto>({
      url: '/users/me',
      method: 'get',
      silent: true,
      scopeId: GLOBAL_REQUEST_SCOPE,
    }),
    request<GetMeMenusResponseDto>({
      url: '/me/menus',
      method: 'get',
      silent: true,
      scopeId: GLOBAL_REQUEST_SCOPE,
    }),
    request<GetPermissionsResponseDto>({
      url: '/me/permissions',
      method: 'get',
      silent: true,
      scopeId: GLOBAL_REQUEST_SCOPE,
    }),
  ])
  const isSuperAdmin = me.username === SUPER_ADMIN_USERNAME
  return {
    user: toUser(me),
    // 普通用户后端无当前用户角色码自助接口（规格 §5.1），roleCodes 固定空数组；
    // 超管注入 admin 角色码复用 §4.4 通配语义
    roleCodes: isSuperAdmin ? [ADMIN_ROLE_CODE] : [],
    permCodes: permissions.permissions,
    // 超管直接展示全部菜单（不受后端菜单树限制，规格 §4.4 v1.15）
    menuPaths: isSuperAdmin ? null : collectMenuPaths(menus),
  }
}

/**
 * 个人中心写操作可调选项（规格 §7.4-3）：
 * 资料与密码表单自行呈现错误（字段映射或页面级）的调用方传 silent: true 关闭全局提示，
 * 避免同一错误既弹全局提示又在表单内重复出现；默认走全局统一提示。
 */
export interface ProfileWriteOptions {
  silent?: boolean
}

/** 编辑个人资料：PUT /users/me（body 契约见规格 §14.3/§6.3 v1.14；响应 UserResponse 适配为 User） */
export function updateProfile(dto: UpdateProfileRequestDto, options: ProfileWriteOptions = {}): Promise<User> {
  return request<GetUserMeResponseDto>({
    url: '/users/me',
    method: 'put',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  }).then(toUser)
}

/** 修改密码：PUT /users/me/password（响应 204 空体解包为 null）；新旧密码策略由表单校验（规格 §14.3） */
export function changePassword(dto: ChangePasswordRequestDto, options: ProfileWriteOptions = {}): Promise<null> {
  return request<null>({
    url: '/users/me/password',
    method: 'put',
    data: dto,
    ...(options.silent === true ? { silent: true } : {}),
  })
}
