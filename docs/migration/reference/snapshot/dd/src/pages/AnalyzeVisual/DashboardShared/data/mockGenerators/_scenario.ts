/**
 * @description mock 场景与注入时钟（§11）
 *
 * mock 场景由 composition root 注入。
 * 测试和人工联调可稳定复现成功、空数据、业务错误和慢请求。
 * 不在生产 UI 中暴露 mock 场景开关。
 */
import type { DashboardDataErrorCode } from "@/pages/AnalyzeVisual/DashboardShared/data/DashboardRepository";

/**
 * 注入时钟接口，便于确定性测试与可重现 mock（§11.1）。
 * 生产实现直接返回 Date.now()。
 */
export interface Clock {
    now(): number;
}

/** 默认系统时钟。 */
export const systemClock: Clock = {
    now: () => Date.now(),
};

/**
 * mock 场景由 composition root 注入。
 * 默认场景永不随机失败（§11.2）。
 */
export type MockScenario =
    | { mode: "success"; latencyMs: number }
    | { mode: "empty"; latencyMs: number }
    | { mode: "error"; latencyMs: number; errorCode: DashboardDataErrorCode };

/** 默认成功场景（300ms 延迟，§17 性能基线） */
export const DEFAULT_MOCK_SCENARIO: MockScenario = {
    mode: "success",
    latencyMs: 300,
};

/**
 * 模拟延迟 + 场景判定。
 * 根据 scenario 决定是否 reject、是否返回空数据。
 */
export function applyScenario<T>(
    scenario: MockScenario,
    emptyData: T,
    buildSuccess: () => T,
): Promise<T> {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (scenario.mode === "error") {
                // 延迟引入避免循环依赖：场景错误码已传入
                import("@/pages/AnalyzeVisual/DashboardShared/data/DashboardRepository").then(
                    ({ DashboardDataError }) => {
                        reject(new DashboardDataError(scenario.errorCode));
                    },
                );
                return;
            }
            if (scenario.mode === "empty") {
                resolve(emptyData);
                return;
            }
            resolve(buildSuccess());
        }, scenario.latencyMs);
    });
}
