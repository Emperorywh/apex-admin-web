/**
 * @description SVG 半圆仪表盘（复刻 server-monitor-dashboard.html 的 makeGauge）
 *
 *   - 半圆弧形 + 刻度线 + 双层旋转虚线环装饰，viewBox 固定 0 0 240 168
 *   - 弧形长度用 pathLength=100 + strokeDasharray 表示百分比，CSS transition 平滑过渡
 *   - 弧形颜色随严重程度档位切换（<70 蓝 / 70~89 黄 / ≥90 红），带同色辉光
 *   - 数值变化时 700ms 三次方缓动动画（rAF 驱动）
 *   - value 为 null（数据降级态）时显示 "--" 并隐藏弧形
 */
import { useEffect, useRef, useState } from "react";
import { hexA, sevOf } from "../model/policy";

export interface GaugeProps {
    /** 仪表名称（显示在弧内上方） */
    name: string;
    /** 0~100 的使用率；null 表示无数据（降级态） */
    value: number | null;
}

const CX = 120;
const CY = 142;
const ARC_D = "M28 142 A92 92 0 0 1 212 142";

/*
 * 刻度线为静态内容，模块级预生成一次即可：
 * 每 5% 一根，25% 整数倍为主刻度（更长更亮）
 */
const TICKS = Array.from({ length: 21 }, (_, i) => i * 5).map((a) => {
    const ang = Math.PI * (1 - a / 100);
    const major = a % 25 === 0;
    const r1 = major ? 76 : 79.5;
    const r2 = 83;
    return (
        <line
            key={a}
            x1={(CX + r1 * Math.cos(ang)).toFixed(1)}
            y1={(CY - r1 * Math.sin(ang)).toFixed(1)}
            x2={(CX + r2 * Math.cos(ang)).toFixed(1)}
            y2={(CY - r2 * Math.sin(ang)).toFixed(1)}
            stroke={major ? "rgba(150,190,240,.5)" : "rgba(120,160,220,.22)"}
            strokeWidth={major ? 2 : 1}
        />
    );
});

export function Gauge({ name, value }: GaugeProps) {
    // display 为缓动中的展示值；shownRef 记录当前已展示值，作为下一次缓动的起点
    const [display, setDisplay] = useState(0);
    const shownRef = useRef(0);
    const rafRef = useRef(0);

    // 数值变化时启动 700ms 三次方缓动；卸载或值变化时取消上一段动画
    useEffect(() => {
        if (value === null) return;
        const from = shownRef.current;
        const t0 = performance.now();
        const step = (t: number) => {
            const k = Math.max(0, Math.min(1, (t - t0) / 700));
            const v = from + (value - from) * (1 - Math.pow(1 - k, 3));
            shownRef.current = v;
            setDisplay(v);
            if (k < 1) rafRef.current = requestAnimationFrame(step);
        };
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(rafRef.current);
    }, [value]);

    const v = value ?? 0;
    const sev = sevOf(v);
    return (
        <svg viewBox="0 0 240 168" role="img" aria-label={name}>
            <circle className="sm-spin" cx={CX} cy={CY} r="108" />
            <circle className="sm-spin sm-rev" cx={CX} cy={CY} r="99" />
            {TICKS}
            <path className="sm-g-track" d={ARC_D} />
            <path
                className="sm-g-val"
                pathLength={100}
                d={ARC_D}
                style={{
                    strokeDasharray: `${v} 100`,
                    // 使用率过低时弧形几乎不可见，直接隐藏避免残留一小段色块
                    visibility: value !== null && v >= 0.3 ? "visible" : "hidden",
                    stroke: sev.c,
                    filter: `drop-shadow(0 0 5px ${hexA(sev.c, 0.55)})`,
                }}
            />
            <text className="sm-g-name" x={CX} y="92">
                {name}
            </text>
            <text className="sm-g-num" x={CX} y="130" textAnchor="middle">
                <tspan className="sm-v">{value === null ? "--" : display.toFixed(1)}</tspan>
                <tspan className="sm-pct" dx="5">
                    %
                </tspan>
            </text>
        </svg>
    );
}
