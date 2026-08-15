import { describe, expect, test } from 'vitest'
import { PROFILE_ENDPOINTS } from './profile.constants'

describe('profile.constants', () => {
  test('资料与密码接口路径与 §6.3 一致', () => {
    expect(PROFILE_ENDPOINTS.GET_PROFILE).toBe('/auth/profile')
    expect(PROFILE_ENDPOINTS.UPDATE_PROFILE).toBe('/auth/profile')
    expect(PROFILE_ENDPOINTS.CHANGE_PASSWORD).toBe('/auth/password')
  })
})
