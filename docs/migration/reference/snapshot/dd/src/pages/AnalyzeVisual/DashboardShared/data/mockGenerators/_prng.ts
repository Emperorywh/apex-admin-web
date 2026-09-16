/**
 * @description seeded PRNG（§11.1）
 *
 * 生成器使用项目内独立 seeded PRNG，不调用全局 Math.random()。
 * 相同输入、时钟和场景必须得到深度相等的数据。
 *
 * 使用 mulberry32 算法：速度快、分布足够均匀、可重现。
 */

/**
 * 把任意字符串哈希为 32 位无符号整数种子。
 * FNV-1a 变种，简单稳定。
 */
export function hashStringToSeed(...parts: Array<string | number>): number {
    let h = 0x811c9dc5;
    for (const part of parts) {
        const s = String(part);
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            // FNV prime
            h = Math.imul(h, 0x01000193);
        }
    }
    // 转为无符号 32 位
    return h >>> 0;
}

/**
 * mulberry32 PRNG：返回 [0,1) 区间的浮点数生成器函数。
 */
export function createPrng(seed: number): () => number {
    let a = seed >>> 0;
    return function next(): number {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * 基于 PRNG 生成 [min, max] 闭区间整数。
 */
export function randomInt(rng: () => number, min: number, max: number): number {
    return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * 基于 PRNG 生成 [min, max) 区间浮点数。
 */
export function randomFloat(rng: () => number, min: number, max: number): number {
    return rng() * (max - min) + min;
}

/**
 * 基于 PRNG 从数组中取一个元素。
 */
export function pick<T>(rng: () => number, arr: readonly T[]): T {
    return arr[Math.floor(rng() * arr.length)];
}

/**
 * 基于 PRNG 生成带偏移量的 ISO 8601 时刻字符串。
 * base 为基准时间戳（毫秒），offsetMs 为相对偏移。
 */
export function toIsoWithOffset(base: number, offsetMs: number, timezoneOffsetMinutes = -480): string {
    // 生成带 +08:00 偏移的 ISO 8601
    const ts = base + offsetMs;
    const date = new Date(ts);
    const absMin = Math.abs(timezoneOffsetMinutes);
    const sign = timezoneOffsetMinutes <= 0 ? "+" : "-";
    const hh = String(Math.floor(absMin / 60)).padStart(2, "0");
    const mm = String(absMin % 60).padStart(2, "0");
    // 使用 UTC 分量构造，再附加时区偏移
    const y = date.getUTCFullYear();
    const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    const h = String(date.getUTCHours()).padStart(2, "0");
    const mi = String(date.getUTCMinutes()).padStart(2, "0");
    const s = String(date.getUTCSeconds()).padStart(2, "0");
    return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${hh}:${mm}`;
}
