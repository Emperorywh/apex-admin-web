/// <reference types="vite/client" />

/**
 * 严格环境变量类型：新增变量必须先在此登记，未声明的 key 在代码中不可见。
 */
interface ImportMetaEnv {
  /** API 基础路径，与后端 /api/v1 前缀对齐，默认 '/api/v1' */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
