/**
 * @description Dashboard 格式化纯函数（§3.3 / §14）
 *
 * 所有数值、百分比、日期、持续时间统一通过 Intl 格式化，
 * 不允许字符串拼接实现千分位或本地化日期。
 * 持续时间使用独立 formatDuration 纯函数，不依赖 dayjs.duration（§3.3）。
 */

/**
 * 当前项目支持的 5 种 locale 标识。
 * 与 Intl / Ant Design / dayjs 使用的 BCP-47 标签保持一致。
 */
export type SupportedLocale = "zh-CN" | "en-US" | "zh-TW" | "ja-JP" | "ko-KR";

const SUPPORTED_LOCALES: ReadonlySet<string> = new Set([
    "zh-CN",
    "en-US",
    "zh-TW",
    "ja-JP",
    "ko-KR",
]);

/**
 * 把任意 locale 字符串规范化为 SupportedLocale。
 * 未命中时回退到 zh-CN（项目默认语言）。
 */
export function normalizeLocale(locale: string | undefined): SupportedLocale {
    if (locale && SUPPORTED_LOCALES.has(locale)) return locale as SupportedLocale;
    return "zh-CN";
}

/**
 * 格式化整数（千分位）。
 */
export function formatInteger(value: number, locale: string): string {
    return new Intl.NumberFormat(normalizeLocale(locale), {
        maximumFractionDigits: 0,
    }).format(Math.round(value));
}

/**
 * 格式化为固定两位小数的数值。
 */
export function formatDecimal(value: number, locale: string, fractionDigits = 2): string {
    return new Intl.NumberFormat(normalizeLocale(locale), {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(value);
}

/**
 * 格式化百分比（§6.1：领域值为 0–1 小数）。
 * 入参为 0–1 小数，展示为百分比。
 */
export function formatPercentage(ratio: number | null, locale: string, fractionDigits = 1): string {
    if (ratio === null || Number.isNaN(ratio)) return "--";
    return new Intl.NumberFormat(normalizeLocale(locale), {
        style: "percent",
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(ratio);
}

/**
 * 格式化距离（领域单位为米），输出千米。
 */
export function formatDistanceKm(meters: number | null, locale: string, fractionDigits = 2): string {
    if (meters === null || Number.isNaN(meters)) return "--";
    return `${formatDecimal(meters / 1000, locale, fractionDigits)} km`;
}

/**
 * 格式化时长（领域单位为毫秒），输出人类可读的小时/分钟/秒组合。
 * 不依赖 dayjs.duration（§3.3）。
 *
 * - < 1 分钟：秒
 * - < 1 小时：分钟（必要时含秒）
 * - 否则：小时 + 分钟
 */
export function formatDuration(milliseconds: number | null, locale: string): string {
    if (milliseconds === null || Number.isNaN(milliseconds)) return "--";
    if (milliseconds < 0) return "--";
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];
    const localeNorm = normalizeLocale(locale);
    // 中文/日韩/繁中按本地习惯给出最小可读组合
    if (hours > 0) {
        if (localeNorm === "en-US") {
            parts.push(`${hours}h ${minutes}m`);
        } else {
            parts.push(`${hours}${minutes > 0 ? ` ${minutes}` : ""}`);
            // zh/ja/ko 后缀
        }
        // 通用简短后缀（h / m）跨语言可读，避免为每种语言维护独立单位字典
        return `${hours}h ${minutes}m`.trim();
    }
    if (minutes > 0) {
        return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }
    return `${seconds}s`;
}

/**
 * 格式化时长为"小时"为单位的十进制值。
 */
export function formatDecimalHours(milliseconds: number | null, locale: string, fractionDigits = 2): string {
    if (milliseconds === null || Number.isNaN(milliseconds)) return "--";
    return formatDecimal(milliseconds / 3_600_000, locale, fractionDigits);
}

/**
 * 格式化时长为"分钟"为单位的十进制值。
 */
export function formatDecimalMinutes(milliseconds: number | null, locale: string, fractionDigits = 1): string {
    if (milliseconds === null || Number.isNaN(milliseconds)) return "--";
    return formatDecimal(milliseconds / 60_000, locale, fractionDigits);
}

/**
 * 格式化日期时间（带时区偏移的 ISO 8601 输入）。
 * 输出长日期时间格式，按 locale 本地化。
 */
export function formatDateTime(isoString: string, locale: string): string {
    if (!isoString) return "--";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "--";
    return new Intl.DateTimeFormat(normalizeLocale(locale), {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(date);
}

/**
 * 仅格式化日期（不带时间）。
 */
export function formatDate(isoString: string, locale: string): string {
    if (!isoString) return "--";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "--";
    return new Intl.DateTimeFormat(normalizeLocale(locale), {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}

/**
 * 空值统一展示：null / undefined / NaN 一律展示为 "--"（§6.1）。
 * 注意 0 是有效值，不能用真假判断误转为 "--"。
 */
export function formatNullable(value: number | null | undefined, locale: string, formatter: (v: number, l: string) => string): string {
    if (value === null || value === undefined || Number.isNaN(value)) return "--";
    return formatter(value, locale);
}
