# 代码格式

项目使用 Tab 缩进，每个 Tab 显示为 4 列；TypeScript 和 JavaScript 使用单引号、不添加行尾分号。Prettier 配置与 EditorConfig 共同维护这些规则，YAML 按语法要求使用空格缩进。

- 执行 `pnpm format` 格式化所有支持的项目文件，包括国际化资源。
- 执行 `pnpm format:check` 检查格式是否符合项目规则。
- VS Code 安装 Prettier 扩展（`esbenp.prettier-vscode`）后，使用项目配置在保存时自动格式化。

依赖、构建产物和包管理器锁文件不参与格式化。
