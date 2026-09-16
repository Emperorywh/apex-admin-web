/*
 * 包采用标准 ESM，ESLint 8 的 CommonJS 配置改用明确扩展名。
 * 保留现有规则，不自动格式化项目源码。
 */
module.exports = {
  extends: require.resolve('@umijs/lint/dist/config/eslint'),
  /*
   * 文档配置会被提交检查选中，因此显式纳入 ESLint 检查。
   * 覆盖点文件的默认忽略行为，使配置文件也能正常检查。
   */
  ignorePatterns: ['!.dumirc.ts'],
};
