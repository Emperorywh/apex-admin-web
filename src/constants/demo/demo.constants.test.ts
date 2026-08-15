import { describe, expect, test } from 'vitest'
import { DEMO_NESTED_I18N_NAMESPACE } from './demo.constants'

describe('demo.constants', () => {
  test('多级菜单演示 i18n 命名空间与 en-US 资源文件名一致（规格 §12）', () => {
    expect(DEMO_NESTED_I18N_NAMESPACE).toBe('demoNested')
  })
})
