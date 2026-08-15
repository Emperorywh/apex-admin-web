import { expectTypeOf, test } from 'vitest'
import type { PageResult, User } from './user.types'

test('User 字段与规格 §14.1 逐字一致', () => {
  expectTypeOf<User>().toEqualTypeOf<{
    id: string
    username: string
    displayName: string
    email: string
    phone?: string
    status: 'enabled' | 'disabled'
    roleIds: string[]
    createdAt: string
    updatedAt: string
  }>()
})

test('PageResult 字段与规格 §14.1 逐字一致', () => {
  expectTypeOf<PageResult<number>>().toEqualTypeOf<{
    list: number[]
    total: number
    page: number
    size: number
  }>()
})
