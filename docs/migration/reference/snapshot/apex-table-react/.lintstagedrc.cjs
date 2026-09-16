/*
 * 提交时只检查代码，不自动修复或格式化源码、文档及配置。
 * 保留 lint-staged 对部分暂存文件的隔离与备份恢复能力。
 */
module.exports = {
  '*.{js,jsx,ts,tsx}': 'eslint',
  '*.{css,less}': 'stylelint',
};
