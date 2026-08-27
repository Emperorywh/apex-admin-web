/**
 * 结构门禁（SPEC §3）：目录/命名、导入方向、深层相对路径与 index 文件。
 * 任何违规即以非零码退出，阻断提交与 CI。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = join(process.cwd(), 'src')
const violations = []

function walk(dir, onFile) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stats = statSync(full)
    if (stats.isDirectory()) walk(full, onFile)
    else onFile(full)
  }
}

/** 相对 src 的 POSIX 路径 */
function rel(filePath) {
  return relative(ROOT, filePath).split(sep).join('/')
}

/** 顶层分层：pages/features/services/hooks/components/types/constants/layouts/router/store/i18n/utils/styles */
function topLayer(relPath) {
  return relPath.split('/')[0]
}

/* -------------------------------------------------------------------------- */
/* 1. 命名与 index 文件                                                          */
/* -------------------------------------------------------------------------- */

walk(ROOT, (filePath) => {
  const relPath = rel(filePath)
  const segments = relPath.split('/')
  const fileName = segments.at(-1)

  if (fileName === 'index.tsx') {
    violations.push(`禁止 index.tsx 承载实现：src/${relPath}`)
  }
})

walk(ROOT, (filePath) => {
  const relPath = rel(filePath)
  if (!relPath.startsWith('pages/')) return
  const segments = relPath.split('/')
  const fileName = segments.at(-1)
  if (!fileName.endsWith('.tsx') || fileName.endsWith('.module.css.tsx')) return
  const fileBase = fileName.replace(/\.tsx$/, '')
  const dirName = segments.at(-2)
  if (segments.length >= 3 && fileBase !== dirName) {
    violations.push(`页面入口必须与文件夹同名：src/${relPath}（期望 ${dirName}/${dirName}.tsx）`)
  }
})

/* -------------------------------------------------------------------------- */
/* 2. 深层相对路径与伪绝对导入                                                     */
/* -------------------------------------------------------------------------- */

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.css'])

walk(ROOT, (filePath) => {
  const relPath = rel(filePath)
  if (!SOURCE_EXTENSIONS.has(relPath.slice(relPath.lastIndexOf('.')))) return
  const content = readFileSync(filePath, 'utf8')
  if (/(^|['"\s])\.\.\/\.\.\//.test(content)) {
    violations.push(`出现 ../../ 或更深层相对导入：src/${relPath}（改用 @/ 别名）`)
  }
  for (const match of content.matchAll(/from\s+['"]((?:src|pages|features|services|components|hooks|types|constants|layouts|router|store|i18n|utils)\/[^'"]*)['"]/g)) {
    violations.push(`伪绝对导入：src/${relPath} 引用了 ${match[1]}（必须以 @/ 开头）`)
  }
})

/* -------------------------------------------------------------------------- */
/* 3. 导入方向门禁                                                               */
/* -------------------------------------------------------------------------- */

/** layer → 允许引用的顶层前缀（含跨层白名单）；未列出的顶层一律禁止 */
const ALLOWED_TARGETS = {
  utils: [],
  constants: [],
  types: [],
  i18n: ['constants', 'i18n'],
  store: ['constants', 'types', 'i18n', 'store'],
  components: ['constants', 'types', 'hooks', 'services/feedback', 'components', 'utils', 'store', 'i18n'],
  hooks: ['constants', 'types', 'components', 'store', 'i18n', 'utils'],
  services: ['constants', 'types', 'utils', 'store', 'services', 'i18n'],
  layouts: ['constants', 'types', 'hooks', 'components', 'features', 'services', 'store', 'layouts', 'i18n', 'utils', 'router'],
  pages: ['constants', 'types', 'hooks', 'components', 'features', 'services', 'store', 'layouts', 'i18n', 'utils', 'router'],
  router: ['constants', 'types', 'components', 'layouts', 'pages', 'store', 'i18n', 'utils', 'router'],
  features: ['constants', 'types', 'hooks', 'components', 'features', 'services', 'store', 'i18n', 'utils'],
}

/** types 层对 services 的唯一例外：协议基础类型 */
const TYPES_SERVICE_EXCEPTION = '@/services/request/request.types'

walk(ROOT, (filePath) => {
  const relPath = rel(filePath)
  if (!/\.(ts|tsx)$/.test(relPath)) return
  const layer = topLayer(relPath)
  const allowed = ALLOWED_TARGETS[layer]
  if (!allowed) return
  const content = readFileSync(filePath, 'utf8')

  for (const match of content.matchAll(/from\s+['"]@\/([^'"]+)['"]/g)) {
    const target = match[1]
    const targetLayer = topLayer(target)
    const permitted =
      targetLayer === layer ||
      allowed.includes(targetLayer) ||
      allowed.some((prefix) => target.startsWith(`${prefix}/`)) ||
      (layer === 'types' && `@/${target}` === TYPES_SERVICE_EXCEPTION)
    if (!permitted) {
      violations.push(`导入越界：src/${relPath} → @/${target}（${layer} 层不允许引用 ${targetLayer}）`)
    }
  }
})

/* -------------------------------------------------------------------------- */
/* 汇总                                                                        */
/* -------------------------------------------------------------------------- */

if (violations.length > 0) {
  console.error(`✖ 结构门禁未通过（${violations.length} 处）：\n`)
  for (const violation of violations) {
    console.error(`  - ${violation}`)
  }
  process.exit(1)
} else {
  console.log('✔ 结构门禁通过')
}
