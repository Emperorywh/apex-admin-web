import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildIconCollection, parseSvgBody, parseSvgSize } from './build-icon-collection.mjs'

// jsdom 环境下 import.meta.url 不是 file: URL，改由仓库根目录推导路径
const repoRoot = process.cwd()
const iconsDir = join(repoRoot, 'src', 'assets', 'icons')

function readSvgSources() {
  const sources = {}
  for (const name of readdirSync(iconsDir)) {
    if (name.endsWith('.svg')) {
      sources[name.slice(0, -'.svg'.length)] = readFileSync(join(iconsDir, name), 'utf8')
    }
  }
  return sources
}

describe('build-icon-collection', () => {
  it('提交的 local.json 与 SVG 源保持一致（改图标后须重跑 pnpm icons:build）', () => {
    const { collection, skipped } = buildIconCollection(readSvgSources())
    expect(skipped).toEqual([])
    const committed = JSON.parse(readFileSync(join(iconsDir, 'local.json'), 'utf8'))
    expect(committed).toEqual(collection)
  })

  it('local: 前缀与集合元信息固定', () => {
    const { collection } = buildIconCollection(readSvgSources())
    expect(collection.prefix).toBe('local')
    expect(collection.width).toBe(24)
    expect(collection.height).toBe(24)
    expect(Object.keys(collection.icons).length).toBeGreaterThan(0)
  })

  it('解析 viewBox 尺寸与内体', () => {
    expect(parseSvgSize('<svg viewBox="0 0 24 24"><path/></svg>')).toEqual({ width: 24, height: 24 })
    expect(parseSvgSize('<svg viewBox="0 0 32 16"><path/></svg>')).toEqual({ width: 32, height: 16 })
    expect(parseSvgSize('<svg><path/></svg>')).toEqual({ width: 24, height: 24 })
    expect(parseSvgBody('<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>')).toBe('<path d="M0 0"/>')
    expect(parseSvgBody('not-an-svg')).toBeNull()
  })

  it('无法解析的 SVG 进入 skipped 而不污染集合', () => {
    const { collection, skipped } = buildIconCollection({ good: '<svg><path d="M0 0"/></svg>', bad: 'junk' })
    expect(skipped).toEqual(['bad'])
    expect(Object.keys(collection.icons)).toEqual(['good'])
  })
})
