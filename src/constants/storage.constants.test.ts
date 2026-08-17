import { describe, expect, test } from 'vitest'
import { PERSIST_SCHEMA_VERSION, STORAGE_KEY_PREFIX, THEME_BOOT_STORAGE_KEY } from './storage.constants'

describe('storage.constants', () => {
  test('Storage key 统一前缀为 apex_（§8.2）', () => {
    expect(STORAGE_KEY_PREFIX).toBe('apex_')
  })

  test('主题启动镜像 key 固定为 apex_boot_theme，且包含统一前缀（§8.3）', () => {
    expect(THEME_BOOT_STORAGE_KEY).toBe('apex_boot_theme')
    expect(THEME_BOOT_STORAGE_KEY.startsWith(STORAGE_KEY_PREFIX)).toBe(true)
  })

  test('persist schema 版本从 1 起步、随结构变化递增（§8.2；v2 移除 settings 字体字段）', () => {
    expect(PERSIST_SCHEMA_VERSION).toBe(2)
    expect(Number.isInteger(PERSIST_SCHEMA_VERSION)).toBe(true)
  })
})
