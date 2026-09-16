module.exports = {
  extends: require.resolve('@umijs/max/eslint'),
  rules: {
    "no-unused-vars": ["error", { vars: "all", args: "after-used", ignoreRestSiblings: false }],
    "no-var": "error",
    "@typescript-eslint/no-unused-vars": "error",
    // https://zh-hans.eslint.org/docs/latest/rules/quotes
    quotes: ["error", "double", { allowTemplateLiterals: true, avoidEscape: true }],
    semi: ["error", "always"],
    "spaced-comment": ["error", "always"]
  }
};
