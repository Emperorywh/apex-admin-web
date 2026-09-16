/**
 * @description Dashboard mock 仓储实现（§7.3 / §11）
 *
 * 当前阶段默认注入此实现。HTTP 适配器就绪后切换为 HttpDashboardRepository。
 * repository 只负责组合生成器，不形成巨型 dashboard.ts（§8 边界规则）。
 *
 * 默认场景永不随机失败（§11.2）；空数据与错误通过显式 MockScenario 稳定复现。
 */
import type { DashboardRepository } from "@/pages/AnalyzeVisual/DashboardShared/data/DashboardRepository";
import type { DateRange } from "@/pages/AnalyzeVisual/DashboardShared/model/dateRange";
import { createDateRange, lastNDaysRange } from "@/pages/AnalyzeVisual/DashboardShared/model/dateRange";
import type { FaultAlertData, FaultDetailPage, FaultDetailPageQuery } from "@/pages/AnalyzeVisual/FaultAlert/model/types";
import type { RealtimeDashboardData } from "@/pages/AnalyzeVisual/RealtimeDashboard/model/types";
import type { TaskStatisticsData } from "@/pages/AnalyzeVisual/TaskStatisticsReport/model/types";
import { DEFAULT_RANGE_DAYS, REALTIME_LIST_MAX_ITEMS } from "@/pages/AnalyzeVisual/DashboardShared/model/policy";
import {
    DEFAULT_MOCK_SCENARIO,
    type Clock,
    type MockScenario,
    applyScenario,
    systemClock,
} from "./mockGenerators/_scenario";
import { emptyFaultAlertData, generateFaultAlertData, toFaultDetailRecord } from "./mockGenerators/faultAlert";
import { generateRealtimeDashboardData } from "./mockGenerators/realtime";
import { emptyTaskStatisticsData, generateTaskStatisticsData } from "./mockGenerators/taskStatistics";

/**
 * mock 仓储构造参数。
 *   - scenario：显式注入场景，默认成功且延迟 300ms（§17 性能基线）
 *   - clock：注入时钟用于确定性测试
 */
export interface MockDashboardRepositoryOptions {
    scenario?: MockScenario;
    clock?: Clock;
}

/**
 * Dashboard mock 仓储。
 * 实现 DashboardRepository 端口，注入生成器并应用 scenario。
 */
export class MockDashboardRepository implements DashboardRepository {
    private readonly scenario: MockScenario;
    private readonly clock: Clock;

    constructor(options: MockDashboardRepositoryOptions = {}) {
        this.scenario = options.scenario ?? DEFAULT_MOCK_SCENARIO;
        this.clock = options.clock ?? systemClock;
    }

    /**
     * mock 数据生成的固定区间：近 DEFAULT_RANGE_DAYS 个自然日。
     * 报表接口均按固定天数统计、页面不提供时间区间选择，
     * mock 统一按该默认区间生成（日粒度）。
     */
    private defaultRange(): DateRange {
        const { startDate, endDate } = lastNDaysRange(DEFAULT_RANGE_DAYS, this.clock.now());
        return createDateRange(startDate, endDate, this.clock.now());
    }

    fetchRealtime(): Promise<RealtimeDashboardData> {
        // 实时快照在 error 场景下不返回旧数据，由调用方清空（§15）
        const empty: RealtimeDashboardData = {
            snapshotAt: new Date(this.clock.now()).toISOString(),
            kpis: {
                todayTaskTotal: { current: null, baseline: null },
                todayCompletionRate: { current: null, baseline: null },
                onlineVehicleCount: 0,
                totalVehicleCount: 0,
                faultVehicleCount: { current: null, baseline: null },
                averageCompletedDurationMs: { current: null, baseline: null },
                averageHourlyCompletedCount: { current: null, baseline: null },
                fleetUtilization: { current: null, baseline: null },
                backlogCount: { current: null, baseline: null },
            },
            vehicleStatus: [],
            todayTaskTrend: [],
            openAlerts: [],
            recentCompletedTasks: [],
        };
        return applyScenario(this.scenario, empty, () => {
            const data = generateRealtimeDashboardData(this.clock.now(), this.clock);
            // 列表规模上限 100 条（§12.2）
            return {
                ...data,
                openAlerts: data.openAlerts.slice(0, REALTIME_LIST_MAX_ITEMS),
                recentCompletedTasks: data.recentCompletedTasks.slice(0, REALTIME_LIST_MAX_ITEMS),
            };
        });
    }

    // 接口签名含起止时间与车辆筛选参数；mock 仅用于开发联调，
    // 忽略这些参数、按默认区间生成（TS 方法参数更少天然兼容接口，无需声明占位形参）
    fetchTaskStatistics(): Promise<TaskStatisticsData> {
        return applyScenario(this.scenario, emptyTaskStatisticsData(), () => generateTaskStatisticsData(this.defaultRange()));
    }

    fetchFaultAlert(): Promise<FaultAlertData> {
        return applyScenario(this.scenario, emptyFaultAlertData(), () => generateFaultAlertData(this.defaultRange()));
    }

    fetchFaultDetailPage(query: FaultDetailPageQuery): Promise<FaultDetailPage> {
        return applyScenario(this.scenario, { rows: [], total: 0 }, () => {
            // 明细查询不携带时间参数，mock 按默认区间生成（与真实接口「查全部」语义对齐）
            let rows = generateFaultAlertData(this.defaultRange()).rows.map(toFaultDetailRecord);
            // 服务端筛选语义的 mock 复刻：级别 / 类型 / 状态精确匹配；
            // 来源/告警码/订单/时间等条件 mock 行无对应字段，忽略（mock 仅用于开发联调）
            if (query.level) rows = rows.filter((r) => r.level === query.level);
            if (query.alarmType) rows = rows.filter((r) => r.alarmType === query.alarmType);
            if (query.closed !== undefined) rows = rows.filter((r) => r.closed === query.closed);
            const start = (query.pageNo - 1) * query.pageSize;
            return { rows: rows.slice(start, start + query.pageSize), total: rows.length };
        });
    }
}
