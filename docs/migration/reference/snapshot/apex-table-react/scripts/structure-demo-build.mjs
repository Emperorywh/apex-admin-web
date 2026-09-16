import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

/*
 * 独立页面使用正式包入口验证自动样式加载和 props 主题配置。
 * 输出是可再生文档资源，源码和组件包始终保持分离。
 */
const directory = 'public/structure-only';
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--project', 'examples/structure-only/tsconfig.json'], { stdio: 'inherit' });
await mkdir(directory, { recursive: true });
await mkdir('.artifacts', { recursive: true });
const result = await build({ entryPoints: ['examples/structure-only/App.tsx'], outdir: directory, bundle: true, minify: true, metafile: true, format: 'esm', target: 'es2020', define: { 'process.env.NODE_ENV': '"production"' } });
/*
 * 验证默认入口确实带入两份必要样式，消费页面无需手动导入。
 * 输出链接由构建工具生成，只负责加载组件入口收集的样式产物。
 */
for (const style of ['structure.css', 'theme.css']) {
  if (!Object.keys(result.metafile.inputs).some((file) => file.endsWith(`/styles/${style}`))) throw new Error(`组件入口未自动加载 ${style}`);
}
await writeFile('.artifacts/structure-only-metafile.json', JSON.stringify(result.metafile, null, 2));
await writeFile(`${directory}/index.html`, '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Props 主题 · 两种品牌</title><link rel="stylesheet" href="App.css"></head><body style="margin:0"><div id="root"></div><script type="module" src="App.js"></script></body></html>');
console.log('已生成自动加载组件样式的双主题示例。');
