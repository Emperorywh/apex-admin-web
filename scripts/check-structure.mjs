/**
 * 结构门禁检查脚本（pnpm check:structure 入口）。
 *
 * 背景（迁移规格 G16）：模板原 package.json 声明了 check:structure 但脚本文件缺失，
 * 本脚本补齐真实可执行的检查，规则依据 CLAUDE.md「分层结构」一节的既有约定：
 *
 * 1. 禁止任何 index.tsx —— 页面/组件入口必须是「目录名 = 文件名 = 导出组件名」
 *    （如 User/User.tsx），不允许桶文件式 index 入口；
 * 2. 唯一别名 @/* → src/* —— 禁止 ../../ 及更深的多级相对导入，
 *    禁止以 src/、pages/ 等顶层目录开头的伪绝对导入；
 * 3. 导入方向门禁 —— services 不得导入 React 组件层（pages/features/components/layouts）；
 *    components/hooks 不得导入 pages/features；features 各业务域之间不得互相穿透导入；
 * 4. 业务源码禁止硬编码协议与主机 —— 不得出现 http://、https://、ws://、wss://
 *    与点分 IPv4 字面量（迁移规格 4.4：生产走同源反向代理，dev 走 Vite 代理，
 *    代理目标只允许出现在 vite.config.ts，不允许泄漏进 src 业务代码）。
 *
 * 输出：全部通过时打印摘要并退出 0；任何违规逐条列出并以退出码 1 结束。
 * 本脚本只用 Node 内置模块，不引入额外依赖。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, posix, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** 项目根目录（本脚本位于 <root>/scripts/ 下） */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 源码根目录：所有结构规则只作用于 src/ */
const SRC = join(ROOT, 'src')

/** src 下的源文件扩展名；结构规则只检查 TS/TSX 源码 */
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])

/** 伪绝对导入禁止的顶层前缀：即 src 的一级目录名（如 from 'pages/...' 视为伪绝对） */
let topLevelDirs = []

/** 收集的违规列表：每项 { file, line, rule, message } */
const violations = []

/**
 * 递归收集目录下的全部源文件（相对 src 的 POSIX 风格路径）。
 * @param {string} dir 绝对目录
 * @returns {string[]} 形如 services/request/request.ts 的相对路径列表
 */
function collectSourceFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const absolute = join(dir, entry)
    const stat = statSync(absolute)
    if (stat.isDirectory()) {
      // 递归子目录，汇总结果
      files.push(...collectSourceFiles(absolute))
    } else if (SOURCE_EXTENSIONS.has(extname(entry))) {
      // 仅收集 .ts / .tsx 源文件
      files.push(relative(SRC, absolute).replaceAll('\\', '/'))
    }
  }
  return files
}

/** path.extname 的薄封装，便于集中管理扩展名判断 */
function extname(file) {
  const idx = file.lastIndexOf('.')
  return idx === -1 ? '' : file.slice(idx)
}

/**
 * 从源码文本中解析全部静态 import 的模块说明符及其所在行号。
 * 覆盖 `import x from 'm'`、`import type { X } from 'm'`、`export x from 'm'`、`import 'm'`。
 * 不做完整 AST 解析：oxlint/TypeScript 已保证语法合法，这里只需稳定的正则提取。
 * @param {string} text 源码文本
 * @returns {Array<{ specifier: string, line: number }>}
 */
function extractImports(text) {
  const results = []
  // 逐行匹配 from '...' 与独立 import '...'，避免跨行正则的回溯开销
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    // from 'xxx'（含 import/export ... from）
    const fromMatch = line.match(/\bfrom\s+['"]([^'"]+)['"]/)
    if (fromMatch) {
      results.push({ specifier: fromMatch[1], line: i + 1 })
      continue
    }
    // 侧效导入 import 'xxx'
    const sideMatch = line.match(/^\s*import\s+['"]([^'"]+)['"]/)
    if (sideMatch) {
      results.push({ specifier: sideMatch[1], line: i + 1 })
    }
  }
  return results
}

/**
 * 把导入说明符解析为「模块在 src 内的归属路径」。
 * @param {string} specifier 导入说明符
 * @param {string} importerFile 导入方文件（相对 src 的 POSIX 路径）
 * @returns {string | null} 归属路径（POSIX，相对 src）；无法解析时返回 undefined 语义由调用方判断
 */
function resolveImportTarget(specifier, importerFile) {
  if (specifier.startsWith('@/')) {
    // 唯一别名：@/* → src/*
    return specifier.slice(2)
  }
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    // 相对导入：基于导入方目录解析出 src 内路径
    const baseDir = posix.dirname(importerFile)
    return posix.normalize(posix.join(baseDir, specifier))
  }
  const pseudoPrefix = topLevelDirs.find((dir) => specifier === dir || specifier.startsWith(`${dir}/`))
  if (pseudoPrefix) {
    // 伪绝对导入：以 src 顶层目录名开头（如 from 'pages/x'），等同 src/x
    return specifier
  }
  // 其余视为第三方包或 node 内置模块，不属于 src 内部结构
  return null
}

/** 规则 1：禁止任何 index.tsx 桶入口 */
function checkNoIndexTsx(allFiles) {
  for (const file of allFiles) {
    if (file.endsWith('/index.tsx') || file === 'index.tsx') {
      violations.push({
        file,
        line: 0,
        rule: 'no-index-tsx',
        message: '禁止 index.tsx 桶入口；页面/组件入口必须是「目录名 = 文件名」（如 User/User.tsx）',
      })
    }
  }
}

/**
 * 规则 2 + 3：逐文件检查导入合法性（别名/相对/伪绝对 + 导入方向门禁）。
 * @param {string} file 当前文件（相对 src 的 POSIX 路径）
 * @param {string} text 源码文本
 */
function checkImports(file, text) {
  const imports = extractImports(text)
  for (const { specifier, line } of imports) {
    // 规则 2a：禁止 ../../ 及更深的多级相对导入（跨目录一律走 @ 别名）
    if (/^\.\.\/(\.\.\/)/.test(specifier)) {
      violations.push({
        file,
        line,
        rule: 'no-deep-relative-import',
        message: `禁止多级相对导入 '${specifier}'；跨目录引用必须使用 @/ 别名`,
      })
      continue
    }
    const target = resolveImportTarget(specifier, file)
    if (target === null) continue

    // 规则 2b：伪绝对导入（如 'pages/x'）按违规处理；
    // 相对导入（'./' 与单级 '../'，多级已被规则 2a 拦截）与 '@/' 别名均为合法形态。
    const isAlias = specifier.startsWith('@/')

    const isRelative = specifier.startsWith('./') || specifier.startsWith('../')
    if (!isAlias && !isRelative) {
      violations.push({
        file,
        line,
        rule: 'no-pseudo-absolute-import',
        message: `禁止伪绝对导入 '${specifier}'；必须使用 @/ 别名`,
      })
      continue
    }

    // 规则 3：导入方向门禁（传入解析后的目标路径，方向矩阵内部自行分层判定）
    checkDirection(file, line, specifier, target)
  }
}

/** 取 src 内路径的一级目录；根级文件返回 null */
function topLevelOf(pathInSrc) {
  const idx = pathInSrc.indexOf('/')
  return idx === -1 ? null : pathInSrc.slice(0, idx)
}

/** 取 features 路径的第二段业务域名（如 features/system/x → system）；非 features 路径返回 null */
function featureDomainOf(pathInSrc) {
  const match = pathInSrc.match(/^features\/([^/]+)(?:\/|$)/)
  return match ? match[1] : null
}

/**
 * 规则 3 的方向矩阵：
 * - services → pages/features/components/layouts：禁止（service 层不得依赖组件层）
 * - components|hooks → pages/features：禁止（共享层不得反向依赖业务装配层）
 * - features/A → features/B（A≠B）：禁止（业务域之间不得互相穿透；
 *   必须比较第二段子域名而非一级目录，否则同域内的合法导入会被误判）
 */
function checkDirection(file, line, specifier, target) {
  const fromDir = topLevelOf(file)
  const toDir = topLevelOf(target)
  if (fromDir === 'services' && ['pages', 'features', 'components', 'layouts'].includes(toDir)) {
    violations.push({
      file,
      line,
      rule: 'no-service-to-component-import',
      message: `service 层不得导入组件层：'${specifier}'（services → ${toDir}）`,
    })
  }
  if (['components', 'hooks'].includes(fromDir) && ['pages', 'features'].includes(toDir)) {
    violations.push({
      file,
      line,
      rule: 'no-shared-to-page-import',
      message: `共享层不得导入页面/业务域：'${specifier}'（${fromDir} → ${toDir}）`,
    })
  }
  const fromDomain = featureDomainOf(file)
  const toDomain = featureDomainOf(target)
  if (fromDomain && toDomain && fromDomain !== toDomain) {
    violations.push({
      file,
      line,
      rule: 'no-cross-feature-import',
      message: `features 业务域之间不得互相导入：'${specifier}'（${fromDomain} → ${toDomain}）`,
    })
  }
}

/**
 * 规则 4：业务源码禁止硬编码协议字面量与 IPv4 地址。
 * 检查整份源码文本（含注释）：门禁意图是阻止主机地址进入业务代码，
 * 注释中的示例同样不应出现完整 URL，示例一律写成相对路径（如 /fms/v1/...）。
 */
function checkNoHardcodedHost(file, text) {
  const patterns = [
    { name: 'hardcoded-url', regex: /\b(?:https?|wss?):\/\/[^\s'"]+/g, hint: '硬编码 URL' },
    {
      name: 'hardcoded-ipv4',
      regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
      hint: '硬编码 IPv4 地址',
    },
  ]
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    for (const { name, regex, hint } of patterns) {
      regex.lastIndex = 0
      const hit = regex.exec(lines[i])
      if (hit) {
        violations.push({
          file,
          line: i + 1,
          rule: name,
          message: `${hint} '${hit[0]}';主机与协议只允许出现在 vite.config.ts 的代理配置`,
        })
      }
    }
  }
}

/** 主流程：收集文件 → 初始化顶层目录 → 逐规则检查 → 汇总输出 */
function main() {
  const allFiles = collectSourceFiles(SRC)
  // 以实际目录结构生成伪绝对前缀集合，避免手工维护清单
  topLevelDirs = readdirSync(SRC).filter((name) => statSync(join(SRC, name)).isDirectory())

  checkNoIndexTsx(allFiles)
  for (const file of allFiles) {
    const text = readFileSync(join(SRC, file), 'utf8')
    checkImports(file, text)
    checkNoHardcodedHost(file, text)
  }

  if (violations.length > 0) {
    console.error(`check:structure 失败，共 ${violations.length} 处违规：`)
    for (const v of violations) {
      const location = v.line > 0 ? `${v.file}:${v.line}` : v.file
      console.error(`  [${v.rule}] ${location}`)
      console.error(`    ${v.message}`)
    }
    process.exit(1)
  }

  console.log(`check:structure 通过：${allFiles.length} 个源文件，无 index.tsx、无违规导入方向、无硬编码主机。`)
}

main()
