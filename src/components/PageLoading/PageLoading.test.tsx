/** PageLoading 测试：懒加载 Suspense fallback 的统一加载占位（规格 §4.2） */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageLoading } from './PageLoading'

describe('PageLoading', () => {
  it('渲染带状态标记的居中加载占位', () => {
    render(<PageLoading />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
