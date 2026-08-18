import { describe, expect, test } from 'vitest'
import { MENU_TYPES } from './menu.constants'

describe('menu.constants', () => {
  test('菜单类型枚举与 §14.1 MenuItem.type 一致', () => {
    expect(MENU_TYPES).toEqual({ DIRECTORY: 'directory', PAGE: 'page', BUTTON: 'button' })
  })
})
