import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * 开发代理目标（迁移规格 4.4 节 D31）：
 * - 默认指向调度系统联调环境 http://10.11.2.67:8888（OpenAPI 文档服务地址）；
 * - 可用环境变量 APEX_DEV_PROXY_TARGET 覆盖，便于专用测试环境联调；
 * - 业务代码一律走同源相对路径（/fms/v1/...），不允许硬编码 IP/协议/端口。
 */
const DEV_PROXY_TARGET = process.env.APEX_DEV_PROXY_TARGET ?? 'http://10.11.2.67:8888'

/**
 * 同源代理前缀契约：
 * - 前端 service 层统一以 /fms/v1 为基础路径发起请求（见 src/services/request/request.constants.ts）；
 * - dev 代理把 /fms 前缀原样转发到目标服务器，不做 rewrite —— 上游收到的最终路径
 *   保持为 /fms/v1/...，与 OpenAPI 声明一致；
 * - 生产环境不走此代理，由同源反向代理转发 /fms，同样不改变路径前缀。
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/fms': {
        target: DEV_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
})
