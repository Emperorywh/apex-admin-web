/**
 * collectPermissionLeafCodes 测试（规格 §14.1 PermissionNode）：
 * 仅叶子产出 permCode、多层嵌套按树序输出、空树与缺失 permCode 的健壮性。
 */
import { describe, expect, it } from 'vitest'
import type { PermissionNode } from '@/types/system/role/role.types'
import { collectPermissionLeafCodes } from './permissionTree'

describe('collectPermissionLeafCodes（规格 §14.1）', () => {
  it('仅叶子节点产出 permCode，目录节点不计入', () => {
    const tree: PermissionNode[] = [
      {
        key: 'system',
        title: '系统管理',
        children: [
          {
            key: 'system:user',
            title: '用户管理',
            children: [
              { key: 'system:user:list', title: '查询', permCode: 'system:user:list' },
              { key: 'system:user:create', title: '新增', permCode: 'system:user:create' },
            ],
          },
        ],
      },
      { key: 'dashboard:view', title: '查看', permCode: 'dashboard:view' },
    ]
    expect(collectPermissionLeafCodes(tree)).toEqual(['system:user:list', 'system:user:create', 'dashboard:view'])
  })

  it('空树与空 children 返回空数组', () => {
    expect(collectPermissionLeafCodes([])).toEqual([])
    expect(collectPermissionLeafCodes([{ key: 'empty', title: '空目录', children: [] }])).toEqual([])
  })

  it('缺失 permCode 的异常叶子跳过，不产出权限码', () => {
    const tree: PermissionNode[] = [
      { key: 'leaf-without-code', title: '异常叶子' },
      { key: 'normal', title: '正常', permCode: 'a:b:c' },
    ]
    expect(collectPermissionLeafCodes(tree)).toEqual(['a:b:c'])
  })
})
