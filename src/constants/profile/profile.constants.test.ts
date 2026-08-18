import { describe, expect, test } from 'vitest'
import { PROFILE_I18N_NAMESPACE } from './profile.constants'

describe('profile.constants', () => {
  test('个人中心 i18n 命名空间与 en-US 资源文件名一致（规格 §12）', () => {
    expect(PROFILE_I18N_NAMESPACE).toBe('profile')
  })
})
