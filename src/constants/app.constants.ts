/**
 * 应用级常量：页签缓存容量、全局进度延迟和应用级容量/时间边界。
 */

/** 非固定页签的最大缓存实例数；affix 页签不计入（SPEC §5.1） */
export const PAGE_CACHE_MAX_ENTRIES = 10

/** 全局进度条延迟显示时间（毫秒）；短于该值的导航不显示，避免闪烁 */
export const GLOBAL_PROGRESS_DELAY_MS = 120

/** 顶栏时钟刷新间隔（毫秒） */
export const CLOCK_TICK_INTERVAL_MS = 1_000
