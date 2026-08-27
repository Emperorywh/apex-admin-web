/**
 * 个人中心服务。
 */

import { api } from '@/services/request/request'
import type { RequestOptions } from '@/services/request/request.types'
import type { MeResponseDto } from '@/services/auth/auth.service.types'
import type { UpdateMyProfileRequestDto } from '@/services/profile/profile.service.types'

export function getMyProfile(options?: RequestOptions): Promise<MeResponseDto> {
  return api.get<MeResponseDto>('/users/me', { signal: options?.signal })
}

export function updateMyProfile(body: UpdateMyProfileRequestDto, options?: RequestOptions): Promise<MeResponseDto> {
  return api.put<MeResponseDto>('/users/me', body, { signal: options?.signal })
}
