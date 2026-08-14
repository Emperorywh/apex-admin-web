// 一次性辅助：写入 .husky/pre-push 钩子内容后删除自身
import { writeFileSync, unlinkSync } from 'node:fs'

writeFileSync(
  new URL('../.husky/pre-push', import.meta.url),
  '# 只读检查：全项目引用构建类型检查，不伪装为仅检查暂存文件\npnpm typecheck\n',
)
unlinkSync(new URL('./write-pre-push.tmp.mjs', import.meta.url))
console.log('pre-push written')
