/**
 * @description 实时看板页面（独立路由）
 *
 * 页面本体直接持有数据与轮询（§4.3）：
 *   - 挂载后立即请求一次，之后每次请求完成 5s 后再发起下一次（§4.3，无工具栏与倒计时）；
 *   - 页面隐藏时暂停轮询，恢复可见时立即刷新一次；
 *   - 请求失败按空数据降级（§15）：清空快照、仅留受控日志，后续轮询继续。
 *
 * 数据流：本组件请求数据，通过 props 传给 RealtimeDashboard 纯展示组件。
 */
import { useDocumentVisibility } from "ahooks";
import { useCallback, useEffect, useRef, useState } from "react";
import { dashboardRepository } from "@/pages/AnalyzeVisual/DashboardShared/data/HttpDashboardRepository";
import { REALTIME_POLL_INTERVAL_MS } from "@/pages/AnalyzeVisual/DashboardShared/model/policy";
import { RealtimeDashboard } from "@/pages/AnalyzeVisual/RealtimeDashboard/RealtimeDashboard";
import type { RealtimeDashboardData } from "@/pages/AnalyzeVisual/RealtimeDashboard/model/types";
import "@/pages/AnalyzeVisual/DashboardShared/echarts/registry";
import "@/pages/AnalyzeVisual/DashboardShared/index.less";

/**
 * 实时看板页面。
 */
export default function RealtimeDashboardPage() {
    const [data, setData] = useState<RealtimeDashboardData | null>(null);
    const [loading, setLoading] = useState(false);
    // 下一次轮询的定时器句柄；null 表示未调度（页面隐藏/组件卸载）
    const timerRef = useRef<number | null>(null);

    /**
     * 请求一次数据，完成后调度下一次轮询。
     * 失败按空数据降级（§15）：不展示错误态，仅留受控日志，后续轮询继续。
     */
    const doFetch = useCallback(async () => {
        setLoading(true);
        try {
            setData(await dashboardRepository.fetchRealtime());
        } catch (e) {
            setData(null);
            console.error("[RealtimeDashboard] 实时看板数据加载失败：", e);
        } finally {
            setLoading(false);
            // 请求完成后才计时下一次（§4.3）；页面隐藏时不调度，待恢复可见后再触发
            if (timerRef.current !== null) clearTimeout(timerRef.current);
            timerRef.current = null;
            if (!document.hidden) {
                timerRef.current = window.setTimeout(() => void doFetchRef.current(), REALTIME_POLL_INTERVAL_MS);
            }
        }
    }, []);

    // setTimeout 回调需要调用最新的 doFetch，用 ref 打破自引用
    const doFetchRef = useRef(doFetch);
    doFetchRef.current = doFetch;

    // 首次挂载及页面恢复可见时立即刷新一次；隐藏时取消已调度的轮询（§4.3）
    const visibility = useDocumentVisibility();
    useEffect(() => {
        if (visibility === "visible") {
            void doFetchRef.current();
        } else if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, [visibility]);

    // 卸载时清除轮询定时器
    useEffect(
        () => () => {
            if (timerRef.current !== null) clearTimeout(timerRef.current);
        },
        [],
    );

    return (
        <div className="dashboard-page">
            <RealtimeDashboard data={data} loading={loading} />
        </div>
    );
}
