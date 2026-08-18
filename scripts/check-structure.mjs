#!/usr/bin/env node
/**
 * 结构门禁脚本（规格 §16.2）。
 *
 * 扫描源码导入语句与真实文件路径，检查以下规则，违规时返回非零退出码：
 *   no-index-tsx                   项目内不得出现 index.tsx
 *   same-name-folder-file          页面/组件必须由同名文件夹与同名实现文件包裹
 *   loadpage-in-pages              路由 loadPage 目标必须位于 src/pages/
 *   pages-not-in-features          页面入口不得出现在 src/features/
 *   feature-leaf-content           feature 叶子目录只允许 components/ 与 hooks/
 *   service-file-outside-services  业务请求实现或 DTO 只能位于 src/services/
 *   no-deep-parent-import          禁止 ../../ 及更深的父级相对导入
 *   unique-alias                   内部根级导入只能使用唯一的 @/ 别名
 *   dependency-direction           固定依赖方向、共享层反向依赖与业务域穿透导入
 *   case-mismatch                  导入路径大小写必须与磁盘完全一致
 *   iconify-only-in-appicon        @iconify/react 只允许在 src/components/AppIcon/ 内导入（SPEC_UI2 §5.3）
 *
 * 边界例外通过 scripts/check-structure.allowlist.json 记录，格式：
 *   { "<ruleId>": [{ "file": "<相对 src 的文件路径>", "owner": "...", "reason": "...", "cleanup": "..." }] }
 * 条目必须精确到文件、不得使用通配符；feature-leaf-content、pages-not-in-features、
 * service-file-outside-services 三条硬约束不可豁免。
 *
 * 用法：node scripts/check-structure.mjs [srcDir]（默认仓库 src/，参数供测试使用）
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const RULE_IDS = [
  'no-index-tsx',
  'same-name-folder-file',
  'loadpage-in-pages',
  'pages-not-in-features',
  'feature-leaf-content',
  'service-file-outside-services',
  'no-deep-parent-import',
  'unique-alias',
  'dependency-direction',
  'case-mismatch',
  'iconify-only-in-appicon',
]

/** 不可通过 allowlist 豁免的硬约束 */
export const HARD_RULES = ['feature-leaf-content', 'pages-not-in-features', 'service-file-outside-services']

/** src 顶层结构词汇表（规格 §3.1），用于识别第二套别名与伪绝对路径 */
export const SRC_TOP_LEVEL_NAMES = [
  'App',
  'assets',
  'components',
  'config',
  'constants',
  'demo',
  'features',
  'hooks',
  'i18n',
  'layouts',
  'pages',
  'router',
  'services',
  'store',
  'styles',
  'test',
  'types',
  'utils',
]

/** feature 任意层级禁止出现的业务实现目录 */
const FORBIDDEN_IN_FEATURES = [
  'pages',
  'api',
  'services',
  'store',
  'types',
  'constants',
  'assets',
  'utils',
  'config',
  'i18n',
  'demo',
  'router',
  'layouts',
]

/** services 层中允许被 components/hooks 依赖的基础设施子目录（规格 §3.2） */
const SERVICE_INFRA_DOMAINS = ['request', 'feedback']

/** 解析无扩展名导入时的候选扩展；'' 表示允许目录导入以命中真实目录名 */
const EXT_CANDIDATES = ['', '.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.cjs', '.css', '.json', '.svg', '.png']

const SCANNABLE_EXT = /\.(ts|tsx|mts|js|jsx|mjs|cjs|css)$/

/** 提取 import/export from/动态 import 的模块说明符 */
const IMPORT_PATTERNS = [
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
]

const LOADPAGE_RE = /loadPage\s*:\s*\(\s*\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)/g

/**
 * 递归收集目录树。dirEntries 保存磁盘真实大小写的条目名，
 * 供大小写一致性检查使用。
 */
function walk(root) {
  const files = []
  const dirEntries = new Map()

  const visit = (absDir, relDir) => {
    const entries = readdirSync(absDir, { withFileTypes: true })
    dirEntries.set(relDir, entries.map((e) => e.name))
    for (const entry of entries) {
      const childRel = relDir ? `${relDir}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        visit(resolve(absDir, entry.name), childRel)
      } else {
        files.push({ rel: childRel, abs: resolve(absDir, entry.name) })
      }
    }
  }

  visit(root, '')
  return { files, dirEntries }
}

function extractImports(content) {
  const imports = []
  for (const re of IMPORT_PATTERNS) {
    re.lastIndex = 0
    let match
    while ((match = re.exec(content)) !== null) {
      const line = content.slice(0, match.index).split('\n').length
      imports.push({ specifier: match[1], line })
    }
  }
  return imports
}

/** 相对说明符按导入者位置规范化为 src 相对路径；越界返回 null */
function normalizeRelative(importerRel, specifier) {
  const parts = importerRel.split('/').slice(0, -1)
  for (const seg of specifier.split('/')) {
    if (seg === '.' || seg === '') continue
    if (seg === '..') {
      if (parts.length === 0) return null
      parts.pop()
      continue
    }
    parts.push(seg)
  }
  return parts.length > 0 ? parts.join('/') : null
}

/** 相对导入的前置 ../ 层数 */
function leadingParentCount(specifier) {
  const match = specifier.match(/^(?:\.\.\/)+/)
  return match ? match[0].length / 3 : 0
}

/**
 * 校验 src 相对路径能否按真实大小写命中磁盘。
 * 返回 ok / case-mismatch / not-found（not-found 交给 typecheck，不在此报错）。
 */
function resolveExact(dirEntries, relPath) {
  const segs = relPath.split('/')
  let dir = ''
  for (let i = 0; i < segs.length - 1; i += 1) {
    const seg = segs[i]
    const entries = dirEntries.get(dir)
    if (!entries) return { status: 'not-found' }
    if (!entries.includes(seg)) {
      const ci = entries.find((e) => e.toLowerCase() === seg.toLowerCase())
      if (!ci) return { status: 'not-found' }
      return { status: 'case-mismatch', at: dir ? `${dir}/${seg}` : seg }
    }
    dir = dir ? `${dir}/${seg}` : seg
  }
  const last = segs[segs.length - 1]
  const entries = dirEntries.get(dir)
  if (!entries) return { status: 'not-found' }
  const candidates = EXT_CANDIDATES.map((ext) => last + ext)
  if (candidates.some((c) => entries.includes(c))) {
    return { status: 'ok' }
  }
  const ciMatch = entries.find((e) => candidates.some((c) => c.toLowerCase() === e.toLowerCase()))
  if (ciMatch) return { status: 'case-mismatch', at: dir ? `${dir}/${ciMatch}` : ciMatch }
  return { status: 'not-found' }
}

/** 文件所属顶层目录；根级文件返回 '' */
function layerOf(rel) {
  return rel.includes('/') ? rel.split('/')[0] : ''
}

/** feature 文件的业务域路径，如 features/system/user/hooks/useX.ts -> system/user */
function featureDomain(rel) {
  const segs = rel.split('/')
  const stop = segs.findIndex((s, i) => i > 0 && (s === 'components' || s === 'hooks'))
  return segs.slice(1, stop === -1 ? segs.length : stop).join('/')
}

/** 判断 .tsx 是否位于页面/组件命名规则约束区域 */
function inComponentArea(rel) {
  const segs = rel.split('/')
  if (['pages', 'components', 'layouts', 'App'].includes(segs[0])) return true
  return segs.includes('components')
}

export function validateAllowlist(data, files) {
  const errors = []
  const fileSet = new Set(files.map((f) => f.rel))
  for (const [rule, entries] of Object.entries(data)) {
    if (!RULE_IDS.includes(rule)) {
      errors.push(`未知规则 "${rule}"，合法规则：${RULE_IDS.join(' | ')}`)
      continue
    }
    if (!Array.isArray(entries)) {
      errors.push(`规则 "${rule}" 的条目必须是数组`)
      continue
    }
    for (const entry of entries) {
      const file = entry?.file
      if (typeof file !== 'string' || file.length === 0) {
        errors.push(`规则 "${rule}" 存在缺少 file 字段的条目`)
        continue
      }
      if (file.includes('*')) {
        errors.push(`规则 "${rule}" 的 ${file} 不得使用通配符`)
        continue
      }
      if (file.endsWith('/')) {
        errors.push(`规则 "${rule}" 的 ${file} 必须精确到文件`)
        continue
      }
      if (!fileSet.has(file)) {
        errors.push(`规则 "${rule}" 的 ${file} 不存在于源码树，必须精确到文件`)
        continue
      }
      if (!entry.owner || !entry.reason || !entry.cleanup) {
        errors.push(`规则 "${rule}" 的 ${file} 缺少 owner/reason/cleanup 字段`)
        continue
      }
      if (HARD_RULES.includes(rule)) {
        errors.push(`规则 "${rule}" 属于硬约束，不可通过 allowlist 豁免`)
      }
    }
  }
  return errors
}

/**
 * 对给定 src 根目录执行全部结构规则。
 * @param {string} srcDir 作为 src 根扫描的目录
 * @param {Record<string, Array>} allowlistData 可选 allowlist 数据
 * @returns {{ violations: Array<{rule,file,line?,message}>, allowlistErrors: string[] }}
 */
export function checkStructure(srcDir, allowlistData = {}) {
  const violations = []
  const { files, dirEntries } = walk(srcDir)
  const add = (rule, file, message, line) => violations.push({ rule, file, line, message })

  const topLevelNames = new Set(SRC_TOP_LEVEL_NAMES)
  for (const name of dirEntries.get('') ?? []) {
    topLevelNames.add(name)
  }

  // 读取可扫描文件的内容与导入
  const raws = new Map()
  const importsOf = new Map()
  for (const file of files) {
    if (!SCANNABLE_EXT.test(file.rel)) continue
    let raw = ''
    try {
      raw = readFileSync(file.abs, 'utf8')
    } catch {
      raw = ''
    }
    raws.set(file.rel, raw)
    importsOf.set(file.rel, extractImports(raw))
  }

  // ── no-index-tsx：项目内不得出现 index.tsx ──
  for (const file of files) {
    if (file.rel.split('/').pop() === 'index.tsx') {
      add('no-index-tsx', file.rel, '项目内不得出现 index.tsx 承载页面或组件实现')
    }
  }

  // ── same-name-folder-file：同名文件夹与同名实现文件 ──
  for (const file of files) {
    if (!file.rel.endsWith('.tsx') || !inComponentArea(file.rel)) continue
    const segs = file.rel.split('/')
    const stem = segs[segs.length - 1].slice(0, -'.tsx'.length)
    const folder = segs.length >= 2 ? segs[segs.length - 2] : ''
    // 同前缀的共置测试（Login/Login.test.tsx）不算逃逸
    if (stem !== folder && !stem.startsWith(`${folder}.`)) {
      add('same-name-folder-file', file.rel, `页面/组件实现 ${stem}.tsx 必须位于同名文件夹 ${stem}/ 内`)
    }
  }
  // components 容器的直属子项必须是包含同名实现文件的组件文件夹
  for (const [dir, entries] of dirEntries) {
    if (dir !== 'components' && !dir.endsWith('/components')) continue
    for (const name of entries) {
      const child = dir ? `${dir}/${name}` : name
      if (!dirEntries.has(child)) {
        add('same-name-folder-file', child, `components/ 下不允许散落文件 ${name}，必须收入同名组件文件夹`)
      }
    }
    for (const name of entries) {
      const child = dir ? `${dir}/${name}` : name
      if (!dirEntries.has(child)) continue
      const hasImpl = (dirEntries.get(child) ?? []).some((e) => e === `${name}.tsx`)
      if (!hasImpl) {
        add('same-name-folder-file', child, `组件文件夹 ${child} 缺少同名实现文件 ${name}.tsx`)
      }
    }
  }
  // pages 根与业务域目录下不允许散落文件，只允许业务域目录与页面文件夹
  for (const [dir, entries] of dirEntries) {
    if (dir !== 'pages' && !dir.startsWith('pages/')) continue
    const depth = dir === 'pages' ? 1 : dir.split('/').length
    if (depth > 2) continue
    for (const name of entries) {
      const child = `${dir}/${name}`
      if (!dirEntries.has(child)) {
        add('same-name-folder-file', child, `pages/ 下只允许业务域目录与页面文件夹，不允许散落文件 ${name}`)
      }
    }
  }
  for (const [dir, entries] of dirEntries) {
    if (dir.split('/').length !== 3 || dir.split('/')[0] !== 'pages') continue
    for (const name of entries) {
      const child = `${dir}/${name}`
      if (!dirEntries.has(child)) continue
      const hasImpl = (dirEntries.get(child) ?? []).some((e) => e === `${name}.tsx`)
      if (!hasImpl) {
        add('same-name-folder-file', child, `页面文件夹 ${child} 缺少同名入口文件 ${name}.tsx`)
      }
    }
  }
  // App 应用外壳
  if (dirEntries.has('App')) {
    const hasApp = (dirEntries.get('App') ?? []).some((e) => e === 'App.tsx')
    if (!hasApp) {
      add('same-name-folder-file', 'App', 'App 必须遵循 App/App.tsx 同名文件夹规则')
    }
  }

  // ── pages-not-in-features：页面入口不得出现在 features ──
  for (const dir of dirEntries.keys()) {
    if (dir.startsWith('features/') && dir.split('/').pop() === 'pages') {
      add('pages-not-in-features', dir, '页面入口只能位于 src/pages/，features 内不得出现 pages 目录')
    }
  }

  // ── feature-leaf-content：叶子 feature 只允许 components/ 与 hooks/ ──
  for (const [dir, entries] of dirEntries) {
    if (dir !== 'features' && !dir.startsWith('features/')) continue
    const rest = dir === 'features' ? [] : dir.slice('features/'.length).split('/')
    // 进入 components/hooks 实现目录后不再检查 feature 结构
    if (rest.some((s) => s === 'components' || s === 'hooks')) continue
    const isLeaf = entries.some((e) => e === 'components' || e === 'hooks')
    for (const name of entries) {
      const child = `${dir}/${name}`
      const isDir = dirEntries.has(child)
      if (!isDir) {
        add('feature-leaf-content', child, `feature 目录内不允许散落文件 ${name}，实现只能放入 components/ 或 hooks/`)
        continue
      }
      if (dir === 'features' && (name === 'components' || name === 'hooks')) {
        add('feature-leaf-content', child, 'features 根部只允许业务域目录，components/hooks 必须挂在业务域下')
        continue
      }
      if (isLeaf && name !== 'components' && name !== 'hooks') {
        add('feature-leaf-content', child, `叶子 feature 目录只允许 components/ 与 hooks/，出现子目录 ${name}`)
        continue
      }
      // 实现目录名禁令只作用于业务域内部：features 根下的直接子目录是业务域本身，
      // 其中 demo 域是规格 §13.3 约定的可整体剔除目录（src/features/demo），不受该禁令约束
      if (dir !== 'features' && !isLeaf && FORBIDDEN_IN_FEATURES.includes(name)) {
        add('feature-leaf-content', child, `feature 任意层级不得出现 ${name}/ 目录`)
      }
    }
  }

  // ── service-file-outside-services：业务请求实现与 DTO 只在 services ──
  for (const file of files) {
    if (/\.service\.[cm]?[jt]sx?$/.test(file.rel.split('/').pop()) && layerOf(file.rel) !== 'services') {
      add('service-file-outside-services', file.rel, '业务请求实现或 DTO 只能位于 src/services/')
    }
  }

  // ── 导入语句相关规则 ──
  for (const [rel, imports] of importsOf) {
    const layer = layerOf(rel)
    const domain = layer === 'features' ? featureDomain(rel) : null

    for (const { specifier, line } of imports) {
      // iconify-only-in-appicon：@iconify/* 只允许 AppIcon 封装内导入（SPEC_UI2 §5.3 离线红线）
      if (specifier.startsWith('@iconify/') && !rel.startsWith('components/AppIcon/')) {
        add('iconify-only-in-appicon', rel, `@iconify/* 只允许在 src/components/AppIcon/ 内导入：${specifier}`, line)
      }

      // no-deep-parent-import
      if (leadingParentCount(specifier) >= 2) {
        add('no-deep-parent-import', rel, `禁止 ../../ 及更深的父级相对导入：${specifier}`, line)
      }

      // unique-alias：唯一 @/ 别名，禁止第二套别名与伪绝对路径
      if (specifier.startsWith('@') && !specifier.startsWith('@/')) {
        const scope = specifier.slice(1).split('/')[0]
        if (topLevelNames.has(scope)) {
          add('unique-alias', rel, `禁止第二套别名 @${scope}/，必须使用唯一的 @/ 别名`, line)
        }
      } else if (!specifier.startsWith('.') && !specifier.startsWith('@')) {
        const firstSeg = specifier.split('/')[0]
        if (firstSeg === 'src' || (specifier.includes('/') && topLevelNames.has(firstSeg))) {
          add('unique-alias', rel, `禁止伪绝对路径 ${specifier}，内部根级导入必须使用 @/ 别名`, line)
        }
      }

      // 解析内部导入目标
      let target = null
      if (specifier.startsWith('@/')) {
        target = specifier.slice(2)
      } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
        target = normalizeRelative(rel, specifier)
      }
      if (!target) continue

      // case-mismatch
      const resolved = resolveExact(dirEntries, target)
      if (resolved.status === 'case-mismatch') {
        add('case-mismatch', rel, `导入路径大小写与磁盘不一致：${specifier}（应为 ${resolved.at}）`, line)
      }

      // dependency-direction
      const targetLayer = layerOf(target)
      if ((layer === 'components' || layer === 'hooks') && (targetLayer === 'pages' || targetLayer === 'features')) {
        add('dependency-direction', rel, `共享层 ${layer}/ 不得反向导入 ${targetLayer}/：${specifier}`, line)
      }
      if (
        (layer === 'components' || layer === 'hooks') &&
        targetLayer === 'services' &&
        !SERVICE_INFRA_DOMAINS.includes(target.split('/')[1] ?? '')
      ) {
        add('dependency-direction', rel, `共享层不得直接依赖单一业务域 service：${specifier}`, line)
      }
      if (layer === 'features' && (targetLayer === 'pages' || targetLayer === 'layouts' || targetLayer === 'router')) {
        add('dependency-direction', rel, `features 不得导入 ${targetLayer}/：${specifier}`, line)
      }
      if (layer === 'features' && targetLayer === 'features' && featureDomain(target) !== domain) {
        add('dependency-direction', rel, `不同业务域的 feature 不得互相穿透导入：${specifier}`, line)
      }
      if (
        layer === 'services' &&
        ['pages', 'features', 'components', 'layouts', 'App'].includes(targetLayer)
      ) {
        add('dependency-direction', rel, `service 不得导入 React UI（${targetLayer}/）：${specifier}`, line)
      }
      if ((layer === 'pages' || layer === 'layouts') && targetLayer === 'router') {
        add('dependency-direction', rel, `${layer}/ 不得导入 router/：${specifier}`, line)
      }
      if (layer === 'demo' && (targetLayer === 'pages' || targetLayer === 'features')) {
        add('dependency-direction', rel, `demo 不得导入 ${targetLayer}/ 中的 UI 实现：${specifier}`, line)
      }
    }

    // loadpage-in-pages
    const raw = raws.get(rel) ?? ''
    LOADPAGE_RE.lastIndex = 0
    let match
    while ((match = LOADPAGE_RE.exec(raw)) !== null) {
      const specifier = match[1]
      if (!specifier.startsWith('@/pages/')) {
        const line = raw.slice(0, match.index).split('\n').length
        add('loadpage-in-pages', rel, `loadPage 目标必须位于 src/pages/：${specifier}`, line)
      }
    }
  }

  // allowlist 校验与豁免（存在任何 allowlist 错误时不做豁免，直接失败）
  const allowlistErrors = validateAllowlist(allowlistData, files)
  if (allowlistErrors.length > 0) {
    return { violations, allowlistErrors }
  }
  const suppressed = violations.filter((v) =>
    (allowlistData[v.rule] ?? []).some((entry) => entry.file === v.file),
  )
  return { violations: violations.filter((v) => !suppressed.includes(v)), allowlistErrors }
}

function main() {
  const srcDir = process.argv[2]
    ? resolve(process.argv[2])
    : fileURLToPath(new URL('../src', import.meta.url))
  const allowlistPath = fileURLToPath(new URL('./check-structure.allowlist.json', import.meta.url))

  let allowlistData = {}
  if (existsSync(allowlistPath)) {
    try {
      allowlistData = JSON.parse(readFileSync(allowlistPath, 'utf8'))
    } catch (error) {
      console.error(`allowlist 解析失败：${error instanceof Error ? error.message : String(error)}`)
      process.exitCode = 1
      return
    }
  }

  const { violations, allowlistErrors } = checkStructure(srcDir, allowlistData)

  for (const error of allowlistErrors) {
    console.error(`[allowlist] ${error}`)
  }
  if (violations.length > 0) {
    console.error(`结构检查失败，共 ${violations.length} 处违规：`)
    for (const v of violations) {
      const line = v.line ? `:${v.line}` : ''
      console.error(`[${v.rule}] ${v.file}${line} — ${v.message}`)
    }
  }
  if (violations.length === 0 && allowlistErrors.length === 0) {
    console.log('结构检查通过')
  }
  process.exitCode = violations.length > 0 || allowlistErrors.length > 0 ? 1 : 0
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  main()
}
