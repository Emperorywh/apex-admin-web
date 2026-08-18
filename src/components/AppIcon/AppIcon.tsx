/**
 * 应用图标唯一入口（SPEC_UI2 §5.3 红线）：全项目只允许本文件直接导入 @iconify/react，
 * 其他文件一律消费 <AppIcon name="local:…" />（check-structure 规则 iconify-only-in-appicon 强制）。
 *
 * 双轨制（SPEC_UI2 §5）：
 * - 菜单彩色图标走 Iconify 离线集合：构建期 scripts/build-icon-collection.mjs 把
 *   src/assets/icons/*.svg 预转为 IconifyJSON（local.json），此处经 import.meta.glob
 *   聚合后统一 addCollection 注册；仅支持 local: 前缀，严禁运行时请求 api.iconify.design；
 * - 无彩色资产的条目回退 lucide-react 线性图标（LUCIDE_FALLBACK 注册表统一管理，
 *   与彩色图标保持同尺寸）；未注册的名字渲染占位图标并在开发期告警。
 *
 * 注册完整性：路由 meta.icon、demo 菜单图标等引用的每个名字都必须可解析，
 * listRegisteredAppIcons/hasAppIcon 供单测断言（SPEC_UI2 §5.4）。
 */
import { addCollection, Icon as IconifyIcon } from '@iconify/react'
import { CircleDashed, FileText, type LucideIcon } from 'lucide-react'

/** IconifyJSON 集合的最小形状（构建脚本产物 local.json） */
interface IconifyCollectionJson {
  prefix: string
  icons: Record<string, { body: string; width?: number; height?: number }>
  width?: number
  height?: number
}

/** 已注册的 Iconify 图标名集合（不含前缀）：注册完整性断言与运行时解析共用 */
const registeredIconifyNames = new Set<string>()

// 模块初始化时聚合全部本地集合并离线注册（SPEC_UI2 §5.1 首选装载路径）
const collections = import.meta.glob('/src/assets/icons/*.json', { eager: true, import: 'default' })
for (const json of Object.values(collections)) {
  const collection = json as IconifyCollectionJson
  if (collection.prefix !== 'local') {
    continue
  }
  addCollection(collection as Parameters<typeof addCollection>[0])
  for (const name of Object.keys(collection.icons)) {
    registeredIconifyNames.add(name)
  }
}

/**
 * lucide 线性回退注册表（SPEC_UI2 §5.5）：无彩色资产的图标名 → lucide 组件，
 * 回退图标与彩色图标保持同尺寸（一级 24px / 子级 20px 由调用方控制 size）。
 */
const LUCIDE_FALLBACK: Record<string, LucideIcon> = {
  'ic-file': FileText,
}

/** 未注册名字的占位图标（开发期同时输出告警） */
const PLACEHOLDER_ICON: LucideIcon = CircleDashed

// 注册表查询函数与组件同文件：图标封装模块不做 Fast Refresh，局部禁用该告警
// oxlint-disable-next-line react/only-export-components
export function normalizeAppIconName(name: string): string | null {
  if (name.startsWith('local:')) {
    return name.slice('local:'.length)
  }
  // 无前缀按本地名处理；其余前缀一律拒绝（离线红线）
  return name.includes(':') ? null : name
}

// oxlint-disable-next-line react/only-export-components
export function hasAppIcon(name: string): boolean {
  const normalized = normalizeAppIconName(name)
  return normalized !== null && (registeredIconifyNames.has(normalized) || normalized in LUCIDE_FALLBACK)
}

// oxlint-disable-next-line react/only-export-components
export function listRegisteredAppIcons(): string[] {
  return [
    ...[...registeredIconifyNames].map((name) => `local:${name}`),
    ...Object.keys(LUCIDE_FALLBACK).map((name) => `local:${name}`),
  ]
}

export interface AppIconProps {
  /** 图标名：local: 前缀（如 local:ic-dashboard）；无前缀按本地名处理，其他前缀拒绝 */
  name: string
  /** 渲染尺寸 px：一级菜单 24 / 子级 20（SPEC_UI2 §5.5），默认 20 */
  size?: number
  className?: string
}

export function AppIcon({ name, size = 20, className }: AppIconProps) {
  const normalized = normalizeAppIconName(name)
  if (normalized !== null && registeredIconifyNames.has(normalized)) {
    return (
      <IconifyIcon icon={`local:${normalized}`} width={size} height={size} className={className} aria-hidden />
    )
  }
  if (normalized !== null && normalized in LUCIDE_FALLBACK) {
    const Fallback = LUCIDE_FALLBACK[normalized]
    return <Fallback size={size} className={className} aria-hidden />
  }
  if (import.meta.env.DEV) {
    console.warn(`[AppIcon] 未注册的图标名：${name}（请补充 src/assets/icons 资产或 LUCIDE_FALLBACK 回退）`)
  }
  return <PLACEHOLDER_ICON size={size} className={className} aria-hidden />
}
