import { describe, expect, test } from 'vitest'
import { PROFILE_ENDPOINTS, PROFILE_I18N_NAMESPACE } from './profile.constants'

describe('profile.constants', () => {
  test('资料与密码接口路径与 §6.3 一致', () => {
    expect(PROFILE_ENDPOINTS.GET_PROFILE).toBe('/auth/profile')
    expect(PROFILE_ENDPOINTS.UPDATE_PROFILE).toBe('/auth/profile')
    expect(PROFILE_ENDPOINTS.CHANGE_PASSWORD).toBe('/auth/password')
  })

  test('个人中心 i18n 命名空间与 en-US 资源文件名一致（规格 §12）', () => {
    expect(PROFILE_I18N_NAMESPACE).toBe('profile')
  })
})
