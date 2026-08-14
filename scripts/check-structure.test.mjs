import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkStructure } from './check-structure.mjs'

// jsdom 环境下 import.meta.url 不是 file: URL，改由仓库根目录推导路径
const repoRoot = process.cwd()
const fixturesRoot = join(repoRoot, 'scripts', 'fixtures')
const scriptPath = join(repoRoot, 'scripts', 'check-structure.mjs')

/** 每类规则至少一个失败样例：目录名 -> 期望命中的规则 */
const FAIL_CASES = [
  ['index-tsx', 'no-index-tsx'],
  ['same-name', 'same-name-folder-file'],
  ['loadpage-target', 'loadpage-in-pages'],
  ['pages-in-features', 'pages-not-in-features'],
  ['feature-leaf', 'feature-leaf-content'],
  ['deep-parent', 'no-deep-parent-import'],
  ['second-alias', 'unique-alias'],
  ['pseudo-absolute', 'unique-alias'],
  ['dependency-direction', 'dependency-direction'],
  ['case-mismatch', 'case-mismatch'],
  ['service-outside', 'service-file-outside-services'],
]

function runScript(srcDir) {
  const result = spawnSync(process.execPath, [scriptPath, srcDir], { encoding: 'utf8' })
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` }
}

describe('check-structure 合法样例', () => {
  it('完整合法目录树通过全部规则', () => {
    const { violations, allowlistErrors } = checkStructure(join(fixturesRoot, 'pass'))
    expect(allowlistErrors).toEqual([])
    expect(violations).toEqual([])
  })

  it('合法样例经 CLI 执行退出码为 0', () => {
    const { status } = runScript(join(fixturesRoot, 'pass'))
    expect(status).toBe(0)
  })
})

describe('check-structure 失败样例', () => {
  for (const [name, rule] of FAIL_CASES) {
    it(`${name} 命中规则 ${rule}`, () => {
      const { violations } = checkStructure(join(fixturesRoot, 'fail', name))
      const hits = violations.filter((v) => v.rule === rule)
      expect(hits.length).toBeGreaterThan(0)
    })

    it(`${name} 经 CLI 执行返回非零退出码`, () => {
      const { status, output } = runScript(join(fixturesRoot, 'fail', name))
      expect(status).not.toBe(0)
      expect(output).toContain(rule)
    })
  }
})

describe('check-structure allowlist', () => {
  const dependencyDirectionFixture = join(fixturesRoot, 'fail', 'dependency-direction')
  const entry = { file: 'components/Auth/Auth.tsx', owner: '张三', reason: '历史组件临时依赖', cleanup: 'TASK-010 重构后移除' }

  it('精确到文件的条目豁免非硬约束违规', () => {
    const { violations, allowlistErrors } = checkStructure(dependencyDirectionFixture, {
      'dependency-direction': [entry],
    })
    expect(allowlistErrors).toEqual([])
    expect(violations).toEqual([])
  })

  it('通配符条目被拒绝且不豁免违规', () => {
    const { violations, allowlistErrors } = checkStructure(dependencyDirectionFixture, {
      'dependency-direction': [{ ...entry, file: 'components/**' }],
    })
    expect(allowlistErrors.some((e) => e.includes('通配符'))).toBe(true)
    expect(violations.some((v) => v.rule === 'dependency-direction')).toBe(true)
  })

  it('不存在的文件路径被拒绝', () => {
    const { allowlistErrors } = checkStructure(dependencyDirectionFixture, {
      'dependency-direction': [{ ...entry, file: 'components/Missing.ts' }],
    })
    expect(allowlistErrors.some((e) => e.includes('不存在'))).toBe(true)
  })

  it('硬约束规则不可豁免', () => {
    const { violations, allowlistErrors } = checkStructure(join(fixturesRoot, 'fail', 'service-outside'), {
      'service-file-outside-services': [
        { file: 'features/auth/auth.service.ts', owner: '张三', reason: '临时', cleanup: 'TASK-010' },
      ],
    })
    expect(allowlistErrors.some((e) => e.includes('硬约束'))).toBe(true)
    expect(violations.some((v) => v.rule === 'service-file-outside-services')).toBe(true)
  })

  it('未知规则被拒绝', () => {
    const { allowlistErrors } = checkStructure(join(fixturesRoot, 'pass'), {
      'no-such-rule': [entry],
    })
    expect(allowlistErrors.some((e) => e.includes('未知规则'))).toBe(true)
  })
})
