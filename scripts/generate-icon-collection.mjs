#!/usr/bin/env node
/**
 * SVG → IconifyJSON collection 转换脚本（SPEC_UI2 §5.1 首选装载路径）。
 *
 * 构建期把 src/assets/icons/*.svg 预转换为单一 IconifyJSON collection
 * （src/assets/icons/local.iconify.json，随资产提交）；运行时由
 * src/components/AppIcon/ 经 import.meta.glob 聚合后 addCollection 一次注册，
 * 全程离线（红线：禁止运行时请求 api.iconify.design）。
 *
 * 零第三方依赖：SVG 为本仓库约定的规整资产（单根 <svg> + viewBox），按
 * 「剥掉外层 <svg> 标签取 body、读 viewBox 推导尺寸」的最小口径解析即可。
 *
 * 用法：node scripts/generate-icon-collection.mjs [iconsDir]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_ICONS_DIR = fileURLToPath(new URL('../src/assets/icons', import.meta.url))

/** 默认画布尺寸：本目录资产统一 24px 画布（SPEC_UI2 §5.2） */
const DEFAULT_CANVAS = 24

/** 解析单个 SVG：返回 IconifyIcon（body + 尺寸）；形状不符抛错由调用方整体失败 */
function parseSvg(name, raw) {
  const open = raw.match(/<svg\b([^>]*)>/)
  const close = raw.lastIndexOf('</svg>')
  if (open === null || close < 0) {
    throw new Error(`${name}.svg 缺少 <svg> 根元素`)
  }
  const attrs = open[1]
  const body = raw.slice(open.index + open[0].length, close).trim()
  if (body.length === 0) {
    throw new Error(`${name}.svg 无内部图形内容`)
  }
  const icon = { body }
  const viewBox = attrs.match(/viewBox\s*=\s*["']([^"']+)["']/)
  const width = attrs.match(/(?<![:\w])width\s*=\s*["']([\d.]+)["']/)
  const height = attrs.match(/(?<![:\w])height\s*=\s*["']([\d.]+)["']/)
  if (viewBox !== null) {
    const parts = viewBox[1].trim().split(/[\s,]+/)
    if (parts.length !== 4 || parts.some((p) => !/^\d*\.?\d+$/.test(p))) {
      throw new Error(`${name}.svg viewBox 非法：${viewBox[1]}`)
    }
    icon.width = Number(parts[2])
    icon.height = Number(parts[3])
  } else if (width !== null && height !== null) {
    icon.width = Number(width[1])
    icon.height = Number(height[1])
  } else {
    icon.width = DEFAULT_CANVAS
    icon.height = DEFAULT_CANVAS
  }
  return icon
}

/**
 * 生成 collection。导出供测试与脚本复用。
 * @param {string} iconsDir SVG 目录
 * @returns {{ collection: object, warnings: string[] }} collection 为 IconifyJSON
 */
export function buildIconCollection(iconsDir) {
  const icons = {}
  const warnings = []
  for (const entry of readdirSync(iconsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.svg')) {
      continue
    }
    const name = entry.name.slice(0, -'.svg'.length)
    icons[name] = parseSvg(name, readFileSync(resolve(iconsDir, entry.name), 'utf8'))
  }
  const names = Object.keys(icons).sort((a, b) => a.localeCompare(b, 'en'))
  if (names.length === 0) {
    warnings.push('目录中没有 SVG 资产')
  }
  return {
    collection: {
      prefix: 'local',
      icons: Object.fromEntries(names.map((name) => [name, icons[name]])),
      width: DEFAULT_CANVAS,
      height: DEFAULT_CANVAS,
    },
    warnings,
  }
}

function main() {
  const iconsDir = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_ICONS_DIR
  const { collection, warnings } = buildIconCollection(iconsDir)
  for (const warning of warnings) {
    console.warn(`[icons] ${warning}`)
  }
  const outFile = resolve(iconsDir, 'local.iconify.json')
  writeFileSync(outFile, `${JSON.stringify(collection, null, 2)}\n`, 'utf8')
  console.log(`已生成 ${outFile}（${Object.keys(collection.icons).length} 个图标）`)
}

const isMain = process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href
if (isMain) {
  main()
}
