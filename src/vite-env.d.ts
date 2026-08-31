/// <reference types="vite/client" />

/**
 * 严格 ImportMetaEnv：显式列出全部环境变量。
 * 纯前端模式下当前无任何自定义环境变量（原 VITE_API_BASE_URL 已随请求层移除）。
 */
interface ImportMetaEnv {}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
