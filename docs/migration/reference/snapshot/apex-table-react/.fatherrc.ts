import { defineConfig } from 'father';

export default defineConfig({
  /*
   * 正式源码单独构建，文档演示集中放在 docs 中。
   * 构建后补齐标准 ESM 相对扩展名并复制两份独立样式。
   */
  esm: { output: 'dist', ignores: ['**/*.md'] },
});
