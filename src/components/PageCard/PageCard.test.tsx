/**
 * 页面单卡片骨架测试（SPEC_UI2 §7）：标题区/搜索区/内容区结构与条件渲染。
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageCard } from './PageCard'

describe('PageCard 单卡片骨架（SPEC_UI2 §7）', () => {
  it('渲染标题、附加区、搜索区与内容区', () => {
    render(
      <PageCard title="用户管理" extra={<button type="button">新增</button>} search={<input type="search" aria-label="搜索" />}>
        <table />
      </PageCard>,
    )
    expect(screen.getByRole('heading', { level: 3, name: '用户管理' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新增' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: '搜索' })).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('标题与搜索区均可省略：仅内容区仍成卡', () => {
    const { container } = render(
      <PageCard>
        <table />
      </PageCard>,
    )
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(container.querySelector('section')).toBeInTheDocument()
  })
})
