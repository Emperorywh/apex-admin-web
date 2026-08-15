import { describe, expect, test } from 'vitest'
import { MENU_ENDPOINTS, MENU_TYPES } from './menu.constants'

describe('menu.constants', () => {
  test('菜单接口路径与 §14.3 一致', () => {
    expect(MENU_ENDPOINTS).toEqual({
      TREE: '/menus/tree',
      CREATE: '/menus',
      UPDATE: '/menus/:id',
      DELETE: '/menus/:id',
    })
  })

  test('菜单类型枚举与 §14.1 MenuItem.type 一致', () => {
    expect(MENU_TYPES).toEqual({ DIRECTORY: 'directory', PAGE: 'page', BUTTON: 'button' })
  })
})
