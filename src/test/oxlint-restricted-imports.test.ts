/**
 * oxlint 受限导入规则生效性检查（规格 §4.1/§16.2）：
 * renderRoutes 纯渲染架构要求页面禁止使用 Data Router 数据 API；
 * 本测试临时生成一个包含 useLoaderData/useRouteLoaderData/useFetcher/useRevalidator
 * 四个受限命名导入的违规样例，对仓库 .oxlintrc.json 配置运行 oxlint，
 * 断言四个命名导入均被检出——防止规则被误删或配置漂移后静默失效。
 * 属 §3.2 允许的 src/test 跨业务测试工具例外；临时样例在 finally 中删除。
 */
/// <reference types="node" />
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/** 仓库根目录：定位 .oxlintrc.json 与 pnpm 可执行入口 */
const repositoryRoot = resolve(fileURLToPath(import.meta.url), '../../../')

/** 受规格 §4.1 限制的四个 Data Router 数据 API 命名导入 */
const RESTRICTED_IMPORT_NAMES = [
  'useLoaderData',
  'useRouteLoaderData',
  'useFetcher',
  'useRevalidator',
] as const

/** 违规样例源码：一次性导入全部受限命名，供 oxlint 检出 */
const VIOLATION_SAMPLE = [
  `import { ${RESTRICTED_IMPORT_NAMES.join(', ')} } from 'react-router'`,
  `export const probes = [${RESTRICTED_IMPORT_NAMES.join(', ')}]`,
  '',
].join('\n')

describe('oxlint 受限导入规则生效性（规格 §4.1）', () => {
  it('对临时违规样例运行仓库 oxlint 配置，四个受限命名导入均被检出', () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), 'apex-oxlint-restricted-'))
    const fixtureFile = join(fixtureDir, 'violation-sample.tsx')
    writeFileSync(fixtureFile, VIOLATION_SAMPLE, 'utf8')
    try {
      let output = ''
      let failed = false
      try {
        // 期望非零退出：违规样例必须被拒；shell: true 以兼容 Windows 的 pnpm.cmd shim
        output = execFileSync('pnpm', ['exec', 'oxlint', '--config', join(repositoryRoot, '.oxlintrc.json'), fixtureFile], {
          cwd: repositoryRoot,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true,
        })
      } catch (error) {
        failed = true
        const failure = error as { stdout?: string; stderr?: string; message?: string }
        output = `${failure.stdout ?? ''}\n${failure.stderr ?? ''}\n${failure.message ?? ''}`
      }
      // 规则生效的判定：oxlint 以非零退出，且每个受限命名导入都被逐一点名
      expect(failed).toBe(true)
      expect(output).toContain('no-restricted-imports')
      for (const name of RESTRICTED_IMPORT_NAMES) {
        expect(output).toContain(`'${name}' import from 'react-router' is restricted`)
      }
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true })
    }
  })
})
