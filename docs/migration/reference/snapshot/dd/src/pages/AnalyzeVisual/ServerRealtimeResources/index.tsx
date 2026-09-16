/**
 * @description 服务器实时资源监控大屏（复刻自 server-monitor-dashboard.html）
 *
 * 页面形态（与「库位看板」相同的双路由模式）：
 *   - 菜单入口是嵌套路由 /analyze-visual/server-resource（redirect 别名，控制菜单展示与权限），
 *     点击后 replace 重定向到本页；浏览器返回不会形成重定向循环；
 *   - 本页挂在顶层 layout:false 路由 /analyze-visual/server-resource-monitor 下，
 *     不包 ProLayout 布局壳，是真正的全屏大屏；右上角「返回」按钮退出（浏览器返回亦可）。
 *
 * 数据流（页面本体直接持有，props 下传给纯展示子组件）：
 *   - 挂载后立即请求一次 /fms/v1/serverResource/current，之后每次请求完成 2s 再发起下一次；
 *   - 页面隐藏时暂停轮询，恢复可见时立即刷新一次（与实时看板同一策略）；
 *   - 请求失败按空数据降级：快照置 null（仪表/指标卡/磁盘显示占位），徽标切「连接失败」，
 *     已采集的真实趋势历史保留但停止追加，恢复后自动切回实时。
 *
 * 与复刻源的差异：
 *   - 接口不可达时不切演示数据（生产环境展示假数据有误导风险）；
 *   - 数字字体不引入 Google Fonts 外链（内网环境不可达），靠字体栈回退。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useDocumentVisibility } from "ahooks";
import { history, useModel } from "@umijs/max";
import { getServerResourceCurrent } from "@/api";
import { useI18n } from "@/hooks/useI18n";
import type { ServerResourceSnapshot } from "@/types/AnalyzeVisual/ServerResource";
import { getFirstAccessiblePath } from "@/utils/permission";
import { DataTableOverlay } from "./components/DataTableOverlay";
import { DiskList } from "./components/DiskList";
import { Gauge } from "./components/Gauge";
import type { TrendSeries } from "./components/TrendChart";
import { TrendChart } from "./components/TrendChart";
import type { TipState, TrendPoint } from "./model/policy";
import { MAX_HIST, POLL_MS, SERIES, normRate, pad2, sevOf } from "./model/policy";
import "./index.less";

/** 数据连接状态：连接中 / 实时 / 连接失败（替代复刻源的 demo 演示档位） */
type ConnMode = "wait" | "live" | "error";

/**
 * 头部时钟（独立组件 + 自有 1s 定时器，避免整屏每秒重渲染）。
 * 日期用 Intl 按当前语言格式化；时间固定 24 小时制 HH:mm:ss（大屏惯例）。
 */
function HeaderClock() {
    const { locale } = useI18n();
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    const dateText = useMemo(
        () =>
            new Intl.DateTimeFormat(locale, {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
            }).format(now),
        [locale, now],
    );
    return (
        <div className="sm-clock">
            <div className="sm-date">{dateText}</div>
            <div className="sm-time sm-num">
                {pad2(now.getHours())}:{pad2(now.getMinutes())}:{pad2(now.getSeconds())}
            </div>
        </div>
    );
}

export default function ServerRealtimeResources() {
    const { t } = useI18n();
    const { initialState } = useModel("@@initialState");

    /** 最近一次成功快照；null 表示尚未成功或处于连接失败降级态 */
    const [snapshot, setSnapshot] = useState<ServerResourceSnapshot | null>(null);
    const [mode, setMode] = useState<ConnMode>("wait");
    /** 趋势历史（客户端逐次采样累积，最多 MAX_HIST 点）；失败时不追加 */
    const [hist, setHist] = useState<TrendPoint[]>([]);
    const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
    /** 页面级悬浮提示（趋势图与磁盘行共用），null 表示隐藏 */
    const [tip, setTip] = useState<TipState | null>(null);
    const [tableOpen, setTableOpen] = useState(false);
    // 下一次轮询的定时器句柄；null 表示未调度（页面隐藏/组件卸载）
    const timerRef = useRef<number | null>(null);
    /*
     * 组件存活标记：请求在卸载后才完成时，finally 分支不得再调度下一次轮询，
     * 否则离开页面后轮询永远停不掉（每 2s 一次的空转请求）
     */
    const mountedRef = useRef(true);

    /**
     * 请求一次快照，完成后调度下一次轮询。
     * 失败按空数据降级：快照置 null、徽标切连接失败，仅留受控日志，后续轮询继续。
     */
    const doFetch = useCallback(async () => {
        try {
            const res = await getServerResourceCurrent();
            // HTTP 成功约定（与看板仓库层同口径）：code === 200 且 message === "success"
            if (res?.code !== 200 || res?.message !== "success" || !res.data) {
                throw new Error(`响应异常：code=${res?.code} message=${res?.message}`);
            }
            const d = res.data;
            setSnapshot(d);
            setMode("live");
            const now = Date.now();
            setLastSuccessAt(now);
            setHist((prev) => {
                const next = [
                    ...prev,
                    {
                        t: now,
                        cpu: normRate(d.systemCpuLoad),
                        mem: normRate(d.systemMemoryUsageRate),
                        jvm: normRate(d.jvmHeapUsageRate),
                    },
                ];
                if (next.length > MAX_HIST) next.shift();
                return next;
            });
        } catch (e) {
            setSnapshot(null);
            setMode("error");
            console.error("[ServerRealtimeResources] 服务器资源数据加载失败：", e);
        } finally {
            // 组件已卸载：不再调度下一次轮询（卸载时的清理已停掉定时器）
            if (!mountedRef.current) return;
            // 请求完成后才计时下一次；页面隐藏时不调度，待恢复可见后再触发
            if (timerRef.current !== null) clearTimeout(timerRef.current);
            timerRef.current = null;
            if (!document.hidden) {
                timerRef.current = window.setTimeout(() => void doFetchRef.current(), POLL_MS);
            }
        }
    }, []);

    // setTimeout 回调需要调用最新的 doFetch，用 ref 打破自引用
    const doFetchRef = useRef(doFetch);
    doFetchRef.current = doFetch;

    // 首次挂载及页面恢复可见时立即刷新一次；隐藏时取消已调度的轮询
    const visibility = useDocumentVisibility();
    useEffect(() => {
        if (visibility === "visible") {
            void doFetchRef.current();
        } else if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, [visibility]);

    // 卸载时清除轮询定时器并标记组件已销毁
    useEffect(
        () => () => {
            mountedRef.current = false;
            if (timerRef.current !== null) clearTimeout(timerRef.current);
        },
        [],
    );

    /* ---------- 悬浮提示：内容随鼠标移动更新，useLayoutEffect 中测量并做视口边界翻转 ---------- */
    const tipRef = useRef<HTMLDivElement>(null);
    const [tipPos, setTipPos] = useState({ left: 0, top: 0 });
    useLayoutEffect(() => {
        if (!tip || !tipRef.current) return;
        const r = tipRef.current.getBoundingClientRect();
        let left = tip.x + 16;
        let top = tip.y + 14;
        if (left + r.width > window.innerWidth - 8) left = tip.x - r.width - 12;
        if (top + r.height > window.innerHeight - 8) top = tip.y - r.height - 10;
        setTipPos({ left, top });
    }, [tip]);

    const showTip = useCallback((x: number, y: number, title: string, rows: TipState["rows"]) => {
        setTip({ x, y, title, rows });
    }, []);
    const hideTip = useCallback(() => setTip(null), []);

    /* ---------- 派生展示值 ---------- */
    const cpu = snapshot ? normRate(snapshot.systemCpuLoad) : null;
    const mem = snapshot ? normRate(snapshot.systemMemoryUsageRate) : null;
    const jvm = snapshot ? normRate(snapshot.jvmHeapUsageRate) : null;
    const disks = snapshot?.disks ?? null;
    const diskAvg =
        disks && disks.length ? disks.reduce((s, x) => s + normRate(x.usageRate), 0) / disks.length : 0;

    // 趋势序列定义（颜色固定，名称随语言变化）；useMemo 避免鼠标移动引发的无效重绘
    const trendSeries: TrendSeries[] = useMemo(
        () => [
            { key: SERIES[0].key, color: SERIES[0].color, name: t("CPU 使用率") },
            { key: SERIES[1].key, color: SERIES[1].color, name: t("内存使用率") },
            { key: SERIES[2].key, color: SERIES[2].color, name: t("JVM 堆使用率") },
        ],
        [t],
    );

    const fmtPct = (v: number | null) => (v === null ? "—" : v.toFixed(1) + "%");

    /** 严重程度状态点（仪表底部 chip 用）；无数据时显示暗色圆点与占位符 */
    const renderChip = (v: number | null) => {
        const sev = v === null ? null : sevOf(v);
        return (
            <span className="sm-mini-v sm-chip">
                <i
                    style={
                        sev
                            ? { background: sev.dot, boxShadow: `0 0 7px ${sev.dot}` }
                            : { background: "#3a4a6b" }
                    }
                />
                <em style={{ fontStyle: "normal" }}>{sev ? t(sev.t) : "—"}</em>
            </span>
        );
    };

    const trendFootSource =
        mode === "live" ? t("实时接口数据") : mode === "error" ? t("连接失败，等待重试") : t("连接中…");

    /*
     * 返回上一页：菜单别名是 replace 重定向，history.back 会越过别名直达前一页，无循环。
     * 无历史记录（收藏夹/直开 URL）时回退到首个可访问菜单页。
     */
    const handleBack = () => {
        if (window.history.length > 1) {
            window.history.back();
            return;
        }
        history.push(getFirstAccessiblePath(initialState?.permissionsTree, initialState?.username));
    };

    return (
        <div className="server-monitor-screen">
            {/* ================= 头部 ================= */}
            <header className="sm-header">
                <div className="sm-h-side">
                    <HeaderClock />
                </div>
                <div className="sm-h-center">
                    <div className="sm-wing sm-left" />
                    <div className="sm-title-box">
                        <h1>{t("服务器资源监控大屏")}</h1>
                        <div className="sm-subtitle">SERVER RESOURCE MONITORING PLATFORM</div>
                    </div>
                    <div className="sm-wing sm-right" />
                </div>
                <div className="sm-h-side sm-h-right">
                    <button
                        className="sm-ghost-btn"
                        title={t("以表格形式查看当前快照（无障碍视图）")}
                        onClick={() => setTableOpen(true)}
                    >
                        {t("数据表格")}
                    </button>
                    <div className={`sm-badge sm-${mode}`}>
                        <i />
                        <span>
                            {mode === "live" ? t("实时数据") : mode === "error" ? t("连接失败") : t("连接中…")}
                        </span>
                    </div>
                    <button className="sm-ghost-btn" onClick={handleBack}>
                        {t("返回")}
                    </button>
                </div>
            </header>

            {/* ================= 主体 ================= */}
            <main className="sm-main">
                {/* 左列：CPU + 内存 */}
                <section className="sm-col">
                    <div className="sm-panel">
                        <div className="sm-panel-title">{t("CPU 使用率")}</div>
                        <div className="sm-gauge-wrap">
                            <Gauge name={t("CPU 使用率")} value={cpu} />
                        </div>
                        <div className="sm-gauge-foot">
                            <div className="sm-mini">
                                <span className="sm-mini-k">{t("逻辑核心")}</span>
                                <span className="sm-mini-v">{snapshot?.cpuCores ?? "—"}</span>
                            </div>
                            <div className="sm-mini">
                                <span className="sm-mini-k">{t("负载状态")}</span>
                                {renderChip(cpu)}
                            </div>
                        </div>
                    </div>
                    <div className="sm-panel">
                        <div className="sm-panel-title">{t("系统内存")}</div>
                        <div className="sm-gauge-wrap">
                            <Gauge name={t("内存使用率")} value={mem} />
                        </div>
                        <div className="sm-gauge-foot">
                            <div className="sm-mini">
                                <span className="sm-mini-k">{t("总内存")}</span>
                                <span className="sm-mini-v">{snapshot?.systemMemoryTotal ?? "—"}</span>
                            </div>
                            <div className="sm-mini">
                                <span className="sm-mini-k">{t("已用")}</span>
                                <span className="sm-mini-v">{snapshot?.systemMemoryUsed ?? "—"}</span>
                            </div>
                            <div className="sm-mini">
                                <span className="sm-mini-k">{t("空闲")}</span>
                                <span className="sm-mini-v">{snapshot?.systemMemoryFree ?? "—"}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 中列：指标卡 + 趋势 */}
                <section className="sm-col">
                    <div className="sm-stat-row">
                        <div className="sm-tile">
                            <div className="sm-tile-k">{t("CPU 核心数")}</div>
                            <div className="sm-tile-v">
                                {snapshot?.cpuCores != null ? t("{count} 核", { count: snapshot.cpuCores }) : "—"}
                            </div>
                            <div className="sm-tile-s">{t("逻辑处理器数量")}</div>
                        </div>
                        <div className="sm-tile">
                            <div className="sm-tile-k">{t("系统内存总量")}</div>
                            <div className="sm-tile-v">{snapshot?.systemMemoryTotal ?? "—"}</div>
                            <div className="sm-tile-s">
                                {snapshot
                                    ? t("已用 {used} · 空闲 {free}", {
                                          used: snapshot.systemMemoryUsed ?? "—",
                                          free: snapshot.systemMemoryFree ?? "—",
                                      })
                                    : "—"}
                            </div>
                        </div>
                        <div className="sm-tile">
                            <div className="sm-tile-k">{t("JVM 堆最大内存")}</div>
                            <div className="sm-tile-v">{snapshot?.jvmHeapMax ?? "—"}</div>
                            <div className="sm-tile-s">
                                {snapshot ? t("已用 {used}", { used: snapshot.jvmHeapUsed ?? "—" }) : "—"}
                            </div>
                        </div>
                        <div className="sm-tile">
                            <div className="sm-tile-k">{t("磁盘分区")}</div>
                            <div className="sm-tile-v">
                                {disks ? t("{count} 个", { count: disks.length }) : "—"}
                            </div>
                            <div className="sm-tile-s">
                                {disks && disks.length
                                    ? t("平均使用率 {value} %", { value: diskAvg.toFixed(1) })
                                    : t("暂无分区数据")}
                            </div>
                        </div>
                    </div>
                    <div className="sm-panel sm-trend-panel">
                        <div className="sm-panel-title">
                            {t("资源使用趋势")}
                            <div className="sm-legend">
                                {trendSeries.map((s, i) => (
                                    <span className="sm-lg" key={s.key}>
                                        <i
                                            className="sm-lg-line"
                                            style={{ "--sm-c": s.color } as CSSProperties}
                                        />
                                        {/* 图例行内只放短名 + 当前值；完整名称在悬浮提示中展示 */}
                                        {i === 0 ? "CPU" : i === 1 ? t("内存") : "JVM"}
                                        <b>{fmtPct(i === 0 ? cpu : i === 1 ? mem : jvm)}</b>
                                    </span>
                                ))}
                            </div>
                        </div>
                        <TrendChart
                            points={hist}
                            series={trendSeries}
                            collectingText={t("正在采集数据…")}
                            onTip={showTip}
                            onTipHide={hideTip}
                        />
                        <div className="sm-trend-foot">
                            {t("每 {seconds} 秒采样 · 窗口约 {minutes} 分钟 · {source} · 悬停查看逐点数值", {
                                seconds: POLL_MS / 1000,
                                minutes: Math.round((MAX_HIST * POLL_MS) / 60000),
                                source: trendFootSource,
                            })}
                        </div>
                    </div>
                </section>

                {/* 右列：JVM + 磁盘 */}
                <section className="sm-col">
                    <div className="sm-panel">
                        <div className="sm-panel-title">{t("JVM 堆内存")}</div>
                        <div className="sm-gauge-wrap">
                            <Gauge name={t("JVM 堆使用率")} value={jvm} />
                        </div>
                        <div className="sm-gauge-foot">
                            <div className="sm-mini">
                                <span className="sm-mini-k">{t("堆最大")}</span>
                                <span className="sm-mini-v">{snapshot?.jvmHeapMax ?? "—"}</span>
                            </div>
                            <div className="sm-mini">
                                <span className="sm-mini-k">{t("堆已用")}</span>
                                <span className="sm-mini-v">{snapshot?.jvmHeapUsed ?? "—"}</span>
                            </div>
                            <div className="sm-mini">
                                <span className="sm-mini-k">{t("状态")}</span>
                                {renderChip(jvm)}
                            </div>
                        </div>
                    </div>
                    <div className="sm-panel sm-panel-disk">
                        <div className="sm-panel-title">{t("磁盘分区")}</div>
                        <DiskList disks={disks} onTip={showTip} onTipHide={hideTip} />
                    </div>
                </section>
            </main>

            {/* 全局悬浮提示（趋势图与磁盘行共用） */}
            {tip && (
                <div className="sm-gtip" ref={tipRef} style={{ left: tipPos.left, top: tipPos.top }}>
                    <div className="sm-gt-t">{tip.title}</div>
                    {tip.rows.map((r, i) => (
                        <div className="sm-gt-r" key={i}>
                            <span className="sm-gt-k" style={{ background: r.color }} />
                            <span className="sm-gt-n">{r.name}</span>
                            <span className="sm-gt-v">{r.value}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* 表格视图（数据的无障碍等价呈现） */}
            <DataTableOverlay
                open={tableOpen}
                snapshot={snapshot}
                lastSuccessAt={lastSuccessAt}
                sourceText={mode === "live" ? t("实时接口") : t("连接失败")}
                onClose={() => setTableOpen(false)}
            />
        </div>
    );
}
