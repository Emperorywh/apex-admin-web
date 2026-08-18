# 资产来源与许可说明

本目录资产来自 MIT 许可的开源项目 [slash-admin](https://github.com/d3george/slash-admin)
（Copyright (c) 2023 d3george），随资产附原始许可证全文 [`LICENSE.slash-admin.txt`](./LICENSE.slash-admin.txt)。

- `icons/*.svg`：复用自 slash-admin `src/assets/icons/`（MIT）。原文件以 `currentColor`
  着色（前层实色 + `opacity: 0.32` 底层构成双色面性观感，24px 画布）。
  其中 `ic-role.svg` 为本项目按同风格增补的自绘图标（无需第三方许可）。
- `images/cyan-blur.png`、`images/red-blur.png`：复用自 slash-admin
  `src/assets/images/background/`（MIT），用于设置抽屉光斑装饰背景。
- `icons/*.iconify.json`：由 `scripts/generate-icon-collection.mjs` 从同目录 SVG
  生成的 IconifyJSON collection（构建期产物，随资产提交；重新生成：`node scripts/generate-icon-collection.mjs`）。

Iconify 仅以 `local:` 前缀离线注册（SPEC_UI2 §5.1 离线红线：禁止运行时请求
`api.iconify.design`，全部图标打进 bundle）。

## Inter Variable 字体（SPEC_UI2 §4.5）

Inter Variable 经 npm 依赖 `@fontsource-variable/inter` 自托管（代码 MIT /
字体 SIL OFL），仅拉丁子集 woff2 由 `src/styles/globals.css` 的 `@font-face`
注入构建产物，无 CDN 依赖；许可全文见
`node_modules/@fontsource-variable/inter/LICENSE`（SIL Open Font License 1.1）。

