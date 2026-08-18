import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/** VITE_DEMO_MODE 合法取值，见规格 §13.1 */
const DEMO_MODE_VALUES = ['off', 'force', 'fallback'] as const

/**
 * 启动时校验枚举类环境变量；非法值使 dev/build 直接失败。
 * 校验发生在 Vite 配置加载阶段，dev 与 build 均会执行。
 */
function assertEnv(env: Record<string, string>): void {
  const demoMode = env.VITE_DEMO_MODE
  if (demoMode !== undefined && !DEMO_MODE_VALUES.includes(demoMode as (typeof DEMO_MODE_VALUES)[number])) {
    throw new Error(
      `[env] VITE_DEMO_MODE 非法：${demoMode}，合法取值为 ${DEMO_MODE_VALUES.join(' | ')}`,
    )
  }
  const apiBaseUrl = env.VITE_API_BASE_URL
  if (apiBaseUrl !== undefined && !/^(\/|https?:\/\/)/.test(apiBaseUrl)) {
    throw new Error(`[env] VITE_API_BASE_URL 非法：${apiBaseUrl}，必须以 / 或 http(s):// 开头`)
  }
}

export default defineConfig(({ mode }) => {
  // 读取包括 PROXY_TARGET 在内的全部环境变量；PROXY_TARGET 不带 VITE_ 前缀，不暴露给客户端
  const env = loadEnv(mode, process.cwd(), '')
  assertEnv(env)

  return {
    base: '/',
    plugins: [react()],
    resolve: {
      alias: {
        // 唯一路径别名 @ -> src，基于配置文件位置解析，不依赖当前工作目录
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: env.PROXY_TARGET
        ? {
            '/api': {
              target: env.PROXY_TARGET,
              changeOrigin: true,
            },
          }
        : undefined,
    },
    build: {
      rollupOptions: {
        output: {
          // 拆分大依赖，避免单 chunk 过大；以构建分析结果为准继续调整
          manualChunks(id: string): string | undefined {
            if (!id.includes('node_modules')) {
              return undefined
            }
            if (/[\\/]node_modules[\\/](echarts|zrender)[\\/]/.test(id)) {
              return 'echarts'
            }
            if (/[\\/]node_modules[\\/](antd|@ant-design[\\/]|rc-[^\\/]+)[\\/]/.test(id)) {
              return 'antd'
            }
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
              return 'react'
            }
            return undefined
          },
        },
      },
    },
  }
})
