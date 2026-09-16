/**
 * @description Dashboard 业务策略常量集中定义（§8 边界规则）
 *
 * 轮询间隔、粒度边界、利用率颜色阈值、滚动速度等魔法数字
 * 统一在此定义，禁止散落在组件中。
 */

/**
 * 实时轮询间隔：5 秒（§2 / §4.3）。
 * 请求完成后开始计算下一次间隔。
 */
export const REALTIME_POLL_INTERVAL_MS = 5_000;

/**
 * 实时滚动列表规模上限（§12.2）。
 */
export const REALTIME_LIST_MAX_ITEMS = 100;

/**
 * 实时看板订单统计天数：2 表示覆盖今天 + 昨天（§5.1）。
 * 昨日数据用于今日 KPI 的同时刻环比基线和趋势图的昨日对比线。
 */
export const REALTIME_BOARD_STAT_DAYS = 2;

/**
 * 任务统计报表默认统计天数：7 表示近 7 个自然日（含今天）。
 * 后端接口仅支持按天数统计（不支持任意起止日期），
 * 页面提供「统计天数」输入框，查询时以用户输入的天数为准，此处仅为默认值。
 */
export const TASK_STATISTICS_REPORT_DAYS = 7;

/**
 * 故障告警报表默认统计窗口天数：14 表示近 14 个自然日（含今天）。
 * 接口支持任意起止时间（startTime/endTime），页面 TimeRangePicker 可任选区间，
 * 此处仅为初始默认窗口的天数。
 */
export const FAULT_ALERT_REPORT_DAYS = 14;

/**
 * 利用率颜色阈值（§5.3）：
 *   < 50% 红
 *   50% – < 70% 黄
 *   ≥ 70% 绿
 * 阈值为 0–1 小数，与领域层比例单位一致。
 */
export const UTILIZATION_THRESHOLDS = {
    LOW: 0.5,
    HIGH: 0.7,
} as const;

/**
 * mock 数据生成的默认区间天数：近 7 个自然日（含今天）。
 * 报表接口均按固定天数统计、页面不提供时间区间选择（区间工具栏已移除），
 * 该常量仅供 mock 仓储构造默认区间使用。
 */
export const DEFAULT_RANGE_DAYS = 7;

/**
 * 表格分页大小选项（§5.2 / §5.4）。
 */
export const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

/**
 * 报表默认 mock 延迟（§17 性能基线测试条件：300ms）。
 */
export const DEFAULT_MOCK_LATENCY_MS = 300;

/**
 * KPI 卡片主值字号 / 单位字号（§10.1）。
 */
export const KPI_VALUE_FONT_SIZE_PX = 28;
export const KPI_UNIT_FONT_SIZE_PX = 16;
export const KPI_LABEL_FONT_SIZE_PX = 12;

/**
 * 图表默认高度（§10.2）。
 */
export const CHART_HEIGHT_PX = 280;
export const CHART_PANEL_MIN_HEIGHT_PX = 320;

/**
 * prefers-reduced-motion 媒体查询。
 */
export const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";
