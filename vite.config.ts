import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 本地后端（C:\code\apex-admin）的 dev 代理目标，可用环境变量覆盖
const DEV_PROXY_TARGET = process.env.APEX_DEV_PROXY_TARGET ?? 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: DEV_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
})
