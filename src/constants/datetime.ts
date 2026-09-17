/**
 * 业务时间展示的部署时区契约（迁移规格 11.3 / D23）：
 * - 业务时间、按天统计区间、Cron 业务日期一律跟随后端部署时区展示与计算，
 *   不随使用者浏览器的语言或时区漂移；
 * - 后端当前没有时区查询接口，因此通过部署配置（VITE_DEPLOY_TIMEZONE）注入，
 *   缺省 Asia/Shanghai；不得虚构查询 endpoint；
 * - 本常量只是全站唯一定义点；dayjs 时区插件与具体展示工具在 T00.7 接入时消费它，
 *   页面不得各自硬编码时区字符串。
 */

/** 部署时区默认值；部署侧可用 VITE_DEPLOY_TIMEZONE 覆盖 */
export const DEFAULT_DEPLOY_TIMEZONE = 'Asia/Shanghai'

/** 全站生效的部署时区（构建期注入，运行期只读） */
export const DEPLOY_TIMEZONE: string = import.meta.env.VITE_DEPLOY_TIMEZONE ?? DEFAULT_DEPLOY_TIMEZONE
