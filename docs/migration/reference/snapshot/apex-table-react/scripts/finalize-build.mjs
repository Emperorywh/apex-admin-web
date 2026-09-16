import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

/*
 * father 保留的无扩展相对引用在原生 ESM 中不可解析。
 * 只处理本次构建目录中的产物，源码与用户暂存区均保持不动。
 */
const root = path.resolve('dist');
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(filename);
    else if (/\.(?:js|d\.ts)$/.test(entry.name)) {
      const source = await readFile(filename, 'utf8');
      const imports = [...source.matchAll(/((?:from\s*|import\s*|import\s*\()(['"]))(\.[^'"]+)(\2)/g)];
      let result = source;
      for (const match of imports) {
        const target = path.resolve(path.dirname(filename), match[3]);
        let suffix = '';
        if (!path.extname(target)) {
          try { if ((await stat(`${target}.js`)).isFile()) suffix = '.js'; } catch { /*
            * 文件入口不存在时尝试目录入口，保留外部依赖原样。
            * 不猜测或改写消费方包名。
            */ }
          if (!suffix) { try { if ((await stat(path.join(target, 'index.js'))).isFile()) suffix = '/index.js'; } catch { /*
            * 类型文件可能没有对应运行时文件，交由类型检查发现真正的缺失。
            * 无关资源引用保持原样。
            */ } }
        }
        if (suffix) result = result.replaceAll(`${match[1]}${match[3]}${match[4]}`, `${match[1]}${match[3]}${suffix}${match[4]}`);
      }
      if (result !== source) await writeFile(filename, result);
    }
  }
}
await visit(root);
await mkdir(path.join(root, 'styles'), { recursive: true });
for (const file of ['structure.css', 'theme.css']) await copyFile(path.resolve('src/styles', file), path.join(root, 'styles', file));
console.log('ESM 引用与独立 CSS 产物已准备完成。');
