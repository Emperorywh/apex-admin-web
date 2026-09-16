/*
 * 项目启用了 ESM，使用 .cjs 明确按 CommonJS 加载此配置。
 * 保留现有格式化规则，避免提交钩子加载配置时失败。
 */
module.exports = {
  pluginSearchDirs: false,
  plugins: [
    require.resolve('prettier-plugin-organize-imports'),
    require.resolve('prettier-plugin-packagejson'),
  ],
  printWidth: 80,
  proseWrap: 'never',
  singleQuote: true,
  trailingComma: 'all',
  overrides: [
    {
      files: '*.md',
      options: {
        proseWrap: 'preserve',
      },
    },
  ],
};
