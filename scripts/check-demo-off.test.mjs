/**
 * check-demo-off.mjs 扫描逻辑单元测试（规格 §13.3）：
 * 不触发真实构建，只验证标记命中与目录收集行为；真实 off 构建由 pnpm check:demo-off 承担。
 */
import { describe, expect, it } from 'vitest'
import {
  collectArtifactFiles,
  DEMO_ARTIFACT_MARKERS,
  scanArtifactsForDemoMarkers,
} from './check-demo-off.mjs'

describe('DEMO_ARTIFACT_MARKERS（规格 §13.3 约定）', () => {
  it('包含约定哨兵字符串与 demo 账号/假数据特征', () => {
    expect(DEMO_ARTIFACT_MARKERS).toContain('APEX_DEMO_SENTINEL')
    expect(DEMO_ARTIFACT_MARKERS).toContain('apex_demo_data')
    expect(DEMO_ARTIFACT_MARKERS).toContain('demo-at.')
    expect(DEMO_ARTIFACT_MARKERS).toContain('demo-user-')
    expect(DEMO_ARTIFACT_MARKERS).toContain('演示管理员')
  })
})

describe('scanArtifactsForDemoMarkers', () => {
  it('干净产物命中为空', () => {
    const hits = scanArtifactsForDemoMarkers([
      { path: 'dist/index.html', content: '<!doctype html><title>apex</title>' },
      { path: 'dist/assets/index-abc.js', content: 'console.log("normal bundle")' },
    ])
    expect(hits).toEqual([])
  })

  it('命中哨兵与全部类别的 demo 标记并报告文件路径', () => {
    const hits = scanArtifactsForDemoMarkers([
      { path: 'dist/assets/index-1.js', content: 'const s="APEX_DEMO_SENTINEL"' },
      { path: 'dist/assets/index-2.js', content: 'localStorage.getItem("apex_demo_data")' },
      { path: 'dist/assets/index-3.js', content: '"demo-at.admin.1"' },
      { path: 'dist/assets/style.css', content: '/* 演示管理员 */' },
    ])
    expect(hits.map((hit) => hit.marker)).toEqual([
      'APEX_DEMO_SENTINEL',
      'apex_demo_data',
      'demo-at.',
      '演示管理员',
    ])
    expect(hits.every((hit) => hit.path.startsWith('dist/'))).toBe(true)
  })

  it('相似但不相同的字符串不误报', () => {
    const hits = scanArtifactsForDemoMarkers([
      { path: 'dist/assets/index.js', content: 'APEX-DEMO-SENTINEL demo-at-x demo_user_1 演示' },
    ])
    expect(hits).toEqual([])
  })
})

describe('collectArtifactFiles', () => {
  it('只收集可扫描扩展名并递归子目录', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = mkdtempSync(join(tmpdir(), 'apex-demo-off-'))
    try {
      writeFileSync(join(dir, 'index.html'), '<html></html>')
      mkdirSync(join(dir, 'assets'))
      writeFileSync(join(dir, 'assets', 'index-abc.js'), 'export {}')
      writeFileSync(join(dir, 'assets', 'index-abc.js.map'), '{}')
      writeFileSync(join(dir, 'logo.svg'), '<svg/>')
      const files = collectArtifactFiles(dir).map((path) => path.split(/[\\/]/).pop())
      expect(files.sort()).toEqual(['index-abc.js', 'index.html'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
