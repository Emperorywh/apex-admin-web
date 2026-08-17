/**
 * 彩色图标唯一封装入口（SPEC-UI2 §5.3 红线）：
 * 其他文件禁止直接 import '@iconify/react'（check-structure 门禁强制）。
 *
 * - 离线红线（SPEC-UI2 §5.1）：全部图标经构建期预生成的 IconifyJSON collection
 *   （src/assets/icons/local.iconify.json，由 scripts/generate-icon-collection.mjs 生成）
 *   在模块初始化时 import.meta.glob 聚合 + addCollection 一次注册；
 *   仅支持 `local:` 前缀，禁止 `url:` 与在线图标集，禁止运行时请求 api.iconify.design
 *   （未注册名一律走 lucide 回退渲染，Iconify 永远收不到未知图标名，天然无 CDN 拉取）。
 * - 双轨制（SPEC-UI2 §5）：菜单彩色图标走本地 SVG collection；
 *   工具/内联线性图标继续由调用方直接使用 lucide-react，不经本组件。
 * - 回退关系由本注册表统一管理（SPEC-UI2 §5.5）：无彩色资产的条目回退 lucide
 *   线性图标并保持同尺寸（24/20px），图标名 → 回退组件的映射收敛于此。
 * - 彩色取色：SVG 资产以 currentColor 着色，颜色经 config/theme.ts 的
 *   deriveMenuIconAccentColor 按图标名稳定派生（色值纪律，SPEC-UI2 §4.3）。
 */
import { Icon as IconifyIcon, addCollection } from '@iconify/react'
import type { IconifyJSON } from '@iconify/react'
import { CircleDashed, LayoutDashboard, ListTree, Settings, ShieldCheck, UsersRound, FlaskConical, Layers, type LucideIcon } from 'lucide-react'
import { deriveMenuIconAccentColor } from '@/config/theme'

/** 唯一合法图标名前缀（SPEC-UI2 §5.1）：全部图标打进 bundle，仅支持本地 collection */
export const LOCAL_ICON_PREFIX = 'local:'

/**
 * lucide 线性回退注册表（SPEC-UI2 §5.5）：路由/菜单图标名未注册彩色资产时
 * 按同名键回退 lucide 图标，尺寸与彩色态一致（由调用方传入）。
 */
const LUCIDE_FALLBACKS: Readonly<Record<string, LucideIcon>> = {
  'ic-dashboard': LayoutDashboard,
  'ic-management': Settings,
  'ic-user': UsersRound,
  'ic-role': ShieldCheck,
  'ic-menu': ListTree,
  'ic-flask': FlaskConical,
  'ic-menulevel': Layers,
}

/** 无任何命中时的占位图标：保证缺失资产仍渲染等尺寸占位而非空节点 */
const FALLBACK_PLACEHOLDER: LucideIcon = CircleDashed

/** 构建期聚合注册（模块初始化一次）：collection 形状由 scripts/generate-icon-collection.mjs 保证 */
const collections = import.meta.glob('@/assets/icons/*.iconify.json', {
  eager: true,
  import: 'default',
}) as Record<string, IconifyJSON>

/** 已注册的本地图标名集合（去掉 local: 前缀后的短名） */
const registeredIcons: ReadonlySet<string> = (() => {
  const names = new Set<string>()
  for (const collection of Object.values(collections)) {
    for (const name of Object.keys(collection.icons ?? {})) {
      names.add(name)
    }
  }
  return names
})()

let registered = false

/** 离线注册：幂等，可在测试或多次引入下安全调用 */
function ensureRegistered(): void {
  if (registered) {
    return
  }
  registered = true
  for (const collection of Object.values(collections)) {
    addCollection(collection)
  }
}

/** 判断图标短名是否已注册彩色资产（含 lucide 回退口径的「已登记」判定用短名） */
// oxlint-disable-next-line react/only-export-components
export function isLocalIconRegistered(shortName: string): boolean {
  return registeredIcons.has(shortName)
}

/** 已注册彩色资产短名列表（排序稳定，供注册完整性测试与调试） */
// oxlint-disable-next-line react/only-export-components
export function getRegisteredLocalIconNames(): readonly string[] {
  return [...registeredIcons].sort((a, b) => a.localeCompare(b, 'en'))
}

/** 解析 `local:xxx` 图标名为短名；非本地图标名返回 null（SPEC-UI2 §5.1 仅支持 local:） */
// oxlint-disable-next-line react/only-export-components
export function parseLocalIconName(name: string): string | null {
  return name.startsWith(LOCAL_ICON_PREFIX) ? name.slice(LOCAL_ICON_PREFIX.length) : null
}

/**
 * 解析图标名的渲染资产：已注册返回 Iconify 图标名；否则返回 lucide 回退组件。
 * 由本模块统一管理回退关系（SPEC-UI2 §5.5）。
 */
// oxlint-disable-next-line react/only-export-components
export function resolveIconAsset(name: string): { kind: 'iconify'; icon: string } | { kind: 'lucide'; icon: LucideIcon } {
  const shortName = parseLocalIconName(name)
  if (shortName === null) {
    return { kind: 'lucide', icon: FALLBACK_PLACEHOLDER }
  }
  if (registeredIcons.has(shortName)) {
    return { kind: 'iconify', icon: `${LOCAL_ICON_PREFIX}${shortName}` }
  }
  return { kind: 'lucide', icon: LUCIDE_FALLBACKS[shortName] ?? FALLBACK_PLACEHOLDER }
}

export interface AppIconProps {
  /** 图标名（`local:` 前缀 + 本地注册短名，SPEC-UI2 §5.4） */
  name: string
  /** 图标边长，单位 px：一级菜单 24 / 子级 20（SPEC-UI2 §5.5） */
  size?: number
  /** 覆盖派生彩色；不传时按图标名稳定派生取色板色（theme.ts） */
  color?: string
  /** 透传类名（CSS Modules 组合样式用） */
  className?: string
}

/**
 * 彩色图标渲染（SPEC-UI2 §5）：装饰性图标固定 aria-hidden；
 * 尺寸经 width/height 呈像素级精确控制（不走 1em 相对缩放）。
 */
export function AppIcon({ name, size = 24, color, className }: AppIconProps) {
  ensureRegistered()
  const asset = resolveIconAsset(name)
  const resolvedColor = color ?? deriveMenuIconAccentColor(name)
  if (asset.kind === 'lucide') {
    const FallbackIcon = asset.icon
    return <FallbackIcon size={size} color={resolvedColor} aria-hidden className={className} />
  }
  return (
    <IconifyIcon
      icon={asset.icon}
      width={size}
      height={size}
      color={resolvedColor}
      className={className}
      aria-hidden
    />
  )
}
