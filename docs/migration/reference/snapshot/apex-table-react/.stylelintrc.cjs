/*
 * 使用明确的 CommonJS 扩展名，兼容项目的 ESM 模式。
 * 保留样式质量规则，示例中的紧凑排版和合法大小写不作为提交阻断条件。
 */
module.exports = {
  extends: '@umijs/lint/dist/config/stylelint',
  overrides: [
    {
      files: ['docs/demos/**/*.css', 'examples/**/*.css'],
      rules: {
        'declaration-block-single-line-max-declarations': null,
        'rule-empty-line-before': null,
        'value-keyword-case': null,
      },
    },
  ],
};
