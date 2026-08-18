#!/usr/bin/env node
/**
 * VITE_DEMO_MODE=off 构建剔除检查（规格 §13.3/§19.2）。
 *
 * 流程（同一控制流内完成，finally 清理临时产物）：
 * 1. 以 VITE_DEMO_MODE=off 强制执行 vite build（process env 优先于 .env 文件，即使
 *    .env.production.local 覆盖了取值也按 off 构建）到临时目录 dist-demo-off-check；
 * 2. 递归扫描全部构建产物（js/css/html），检索 demo 模块未被 Rollup 剔除时才会出现的
 *    约定哨兵字符串 APEX_DEMO_SENTINEL 与 demo 账号/假数据标记；
 * 3. 命中任何标记即以非零退出码失败；构建失败同样非零退出。
 *
 * 标记清单与 src/demo 常量保持同步：新增 demo 专属字符串时同步更新 DEMO_ARTIFACT_MARKERS。
 * 扫描逻辑与标记清单单独导出，供按需复用（不触发真实构建）。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * 仓库根目录：只在 CLI 主流程解析，不在模块导入期求值（与 check-structure.mjs 同策略）。
 */
function repoRoot() {
  return fileURLToPath(new URL('..', import.meta.url))
}

/** off 构建临时产物目录（脚本退出前删除；不入库） */
export const DEMO_OFF_OUT_DIR = 'dist-demo-off-check'

/**
 * demo 模块残留标记（规格 §13.3 约定 + demo 假数据特征）：
 * - APEX_DEMO_SENTINEL：src/demo/demo.constants.ts 导出的约定哨兵；
 * - apex_demo_data：demo CRUD 快照 storage key；
 * - demo-at./demo-rt.：demo 双 token 前缀；demo-user-/demo-role-：种子数据 ID 前缀；
 * - 演示管理员/演示访客：demo 账号显示名。
 * 全部只可能来自 src/demo/ 与 src/features/demo/，正常代码与依赖不会出现。
 */
export const DEMO_ARTIFACT_MARKERS = Object.freeze([
  'APEX_DEMO_SENTINEL',
  'apex_demo_data',
  'demo-at.',
  'demo-rt.',
  'demo-user-',
  'demo-role-',
  '演示管理员',
  '演示访客',
])

/** 可扫描的产物扩展名 */
const SCANNABLE_EXTENSIONS = /\.(js|mjs|cjs|css|html)$/i

/** 递归收集目录下全部可扫描产物文件 */
export function collectArtifactFiles(rootDir) {
  const files = []
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = join(dir, entry.name)
      if (entry.isDirectory()) {
        visit(child)
      } else if (SCANNABLE_EXTENSIONS.test(entry.name)) {
        files.push(child)
      }
    }
  }
  visit(rootDir)
  return files
}

/**
 * 扫描产物内容中的 demo 残留标记。
 * @param {Array<{ path: string, content: string }>} artifacts
 * @returns {Array<{ path: string, marker: string }>} 命中列表（空数组表示通过）
 */
export function scanArtifactsForDemoMarkers(artifacts) {
  const hits = []
  for (const artifact of artifacts) {
    for (const marker of DEMO_ARTIFACT_MARKERS) {
      if (artifact.content.includes(marker)) {
        hits.push({ path: artifact.path, marker })
      }
    }
  }
  return hits
}

/** 执行 off 构建；返回子进程退出码（非 0 表示失败） */
function runOffBuild(outDir) {
  const result = spawnSync(
    'pnpm',
    ['exec', 'vite', 'build', '--outDir', outDir, '--emptyOutDir'],
    {
      cwd: repoRoot(),
      stdio: 'inherit',
      env: { ...process.env, VITE_DEMO_MODE: 'off' },
      shell: process.platform === 'win32',
    },
  )
  return result.status ?? 1
}

function main() {
  const outDir = resolve(repoRoot(), DEMO_OFF_OUT_DIR)
  try {
    const buildStatus = runOffBuild(DEMO_OFF_OUT_DIR)
    if (buildStatus !== 0) {
      console.error(`[check-demo-off] off 构建失败（退出码 ${buildStatus}）`)
      process.exitCode = 1
      return
    }
    if (!existsSync(outDir)) {
      console.error('[check-demo-off] 构建产物目录不存在，无法扫描')
      process.exitCode = 1
      return
    }
    const artifacts = collectArtifactFiles(outDir).map((path) => ({
      path,
      content: readFileSync(path, 'utf8'),
    }))
    if (artifacts.length === 0) {
      console.error('[check-demo-off] 构建产物为空，无法确认剔除')
      process.exitCode = 1
      return
    }
    const hits = scanArtifactsForDemoMarkers(artifacts)
    if (hits.length > 0) {
      console.error(`[check-demo-off] off 构建产物包含 demo 标记，共 ${hits.length} 处：`)
      for (const hit of hits) {
        console.error(`  [${hit.marker}] ${hit.path}`)
      }
      process.exitCode = 1
      return
    }
    console.log(`[check-demo-off] off 构建产物扫描通过：${artifacts.length} 个文件，demo 标记命中 0`)
  } finally {
    // 清理临时产物目录：与构建/扫描位于同一控制流（验证入口统一拥有清理）
    rmSync(outDir, { recursive: true, force: true })
  }
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  main()
}
