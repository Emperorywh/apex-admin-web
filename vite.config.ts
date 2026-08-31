import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * 纯前端模式：无后端 API 依赖，不需要环境变量校验与 /api 代理。
 */
export default defineConfig(() => {
  return {
    base: '/',
    plugins: [react()],
    resolve: {
      alias: {
        // 唯一路径别名 @ -> src，基于配置文件位置解析，不依赖当前工作目录
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
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
