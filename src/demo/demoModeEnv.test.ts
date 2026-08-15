/**
 * 演示模式三态配置一致性测试（规格 §13.1/§16.1）：
 * - .env.development 开发默认 fallback；.env.production 真实生产默认 off；
 *   .env.example 承载 force 示例（无后端示例部署）；
 * - vite-env.d.ts 严格 ImportMetaEnv 联合类型；vite.config.ts 启动时校验非法值。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// jsdom 环境下 import.meta.url 不是 file: URL，改由仓库根目录（vitest 工作目录）推导
const REPO_ROOT = process.cwd()

function readRepoFile(relativePath: string): string {
  return readFileSync(`${REPO_ROOT}/${relativePath}`, 'utf8')
}

/** 从 env 文件文本中提取 VITE_DEMO_MODE 取值 */
function extractDemoMode(raw: string): string {
  const match = raw.match(/^VITE_DEMO_MODE=(.+)$/m)
  expect(match).not.toBeNull()
  return (match as RegExpMatchArray)[1].trim()
}

describe('VITE_DEMO_MODE 三态配置（规格 §13.1/§16.1）', () => {
  it('开发环境默认 fallback（.env.development）', () => {
    expect(extractDemoMode(readRepoFile('.env.development'))).toBe('fallback')
  })

  it('真实生产默认 off（.env.production）', () => {
    expect(extractDemoMode(readRepoFile('.env.production'))).toBe('off')
  })

  it('示例文件承载 force 示例部署取值（.env.example）', () => {
    expect(extractDemoMode(readRepoFile('.env.example'))).toBe('force')
  })

  it('vite-env.d.ts 以严格联合类型约束三态', () => {
    const source = readRepoFile('src/vite-env.d.ts')
    expect(source).toContain("readonly VITE_DEMO_MODE: 'off' | 'force' | 'fallback'")
  })

  it('vite.config.ts 启动时校验非法取值（dev/build 失败）', () => {
    const source = readRepoFile('vite.config.ts')
    expect(source).toContain("const DEMO_MODE_VALUES = ['off', 'force', 'fallback'] as const")
    expect(source).toContain('assertEnv(env)')
    expect(source).toContain('VITE_DEMO_MODE 非法')
  })
})
