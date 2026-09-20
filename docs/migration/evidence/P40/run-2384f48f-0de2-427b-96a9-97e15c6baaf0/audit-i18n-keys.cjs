/**
 * P40 五语言分片 key 同构审计（无凭据验证脚本，可持久保存）。
 * - 对比 en-US/zh-TW/ja-JP/ko-KR 四分片的 key 集合零差异；
 * - 收集页面与组件源码中 t('…') 使用的 key + sevOf 档位文案动态 key，
 *   核对全部被分片覆盖（zh-CN key 即文案，无需资源文件）。
 */
const { readFileSync } = require('node:fs')

const langs = ['en-US', 'zh-TW', 'ja-JP', 'ko-KR']
const keys = {}
for (const lang of langs) {
  const src = readFileSync(`src/i18n/locales/${lang}/server-resource.ts`, 'utf-8')
  keys[lang] = [...src.matchAll(/^\s*'((?:[^'\\]|\\.)+)':/gm)].map((m) => m[1])
}
const base = keys['en-US']
let ok = true
for (const lang of langs) {
  const miss = base.filter((k) => !keys[lang].includes(k))
  const extra = keys[lang].filter((k) => !base.includes(k))
  if (miss.length || extra.length) {
    ok = false
    console.log(lang, 'missing:', miss, 'extra:', extra)
  }
}
console.log(`en-US keys: ${base.length}；四语言同构: ${ok}`)

// 页面/组件 t() key 覆盖
const sources = [
  'src/pages/analyze-visual/ServerRealtimeResources/ServerRealtimeResources.tsx',
  'src/features/server-resource/components/DiskPanel.tsx',
  'src/features/server-resource/components/SnapshotTableModal.tsx',
  'src/features/server-resource/components/ResourceGauge.tsx',
].map((p) => readFileSync(p, 'utf-8'))
const used = new Set()
for (const src of sources) {
  for (const m of src.matchAll(/[^\w.]t\(\s*'((?:[^'\\]|\\.)+)'/g)) used.add(m[1])
}
// sevOf 档位文案经 t(sev.t) 动态消费（resourcePolicy 定义）
for (const k of ['正常', '偏高', '危险']) used.add(k)
const dict = new Set(base)
const uncovered = [...used].filter((k) => !dict.has(k))
console.log(`页面使用的 key: ${used.size}；未覆盖: ${uncovered.length ? uncovered : '无'}`)
if (!ok || uncovered.length) process.exit(1)
