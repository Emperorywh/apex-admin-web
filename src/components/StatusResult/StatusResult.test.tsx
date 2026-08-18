/** 状态结果页测试（SPEC_UI2 §9）：状态码/标题/副标题/操作区呈现与可选分支缺省（motion 入场结构） */
import { render, screen } from '@testing-library/react'
import { ShieldX } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { StatusResult } from './StatusResult'

describe('StatusResult（SPEC_UI2 §9）', () => {
  it('呈现状态码点缀、标题、副标题与操作区', () => {
    render(
      <StatusResult
        icon={ShieldX}
        status="403"
        title="无权限访问"
        subTitle="您没有访问该页面的权限"
        extra={<button type="button">返回首页</button>}
      />,
    )
    expect(screen.getByText('403')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '无权限访问' })).toBeInTheDocument()
    expect(screen.getByText('您没有访问该页面的权限')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '返回首页' })).toBeInTheDocument()
  })

  it('副标题与操作区缺省时不渲染对应区域', () => {
    const { container } = render(<StatusResult icon={ShieldX} status="404" title="页面不存在" />)
    expect(screen.getByRole('heading', { name: '页面不存在' })).toBeInTheDocument()
    // motion 入场容器内仅图标徽章 + 状态码 + 标题三个级联子项（SPEC_UI2 §9）
    expect(container.firstChild?.firstChild?.childNodes).toHaveLength(3)
  })
})
