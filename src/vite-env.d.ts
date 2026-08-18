/// <reference types="vite/client" />

/**
 * 严格 ImportMetaEnv：显式列出全部环境变量，新增变量必须同步更新本文件
 * 与 vite.config.ts 的启动时校验（枚举值非法会使 dev/build 失败）。
 * PROXY_TARGET 仅服务端使用，不出现在客户端类型中。
 */
interface ImportMetaEnv {
  /** axios 实例 baseURL */
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
