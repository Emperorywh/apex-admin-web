/// <reference types="vite/client" />

/**
 * 严格环境变量类型：新增变量必须先在此登记，未声明的 key 在代码中不可见。
 */
interface ImportMetaEnv {
  /**
   * API 基础路径，与调度后端 /fms/v1 前缀对齐，默认 '/fms/v1'。
   * 仅部署拓扑变化时覆盖（如同源反向代理使用不同前缀），业务代码不感知主机地址。
   */
  readonly VITE_API_BASE_URL?: string
  /**
   * 后端部署时区（迁移规格 11.3 / D23）：业务时间与按天统计跟随后端部署时区，
   * 不随浏览器时区漂移；缺省 'Asia/Shanghai'。由部署配置注入，如 'Asia/Shanghai'。
   */
  readonly VITE_DEPLOY_TIMEZONE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
