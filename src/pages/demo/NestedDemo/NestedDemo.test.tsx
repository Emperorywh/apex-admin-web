/**
 * 多级菜单演示页面测试（规格 §14.2/§19.1）：
 * 同一实现注册于三个层级路由，按 pathname 识别层级——层级标题步骤条、当前路由与
 * 面包屑链展示、「进入下一级」与步骤条点击导航、页签缓存验证表单（表单状态跨页签
 * 切换保留的载体；Activity 缓存行为由 PageCacheHost 测试与 §19.1 浏览器验收覆盖）。
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { I18nextProvider } from 'react-i18next'
import { appI18n } from '@/i18n/i18n'
import { ROUTE_PATHS } from '@/constants/route.constants'
import { NestedDemo } from './NestedDemo'

/** 位置探针：暴露当前 pathname 供导航断言 */
function LocationProbe(): ReactNode {
  const pathname = useLocation().pathname
  return <div data-testid="location-probe">{pathname}</div>
}

/** 以指定层级路径渲染页面（三个层级路由均注册同一实现，与路由定义一致） */
function renderAtLevel(initialPath: string): ReturnType<typeof render> {
  return render(
    <I18nextProvider i18n={appI18n}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path={ROUTE_PATHS.DEMO_NESTED_LEVEL1} element={<NestedDemo />} />
          <Route path={ROUTE_PATHS.DEMO_NESTED_LEVEL2} element={<NestedDemo />} />
          <Route path={ROUTE_PATHS.DEMO_NESTED_LEVEL3} element={<NestedDemo />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

const LEVEL_CASES = [
  { path: ROUTE_PATHS.DEMO_NESTED_LEVEL1, title: '一级页面', next: '二级页面', nextPath: ROUTE_PATHS.DEMO_NESTED_LEVEL2 },
  { path: ROUTE_PATHS.DEMO_NESTED_LEVEL2, title: '二级页面', next: '三级页面', nextPath: ROUTE_PATHS.DEMO_NESTED_LEVEL3 },
] as const

describe('NestedDemo（规格 §14.2 多级菜单演示）', () => {
  it.each(LEVEL_CASES)('在 $path 识别当前层级并展示面包屑链与下一级入口', ({ path, title, next }) => {
    renderAtLevel(path)
    expect(screen.getByText('多级菜单演示')).toBeInTheDocument()
    // 当前路由与面包屑链（层级标题复用 menu 命名空间）
    expect(screen.getByText(`当前路由：${path}`)).toBeInTheDocument()
    expect(screen.getByText(`面包屑链：演示 / 多级菜单 / ${title}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `进入${next}` })).toBeInTheDocument()
  })

  it('三级叶子无「进入下一级」按钮，三个层级标题均出现在步骤条', () => {
    renderAtLevel(ROUTE_PATHS.DEMO_NESTED_LEVEL3)
    expect(screen.getByText(`当前路由：${ROUTE_PATHS.DEMO_NESTED_LEVEL3}`)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /进入/ })).not.toBeInTheDocument()
    for (const title of ['一级页面', '二级页面', '三级页面']) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
  })

  it('「进入下一级」按钮与步骤条点击在层级路由间导航（三级导航演示）', () => {
    renderAtLevel(ROUTE_PATHS.DEMO_NESTED_LEVEL1)
    fireEvent.click(screen.getByRole('button', { name: '进入二级页面' }))
    expect(screen.getByTestId('location-probe')).toHaveTextContent(ROUTE_PATHS.DEMO_NESTED_LEVEL2)

    // 步骤条点击：直达三级
    fireEvent.click(screen.getByText('三级页面'))
    expect(screen.getByTestId('location-probe')).toHaveTextContent(ROUTE_PATHS.DEMO_NESTED_LEVEL3)
  })

  it('页签缓存验证表单：单行/多行输入与开关载体齐备并附说明文案', () => {
    renderAtLevel(ROUTE_PATHS.DEMO_NESTED_LEVEL2)
    expect(screen.getByText('页签缓存验证')).toBeInTheDocument()
    expect(
      screen.getByText('切换到其他页签或层级后返回本页签，下方表单内容保持不变（页面缓存由 Activity 保留）'),
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText('在任意层级页签输入内容后离开再返回')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('多行输入同样随页签缓存保留')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })
})
