/**
 * @description Dashboard 业务时区与时间桶统一入口
 *
 * 集中初始化 dayjs 的 utc/timezone/isoWeek 插件，
 * 并提供业务时区（mock 阶段固定为 Asia/Shanghai）下的：
 *   - 自然日边界（按业务时区切分 00:00）
 *   - 整点小时桶 / 自然日桶 / ISO 周桶
 *
 * 边界规则（§6.5）：
 *   - 其他 Dashboard 模块只允许调用本模块导出的纯函数，
 *     不得各自调用本地时区 API 推导边界，避免口径漂移。
 *   - UTC 仅用于日期序号运算，不代表业务事件采用 UTC 时区。
 */
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

/**
 * 一次性初始化 Dashboard 所需的 dayjs 插件。
 * 多次调用幂等（dayjs.extend 内部已去重）。
 */
export function initDayjsPlugins(): void {
    dayjs.extend(utc);
    dayjs.extend(timezone);
    dayjs.extend(isoWeek);
}

// 初始化在模块加载时立即完成，保证后续纯函数可用
initDayjsPlugins();

/**
 * mock 阶段业务时区固定为 Asia/Shanghai（§3.3）。
 * 后续接入真实后端时若需按站点切换，集中修改此处即可。
 */
export const BUSINESS_TIMEZONE = "Asia/Shanghai";

/**
 * 将 YYYY-MM-DD 字符串解析为业务时区当天的 00:00 时刻（带时区偏移的 ISO 8601）。
 * 用于把"业务时区中的自然日"映射为带偏移的精确时刻，供后续桶切分使用。
 */
export function startOfDayInBusinessTz(dateStr: string): dayjs.Dayjs {
    return dayjs.tz(dateStr, BUSINESS_TIMEZONE).startOf("day");
}

/**
 * 业务时区下今天（基于注入时钟）的 YYYY-MM-DD。
 * 注入时钟而非直接 new Date() 便于 mock 与测试确定性。
 */
export function todayDateStr(now: number = Date.now()): string {
    return dayjs.tz(now, BUSINESS_TIMEZONE).format("YYYY-MM-DD");
}

/**
 * 业务时区下的整点小时桶。
 * 返回 [bucketStart, bucketEnd) 区间内的 ISO 8601 时刻字符串，
 * 每个桶为一个整点小时。区间左闭右开。
 */
export function hourlyBuckets(startDate: string, endDate: string, now: number): Array<{ bucketStart: string; bucketEnd: string }> {
    const start = startOfDayInBusinessTz(startDate);
    const end = startOfDayInBusinessTz(endDate).add(1, "day");
    const nowDayjs = dayjs.tz(now, BUSINESS_TIMEZONE);
    const buckets: Array<{ bucketStart: string; bucketEnd: string }> = [];
    let cursor = start;
    while (cursor.isBefore(end)) {
        // 今日已完成的小时才纳入趋势（§5.1 只展示截至当前小时的数据）
        const bucketEnd = cursor.add(1, "hour");
        if (cursor.isAfter(nowDayjs)) break;
        buckets.push({
            bucketStart: cursor.toISOString(),
            // 保持 dayjs.tz 的偏移：用 .format 输出带偏移的 ISO 8601
            bucketEnd: bucketEnd.toISOString(),
        });
        cursor = bucketEnd;
    }
    return buckets;
}

/**
 * 业务时区下的自然日桶。
 * 每个桶为一个自然日 [00:00, 次日 00:00)。
 */
export function dailyBuckets(startDate: string, endDate: string): Array<{ bucketStart: string; bucketEnd: string }> {
    const start = startOfDayInBusinessTz(startDate);
    const end = startOfDayInBusinessTz(endDate).add(1, "day");
    const buckets: Array<{ bucketStart: string; bucketEnd: string }> = [];
    let cursor = start;
    while (cursor.isBefore(end)) {
        const next = cursor.add(1, "day");
        buckets.push({
            bucketStart: cursor.toISOString(),
            bucketEnd: next.toISOString(),
        });
        cursor = next;
    }
    return buckets;
}

/**
 * ISO 周桶（周一至周日）。
 * 区间首尾允许部分周：
 *   - 第一桶从 startDate 开始（即使是周中），到该周周日结束。
 *   - 最后一桶从其周一开始（即使是周中），到 endDate 结束。
 * 周首尾不足整周时按实际覆盖天数计算频率（§6.4）。
 */
export function isoWeekBuckets(startDate: string, endDate: string): Array<{ bucketStart: string; bucketEnd: string }> {
    const start = startOfDayInBusinessTz(startDate);
    const end = startOfDayInBusinessTz(endDate).add(1, "day"); // 左闭右开
    const buckets: Array<{ bucketStart: string; bucketEnd: string }> = [];
    let cursor = start;
    while (cursor.isBefore(end)) {
        // isoWeek 周一为 1，周日为 7
        // 计算当前周周日 23:59:59.999 后取下一日 00:00 作为桶右边界
        const dayOfWeek = cursor.isoWeekday(); // 1..7
        const daysToSundayEnd = 7 - dayOfWeek; // 到本周日结束还差几天
        let bucketEnd = cursor.add(daysToSundayEnd + 1, "day").startOf("day");
        // 最后一桶不能越过 end
        if (bucketEnd.isAfter(end)) bucketEnd = end;
        buckets.push({
            bucketStart: cursor.toISOString(),
            bucketEnd: bucketEnd.toISOString(),
        });
        cursor = bucketEnd;
    }
    return buckets;
}

/**
 * 计算一个桶实际覆盖的自然日数量。
 * 用于故障频率归一化（§6.4：小时桶按实际小时数除以 24，周首尾不足整周按实际覆盖天数）。
 */
export function bucketCalendarDays(bucketStart: string, bucketEnd: string): number {
    const start = dayjs(bucketStart);
    const end = dayjs(bucketEnd);
    // 左闭右开区间，覆盖天数 = ceil(差值毫秒 / 一天毫秒)
    const diffDays = end.diff(start, "day", true);
    return Math.max(1, Math.round(diffDays));
}

/**
 * 格式化桶起始时刻为展示标签（§6.5）。
 *   - hour 桶：MM-DD HH:00
 *   - day 桶：YYYY-MM-DD
 *   - week 桶：YYYY-Www（ISO 周编号）
 */
export function formatBucketLabel(bucketStart: string, granularity: "hour" | "day" | "week", locale: string): string {
    const d = dayjs(bucketStart);
    if (granularity === "hour") {
        return d.format("MM-DD HH:00");
    }
    if (granularity === "day") {
        return d.format("YYYY-MM-DD");
    }
    // week：ISO 周编号，年份取 ISO 周所在年份（isoWeekYear）
    return `${d.isoWeekYear()}-W${String(d.isoWeek()).padStart(2, "0")}`;
}
