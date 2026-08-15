import { describe, expect, test } from 'vitest'
import {
  GLOBAL_PROGRESS_HIDE_DELAY_MS,
  PAGE_CACHE_MAX_ENTRIES,
  PERMISSION_CHANGE_TIP_COOLDOWN_MS,
} from './app.constants'

describe('app.constants', () => {
  test('页签缓存容量固定为 10 个非 affix 实例（§9.1）', () => {
    expect(PAGE_CACHE_MAX_ENTRIES).toBe(10)
  })

  test('全局进度条收起延迟固定为 200 毫秒（§7.4）', () => {
    expect(GLOBAL_PROGRESS_HIDE_DELAY_MS).toBe(200)
  })

  test('权限变更提示冷却窗口固定为 30 秒（§5.4）', () => {
    expect(PERMISSION_CHANGE_TIP_COOLDOWN_MS).toBe(30_000)
  })
})
