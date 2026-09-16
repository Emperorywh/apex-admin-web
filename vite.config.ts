import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type ProxyOptions } from 'vite'

// 本地后端（C:\code\apex-admin）的 dev 代理目标，可用环境变量覆盖
const DEV_PROXY_TARGET = process.env.APEX_DEV_PROXY_TARGET ?? 'http://localhost:8000'

/**
 * 旧调度后端（旧项目 C:\code\dd）的 dev 代理目标。
 *
 * 旧后端同时暴露 /fms 与 /rcsFlow 两个业务前缀（旧项目 .umirc.ts 中两者指向同一
 * 地址，注意 rcsFlow 的 F 为大写），迁移期页面将逐步改为请求这两个前缀。
 *
 * 测试地址须由用户另行提供（SPEC §14），未提供前保持未注册状态：
 * 请求会直接 404 而不会误连旧 .umirc.ts 里遗留的内网生产地址。
 */
const LEGACY_PROXY_TARGET = process.env.APEX_DEV_LEGACY_TARGET

// 按需生成代理条目：目标未配置时返回空对象，不注册对应前缀
function legacyProxy(prefix: string, target?: string): Record<string, ProxyOptions> {
  if (!target) {
    return {}
  }
  return {
    [prefix]: {
      target,
      changeOrigin: true,
    },
  }
}

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
      // 旧业务协议前缀，配置 APEX_DEV_LEGACY_TARGET 后才生效；
      // 运行条件与解除方式见 docs/migration/environment.md
      ...legacyProxy('/fms', LEGACY_PROXY_TARGET),
      ...legacyProxy('/rcsFlow', LEGACY_PROXY_TARGET),
    },
  },
})
