import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/**
 * 同源代理前缀契约：
 * - 前端 service 层统一以 /fms/v1 为基础路径发起请求（见 src/services/request/request.constants.ts）；
 * - dev 代理把 /fms 前缀原样转发到目标服务器，不做 rewrite —— 上游收到的最终路径
 *   保持为 /fms/v1/...，与 OpenAPI 声明一致；
 * - 生产环境不走此代理，由同源反向代理转发 /fms，同样不改变路径前缀。
 */
export default defineConfig(({ mode }) => {
  // 代理目标以项目根 .env.local 的 APEX_DEV_LEGACY_TARGET 为唯一配置源（迁移规格 4.4 节 D31）。
  // config 阶段直接读 process.env 在不同 Vite 版本下行为不一致，loadEnv('' 前缀) 是官方约定入口；
  // .env.local 不入库，未配置时兜底指向 OpenAPI 文档服务地址，保证 CI/他人克隆可直接启动。
  const env = loadEnv(mode, process.cwd(), '')
  const DEV_PROXY_TARGET = env.APEX_DEV_LEGACY_TARGET ?? 'http://10.11.2.67:8888'

  return {
    plugins: [react()],
    // 预声明按需优化依赖（T00.7）：konva/react-konva 体积大且目前无页面入口引用，
    // 不预声明会在首个消费者触发"动态发现优化 → 整页二次 reload"，
    // 且浏览器的 immutable 缓存可能拿到旧产物造成双 React 实例（Invalid hook call）。
    optimizeDeps: {
      include: ['react-konva'],
    },
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
  }
})
