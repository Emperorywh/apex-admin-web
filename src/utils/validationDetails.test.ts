/**
 * VALIDATION_FAILED.details 解析测试（规格 §14.4）：
 * 合法形状窄化为字段错误列表；形状不符返回 null；畸形条目被忽略。
 */
import { describe, expect, it } from 'vitest'
import { parseValidationFieldIssues } from './validationDetails'

describe('parseValidationFieldIssues（规格 §14.4）', () => {
  it('合法 details：窄化为 { field, message } 列表', () => {
    expect(
      parseValidationFieldIssues({
        fields: [
          { field: 'username', message: '用户名已存在' },
          { field: 'email', message: 'email 格式不正确' },
        ],
      }),
    ).toEqual([
      { field: 'username', message: '用户名已存在' },
      { field: 'email', message: 'email 格式不正确' },
    ])
  })

  it('空 fields 数组：返回空列表（约定形状、无字段条目）', () => {
    expect(parseValidationFieldIssues({ fields: [] })).toEqual([])
  })

  it('非对象或缺失 fields：返回 null', () => {
    expect(parseValidationFieldIssues(undefined)).toBeNull()
    expect(parseValidationFieldIssues(null)).toBeNull()
    expect(parseValidationFieldIssues('fields')).toBeNull()
    expect(parseValidationFieldIssues({})).toBeNull()
    expect(parseValidationFieldIssues({ fields: 'not-array' })).toBeNull()
  })

  it('畸形条目被忽略，合法条目保留', () => {
    expect(
      parseValidationFieldIssues({
        fields: [
          null,
          42,
          { field: 1, message: '字段名非字符串' },
          { field: 'no-message' },
          { field: 'phone', message: '必须是字符串' },
        ],
      }),
    ).toEqual([{ field: 'phone', message: '必须是字符串' }])
  })
})
