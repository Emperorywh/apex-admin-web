import { expectTypeOf, test } from 'vitest'
import type { ProfileData } from './auth.types'

test('ProfileData 字段与规格 §14.1 逐字一致', () => {
  expectTypeOf<ProfileData>().toEqualTypeOf<{
    user: import('@/types/system/user/user.types').User
    roleCodes: string[]
    permCodes: string[]
    permissionVersion: string
  }>()
})
