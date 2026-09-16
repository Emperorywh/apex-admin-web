import { defineConfig } from 'dumi';
import { resolve } from 'node:path';

export default defineConfig({
  /*
   * 文档使用正式包名导入组件及公开子入口，与开发者接入方式一致。
   * 本地预览将包名映射到源码目录，示例无需修改导入即可展示最新实现。
   */
  alias: { 'apex-table-react': resolve(__dirname, 'src') },
  /*
   * 文档沿用 dumi，示例引用正式源码并与运行时包分离。
   * 页面文案默认中文，组件名仍保留项目既有名称。
   */
  outputPath: 'docs-dist',
  themeConfig: {
    name: 'ApexTableReact',
    /*
     * 文档首次访问采用浅色，保留亮色、暗色和跟随系统三种偏好。
     * 本地主题插槽沿用 dumi 的偏好管理，刷新及路由切换后保持选择。
     */
    prefersColor: { default: 'light', switch: true },
  },
});
