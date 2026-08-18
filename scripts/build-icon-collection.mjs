#!/usr/bin/env node
/**
 * 图标集合构建脚本（SPEC_UI2 §5.1 首选装载路径）：
 * 构建期把 src/assets/icons/*.svg 预转换为 IconifyJSON 集合 local.json，
 * 运行时经 import.meta.glob 聚合 + @iconify/react addCollection 离线注册
 * （local: 唯一前缀，禁运行时请求 api.iconify.design）。
 *
 * 自研轻量解析（正则提取 viewBox 与 svg 内体），不引入 @iconify/utils：
 * 资产为受控的 24px 双色调 SVG（slash-admin 风格），无需完整 SVG 解析器。
 * 生成物 local.json 随资产一并提交；buildIconCollection 为纯函数，
 * scripts/build-icon-collection.test.mjs 校验 JSON 与 SVG 源不漂移。
 *
 * 用法：node scripts/build-icon-collection.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** 路径惰性解析：jsdom 测试环境 import.meta.url 非 file: URL，仅 CLI 入口才求值 */
function resolvePaths() {
  return {
    iconsDir: fileURLToPath(new URL('../src/assets/icons', import.meta.url)),
    outputFile: fileURLToPath(new URL('../src/assets/icons/local.json', import.meta.url)),
  }
}

/** 集合元信息：local: 前缀（SPEC_UI2 §5.1 离线红线） */
export const ICON_COLLECTION_PREFIX = 'local'

/** 从 SVG 文本提取 viewBox 宽高；缺失/非法按 24×24 处理（资产约定 24px 画布） */
export function parseSvgSize(svg) {
  const match = /viewBox\s*=\s*"([^"]+)"/.exec(svg)
  if (match) {
    const parts = match[1].trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n)) && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] }
    }
  }
  return { width: 24, height: 24 }
}

/** 提取 <svg> 内体并归一化空白；无合法外壳返回 null（跳过该资产并告警） */
export function parseSvgBody(svg) {
  const openEnd = svg.indexOf('>')
  const closeStart = svg.lastIndexOf('</svg>')
  if (openEnd < 0 || closeStart <= openEnd) {
    return null
  }
  const body = svg
    .slice(openEnd + 1, closeStart)
    .replace(/\s*\n\s*/g, ' ')
    .trim()
  return body.length > 0 ? body : null
}

/**
 * 由 { 图标名: svg 文本 } 构建 IconifyJSON 集合（纯函数，供测试复用）：
 * { prefix: 'local', icons: { [name]: { body, width, height } }, width: 24, height: 24 }
 */
export function buildIconCollection(svgSources) {
  const icons = {}
  const skipped = []
  for (const [name, svg] of Object.entries(svgSources)) {
    const body = parseSvgBody(svg)
    if (body === null) {
      skipped.push(name)
      continue
    }
    const { width, height } = parseSvgSize(svg)
    icons[name] = { body, width, height }
  }
  return { collection: { prefix: ICON_COLLECTION_PREFIX, icons, width: 24, height: 24 }, skipped }
}

function main() {
  const { iconsDir, outputFile } = resolvePaths()
  const entries = readdirSync(iconsDir, { withFileTypes: true })
  const svgSources = {}
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.svg')) {
      svgSources[entry.name.slice(0, -'.svg'.length)] = readFileSync(`${iconsDir}/${entry.name}`, 'utf8')
    }
  }
  const { collection, skipped } = buildIconCollection(svgSources)
  for (const name of skipped) {
    console.warn(`跳过无法解析的 SVG：${name}.svg`)
  }
  writeFileSync(outputFile, `${JSON.stringify(collection, null, 2)}\n`, 'utf8')
  console.log(`图标集合已生成：${Object.keys(collection.icons).length} 个图标 -> src/assets/icons/local.json`)
}

const isMain = process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
if (isMain) {
  main()
}
