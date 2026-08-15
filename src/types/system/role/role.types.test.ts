import { expectTypeOf, test } from 'vitest'
import type { PermissionNode, Role } from './role.types'

test('Role 字段与规格 §14.1 逐字一致', () => {
  expectTypeOf<Role>().toEqualTypeOf<{
    id: string
    code: string
    name: string
    description?: string
    status: 'enabled' | 'disabled'
    builtIn: boolean
    permCodes: string[]
    createdAt: string
    updatedAt: string
  }>()
})

test('PermissionNode 字段与规格 §14.1 逐字一致', () => {
  expectTypeOf<PermissionNode>().toEqualTypeOf<{
    key: string
    title: string
    permCode?: string
    children?: PermissionNode[]
  }>()
})
