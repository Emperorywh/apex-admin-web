/**
 * @description ECharts 实例生命周期与 option 应用（§9.2）
 *
 * 管理 ECharts 实例、尺寸观察和销毁。
 * 容器尺寸为 0 时延迟初始化，首次成功初始化后显式触发 option 应用。
 *
 * 生命周期绑定真实容器节点（回调 ref + state），而非组件挂载：
 * 各业务图表在空数据时会以 <Empty/> 替换容器 div，节点随之卸载/重建。
 * 若绑定组件挂载（useLayoutEffect([])），组件未卸载时节点替换不会重新初始化，
 * setOption 会持续渲染进已脱离文档的旧节点，导致图表永久空白。
 *
 * 硬性要求（§9.2）：
 *   - ResizeObserver 和所有 rAF 必须在 React effect 的实际 cleanup 中清理。
 *   - 首次初始化后必须可靠执行一次 setOption。
 *   - 每个图表使用精确 ComposeOption，hook 泛型不得退化为 Record<string, unknown>。
 *   - Dashboard 图表统一 notMerge: true（§2 决策）。
 */
import { EChartsCoreOption, EChartsType } from "echarts/core";
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { echarts } from "@/pages/AnalyzeVisual/DashboardShared/echarts/registry";
import { REDUCED_MOTION_MEDIA_QUERY } from "@/pages/AnalyzeVisual/DashboardShared/model/policy";

/**
 * 管理 ECharts 实例、尺寸观察和销毁。
 * 容器尺寸为 0 时延迟初始化，首次成功初始化后显式触发 option 应用。
 * 返回回调 ref 供容器 div 挂载；节点卸载/更换时实例同步销毁重建。
 */
export function useECharts<TOption extends EChartsCoreOption>(option: TOption) {
    const chartRef = useRef<EChartsType | null>(null);
    // 容器节点入 state：节点卸载（null）/更换时驱动下方 effect 销毁并重建实例。
    // setState 身份稳定，直接担任回调 ref，消费方 <div ref={...}> 用法不变
    const [container, setContainer] = useState<HTMLDivElement | null>(null);
    // readyRevision：容器尺寸就绪后递增，触发 option effect 重新应用
    const [readyRevision, markReady] = useReducer((value: number) => value + 1, 0);

    useLayoutEffect(() => {
        if (!container) return;

        let resizeFrame = 0;
        let disposed = false;

        /**
         * 只有容器拥有有效尺寸时才创建实例。
         * 创建完成后通知 option effect，避免首次 effect 早于异步初始化导致空图。
         */
        const ensureChart = () => {
            if (disposed || chartRef.current) return;
            if (container.clientWidth === 0 || container.clientHeight === 0) return;
            chartRef.current = echarts.init(container);
            markReady();
        };

        ensureChart();

        const observer = new ResizeObserver(() => {
            ensureChart();
            window.cancelAnimationFrame(resizeFrame);
            resizeFrame = window.requestAnimationFrame(() => {
                const chart = chartRef.current;
                if (chart && !chart.isDisposed()) chart.resize();
            });
        });
        observer.observe(container);

        return () => {
            disposed = true;
            window.cancelAnimationFrame(resizeFrame);
            observer.disconnect();
            const chart = chartRef.current;
            if (chart && !chart.isDisposed()) chart.dispose();
            chartRef.current = null;
        };
    }, [container]);

    useEffect(() => {
        const chart = chartRef.current;
        if (!chart || chart.isDisposed()) return;
        // 统一 notMerge: true，避免序列缩短、主题切换时残留旧 option（§2 决策）
        // prefers-reduced-motion 命中时关闭图表动画（§9.3）
        const reducedMotion = window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches;
        chart.setOption(reducedMotion ? { ...option, animation: false } : option, { notMerge: true });
    }, [option, readyRevision]);

    return setContainer;
}
