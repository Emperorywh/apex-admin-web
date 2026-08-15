import { expectTypeOf, test } from 'vitest'
import type { MenuItem } from './menu.types'

test('MenuItem 字段与规格 §14.1 逐字一致', () => {
  expectTypeOf<MenuItem>().toEqualTypeOf<{
    id: string
    parentId: string | null
    type: 'directory' | 'page' | 'button'
    name: string
    routeId?: string
    path?: string
    permCode?: string
    sort: number
    visible: boolean
    status: 'enabled' | 'disabled'
    children?: MenuItem[]
  }>()
})
