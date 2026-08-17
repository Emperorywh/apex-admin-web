/**
 * 彩色图标体系测试（SPEC-UI2 §5）：
 * 注册完整性（§5.4 红线：路由/菜单引用的每个图标名均已注册）、
 * local: 前缀解析、lucide 同尺寸回退与取色板派生。
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { routeDefinitions } from '@/router/definitions'
import {
  AppIcon,
  LOCAL_ICON_PREFIX,
  getRegisteredLocalIconNames,
  isLocalIconRegistered,
  parseLocalIconName,
  resolveIconAsset,
} from './AppIcon'
import { deriveMenuIconAccentColor } from '@/config/theme'

/** 深度遍历路由定义收集全部 meta.icon 引用 */
function collectRouteIconNames(
  defs: readonly { meta: { icon?: string }; children?: unknown[] }[],
): string[] {
  const names: string[] = []
  for (const def of defs) {
    if (def.meta.icon !== undefined) {
      names.push(def.meta.icon)
    }
    const children = def.children as readonly { meta: { icon?: string }; children?: unknown[] }[] | undefined
    if (children !== undefined) {
      names.push(...collectRouteIconNames(children))
    }
  }
  return names
}

describe('本地 collection 注册（SPEC-UI2 §5.1 首选装载路径）', () => {
  it('构建期生成的 collection 已随模块初始化注册，核心菜单图标全部就位', () => {
    const names = getRegisteredLocalIconNames()
    expect(names.length).toBeGreaterThanOrEqual(20)
    for (const name of ['ic-dashboard', 'ic-management', 'ic-user', 'ic-menu', 'ic-menulevel']) {
      expect(isLocalIconRegistered(name)).toBe(true)
    }
    // 全部名字经 local: 前缀渲染为 Iconify 资产，无 lucide 回退
    expect(resolveIconAsset(`${LOCAL_ICON_PREFIX}ic-dashboard`)).toEqual({
      kind: 'iconify',
      icon: 'local:ic-dashboard',
    })
  })

  it('未注册短名回退 lucide 线性图标（回退关系由注册表统一管理，SPEC-UI2 §5.5）', () => {
    const asset = resolveIconAsset(`${LOCAL_ICON_PREFIX}ic-not-exist`)
    expect(asset.kind).toBe('lucide')
    // lucide 图标组件为 forwardRef 对象（非函数），断言为可渲染的真值组件即可
    expect(asset.kind === 'lucide' ? asset.icon : null).toBeTruthy()
  })

  it('非 local: 前缀一律占位回退，不进入 Iconify（离线红线：无在线图标集，SPEC-UI2 §5.1）', () => {
    for (const name of ['mdi:home', 'url:https://example.com/icon.svg', 'iconify:anything']) {
      expect(parseLocalIconName(name)).toBeNull()
      expect(resolveIconAsset(name).kind).toBe('lucide')
    }
  })
})

describe('路由图标注册完整性（SPEC-UI2 §5.4 红线）', () => {
  it('路由/菜单引用的每个图标名均已注册（local: 前缀 + collection 短名）', () => {
    const names = collectRouteIconNames(routeDefinitions)
    expect(names.length).toBeGreaterThanOrEqual(6)
    for (const name of names) {
      const shortName = parseLocalIconName(name)
      expect(shortName, `图标名 ${name} 必须使用 local: 前缀`).not.toBeNull()
      expect(
        isLocalIconRegistered(shortName!),
        `图标 ${name} 未在本地 collection 注册`,
      ).toBe(true)
    }
  })
})

describe('AppIcon 渲染（SPEC-UI2 §5.5 尺寸与彩色）', () => {
  it('渲染 svg、按尺寸落定宽高、以取色板派生色着色（currentColor 资产）', () => {
    const { container } = render(<AppIcon name={`${LOCAL_ICON_PREFIX}ic-dashboard`} size={24} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.getAttribute('width')).toBe('24')
    expect(svg?.getAttribute('height')).toBe('24')
    // 着色经 color 样式落定（jsdom 会把内联色值归一为 rgb 形式，用探针元素归一后比较）
    const probe = document.createElement('i')
    probe.style.color = deriveMenuIconAccentColor('local:ic-dashboard')
    expect(svg?.style.color).toBe(probe.style.color)
  })

  it('子级 20px 同风格渲染，未注册名回退 lucide 仍保持同尺寸', () => {
    const { container } = render(<AppIcon name={`${LOCAL_ICON_PREFIX}ic-not-exist`} size={20} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('20')
    expect(svg?.getAttribute('height')).toBe('20')
  })

  it('取色板派生稳定：同一图标名两次派生同色，不同名可能取不同色', () => {
    expect(deriveMenuIconAccentColor('local:ic-dashboard')).toBe(
      deriveMenuIconAccentColor('local:ic-dashboard'),
    )
    const palette = new Set(
      getRegisteredLocalIconNames().map((name) => deriveMenuIconAccentColor(name)),
    )
    expect(palette.size).toBeGreaterThan(1)
  })
})
