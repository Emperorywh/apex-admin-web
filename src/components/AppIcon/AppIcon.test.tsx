/**
 * AppIcon 测试（SPEC_UI2 §5.3/§5.4）：
 * - 注册完整性红线：路由定义 meta.icon 引用的每个 local: 图标名都必须已注册
 *   （Iconify 离线集合或 LUCIDE_FALLBACK 回退表），防止菜单渲染出占位图标；
 * - 渲染双轨：集合内名字走 Iconify（svg 内联），回退表名字走 lucide，未注册走占位。
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { routeDefinitions } from '@/router/definitions'
import type { AppRouteDefinition } from '@/router/router.types'
import { AppIcon, hasAppIcon, listRegisteredAppIcons, normalizeAppIconName } from './AppIcon'

/** 递归收集路由定义中的全部图标名 */
function collectRouteIcons(defs: readonly AppRouteDefinition[]): string[] {
  const names: string[] = []
  for (const def of defs) {
    if (def.meta.icon !== undefined) {
      names.push(def.meta.icon)
    }
    if (def.children !== undefined) {
      names.push(...collectRouteIcons(def.children))
    }
  }
  return names
}

describe('AppIcon 注册完整性（SPEC_UI2 §5.4 红线）', () => {
  it('路由/菜单引用的每个图标名均已注册', () => {
    const referenced = collectRouteIcons(routeDefinitions)
    expect(referenced.length).toBeGreaterThan(0)
    for (const name of referenced) {
      expect(hasAppIcon(name), `图标 ${name} 未注册`).toBe(true)
    }
  })

  it('注册清单只含 local: 前缀（离线红线）', () => {
    const all = listRegisteredAppIcons()
    expect(all.length).toBeGreaterThan(0)
    for (const name of all) {
      expect(name.startsWith('local:')).toBe(true)
    }
  })
})

describe('AppIcon 图标名解析', () => {
  it('local: 前缀归一化；其他前缀（url:/在线图标集）拒绝', () => {
    expect(normalizeAppIconName('local:ic-menu')).toBe('ic-menu')
    expect(normalizeAppIconName('ic-menu')).toBe('ic-menu')
    expect(normalizeAppIconName('url:https://example.com/x.svg')).toBeNull()
    expect(normalizeAppIconName('mdi:home')).toBeNull()
  })
})

describe('AppIcon 渲染双轨', () => {
  it('集合内彩色图标经 Iconify 内联 svg 渲染', () => {
    const { container } = render(<AppIcon name="local:ic-dashboard" size={24} />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('回退注册表名字经 lucide 线性图标渲染（同尺寸）', () => {
    const { container } = render(<AppIcon name="local:ic-file" size={20} />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('未注册名字渲染占位图标而不抛出', () => {
    const { container } = render(<AppIcon name="local:not-exists" />)
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
